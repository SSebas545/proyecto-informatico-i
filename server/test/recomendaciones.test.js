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
 *
 * Ojo con lo que prueban estos casos: la base simulada NO ejecuta SQL, así que
 * el filtrado y el orden de los libros no se ejercitan acá. Lo que se prueba es
 * el contrato del endpoint (200 con las filas de la consulta, lista vacía en vez
 * de 404, una sola consulta, los dos parámetros) y la forma del SQL. La
 * semántica de la consulta se verificó contra MySQL de verdad en una
 * transacción deshecha (2026-11-13).
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

  test('con compras devuelve 200 con las filas de la sugerencia, una sola consulta y dos parámetros', async () => {
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

  test('el límite de 4 acota compras, no ítems de una misma compra', async () => {
    hook.registros = [];
    const desde = s.base.llamadas.length;

    await pedir(s.url, { ruta: '/api/recomendaciones', token: s.tokenUsuario });

    const { sql } = s.base.llamadas.slice(desde)[0];
    // Si el LIMIT 4 estuviera sobre pedido_items, una compra con varios libros
    // ocuparía varios lugares y dejaría afuera compras más nuevas.
    assert.match(
      sql,
      /SELECT\s+p2\.id\s+FROM\s+pedidos\s+p2[\s\S]*?LIMIT\s+4/i,
      `el LIMIT 4 tiene que acotar pedidos distintos: ${sql}`
    );
    assert.match(sql, /SELECT\s+DISTINCT/i, 'las categorías no tienen que repetirse');
  });

  test('sin filas devuelve 200 con lista vacía (nunca 404)', async () => {
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
