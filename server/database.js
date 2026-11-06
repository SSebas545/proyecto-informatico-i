const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Igual que en index.js: el .env vive al lado de este archivo, no en el cwd
// del proceso. Asi tambien funciona el comando de inicializacion del README.
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Crear pool de conexiones
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'libreria_db',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  // Si la base deja de responder, el request no puede quedarse esperando
  // para siempre. connectTimeout corta el handshake de una conexion nueva y
  // queueLimit corta la cola cuando ya hay demasiadas peticiones esperando
  // una conexion libre.
  //
  // Ojo: mysql2 NO soporta `acquireTimeout` (esa opcion es del driver
  // `mysql`). Pasarla solo emitia "Ignoring invalid configuration option" y
  // no limitaba nada; en una version futura va a ser un error. Medido con
  // mysql2 3.24.6.
  connectTimeout: 5000,
  queueLimit: Number(process.env.DB_QUEUE_LIMIT) || 50,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Helper para ejecutar consultas.
// Devuelve [filas, campos], igual que mysql2, que es el contrato que espera
// el resto del codigo: `const [filas] = await query(...)` da un ARRAY de filas
// en los SELECT y un ResultSetHeader en los INSERT/UPDATE/DELETE.
//
// Ojo: devolver solo `rows` rompia todas las rutas. `const [filas] = rows`
// destructuraba la PRIMERA FILA en vez del array (entonces `filas.length`
// era undefined y `filas[0].password` reventaba con TypeError), y en los
// INSERT destructuraba un ResultSetHeader, que no es iterable.
async function query(sql, params = [], conn = null) {
  const ejecutor = conn || pool;
  return ejecutor.execute(sql, params);
}

// Ejecuta fn dentro de una transaccion. Si fn lanza, se hace rollback y el
// error se vuelve a propagar. Sirve para que un pedido no deje el stock
// descontado a medias si algo falla en el medio.
async function conTransaccion(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (error) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      // Si la conexion ya estaba caida el rollback falla: el error original
      // es el que importa.
      console.error('No se pudo hacer rollback:', rollbackError.message);
    }
    throw error;
  } finally {
    conn.release();
  }
}

// Cierra el pool de conexiones. Se usa en el apagado ordenado del servidor.
async function cerrarPool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  conTransaccion,
  cerrarPool,
  
  // Inicializar base de datos (crear tablas si no existen)
  async inicializar() {
    // Tabla de usuarios
    await query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol ENUM('usuario', 'gerente') DEFAULT 'usuario',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Tabla de categorías
    await query(`
      CREATE TABLE IF NOT EXISTS categorias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL UNIQUE
      )
    `);
    
    // Tabla de libros
    await query(`
      CREATE TABLE IF NOT EXISTS libros (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(200) NOT NULL,
        autor VARCHAR(100) NOT NULL,
        descripcion TEXT,
        precio DECIMAL(10, 2) NOT NULL,
        stock INT DEFAULT 0,
        categoria_id INT,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
      )
    `);
    
    // Tabla de carritos
    await query(`
      CREATE TABLE IF NOT EXISTS carritos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);
    
    // Tabla de items del carrito
    await query(`
      CREATE TABLE IF NOT EXISTS carrito_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        carrito_id INT,
        libro_id INT,
        cantidad INT DEFAULT 1,
        precio DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (carrito_id) REFERENCES carritos(id) ON DELETE CASCADE,
        FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE CASCADE
      )
    `);
    
    // Tabla de pedidos
    await query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT,
        total DECIMAL(10, 2) NOT NULL,
        estado ENUM('pendiente', 'pagado', 'cancelado') DEFAULT 'pendiente',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      )
    `);
    
    // Tabla de items de pedido
    await query(`
      CREATE TABLE IF NOT EXISTS pedido_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pedido_id INT,
        libro_id INT,
        cantidad INT NOT NULL,
        precio DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
        FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE CASCADE
      )
    `);
    
    // Insertar categorías por defecto si no existen
    const categoriasDefault = ['Ficción', 'Arte', 'Tecnología', 'Ingeniería', 'Infantil', 'Terror', 'Deportes', 'Otros'];
    for (const cat of categoriasDefault) {
      await query(`INSERT IGNORE INTO categorias (nombre) VALUES (?)`, [cat]);
    }
    
    // Insertar usuario gerente por defecto si no existe.
    // query() devuelve [filas, campos], no las filas: sin destructurar, el
    // .length de abajo medía 2 (filas + campos) y el INSERT nunca se hacia.
    // En una base nueva el sistema quedaba sin ningun usuario y no se podia
    // entrar. Medido: 2 SELECT, 0 INSERT.
    const [adminExistente] = await query('SELECT id FROM usuarios WHERE email = ?', ['admin@libreria.com']);
    if (adminExistente.length === 0) {
      const passwordHasheada = await bcrypt.hash('12345678', 10);
      await query(
        'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
        ['Admin', 'admin@libreria.com', passwordHasheada, 'gerente']
      );
    }
    
    // Insertar usuario de prueba por defecto
    const [usuarioExistente] = await query('SELECT id FROM usuarios WHERE email = ?', ['usuario@test.com']);
    if (usuarioExistente.length === 0) {
      const passwordHasheada = await bcrypt.hash('12345678', 10);
      await query(
        'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
        ['Usuario Test', 'usuario@test.com', passwordHasheada, 'usuario']
      );
    }
    
    console.log('Base de datos inicializada correctamente');
  }
};