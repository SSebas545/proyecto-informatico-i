'use strict';

// Router de administración de usuarios (CU-12).
//
// Se arma con una fábrica para recibir el middleware `autenticarToken` que ya
// vive en index.js: acá no se duplica la verificación del JWT ni el secreto.
// El listado y el cambio de rol son solo para el gerente, y ninguna consulta
// pide la columna `password`.

const express = require('express');
const { query } = require('./database');

const ROLES = new Set(['usuario', 'gerente']);
const COLUMNAS = 'id, nombre, email, rol';

module.exports = (autenticarToken) => {
  const router = express.Router();

  // El gerente es el único que administra cuentas.
  function soloGerente(req, res, next) {
    if (!req.user || req.user.rol !== 'gerente') {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }
    next();
  }

  // GET /api/usuarios — listado completo, ordenado por id.
  router.get('/api/usuarios', autenticarToken, soloGerente, async (req, res) => {
    try {
      // query() devuelve [filas, campos], como mysql2.
      const [usuarios] = await query(`SELECT ${COLUMNAS} FROM usuarios ORDER BY id ASC`);
      res.json(usuarios);
    } catch (error) {
      console.error(error);
      res.status(500).json({ mensaje: 'Error en el servidor' });
    }
  });

  // PUT /api/usuarios/:id/rol — cambia el rol de una cuenta.
  router.put('/api/usuarios/:id/rol', autenticarToken, soloGerente, async (req, res) => {
    try {
      const { rol } = req.body || {};
      if (!ROLES.has(rol)) {
        return res.status(400).json({ mensaje: 'Rol inválido' });
      }

      const [resultado] = await query('UPDATE usuarios SET rol = ? WHERE id = ?', [
        rol,
        req.params.id
      ]);
      if (resultado.affectedRows === 0) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }

      // El UPDATE no devuelve nombre ni email: se relee la fila.
      const [filas] = await query(`SELECT ${COLUMNAS} FROM usuarios WHERE id = ?`, [req.params.id]);
      if (!filas.length) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }
      res.json(filas[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ mensaje: 'Error en el servidor' });
    }
  });

  return router;
};
