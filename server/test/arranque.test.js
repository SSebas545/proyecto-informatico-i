'use strict';

/**
 * Regresiones del arranque HTTP. No levanta la base real: reemplaza el modulo
 * database en require.cache, igual que el banco de pruebas de api.test.js.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');

const RUTA_SERVER = path.join(__dirname, '..');
const RUTA_DATABASE = path.join(RUTA_SERVER, 'database.js');
const RUTA_INDEX = path.join(RUTA_SERVER, 'index.js');

function cargarApp() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-arranque';

  const base = {
    pool: {},
    query: async () => [[], []],
    inicializar: async () => {},
    conTransaccion: async (fn) => fn({}),
    cerrarPool: async () => {}
  };

  require.cache[RUTA_DATABASE] = {
    id: RUTA_DATABASE,
    filename: RUTA_DATABASE,
    loaded: true,
    exports: base
  };
  delete require.cache[RUTA_INDEX];

  return require(RUTA_INDEX);
}

describe('arranque del servidor', () => {
  const app = cargarApp();

  test('iniciarServidor resuelve cuando el puerto esta libre', async () => {
    const server = await app.iniciarServidor(0);
    try {
      const direccion = server.address();
      assert.ok(direccion, 'tiene que tener una direccion');
      assert.ok(direccion.port > 0, 'tiene que escuchar en un puerto real');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('iniciarServidor rechaza con EADDRINUSE si el puerto esta ocupado', async () => {
    // REGRESION: antes el callback de app.listen imprimia "Servidor
    // corriendo" y el proceso salia con codigo 0. Express 5 usa ese callback
    // como manejador del evento 'error', asi que el error quedaba consumido.
    const ocupante = net.createServer();
    await new Promise((resolve, reject) => {
      ocupante.once('error', reject);
      ocupante.listen(0, resolve);
    });

    try {
      const { port } = ocupante.address();
      await assert.rejects(
        app.iniciarServidor(port),
        error => error.code === 'EADDRINUSE',
        'tiene que rechazar con EADDRINUSE'
      );
    } finally {
      await new Promise(resolve => ocupante.close(resolve));
    }
  });
});
