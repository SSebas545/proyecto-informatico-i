'use strict';

/**
 * Regresiones de inicializar(). A diferencia de api.test.js, aca NO se simula
 * el modulo database: se ejecuta el database.js real con un pool de mysql2
 * falso, para verificar el contrato [filas, campos] de punta a punta.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const RUTA_SERVER = path.join(__dirname, '..');
const RUTA_DATABASE = path.join(RUTA_SERVER, 'database.js');
const RUTA_MYSQL = require.resolve(path.join(RUTA_SERVER, 'node_modules', 'mysql2', 'promise'));

// Carga database.js con un pool falso que sabe que usuarios existen.
// usuariosExistentes: [{ id, email }]
function cargarDatabase(usuariosExistentes = []) {
  const llamadas = [];

  const poolFalso = {
    execute: async (sql, params = []) => {
      const limpio = String(sql).replace(/\s+/g, ' ').trim();
      llamadas.push({ sql: limpio, params });

      if (/^SELECT id FROM usuarios/i.test(limpio)) {
        const filas = usuariosExistentes
          .filter(u => u.email === params[0])
          .map(u => ({ id: u.id }));
        return [filas, []];
      }

      return [{ affectedRows: 1, insertId: llamadas.length }, []];
    },
    end: async () => {}
  };

  delete require.cache[RUTA_DATABASE];
  require.cache[RUTA_MYSQL] = {
    id: RUTA_MYSQL,
    filename: RUTA_MYSQL,
    loaded: true,
    exports: { createPool: () => poolFalso }
  };

  const db = require(RUTA_DATABASE);

  return {
    db,
    llamadas,
    limpiar() {
      delete require.cache[RUTA_DATABASE];
      delete require.cache[RUTA_MYSQL];
    }
  };
}

test('inicializar crea los usuarios por defecto en una base vacía', async (t) => {
  // REGRESION: query() devuelve [filas, campos], pero el codigo hacia
  // `adminExistente.length === 0` sobre ese par. El length era 2 siempre,
  // asi que nunca insertaba los usuarios y en una base nueva no se podia
  // entrar al sistema.
  const { db, llamadas, limpiar } = cargarDatabase([]);
  t.after(limpiar);

  await db.inicializar();

  const inserts = llamadas.filter(c => /^INSERT INTO usuarios/i.test(c.sql));
  assert.equal(inserts.length, 2, 'tiene que crear el gerente y el usuario de prueba');

  const emails = inserts.map(c => c.params[1]).sort();
  assert.deepEqual(emails, ['admin@libreria.com', 'usuario@test.com']);

  // La contrasena se guarda hasheada, nunca en texto plano.
  for (const insert of inserts) {
    assert.match(String(insert.params[2]), /^\$2[aby]\$/, 'la password tiene que ir hasheada');
  }
});

test('inicializar no duplica usuarios que ya existen', async (t) => {
  const { db, llamadas, limpiar } = cargarDatabase([
    { id: 1, email: 'admin@libreria.com' },
    { id: 2, email: 'usuario@test.com' }
  ]);
  t.after(limpiar);

  await db.inicializar();

  const inserts = llamadas.filter(c => /^INSERT INTO usuarios/i.test(c.sql));
  assert.equal(inserts.length, 0, 'con los usuarios ya creados no debe insertar nada');
});

test('inicializar crea las ocho categorias por defecto', async (t) => {
  const { db, llamadas, limpiar } = cargarDatabase([]);
  t.after(limpiar);

  await db.inicializar();

  const inserts = llamadas.filter(c => /^INSERT IGNORE INTO categorias/i.test(c.sql));
  assert.equal(inserts.length, 8);
});
