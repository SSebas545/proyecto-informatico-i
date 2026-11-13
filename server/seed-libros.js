// Siembra el catálogo con libros de prueba, para que la página tenga algo que
// mostrar. Es idempotente: se puede correr las veces que haga falta sin
// duplicar filas (se compara por título, que es único en este conjunto).
//
// Uso: npm run seed
const { query, inicializar, cerrarPool } = require('./database');

// precio en ARS, stock en unidades. Las categorías ya las crea `inicializar`.
const LIBROS = [
  { titulo: 'El Señor de los Anillos', autor: 'J.R.R. Tolkien', categoria: 'Ficción', precio: 25000, stock: 4, descripcion: 'La trilogía completa en un solo volumen, tapa dura.' },
  { titulo: 'Cien Años de Soledad', autor: 'Gabriel García Márquez', categoria: 'Ficción', precio: 18000, stock: 6, descripcion: 'Edición conmemorativa de la novela de Macondo.' },
  { titulo: 'Ficciones', autor: 'Jorge Luis Borges', categoria: 'Ficción', precio: 17000, stock: 3, descripcion: 'Cuentos: El jardín de senderos que se bifurcan y Artificios.' },
  { titulo: 'Rayuela', autor: 'Julio Cortázar', categoria: 'Ficción', precio: 19500, stock: 2, descripcion: 'Novela para leer de corrido o saltando capítulos.' },
  { titulo: 'El nombre de la rosa', autor: 'Umberto Eco', categoria: 'Terror', precio: 21000, stock: 1, descripcion: 'Misterio medieval en una abadía.' },
  { titulo: 'It', autor: 'Stephen King', categoria: 'Terror', precio: 26000, stock: 0, descripcion: 'El payaso de Derry, sin stock por ahora.' },
  { titulo: 'Historia del arte', autor: 'E.H. Gombrich', categoria: 'Arte', precio: 32000, stock: 2, descripcion: 'Un recorrido por la pintura y la escultura occidental.' },
  { titulo: 'El mundo de las formas', autor: 'Wucius Wong', categoria: 'Arte', precio: 14500, stock: 3, descripcion: 'Diseño bi y tridimensional explicado con láminas.' },
  { titulo: 'JavaScript: The Good Parts', autor: 'Douglas Crockford', categoria: 'Tecnología', precio: 23000, stock: 5, descripcion: 'El núcleo del lenguaje, sin el resto.' },
  { titulo: 'Bases de datos relacionales', autor: 'C.J. Date', categoria: 'Tecnología', precio: 28500, stock: 2, descripcion: 'Modelo relacional, álgebra y SQL.' },
  { titulo: 'Estructuras de datos en C', autor: 'Aaron Tenenbaum', categoria: 'Ingeniería', precio: 24000, stock: 1, descripcion: 'Listas, árboles y grafos con implementación.' },
  { titulo: 'El principito', autor: 'Antoine de Saint-Exupéry', categoria: 'Infantil', precio: 12000, stock: 8, descripcion: 'Edición ilustrada para primeros lectores.' },
];

async function sembrar() {
  await inicializar();

  let creados = 0;
  let salteados = 0;

  for (const libro of LIBROS) {
    const [categoria] = await query('SELECT id FROM categorias WHERE nombre = ?', [libro.categoria]);
    if (categoria.length === 0) {
      console.error(`Categoría desconocida: ${libro.categoria} (libro: ${libro.titulo})`);
      continue;
    }

    // El chequeo y el INSERT van en la misma sentencia: si dos seeds corren a
    // la vez, el segundo no encuentra la fila y no la duplica (titulo no tiene
    // UNIQUE, así que un SELECT + INSERT separado no alcanzaba).
    const [result] = await query(
      `INSERT INTO libros (titulo, autor, descripcion, precio, stock, categoria_id)
       SELECT ?, ?, ?, ?, ?, ? FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM libros WHERE titulo = ?)`,
      [libro.titulo, libro.autor, libro.descripcion, libro.precio, libro.stock, categoria[0].id, libro.titulo]
    );

    if (result.affectedRows > 0) creados += 1;
    else salteados += 1;
  }

  const [total] = await query('SELECT COUNT(*) AS n FROM libros');
  console.log(`Seed: ${creados} creados, ${salteados} ya existían, total en catálogo: ${total[0].n}`);
}

sembrar()
  .catch((error) => {
    console.error('Falló el seed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => cerrarPool());
