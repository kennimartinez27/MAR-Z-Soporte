const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// HU11 - Auditor consulta el historial de decisiones: solo lectura, actor codificado (username),
// fecha, campo y valores anterior/nuevo. Acceso restringido al rol Auditor.
router.get('/', requireRole('Auditor'), (req, res) => {
  const condiciones = [];
  const params = [];

  if (req.query.solicitudId) {
    condiciones.push('h.solicitud_id = ?');
    params.push(req.query.solicitudId);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const eventos = db.all(
    `SELECT h.id, h.solicitud_id, s.titulo AS solicitud_titulo, u.username AS actor,
            h.campo, h.valor_anterior, h.valor_nuevo, h.fecha
     FROM historial h
     JOIN usuarios u ON u.id = h.actor_id
     JOIN solicitudes s ON s.id = h.solicitud_id
     ${where}
     ORDER BY h.fecha DESC
     LIMIT 200`,
    params
  );
  res.json({ eventos });
});

module.exports = router;
