const express = require('express');
const db = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
}

// HU05 - notificación en la aplicación cuando se asigna una solicitud
router.get('/', requireAuth, (req, res) => {
  const notificaciones = db.all(
    `SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT 20`,
    [req.session.user.id]
  );
  res.json({ notificaciones });
});

router.patch('/:id/leida', requireAuth, (req, res) => {
  const notificacion = db.get('SELECT * FROM notificaciones WHERE id = ?', [req.params.id]);
  if (!notificacion || notificacion.usuario_id !== req.session.user.id) {
    return res.status(404).json({ error: 'Notificación no encontrada' });
  }
  db.run('UPDATE notificaciones SET leida = 1 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
