'use strict';

/**
 * CU-07 — recomendaciones del cliente.
 *
 * Regla fijada: libros de las categorías de las últimas 4 compras, sin los que
 * el cliente ya compró, como máximo 6 y en orden de id para que sea
 * determinístico.
 *
 * Detalle del banco de pruebas: el hook devuelve [filas, campos] (como mysql2)
 * y por eso "sin resultados" se simula con [[], []] y no con [].
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { montarServidor, pedir } = require('./helpers/banco-de-pruebas');

const CONSULTA = /NOT EXISTS/i;

const LIBROS = [
  { id: 5, titulo: 'Rayuela', autor: 'Cortázar', precio: 400, categoria_id: 1 },
  { id: 9, titulo: 'Ficciones', autor: 'Borges', precio: 350, categoria_id: 1 },
  { id: 12, titulo: 'El Aleph', autor: 'Borges', precio: 380, categoria_id: 1 }
];

function filas(registros) {
  return [registros, []];
}

describe('CU-07 recomendaciones', () => {
  let s;

  function hook(sql) {
    if (!CONSULTA.test(sql)) return null; // el resto sigue por defecto
    return filas(hook.registros);
  }
  hook.registros = LIBROS;

  before(async () => { s = await montarServidor({ query: hook }); });
  after(async () => { await s.cerrar(); });

  test('con compras previas devuelve los libros sugeridos en orden, sin los ya comprados', async () => {
    hook.registros = LIBROS;
    const desde = s.base.llamadas.length;

    const r = await pedir(s.url, { ruta: '/api/recomendaciones', token: s.tokenUsuario });

    assert.equal(r.status, 200);
    assert.deepEqual(r.cuerpo.map((l) => l.id), [5, 9, 12]);

    const consultas = s.base.llamadas.slice(desde);
    assert.equal(consultas.length, 1, 'la sugerencia se resuelve con una sola consulta');
    const { sql, params } = consultas[0];
    assert.match(sql, /NOT EXISTS/i, 'tiene que excluir los libros ya comprados');
    assert.match(sql, /LIMIT\s+6/i, 'tiene que limitar a 6');
    assert.deepEqual(params, [2, 2], 'el id del usuario va parametrizado, dos veces');
  });

  test('sin compras previas devuelve una lista vacía', async () => {
    hook.registros = [];
    const r = await pedir(s.url, { ruta: '/api/recomendaciones', token: s.tokenUsuario });
    assert.equal(r.status, 200);
    assert.deepEqual(r.cuerpo, []);
  });

  test('un id con SQL inyectado no se interpola en la consulta', async () => {
    const payload = "1 OR 1=1";
    const token = jwt.sign({ id: payload, rol: 'usuario' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    hook.registros = [];
    const desde = s.base.llamadas.length;

    const r = await pedir(s.url, { ruta: '/api/recomendaciones', token });

    assert.equal(r.status, 200, 'nunca 500: el id va como parámetro');
    const { sql, params } = s.base.llamadas.slice(desde).pop();
    assert.equal(sql.includes(payload), false, 'el payload no puede aparecer en el SQL');
    assert.deepEqual(params, [payload, payload]);
  });
});
