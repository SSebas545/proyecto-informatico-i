'use strict';

/**
 * CU-12 — administración de usuarios.
 *
 * Contrato: el listado y el cambio de rol son solo para el gerente, la
 * respuesta nunca pide el hash de la contraseña, y el PUT relee el usuario
 * después de actualizarlo.
 *
 * Corre con `npm test` (node --test), sin MySQL: la base está simulada.
 *
 * Detalle del banco de pruebas: devuelve las filas completas de la tabla
 * (ignora la lista de columnas del SELECT) y no aplica las escrituras. Por eso
 * "no pedir el hash" se verifica sobre el SQL registrado, y el PUT de estado
 * se simula con el hook `query`, que aplica el UPDATE sobre la tabla en
 * memoria.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { montarServidor, pedir } = require('./helpers/banco-de-pruebas');

describe('CU-12 usuarios', () => {
  let s;

  // El UPDATE real no se aplica en la base simulada; este hook lo aplica para
  // que el PUT pueda devolver el rol ya cambiado.
  function hook(sql, params) {
    if (/^UPDATE\s+usuarios\b/i.test(sql)) {
      const usuario = s && s.base.tablas.usuarios.find((u) => String(u.id) === String(params[1]));
      if (!usuario) return [{ affectedRows: 0, changedRows: 0, info: '' }];
      usuario.rol = params[0];
      return [{ affectedRows: 1, changedRows: 1, info: '' }];
    }
    return null; // null: seguir con el comportamiento por defecto del banco
  }

  before(async () => { s = await montarServidor({ query: hook }); });
  after(async () => { await s.cerrar(); });

  test('GET sin token responde 401', async () => {
    const r = await pedir(s.url, { ruta: '/api/usuarios' });
    assert.equal(r.status, 401);
  });

  test('GET con rol usuario responde 403', async () => {
    const r = await pedir(s.url, { ruta: '/api/usuarios', token: s.tokenUsuario });
    assert.equal(r.status, 403);
  });

  test('GET con gerente lista los usuarios sin pedir el hash y ordenado por id', async () => {
    const desde = s.base.llamadas.length;
    const r = await pedir(s.url, { ruta: '/api/usuarios', token: s.tokenGerente });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.cuerpo));
    assert.deepEqual(r.cuerpo.map((u) => u.id), [1, 2]);

    // Lo que importa: la consulta no nombra la columna del hash en ningún lado
    // y pide el orden por id (el array podría venir ordenado por casualidad).
    const consultas = s.base.llamadas.slice(desde).map((c) => c.sql);
    assert.ok(consultas.length > 0, 'tiene que haber consultado la base');
    for (const sql of consultas) {
      assert.equal(/password/i.test(sql), false, `el SQL no puede pedir el hash: ${sql}`);
    }
    assert.match(consultas[0], /ORDER BY\s+id\s+ASC/i, `tiene que ordenar por id: ${consultas[0]}`);
  });

  test('PUT sin token responde 401', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT', ruta: '/api/usuarios/2/rol', cuerpo: { rol: 'gerente' },
    });
    assert.equal(r.status, 401);
  });

  test('PUT con rol usuario responde 403', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT', ruta: '/api/usuarios/2/rol', cuerpo: { rol: 'gerente' },
      token: s.tokenUsuario,
    });
    assert.equal(r.status, 403);
  });

  test('PUT con un rol inventado responde 400', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT', ruta: '/api/usuarios/2/rol', cuerpo: { rol: 'superadmin' },
      token: s.tokenGerente,
    });
    assert.equal(r.status, 400);
  });

  test('PUT sin el campo rol responde 400', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT', ruta: '/api/usuarios/2/rol', cuerpo: {},
      token: s.tokenGerente,
    });
    assert.equal(r.status, 400);
  });

  test('PUT con un id que no es número responde 400', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT', ruta: '/api/usuarios/abc/rol', cuerpo: { rol: 'gerente' },
      token: s.tokenGerente,
    });
    assert.equal(r.status, 400, 'un id no numérico no puede llegar a MySQL');
  });

  test('PUT sobre un usuario inexistente responde 404 con mensaje', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT', ruta: '/api/usuarios/999/rol', cuerpo: { rol: 'gerente' },
      token: s.tokenGerente,
    });
    assert.equal(r.status, 404);
    // El cuerpo tiene que ser JSON nuestro: con un router vacío Express
    // también devuelve 404, pero en HTML, y el test pasaría por el motivo
    // equivocado.
    assert.ok(r.cuerpo && r.cuerpo.mensaje, 'el 404 tiene que traer { mensaje }');
  });

  test('PUT del gerente cambia el rol y devuelve el usuario', async () => {
    const r = await pedir(s.url, {
      metodo: 'PUT', ruta: '/api/usuarios/2/rol', cuerpo: { rol: 'gerente' },
      token: s.tokenGerente,
    });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.id, 2);
    assert.equal(r.cuerpo.rol, 'gerente');
    assert.ok(r.cuerpo.nombre && r.cuerpo.email, 'tiene que releer nombre y email');
  });
});
