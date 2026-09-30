const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// HU05 - Coordinador necesita ver los agentes activos para poder asignarles solicitudes
router.get('/agentes', requireRole('Coordinador'), (req, res) => {
  const agentes = db.all(
    `SELECT id, username FROM usuarios WHERE rol = 'Agente' AND activo = 1 ORDER BY username`
  );
  res.json({ agentes });
});

module.exports = router;
