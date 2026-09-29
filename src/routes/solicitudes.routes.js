const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const PRIORIDADES_VALIDAS = ['Baja', 'Media', 'Alta'];
const COLUMNAS_ORDENABLES = { prioridad: 'prioridad', estado: 'estado', fecha: 'creado_en' };

// HU02 - Solicitante crea una solicitud de soporte
router.post('/', requireRole('Solicitante'), (req, res) => {
  const { titulo, descripcion, categoria } = req.body || {};
  if (!titulo || !descripcion || !categoria) {
    return res.status(400).json({ error: 'Título, descripción y categoría son obligatorios' });
  }

  const creada = db.get(
    `INSERT INTO solicitudes (titulo, descripcion, categoria, estado, propietario_id)
     VALUES (?, ?, ?, 'Nuevo', ?) RETURNING *`,
    [titulo, descripcion, categoria, req.session.user.id]
  );
  db.persist();
  res.status(201).json({ solicitud: creada });
});

// HU03 - Solicitante consulta únicamente sus propias solicitudes
router.get('/mias', requireRole('Solicitante'), (req, res) => {
  const solicitudes = db.all(
    `SELECT id, titulo, categoria, estado, prioridad, creado_en, actualizado_en
     FROM solicitudes WHERE propietario_id = ? ORDER BY actualizado_en DESC`,
    [req.session.user.id]
  );
  res.json({ solicitudes });
});

router.get('/:id', requireRole('Solicitante'), (req, res) => {
  const solicitud = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  if (!solicitud || solicitud.propietario_id !== req.session.user.id) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }
  res.json({ solicitud });
});

// HU04 - Coordinador lista y prioriza solicitudes
router.get('/', requireRole('Coordinador'), (req, res) => {
  const campo = COLUMNAS_ORDENABLES[req.query.ordenarPor] || 'creado_en';
  const direccion = req.query.orden === 'asc' ? 'ASC' : 'DESC';
  const solicitudes = db.all(`SELECT * FROM solicitudes ORDER BY ${campo} ${direccion}`);
  res.json({ solicitudes });
});

router.patch('/:id/prioridad', requireRole('Coordinador'), (req, res) => {
  const { prioridad } = req.body || {};
  if (!PRIORIDADES_VALIDAS.includes(prioridad)) {
    return res.status(400).json({ error: 'Prioridad inválida' });
  }

  const solicitud = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

  db.run(`UPDATE solicitudes SET prioridad = ?, actualizado_en = datetime('now') WHERE id = ?`, [
    prioridad,
    req.params.id,
  ]);
  db.run(
    `INSERT INTO historial (solicitud_id, actor_id, campo, valor_anterior, valor_nuevo)
     VALUES (?, ?, 'prioridad', ?, ?)`,
    [req.params.id, req.session.user.id, solicitud.prioridad, prioridad]
  );

  const actualizada = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  res.json({ solicitud: actualizada });
});

module.exports = router;
