'use strict';

/**
 * Tests de la API. Corren con `npm test` (node --test), sin MySQL: la base
 * esta simulada en test/helpers/banco-de-pruebas.js.
 *
 * Cada test que esta marcado como REGRESION fallaba con la version anterior
 * del servidor.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { montarServidor, pedir } = require('./helpers/banco-de-pruebas');

describe('libros', () => {
  let s;

  before(async () => { s = await montarServidor(); });
  after(async () => { await s.cerrar(); });

  test('GET /api/libros devuelve un ARRAY', async () => {
    // REGRESION: con la version anterior el handler hacia
    // `const [libros] = await query(...)` sobre un helper que ya devolvia las
    // filas, asi que destructuraba la primera fila y respondia un objeto
    // suelto en vez de la lista.
    const r = await pedir(s.url, { ruta: '/api/libros' });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.cuerpo), 'la respuesta tiene que ser un array');
    assert.equal(r.cuerpo.length, 2);
    assert.equal(r.cuerpo[0].titulo, 'El Hobbit');
  });

  test('GET /api/libros filtra por autor', async () => {
    const r = await pedir(s.url, { ruta: '/api/libros?autor=Tolkien' });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.cuerpo));
  });

  test('GET /api/libros/:id devuelve el libro', async () => {
    const r = await pedir(s.url, { ruta: '/api/libros/1' });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.id, 1);
    assert.equal(r.cuerpo.titulo, 'El Hobbit');
  });

  test('GET /api/libros/:id inexistente devuelve 404', async () => {
    // REGRESION: antes respondia 200 con el cuerpo vacio.
    const r = await pedir(s.url, { ruta: '/api/libros/999' });
    assert.equal(r.status, 404);
    assert.equal(r.cuerpo.mensaje, 'Libro no encontrado');
  });

  test('GET /api/libros/:id con id no numerico devuelve 404, no 500', async () => {
    const r = await pedir(s.url, { ruta: '/api/libros/abc' });
    assert.equal(r.status, 404);
  });

  test('GET /api/categorias devuelve un array', async () => {
    const r = await pedir(s.url, { ruta: '/api/categorias' });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.cuerpo));
    assert.equal(r.cuerpo.length, 2);
  });

  test('POST /api/libros rechaza un precio que no es numero', async () => {
    // Antes el parseFloat de 'abc' devolvia NaN y se guardaba NaN.
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/libros',
      token: s.tokenGerente,
      cuerpo: { titulo: 'T', autor: 'A', precio: 'abc' }
    });
    assert.equal(r.status, 400);
    assert.match(r.cuerpo.mensaje, /precio/i);
  });

  test('POST /api/libros sin precio devuelve 400', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/libros',
      token: s.tokenGerente,
      cuerpo: { titulo: 'T', autor: 'A' }
    });
    assert.equal(r.status, 400);
  });

  test('PUT /api/libros/:id sin precio devuelve 400', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT',
      ruta: '/api/libros/1',
      token: s.tokenGerente,
      cuerpo: { titulo: 'T', autor: 'A' }
    });
    assert.equal(r.status, 400);
  });

  test('POST /api/libros lo puede hacer el gerente y no un usuario', async () => {
    const cuerpo = { titulo: 'T', autor: 'A', precio: 10, stock: 1 };
    const comoGerente = await pedir(s.url, {
      metodo: 'POST', ruta: '/api/libros', token: s.tokenGerente, cuerpo
    });
    assert.equal(comoGerente.status, 201);
    assert.equal(comoGerente.cuerpo.libro.precio, 10);

    const comoUsuario = await pedir(s.url, {
      metodo: 'POST', ruta: '/api/libros', token: s.tokenUsuario, cuerpo
    });
    assert.equal(comoUsuario.status, 403);
  });
});

describe('autenticacion', () => {
  let s;

  before(async () => { s = await montarServidor(); });
  after(async () => { await s.cerrar(); });

  test('POST /api/auth/login con credenciales correctas devuelve token', async () => {
    // REGRESION: antes daba 500 (el helper de base y el destructuring del
    // handler no coinciden, y bcrypt ni siquiera estaba importado).
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/auth/login',
      cuerpo: { email: 'admin@libreria.com', password: '12345678' }
    });
    assert.equal(r.status, 200);
    assert.ok(r.cuerpo.token, 'tiene que devolver un token');
    assert.equal(r.cuerpo.usuario.rol, 'gerente');
  });

  test('POST /api/auth/login con password incorrecta devuelve 401', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/auth/login',
      cuerpo: { email: 'admin@libreria.com', password: 'no-es-la-clave' }
    });
    assert.equal(r.status, 401);
    assert.equal(r.cuerpo.mensaje, 'Credenciales inválidas');
  });

  test('POST /api/auth/login sin body devuelve 400, no 500', async () => {
    // REGRESION: en Express 5 req.body es undefined si no viene el body
    // parseado, y el destructuring reventaba con TypeError -> 500.
    const r = await pedir(s.url, { metodo: 'POST', ruta: '/api/auth/login' });
    assert.equal(r.status, 400);
  });

  test('POST /api/auth/login con body JSON mal formado devuelve 400 JSON', async () => {
    // Express responde los errores de parseo con su manejador por defecto
    // (HTML). El middleware de errores de la app tiene que devolver JSON.
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/auth/login',
      cuerpo: '{esto no es json'
    });
    assert.equal(r.status, 400);
    assert.match(r.cuerpo.mensaje, /JSON/i);
  });

  test('POST /api/auth/login con email inexistente devuelve 401', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/auth/login',
      cuerpo: { email: 'nadie@test.com', password: '12345678' }
    });
    assert.equal(r.status, 401);
  });

  test('POST /api/auth/register ignora el rol que manda el cliente', async () => {
    // REGRESION: el rol venia del body, asi que cualquiera se registraba
    // como gerente y se llevaba el CRUD de libros y las estadisticas.
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/auth/register',
      cuerpo: { nombre: 'Intruso', email: 'intruso@test.com', password: '12345678', rol: 'gerente' }
    });
    assert.equal(r.status, 201);
    assert.equal(r.cuerpo.usuario.rol, 'usuario');
    assert.ok(r.cuerpo.token);
  });

  test('POST /api/auth/register con email repetido devuelve 409', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/auth/register',
      cuerpo: { nombre: 'Otro', email: 'admin@libreria.com', password: '12345678' }
    });
    assert.equal(r.status, 409);
  });

  test('POST /api/auth/register valida el email', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/auth/register',
      cuerpo: { nombre: 'X', email: 'esto-no-es-un-email', password: '12345678' }
    });
    assert.equal(r.status, 400);
  });

  test('POST /api/auth/register exige una contraseña de 8 caracteres', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/auth/register',
      cuerpo: { nombre: 'X', email: 'x@test.com', password: 'corta' }
    });
    assert.equal(r.status, 400);
  });

  test('GET /api/usuario sin token devuelve 401', async () => {
    const r = await pedir(s.url, { ruta: '/api/usuario' });
    assert.equal(r.status, 401);
  });

  test('GET /api/usuario con token invalido devuelve 403', async () => {
    const r = await pedir(s.url, { ruta: '/api/usuario', token: 'no.es.un.jwt' });
    assert.equal(r.status, 403);
  });

  test('GET /api/usuario devuelve el nombre', async () => {
    // REGRESION: el nombre no estaba en el token, asi que la respuesta
    // venia sin la clave 'nombre'.
    const r = await pedir(s.url, { ruta: '/api/usuario', token: s.tokenUsuario });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.nombre, 'Cliente');
    assert.equal(r.cuerpo.email, 'cliente@test.com');
  });

  test('PUT /api/usuario/password con la clave correcta la cambia', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT',
      ruta: '/api/usuario/password',
      token: s.tokenUsuario,
      cuerpo: { password_actual: '12345678', password_nuevo: 'claveNueva123' }
    });
    assert.equal(r.status, 200);
  });

  test('PUT /api/usuario/password con la clave incorrecta devuelve 401', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT',
      ruta: '/api/usuario/password',
      token: s.tokenUsuario,
      cuerpo: { password_actual: 'no-es-la-clave', password_nuevo: 'claveNueva123' }
    });
    assert.equal(r.status, 401);
  });
});

describe('carrito', () => {
  let s;

  before(async () => { s = await montarServidor(); });
  after(async () => { await s.cerrar(); });

  test('GET /api/carrito/:id propio devuelve el carrito', async () => {
    const r = await pedir(s.url, { ruta: '/api/carrito/2', token: s.tokenUsuario });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.cuerpo.items));
    assert.equal(r.cuerpo.items.length, 1);
    assert.equal(r.cuerpo.total, 250.5);
  });

  test('GET /api/carrito/:id de otro usuario devuelve 403', async () => {
    // REGRESION: no habia ninguna verificacion, asi que con un token
    // valido se podia leer el carrito de cualquiera.
    const r = await pedir(s.url, { ruta: '/api/carrito/1', token: s.tokenUsuario });
    assert.equal(r.status, 403);
  });

  test('GET /api/carrito/:id de otro usuario si el rol es gerente', async () => {
    const r = await pedir(s.url, { ruta: '/api/carrito/2', token: s.tokenGerente });
    assert.equal(r.status, 200);
  });

  test('POST /api/carrito/:id de otro usuario devuelve 403', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/carrito/1',
      token: s.tokenUsuario,
      cuerpo: { libro_id: 1, cantidad: 1 }
    });
    assert.equal(r.status, 403);
  });

  test('POST /api/carrito rechaza una cantidad que no es un entero', async () => {
    // Antes la cantidad 'x' llegaba como NaN a la columna.
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/carrito/2',
      token: s.tokenUsuario,
      cuerpo: { libro_id: 1, cantidad: 'x' }
    });
    assert.equal(r.status, 400);
    assert.match(r.cuerpo.mensaje, /cantidad/i);
  });

  test('POST /api/carrito rechaza una cantidad menor a 1', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/carrito/2',
      token: s.tokenUsuario,
      cuerpo: { libro_id: 1, cantidad: 0 }
    });
    assert.equal(r.status, 400);
  });

  test('POST /api/carrito con un libro inexistente devuelve 404', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/carrito/2',
      token: s.tokenUsuario,
      cuerpo: { libro_id: 999, cantidad: 1 }
    });
    assert.equal(r.status, 404);
  });

  test('PUT /api/carrito-item de otro usuario devuelve 404', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT',
      ruta: '/api/carrito-item/1',
      token: s.tokenUsuario,
      cuerpo: { cantidad: 5 }
    });
    assert.equal(r.status, 404);
  });

  test('DELETE /api/carrito-item de otro usuario devuelve 404', async () => {
    const r = await pedir(s.url, {
      metodo: 'DELETE',
      ruta: '/api/carrito-item/1',
      token: s.tokenUsuario
    });
    assert.equal(r.status, 404);
  });

  test('PUT /api/carrito-item propio actualiza la cantidad', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT',
      ruta: '/api/carrito-item/2',
      token: s.tokenUsuario,
      cuerpo: { cantidad: 5 }
    });
    assert.equal(r.status, 200);
  });

  test('PUT /api/carrito-item con cantidad invalida devuelve 400', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT',
      ruta: '/api/carrito-item/2',
      token: s.tokenUsuario,
      cuerpo: { cantidad: 'mucho' }
    });
    assert.equal(r.status, 400);
  });
});

describe('pedidos', () => {
  let s;

  before(async () => { s = await montarServidor(); });
  after(async () => { await s.cerrar(); });

  test('POST /api/pedidos crea el pedido', async () => {
    // REGRESION: antes daba 500 por el destructuring de la consulta.
    const r = await pedir(s.url, { metodo: 'POST', ruta: '/api/pedidos', token: s.tokenUsuario });
    assert.equal(r.status, 200);
    assert.ok(r.cuerpo.pedido_id);
    assert.equal(r.cuerpo.total, 250.5);
  });

  test('POST /api/pedidos corre todo dentro de una transaccion', async () => {
    const r = await pedir(s.url, { metodo: 'POST', ruta: '/api/pedidos', token: s.tokenUsuario });
    assert.equal(r.status, 200);
    const enTransaccion = s.base.llamadas.filter(c => c.enTransaccion);
    assert.ok(enTransaccion.length >= 4, 'las consultas del pedido tienen que ir con conexión');
    assert.ok(enTransaccion.some(c => /INSERT INTO pedidos/i.test(c.sql)));
    assert.ok(enTransaccion.some(c => /UPDATE libros SET stock/i.test(c.sql)));
    assert.ok(enTransaccion.some(c => /DELETE FROM carrito_items/i.test(c.sql)));
  });

  test('POST /api/pedidos sin stock suficiente devuelve 400 y no descuenta', async () => {
    const conPocaStock = await montarServidor({
      query: async (sql) => {
        if (/UPDATE libros SET stock/i.test(sql)) {
          return [{ affectedRows: 0, changedRows: 0, info: '' }, []];
        }
        return null;
      }
    });
    try {
      const r = await pedir(conPocaStock.url, {
        metodo: 'POST', ruta: '/api/pedidos', token: conPocaStock.tokenUsuario
      });
      assert.equal(r.status, 400);
      assert.match(r.cuerpo.mensaje, /Stock insuficiente/i);
      // Con affectedRows 0 el UPDATE condicional no descuenta nada: el stock
      // no puede quedar negativo.
      const descuento = conPocaStock.base.llamadas.find(c => /UPDATE libros SET stock/i.test(c.sql));
      assert.match(descuento.sql, /stock >= \?/);
    } finally {
      await conPocaStock.cerrar();
    }
  });

  test('GET /api/pedidos/historial devuelve un array', async () => {
    const r = await pedir(s.url, { ruta: '/api/pedidos/historial', token: s.tokenUsuario });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.cuerpo));
  });
});

describe('estadisticas y salud', () => {
  let s;

  before(async () => { s = await montarServidor(); });
  after(async () => { await s.cerrar(); });

  test('GET /api/estadisticas devuelve el total y el stock bajo', async () => {
    // REGRESION: la clave se llamaba '_libros_sin_stock' y el contador
    // veniaundefined, asi que la respuesta rompia el contrato.
    const r = await pedir(s.url, { ruta: '/api/estadisticas', token: s.tokenGerente });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.total_libros, 2);
    assert.equal(r.cuerpo.libros_sin_stock, 1);
    assert.equal(r.cuerpo.stock_bajo, 1);
    assert.ok(Array.isArray(r.cuerpo.mas_vendidos));
    assert.equal(r.cuerpo._libros_sin_stock, undefined);
  });

  test('GET /api/estadisticas lo puede ver el gerente y no un usuario', async () => {
    const comoUsuario = await pedir(s.url, { ruta: '/api/estadisticas', token: s.tokenUsuario });
    assert.equal(comoUsuario.status, 403);
  });

  test('GET /api/salud da 200 cuando la base responde', async () => {
    const r = await pedir(s.url, { ruta: '/api/salud' });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.estado, 'ok');
  });

  test('GET /api/salud da 503 cuando la base no responde', async () => {
    const caido = await montarServidor({
      query: async (sql) => {
        if (/SELECT 1/i.test(sql)) {
          const error = new Error('connect ECONNREFUSED 127.0.0.1:3306');
          error.code = 'ECONNREFUSED';
          throw error;
        }
        return null;
      }
    });
    try {
      const r = await pedir(caido.url, { ruta: '/api/salud' });
      assert.equal(r.status, 503);
      assert.equal(r.cuerpo.estado, 'error');
      assert.match(r.cuerpo.detalle, /ECONNREFUSED/);
    } finally {
      await caido.cerrar();
    }
  });
});

describe('categorias', () => {
  let s;

  before(async () => { s = await montarServidor(); });
  after(async () => { await s.cerrar(); });

  test('POST /api/categorias la puede crear el gerente', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/categorias',
      token: s.tokenGerente,
      cuerpo: { nombre: 'Historia' }
    });
    assert.equal(r.status, 201);
    assert.equal(r.cuerpo.categoria.nombre, 'Historia');
  });

  test('POST /api/categorias no la puede crear un usuario', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/categorias',
      token: s.tokenUsuario,
      cuerpo: { nombre: 'Historia' }
    });
    assert.equal(r.status, 403);
  });

  test('POST /api/categorias con nombre repetido devuelve 409', async () => {
    const r = await pedir(s.url, {
      metodo: 'POST',
      ruta: '/api/categorias',
      token: s.tokenGerente,
      cuerpo: { nombre: 'Ficción' }
    });
    assert.equal(r.status, 409);
  });
});
