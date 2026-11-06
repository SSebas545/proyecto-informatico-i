const path = require('path');

// El .env se busca junto a este archivo, no en el cwd del proceso. Con
// `require('dotenv').config()` a secas, arrancar con systemd, pm2 o
// `node /ruta/server/index.js` desde otra carpeta no encontraba el .env y el
// servidor moría con "Falta JWT_SECRET" (medido: rc=1).
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { query, inicializar, conTransaccion, cerrarPool } = require('./database');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// El secreto de JWT es obligatorio. Con un valor por defecto hardcodeado
// cualquiera que lea el codigo puede firmar un token de gerente.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('Falta JWT_SECRET en el .env: el servidor no puede arrancar.');
  process.exit(1);
}

// Error de una peticion con un status HTTP asociado. Dentro de una
// transaccion hay que abortar con una excepcion (y no con un return) para
// que se dispare el rollback.
class ErrorDePeticion extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.name = 'ErrorDePeticion';
    this.status = status;
  }
}

// Los errores de MySQL pueden ser un AggregateError (varias conexiones
// fallaron a la vez) y ahi err.message viene vacio: hay que bajar a los
// errores individuales para saber que paso de verdad.
function describirError(error) {
  if (!error) return 'error desconocido';
  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors.map(e => e.message).join(' | ');
  }
  return error.message || error.code || String(error);
}

// Middleware
// CORS: con CORS_ORIGIN se restringe a los origenes del frontend (en
// produccion hay que ponerlo). Sin esa variable se permite cualquier origen,
// que es lo unico razonable en desarrollo.
const origenesPermitidos = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : true;
app.use(cors({ origin: origenesPermitidos }));
app.use(express.json());

// Express 5 deja req.body en undefined cuando la peticion no trae un body
// JSON parseable (por ejemplo, si no viene Content-Type: application/json).
// Sin esto, cualquier handler que desestructure req.body revienta con un
// TypeError y responde 500.
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

// Inicializar base de datos al iniciar (errores no fatales en desarrollo sin MySQL)
inicializar().catch(err => {
  console.error('Error al inicializar la base de datos:', describirError(err));
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    console.error(
      `No hay MySQL respondiendo en ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}. ` +
      'El servidor arranca, pero toda consulta a la base va a fallar.'
    );
  }
});

// GET /api/salud - Estado del servidor y de la base de datos.
// Sirve como health check: si la base no responde, devuelve 503 y no 200.
app.get('/api/salud', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ estado: 'ok', base_de_datos: 'ok' });
  } catch (error) {
    res.status(503).json({ estado: 'error', base_de_datos: 'sin respuesta', detalle: describirError(error) });
  }
});

// Rutas de autenticación

// POST /api/auth/login - Iniciar sesión
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Email y password son requeridos' });
    }
    
    const [usuarios] = await query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (usuarios.length === 0) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }
    
    const passwordValido = await bcrypt.compare(password, usuarios[0].password);
    if (!passwordValido) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }
    
    const token = jwt.sign(
      { id: usuarios[0].id, rol: usuarios[0].rol, email: usuarios[0].email, nombre: usuarios[0].nombre },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuarios[0].id,
        nombre: usuarios[0].nombre,
        email: usuarios[0].email,
        rol: usuarios[0].rol
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// POST /api/auth/register - Registrarse
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ mensaje: 'Todos los campos son requeridos' });
    }
    if (!/^\S+@\S+\.\S+$/.test(String(email))) {
      return res.status(400).json({ mensaje: 'El email no tiene un formato válido' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres' });
    }
    
    // El rol lo decide el sistema, nunca el cliente. Si se tomara del body,
    // cualquiera que se registre podria pedir rol 'gerente' y obtener el
    // CRUD de libros y las estadisticas del negocio.
    const rol = 'usuario';
    
    // Verificar si el usuario ya existe
    const [existente] = await query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existente.length > 0) {
      return res.status(409).json({ mensaje: 'El email ya está registrado' });
    }
    
    const passwordHasheado = await bcrypt.hash(password, 10);
    
    const [result] = await query(
      'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
      [nombre, email, passwordHasheado, rol]
    );
    
    const token = jwt.sign(
      { id: result.insertId, rol, email, nombre },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      token,
      usuario: {
        id: result.insertId,
        nombre,
        email,
        rol
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// Middleware de autenticación
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer <token>"
  
  if (!token) {
    return res.status(401).json({ mensaje: 'Token requerido' });
  }
  
  // JWT_SECRET ya se validó al arrancar: no hay fallback hardcodeado, que
  // sería una puerta trasera si alguien lograra dejar la variable vacía.
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ mensaje: 'Token inválido' });
    }
    req.user = user;
    next();
  });
}

