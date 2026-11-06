'use strict';

/**
 * Banco de pruebas: monta la app contra una base de datos en memoria.
 *
 * No necesita MySQL. El modulo './database' real se reemplaza en
 * require.cache antes de que index.js lo pida, asi que los tests ejercitan
 * el servidor de verdad (Express, middlewares, JWT, validaciones) y solo la
 * base es simulada.
 *
 * El stub devuelve [filas, campos], el mismo contrato que mysql2, que es lo
 * que espera el codigo del servidor.
 */

const path = require('path');
const jwt = require('jsonwebtoken');

const RUTA_SERVER = path.join(__dirname, '..', '..');
const RUTA_DATABASE = path.join(RUTA_SERVER, 'database');
const RUTA_INDEX = path.join(RUTA_SERVER, 'index.js');

// Hash real de '12345678', para que las pruebas de login usen bcrypt de verdad.
const HASH_DE_PRUEBA = '$2b$10$C4.itrKALuFPlMsrSXmLwej70808kx20PKUI2sQDBP7nFfU/XAEry';

const TABLAS_POR_DEFECTO = {
  usuarios: [
    { id: 1, nombre: 'Admin', email: 'admin@libreria.com', password: HASH_DE_PRUEBA, rol: 'gerente' },
    { id: 2, nombre: 'Cliente', email: 'cliente@test.com', password: HASH_DE_PRUEBA, rol: 'usuario' }
  ],
  categorias: [
    { id: 1, nombre: 'Ficción' },
    { id: 2, nombre: 'Arte' }
  ],
  libros: [
    { id: 1, titulo: 'El Hobbit', autor: 'Tolkien', descripcion: '', precio: 250.5, stock: 3, categoria_id: 1, categoria_nombre: 'Ficción' },
    { id: 2, titulo: 'Cien años', autor: 'García Márquez', descripcion: '', precio: 300, stock: 0, categoria_id: 1, categoria_nombre: 'Ficción' }
  ],
  carritos: [
    { id: 1, usuario_id: 1, rol: 'gerente' },
    { id: 2, usuario_id: 2, rol: 'usuario' }
  ],
  carrito_items: [
    { id: 1, carrito_id: 1, libro_id: 1, cantidad: 2, precio: 250.5, titulo: 'El Hobbit', autor: 'Tolkien', precio_libro: 250.5 },
    { id: 2, carrito_id: 2, libro_id: 1, cantidad: 1, precio: 250.5, titulo: 'El Hobbit', autor: 'Tolkien', precio_libro: 250.5 }
  ],
  pedidos: [
    { id: 1, usuario_id: 1, total: 501, estado: 'pagado', creado_en: '2026-10-21', usuario_nombre: 'Admin' }
  ],
  pedido_items: [
    { id: 1, pedido_id: 1, libro_id: 1, cantidad: 2, precio: 250.5, titulo: 'El Hobbit', autor: 'Tolkien' }
  ]
};

function clonar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

// Detecta la tabla principal de un SELECT: la primera despues de FROM.
function tablaDe(sql) {
  const coincidencia = sql.match(/\bFROM\s+(\w+)/i);
  return coincidencia ? coincidencia[1].toLowerCase() : null;
}

// Aplica las condiciones del WHERE. Soporta igualdad y comparaciones con
// un valor literal o con un placeholder "?", que es lo que usa el servidor.
function aplicarFiltros(filas, sql, params) {
  const donde = sql.match(/\bWHERE\b(.*)$/i);
  if (!donde) return filas;

  let resultado = filas;
  let indiceParam = 0;

  for (const condicion of donde[1].split(/\s+AND\s+/i)) {
    const coincidencia = condicion.match(
      /(\w+(?:\.\w+)?)\s*(>=|<=|=|>|<)\s*(\?|'[^']*'|-?\d+(?:\.\d+)?)/i
    );
    if (!coincidencia) continue;

    const columna = coincidencia[1].includes('.')
      ? coincidencia[1].split('.').pop()
      : coincidencia[1];
    const operador = coincidencia[2];

    // Si la columna no existe en ninguna fila, la condicion no es un filtro
    // real (por ejemplo el "WHERE 1=1" del catalogo): se ignora.
    if (!resultado.some(fila => columna in fila)) continue;

    let valor;
    if (coincidencia[3] === '?') {
      valor = params[indiceParam];
      indiceParam += 1;
    } else if (coincidencia[3].startsWith("'")) {
      valor = coincidencia[3].slice(1, -1);
    } else {
      valor = Number(coincidencia[3]);
    }

    resultado = resultado.filter(fila => {
      const deLaFila = Number(fila[columna]);
      const aComparar = Number(valor);
      switch (operador) {
        case '=': return String(fila[columna]) === String(valor);
        case '>': return deLaFila > aComparar;
        case '<': return deLaFila < aComparar;
        case '>=': return deLaFila >= aComparar;
        case '<=': return deLaFila <= aComparar;
        default: return true;
      }
    });
  }
  return resultado;
}

