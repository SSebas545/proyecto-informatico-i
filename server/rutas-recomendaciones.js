'use strict';

// Router de recomendaciones (CU-07).
//
// Regla de negocio: libros de las categorías de las últimas 4 compras del
// cliente, sin los que ya compró, como máximo 6.
//
// Dos detalles que no son de estilo:
// - El `LIMIT 4` de la subconsulta va en una tabla derivada: MySQL rechaza
//   `LIMIT` dentro de un `IN (...)` (error 1235).
// - El id del usuario va siempre como parámetro, dos veces, nunca interpolado.
//
// Se arma con la misma fábrica que el router de usuarios: recibe
// `autenticarToken` y no duplica la verificación del JWT.

const express = require('express');
const { query } = require('./database');

const SQL_RECOMENDACIONES = `
  SELECT l.id, l.titulo, l.autor, l.precio, l.categoria_id
    FROM libros l
   WHERE l.categoria_id IN (
           SELECT categoria_id FROM (
             SELECT l2.categoria_id
               FROM pedido_items pi
               JOIN pedidos p  ON p.id  = pi.pedido_id
               JOIN libros  l2 ON l2.id = pi.libro_id
              WHERE p.usuario_id = ?
              ORDER BY p.creado_en DESC, pi.id DESC
              LIMIT 4
           ) AS recientes)
     AND NOT EXISTS (
           SELECT 1
             FROM pedido_items pi3
             JOIN pedidos p3 ON p3.id = pi3.pedido_id
            WHERE p3.usuario_id = ? AND pi3.libro_id = l.id)
   ORDER BY l.id ASC
   LIMIT 6
`;

module.exports = (autenticarToken) => {
  const router = express.Router();

  // GET /api/recomendaciones — sugerencias del cliente logueado.
  router.get('/api/recomendaciones', autenticarToken, async (req, res) => {
    try {
      const id = req.user.id;
      const [filas] = await query(SQL_RECOMENDACIONES, [id, id]);
      res.json(filas);
    } catch (error) {
      console.error(error);
      res.status(500).json({ mensaje: 'Error en el servidor' });
    }
  });

  return router;
};