// Un usuario solo puede ver y modificar su propio carrito; el gerente puede
// ver cualquiera. Sin esta comprobacion, cualquiera con un token valido
// pasaba el usuario_id de otro en la URL y le modificaba o vaciaba el
// carrito (el comentario del handler prometia una verificacion que no
// estaba).
function puedeVerCarritoDe(req, usuarioId) {
  if (req.user.rol === 'gerente') return true;
  return Number(usuarioId) === Number(req.user.id);
}

// Rutas de libros

// GET /api/libros - Obtener todos los libros con filtros opcionales
app.get('/api/libros', async (req, res) => {
  try {
    const { categoria, stock, autor, search } = req.query;
    let sql = 'SELECT l.*, c.nombre as categoria_nombre FROM libros l LEFT JOIN categorias c ON l.categoria_id = c.id WHERE 1=1';
    const params = [];
    
    if (categoria) {
      sql += ' AND c.nombre = ?';
      params.push(categoria);
    }
    
    if (stock === 'en') {
      sql += ' AND l.stock > 0';
    } else if (stock === 'sin') {
      sql += ' AND l.stock = 0';
    }
    
    if (autor) {
      sql += ' AND l.autor LIKE ?';
      params.push(`%${autor}%`);
    }
    
    if (search) {
      sql += ' AND (l.titulo LIKE ? OR l.autor LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    sql += ' ORDER BY l.titulo ASC';
    
    const [libros] = await query(sql, params);
    res.json(libros);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// GET /api/libros/:id - Obtener un libro por ID
app.get('/api/libros/:id', async (req, res) => {
  try {
    const [libros] = await query(
      'SELECT l.*, c.nombre as categoria_nombre FROM libros l LEFT JOIN categorias c ON l.categoria_id = c.id WHERE l.id = ?',
      [req.params.id]
    );
    if (libros.length === 0) {
      return res.status(404).json({ mensaje: 'Libro no encontrado' });
    }
    res.json(libros[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// POST /api/libros - Crear un nuevo libro (gerente solo)
app.post('/api/libros', autenticarToken, async (req, res) => {
  try {
    if (req.user.rol !== 'gerente') {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }
    
    const { titulo, autor, descripcion, precio, stock, categoria_id } = req.body;
    if (!titulo || !autor || precio === undefined || precio === null || precio === '') {
      return res.status(400).json({ mensaje: 'Título, autor y precio son requeridos' });
    }
    
    // Precio y stock se validan como numeros: antes el parseFloat de un
    // texto dejaba NaN y se terminaba guardando NaN en la base.
    const precioNumero = Number(precio);
    if (!Number.isFinite(precioNumero) || precioNumero < 0) {
      return res.status(400).json({ mensaje: 'El precio debe ser un número mayor o igual a 0' });
    }
    const stockNumero = Number(stock ?? 0);
    if (!Number.isInteger(stockNumero) || stockNumero < 0) {
      return res.status(400).json({ mensaje: 'El stock debe ser un número entero mayor o igual a 0' });
    }
    
    const [categoria] = await query('SELECT id FROM categorias WHERE id = ?', [categoria_id]);
    
    const [result] = await query(
      'INSERT INTO libros (titulo, autor, descripcion, precio, stock, categoria_id) VALUES (?, ?, ?, ?, ?, ?)',
      [titulo, autor, descripcion || '', precioNumero, stockNumero, categoria_id || null]
    );
    
    res.status(201).json({
      mensaje: 'Libro creado exitosamente',
      libro: { id: result.insertId, titulo, autor, descripcion, precio: precioNumero, stock: stockNumero, categoria_id }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// PUT /api/libros/:id - Actualizar un libro (gerente solo)
app.put('/api/libros/:id', autenticarToken, async (req, res) => {
  try {
    if (req.user.rol !== 'gerente') {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }
    
    const { titulo, autor, descripcion, precio, stock, categoria_id } = req.body;
    if (!titulo || !autor || precio === undefined || precio === null || precio === '') {
      return res.status(400).json({ mensaje: 'Título, autor y precio son requeridos' });
    }
    
    // Mismo criterio que en el alta: nada de NaN en la base.
    const precioNumero = Number(precio);
    if (!Number.isFinite(precioNumero) || precioNumero < 0) {
      return res.status(400).json({ mensaje: 'El precio debe ser un número mayor o igual a 0' });
    }
    const stockNumero = Number(stock ?? 0);
    if (!Number.isInteger(stockNumero) || stockNumero < 0) {
      return res.status(400).json({ mensaje: 'El stock debe ser un número entero mayor o igual a 0' });
    }
    
    const [result] = await query(
      'UPDATE libros SET titulo = ?, autor = ?, descripcion = ?, precio = ?, stock = ?, categoria_id = ? WHERE id = ?',
      [titulo, autor, descripcion || '', precioNumero, stockNumero, categoria_id || null, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Libro no encontrado' });
    }
    
    res.json({ mensaje: 'Libro actualizado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// DELETE /api/libros/:id - Eliminar un libro (gerente solo)
app.delete('/api/libros/:id', autenticarToken, async (req, res) => {
  try {
    if (req.user.rol !== 'gerente') {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }
    
    const [result] = await query('DELETE FROM libros WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Libro no encontrado' });
    }
    
    res.json({ mensaje: 'Libro eliminado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// GET /api/categorias - Obtener todas las categorías
app.get('/api/categorias', async (req, res) => {
  try {
    const [categorias] = await query('SELECT * FROM categorias ORDER BY nombre');
    res.json(categorias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// POST /api/categorias - Agregar nueva categoría (gerente solo)
// CU-15: Agregar Categorías
app.post('/api/categorias', autenticarToken, async (req, res) => {
  try {
    if (req.user.rol !== 'gerente') {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }
    
    const { nombre } = req.body;
    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre de la categoría es requerido' });
    }
    
    // Verificar que no exista ya una categoría con ese nombre
    const [existente] = await query('SELECT id FROM categorias WHERE nombre = ?', [nombre]);
    if (existente.length > 0) {
      return res.status(409).json({ mensaje: 'Ya existe una categoría con ese nombre' });
    }
    
    const [result] = await query(
      'INSERT INTO categorias (nombre) VALUES (?)',
      [nombre]
    );
    
    res.status(201).json({
      mensaje: 'Categoría agregada exitosamente',
      categoria: { id: result.insertId, nombre }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// Rutas de carrito

// GET /api/carrito/:usuario_id - Obtener carrito de un usuario
app.get('/api/carrito/:usuario_id', autenticarToken, async (req, res) => {
  try {
    // Verificar que el usuario sea el dueño del carrito o sea gerente
    if (!puedeVerCarritoDe(req, req.params.usuario_id)) {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }
    
    const [carrito] = await query(
      'SELECT c.*, u.rol FROM carritos c JOIN usuarios u ON c.usuario_id = u.id WHERE c.usuario_id = ?',
      [req.params.usuario_id]
    );
    
    if (carrito.length === 0) {
      return res.json({ items: [], total: 0 });
    }
    
    // Obtener items del carrito
    const [items] = await query(
      'SELECT ci.*, l.titulo, l.autor, l.precio as precio_libro FROM carrito_items ci JOIN libros l ON ci.libro_id = l.id WHERE ci.carrito_id = ?',
      [carrito[0].id]
    );
    
    const total = items.reduce((sum, item) => sum + (item.precio_libro * item.cantidad), 0);
    
    res.json({
      carrito_id: carrito[0].id,
      usuario_id: carrito[0].usuario_id,
      items,
      total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// POST /api/carrito/:usuario_id - Agregar item al carrito
app.post('/api/carrito/:usuario_id', autenticarToken, async (req, res) => {
  try {
    // Verificar que el usuario sea el dueño del carrito o sea gerente
    if (!puedeVerCarritoDe(req, req.params.usuario_id)) {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }
    
    const { libro_id, cantidad } = req.body;
    if (!libro_id) {
      return res.status(400).json({ mensaje: 'ID de libro es requerido' });
    }
    
    // La cantidad tiene que ser un entero >= 1. Sin esta validacion, una
    // cantidad no numerica llegaba como NaN a la columna cantidad.
    const cantidadPedida = Number(cantidad ?? 1);
    if (!Number.isInteger(cantidadPedida) || cantidadPedida < 1) {
      return res.status(400).json({ mensaje: 'La cantidad debe ser un número entero mayor o igual a 1' });
    }
    
    // Verificar que el libro existe y tiene stock
    const [libros] = await query('SELECT * FROM libros WHERE id = ?', [libro_id]);
    if (libros.length === 0) {
      return res.status(404).json({ mensaje: 'Libro no encontrado' });
    }
    
    const libro = libros[0];
    if (libro.stock < cantidadPedida) {
      return res.status(400).json({ mensaje: 'Stock insuficiente' });
    }
    
    // Obtener o crear carrito para el usuario
    let [carrito] = await query('SELECT id FROM carritos WHERE usuario_id = ?', [req.params.usuario_id]);
    
    if (carrito.length === 0) {
      const [result] = await query(
        'INSERT INTO carritos (usuario_id) VALUES (?)',
        [req.params.usuario_id]
      );
      carrito = [{ id: result.insertId }];
    }
    
    // Verificar si el libro ya está en el carrito
    const [existingItem] = await query(
      'SELECT * FROM carrito_items WHERE carrito_id = ? AND libro_id = ?',
      [carrito[0].id, libro_id]
    );
    
    if (existingItem.length > 0) {
      // La cantidad del body es la cantidad FINAL que se quiere en el item
      // (no un incremento), asi que se sobreescribe.
      await query(
        'UPDATE carrito_items SET cantidad = ? WHERE id = ?',
        [cantidadPedida, existingItem[0].id]
      );
    } else {
      // Agregar nuevo item
      await query(
        'INSERT INTO carrito_items (carrito_id, libro_id, cantidad, precio) VALUES (?, ?, ?, ?)',
        [carrito[0].id, libro_id, cantidadPedida, libro.precio]
      );
    }
    
    res.json({ mensaje: 'Item agregado al carrito exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// Busca un item del carrito y verifica que le pertenezca al usuario de la
// peticion (o que ese usuario sea gerente). Devuelve el item o null.
async function buscarItemDeCarritoPropio(req, itemId) {
  const [items] = await query(
    `SELECT ci.id, c.usuario_id FROM carrito_items ci
     JOIN carritos c ON ci.carrito_id = c.id
     WHERE ci.id = ?`,
    [itemId]
  );
  if (!items.length) return null;
  if (!puedeVerCarritoDe(req, items[0].usuario_id)) return null;
  return items[0];
}

// PUT /api/carrito-item/:item_id - Actualizar cantidad en carrito
app.put('/api/carrito-item/:item_id', autenticarToken, async (req, res) => {
  try {
    const { cantidad } = req.body;
    const cantidadNueva = Number(cantidad);
    if (!Number.isInteger(cantidadNueva) || cantidadNueva < 1) {
      return res.status(400).json({ mensaje: 'La cantidad debe ser un número entero mayor o igual a 1' });
    }
    
    const item = await buscarItemDeCarritoPropio(req, req.params.item_id);
    if (!item) {
      return res.status(404).json({ mensaje: 'Item de carrito no encontrado' });
    }
    
    await query(
      'UPDATE carrito_items SET cantidad = ? WHERE id = ?',
      [cantidadNueva, req.params.item_id]
    );
    res.json({ mensaje: 'Cantidad actualizada exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// DELETE /api/carrito-item/:item_id - Eliminar item del carrito
app.delete('/api/carrito-item/:item_id', autenticarToken, async (req, res) => {
  try {
    const item = await buscarItemDeCarritoPropio(req, req.params.item_id);
    if (!item) {
      return res.status(404).json({ mensaje: 'Item de carrito no encontrado' });
    }
    
    await query('DELETE FROM carrito_items WHERE id = ?', [req.params.item_id]);
    res.json({ mensaje: 'Item eliminado del carrito' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// Rutas de pedidos

// POST /api/pedidos - Crear un pedido
app.post('/api/pedidos', autenticarToken, async (req, res) => {
  try {
    const usuario_id = req.user.id;
    
    // Todo el pedido va en una transaccion: si algo falla a mitad (por
    // ejemplo el descuento de stock), se hace rollback y no queda un pedido
    // a medias con el stock ya descontado.
    const { pedido_id, total } = await conTransaccion(async (conn) => {
      // Obtener carrito del usuario
      const [carrito] = await query('SELECT id FROM carritos WHERE usuario_id = ?', [usuario_id], conn);
      
      if (!carrito.length || carrito[0].id === null) {
        throw new ErrorDePeticion(400, 'Carrito vacío');
      }
      
      // Obtener items del carrito
      const [items] = await query(
        'SELECT ci.*, l.titulo, l.stock, l.precio FROM carrito_items ci JOIN libros l ON ci.libro_id = l.id WHERE ci.carrito_id = ?',
        [carrito[0].id],
        conn
      );
      
      if (!items.length) {
        throw new ErrorDePeticion(400, 'Carrito vacío');
      }
      
      // Calcular total
      const total = items.reduce((sum, item) => sum + (Number(item.precio) * item.cantidad), 0);
      
      // Crear pedido
      const [pedidoResult] = await query(
        'INSERT INTO pedidos (usuario_id, total, estado) VALUES (?, ?, ?)',
        [usuario_id, total, 'pendiente'],
        conn
      );
      
      const pedido_id = pedidoResult.insertId;
      
      // Insertar items del pedido y descontar stock
      for (const item of items) {
        // Descuento condicional: si entre la lectura y el descuento otro
        // pedido se llevo el stock, affectedRows viene en 0 y no se
        // descuenta de mas (asi el stock nunca queda negativo).
        const [descontado] = await query(
          'UPDATE libros SET stock = stock - ? WHERE id = ? AND stock >= ?',
          [item.cantidad, item.libro_id, item.cantidad],
          conn
        );
        
        if (descontado.affectedRows === 0) {
          throw new ErrorDePeticion(400, `Stock insuficiente para: ${item.titulo}`);
        }
        
        await query(
          'INSERT INTO pedido_items (pedido_id, libro_id, cantidad, precio) VALUES (?, ?, ?, ?)',
          [pedido_id, item.libro_id, item.cantidad, item.precio],
          conn
        );
      }
      
      // Vaciar carrito
      await query('DELETE FROM carrito_items WHERE carrito_id = ?', [carrito[0].id], conn);
      
      return { pedido_id, total };
    });
    
    res.json({
      mensaje: 'Pedido creado exitosamente',
      pedido_id,
      total
    });
  } catch (error) {
    if (error instanceof ErrorDePeticion) {
      return res.status(error.status).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// GET /api/pedidos/historial - Obtener historial de pedidos del usuario
app.get('/api/pedidos/historial', autenticarToken, async (req, res) => {
  try {
    const [pedidos] = await query(
      'SELECT p.*, u.nombre as usuario_nombre FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id WHERE p.usuario_id = ? ORDER BY p.creado_en DESC',
      [req.user.id]
    );
    res.json(pedidos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// GET /api/estadisticas - Estadísticas para el gerente
app.get('/api/estadisticas', autenticarToken, async (req, res) => {
  try {
    if (req.user.rol !== 'gerente') {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }
    
    // Total de libros
    const [totalLibros] = await query('SELECT COUNT(*) as count FROM libros');
    
    // Libros en stock
    const [stockLibros] = await query('SELECT COUNT(*) as count FROM libros WHERE stock > 0');
    
    // Libros sin stock
    const [sinStock] = await query('SELECT COUNT(*) as count FROM libros WHERE stock = 0');
    
    // Ventas totales (suma de todos los pedidos)
    const [ventas] = await query('SELECT SUM(total) as total_ventas FROM pedidos WHERE estado = "pagado"');
    
    // Stock bajo (libros con stock < 5)
    const [stockBajo] = await query(
      'SELECT COUNT(*) as count FROM libros WHERE stock > 0 AND stock < 5'
    );
    
    // Libros más vendidos (por cantidad en pedido_items)
    const [masVendidos] = await query(`
      SELECT l.titulo, l.autor, SUM(pi.cantidad) as total_vendido
      FROM pedido_items pi
      JOIN libros l ON pi.libro_id = l.id
      JOIN pedidos p ON pi.pedido_id = p.id
      WHERE p.estado = 'pagado'
      GROUP BY pi.libro_id
      ORDER BY total_vendido DESC
      LIMIT 5
    `);
    
    res.json({
      total_libros: totalLibros[0].count,
      libros_en_stock: stockLibros[0].count,
      libros_sin_stock: sinStock[0].count,
      ventas_totales: ventas[0].total_ventas || 0,
      stock_bajo: stockBajo[0].count,
      mas_vendidos: masVendidos
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// GET /api/usuario - Obtener datos del usuario actual
app.get('/api/usuario', autenticarToken, (req, res) => {
  res.json({
    id: req.user.id,
    nombre: req.user.nombre,
    email: req.user.email,
    rol: req.user.rol
  });
});

// PUT /api/usuario - Actualizar datos del usuario
app.put('/api/usuario', autenticarToken, async (req, res) => {
  try {
    const { nombre } = req.body;
    await query(
      'UPDATE usuarios SET nombre = ? WHERE id = ?',
      [nombre, req.user.id]
    );
    res.json({ mensaje: 'Perfil actualizado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// PUT /api/usuario/password - Cambiar contraseña
app.put('/api/usuario/password', autenticarToken, async (req, res) => {
  try {
    const { password_actual, password_nuevo } = req.body;
    if (!password_actual || !password_nuevo) {
      return res.status(400).json({ mensaje: 'Ambas contraseñas son requeridas' });
    }
    
    const [usuario] = await query('SELECT password FROM usuarios WHERE id = ?', [req.user.id]);
    if (!usuario.length) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    
    const passwordValida = await bcrypt.compare(password_actual, usuario[0].password);
    if (!passwordValida) {
      return res.status(401).json({ mensaje: 'La contraseña actual es incorrecta' });
    }
    
    const passwordHasheado = await bcrypt.hash(password_nuevo, 10);
    await query(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [passwordHasheado, req.user.id]
    );
    
    res.json({ mensaje: 'Contraseña cambiada exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// PUT /api/gerente/cambiar-password - Cambiar contraseña (gerente desde dashboard)
app.put('/api/gerente/cambiar-password', autenticarToken, async (req, res) => {
  try {
    if (req.user.rol !== 'gerente') {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }
    
    const { password_actual, password_nuevo } = req.body;
    if (!password_actual || !password_nuevo) {
      return res.status(400).json({ mensaje: 'Ambas contraseñas son requeridas' });
    }
    
    const [usuario] = await query('SELECT password FROM usuarios WHERE id = ?', [req.user.id]);
    if (!usuario.length) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    
    const passwordValida = await bcrypt.compare(password_actual, usuario[0].password);
    if (!passwordValida) {
      return res.status(401).json({ mensaje: 'La contraseña actual es incorrecta' });
    }
    
    const passwordHasheado = await bcrypt.hash(password_nuevo, 10);
    await query(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [passwordHasheado, req.user.id]
    );
    
    res.json({ mensaje: 'Contraseña cambiada exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// Middleware de errores. Express responde los errores de parseo del body con
// su manejador por defecto (HTML y sin log); con esto la API contesta siempre
// JSON y distingue un body invalido (400) de una falla interna (500).
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo de la petición no es JSON válido' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ mensaje: 'El cuerpo de la petición es demasiado grande' });
  }

  console.error('Error no controlado:', describirError(error));
  res.status(500).json({ mensaje: 'Error en el servidor' });
});

// Arranca el servidor HTTP y resuelve cuando esta escuchando. Rechaza si el
// puerto no se puede abrir (EADDRINUSE, EACCES).
//
// Ojo con Express 5: `app.listen(puerto, callback)` registra ese callback como
// manejador del evento 'error' (`server.once('error', done)`). Si el puerto
// esta ocupado, el callback se llama con el error, no con el arranque. Por eso
// aca NO se pasa callback: el log va en 'listening' y el error se rechaza.
// Antes, un puerto ocupado imprimia "Servidor corriendo" y salia con rc=0
// (medido), asi que el supervisor no lo reiniciaba.
function iniciarServidor(puerto = PORT) {
  return new Promise((resolve, reject) => {
    const server = app.listen(puerto);

    server.once('error', reject);
    server.once('listening', () => {
      // Despues del arranque el error ya no es fatal para el listen, pero un
      // 'error' sin listener tumba el proceso: se loguea.
      server.on('error', (error) => {
        console.error('Error del servidor:', describirError(error));
      });
      resolve(server);
    });
  });
}

// Iniciar servidor.
// Solo si este archivo es el punto de entrada: asi los tests pueden importar
// la app y decidir en que puerto escuchar, sin que quede un servidor colgado.
if (require.main === module) {
  iniciarServidor()
    .then((server) => {
      console.log(`Servidor backend corriendo en http://localhost:${PORT}`);

      // Apagado ordenado. Sin esto, un systemctl stop lo mata a los 90s con
      // SIGKILL y las peticiones en vuelo cortan a la mitad.
      const apagar = async (senal) => {
        console.log(`\nRecibida ${senal}: cerrando el servidor...`);
        server.close(async () => {
          try {
            await cerrarPool();
          } catch (error) {
            console.error('Error al cerrar el pool:', error.message);
          }
          process.exit(0);
        });
        // Si alguna conexion se queda colgada, no esperar indefinidamente.
        setTimeout(() => {
          console.error('Cierre forzado: habia conexiones abiertas.');
          process.exit(1);
        }, 10000).unref();
      };

      process.on('SIGTERM', () => apagar('SIGTERM'));
      process.on('SIGINT', () => apagar('SIGINT'));
    })
    .catch((error) => {
      if (error && error.code === 'EADDRINUSE') {
        console.error(`No se pudo arrancar: el puerto ${PORT} ya está en uso.`);
      } else {
        console.error('No se pudo arrancar el servidor:', describirError(error));
      }
      process.exit(1);
    });
}

module.exports = app;
// Se exporta para probar el arranque y EADDRINUSE sin lanzar un proceso hijo.
module.exports.iniciarServidor = iniciarServidor;