function crearBaseDeDatosStub(opciones = {}) {
  const tablas = { ...TABLAS_POR_DEFECTO, ...(opciones.tablas || {}) };
  const llamadas = [];
  let ultimoId = 100;

  async function query(sql, params = [], conn = null) {
    const limpio = sql.replace(/\s+/g, ' ').trim();
    llamadas.push({ sql: limpio, params, enTransaccion: Boolean(conn) });

    if (typeof opciones.query === 'function') {
      const resultado = await opciones.query(limpio, params, conn);
      // null significa "seguí con el comportamiento por defecto".
      if (resultado !== null && resultado !== undefined) {
        if (Array.isArray(resultado)) return resultado;   // [filas, campos]
        return [resultado, []];                            // solo filas
      }
    }

    if (/^\s*INSERT/i.test(limpio)) {
      ultimoId += 1;
      return [{ insertId: ultimoId, affectedRows: 1 }, []];
    }
    if (/^\s*UPDATE/i.test(limpio)) {
      return [{ affectedRows: 1, changedRows: 1, info: '' }, []];
    }
    if (/^\s*DELETE/i.test(limpio)) {
      return [{ affectedRows: 1, changedRows: 1, info: '' }, []];
    }

    // SELECT
    if (/COUNT\(\*\)\s+as\s+count/i.test(limpio)) {
      const tabla = tablaDe(limpio);
      const filas = aplicarFiltros(clonar(tablas[tabla] || []), limpio, params);
      return [[{ count: filas.length }], []];
    }
    if (/SUM\(/i.test(limpio)) {
      return [[{ total_ventas: 501 }], []];
    }
    if (/GROUP BY/i.test(limpio)) {
      return [[{ titulo: 'El Hobbit', autor: 'Tolkien', total_vendido: 2 }], []];
    }

    const tabla = tablaDe(limpio);
    let filas = clonar(tablas[tabla] || []);

    // Simula el JOIN con carritos: el item necesita el usuario_id del
    // carrito, que es lo que usa el servidor para autorizar.
    if (tabla === 'carrito_items' && /\bcarritos\b/i.test(limpio)) {
      filas = filas.map(fila => {
        const carrito = tablas.carritos.find(c => c.id === fila.carrito_id);
        return { ...fila, usuario_id: carrito ? carrito.usuario_id : null };
      });
    }

    return [aplicarFiltros(filas, limpio, params), []];
  }

  async function conTransaccion(fn) {
    const conn = { simulada: true };
    try {
      return await fn(conn);
    } catch (error) {
      // Simula el rollback: no hace falta deshacer nada porque la base es
      // en memoria y las escrituras no se aplican.
      throw error;
    }
  }

  return {
    tablas,
    llamadas,
    query,
    conTransaccion,
    pool: {},
    cerrarPool: async () => {},
    inicializar: async () => {}
  };
}

/**
 * Monta el servidor con la base simulada y devuelve los helpers para
 * pegarle un trait.
 */
async function montarServidor(opciones = {}) {
  const base = crearBaseDeDatosStub(opciones);

  // Secret antes de cargar index.js: si falta, el servidor se niega a
  // arrancar (y esta es justamente una de las cosas que hay que verificar).
  process.env.JWT_SECRET = opciones.jwtSecret || 'secreto-de-prueba';

  // Reemplazar el modulo de base de datos y recargar index.js.
  delete require.cache[require.resolve(RUTA_INDEX)];
  require.cache[require.resolve(RUTA_DATABASE)] = {
    id: require.resolve(RUTA_DATABASE),
    filename: RUTA_DATABASE,
    loaded: true,
    exports: base
  };

  const app = require(RUTA_INDEX);
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;

  const firmar = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

  return {
    base,
    server,
    url,
    tokenGerente: firmar({ id: 1, rol: 'gerente', email: 'admin@libreria.com', nombre: 'Admin' }),
    tokenUsuario: firmar({ id: 2, rol: 'usuario', email: 'cliente@test.com', nombre: 'Cliente' }),
    tokenDeOtro: firmar({ id: 999, rol: 'usuario', email: 'otro@test.com', nombre: 'Otro' }),
    async cerrar() {
      await new Promise(resolve => server.close(resolve));
      delete require.cache[require.resolve(RUTA_INDEX)];
      delete require.cache[require.resolve(RUTA_DATABASE)];
    }
  };
}

/** Pega un request y devuelve { status, cuerpo, texto }. */
async function pedir(url, { metodo = 'GET', ruta = '/', cuerpo, token, cabeceras = {} } = {}) {
  const headers = { ...cabeceras };
  let payload;
  if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const respuesta = await fetch(url + ruta, { method: metodo, headers, body: payload });
  const texto = await respuesta.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    json = null;
  }
  return { status: respuesta.status, cuerpo: json, texto };
}

module.exports = { montarServidor, pedir, crearBaseDeDatosStub, TABLAS_POR_DEFECTO };
