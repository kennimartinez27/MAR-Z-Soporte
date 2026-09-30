const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { condicionesBusqueda } = require('../utils/filtros');

const router = express.Router();

const PRIORIDADES_VALIDAS = ['Baja', 'Media', 'Alta'];
const COLUMNAS_ORDENABLES = { prioridad: 'prioridad', estado: 'estado', fecha: 'creado_en' };

// HU07 - transiciones de estado permitidas cuando el agente asignado actualiza el flujo de atención.
const TRANSICIONES_AGENTE = {
  Asignada: ['En progreso'],
  'En progreso': ['Resuelta'],
  Reabierta: ['En progreso'],
};

function puedeVerSolicitud(solicitud, user) {
  if (user.rol === 'Coordinador' || user.rol === 'Auditor') return true;
  if (user.rol === 'Solicitante') return solicitud.propietario_id === user.id;
  if (user.rol === 'Agente') return solicitud.asignado_a === user.id;
  return false;
}

// Cambio controlado (inicio Sprint 2): Alta exige justificación y una fecha objetivo no pasada.
function fechaObjetivoValida(fechaObjetivo) {
  if (!fechaObjetivo) return false;
  const fecha = new Date(`${fechaObjetivo}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return false;
  const hoy = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return fecha.getTime() >= hoy.getTime();
}

// HU02 - Solicitante crea una solicitud de soporte; puede sugerir prioridad Alta con justificación
router.post('/', requireRole('Solicitante'), (req, res) => {
  const { titulo, descripcion, categoria, prioridadSugerida, justificacion, fechaObjetivo } =
    req.body || {};
  if (!titulo || !descripcion || !categoria) {
    return res.status(400).json({ error: 'Título, descripción y categoría son obligatorios' });
  }

  let sugerida = null;
  let justificacionGuardada = null;
  let fechaObjetivoGuardada = null;
  if (prioridadSugerida) {
    if (prioridadSugerida !== 'Alta') {
      return res.status(400).json({ error: 'Solo se puede sugerir prioridad Alta' });
    }
    if (!(justificacion || '').trim() || !fechaObjetivoValida(fechaObjetivo)) {
      return res.status(400).json({
        error: 'Sugerir prioridad Alta requiere justificación y una fecha objetivo válida (no pasada)',
      });
    }
    sugerida = 'Alta';
    justificacionGuardada = justificacion.trim();
    fechaObjetivoGuardada = fechaObjetivo;
  }

  const creada = db.get(
    `INSERT INTO solicitudes
       (titulo, descripcion, categoria, estado, propietario_id, prioridad_sugerida, justificacion, fecha_objetivo)
     VALUES (?, ?, ?, 'Nuevo', ?, ?, ?, ?) RETURNING *`,
    [
      titulo,
      descripcion,
      categoria,
      req.session.user.id,
      sugerida,
      justificacionGuardada,
      fechaObjetivoGuardada,
    ]
  );
  db.persist();
  res.status(201).json({ solicitud: creada });
});

// HU03 / HU08 / HU09 - Solicitante consulta sus propias solicitudes, con búsqueda y filtros
router.get('/mias', requireRole('Solicitante'), (req, res) => {
  const { condiciones, params } = condicionesBusqueda(req.query);
  condiciones.unshift('propietario_id = ?');
  params.unshift(req.session.user.id);

  const solicitudes = db.all(
    `SELECT id, titulo, categoria, estado, prioridad, prioridad_sugerida, justificacion,
            fecha_objetivo, creado_en, actualizado_en
     FROM solicitudes WHERE ${condiciones.join(' AND ')} ORDER BY actualizado_en DESC`,
    params
  );
  res.json({ solicitudes });
});

// HU05/HU07/HU09 - Agente consulta las solicitudes que tiene asignadas, con búsqueda y filtros
router.get('/asignadas', requireRole('Agente'), (req, res) => {
  const { condiciones, params } = condicionesBusqueda(req.query);
  condiciones.unshift('asignado_a = ?');
  params.unshift(req.session.user.id);

  const solicitudes = db.all(
    `SELECT * FROM solicitudes WHERE ${condiciones.join(' AND ')} ORDER BY actualizado_en DESC`,
    params
  );
  res.json({ solicitudes });
});

router.get('/:id', requireRole('Solicitante', 'Agente', 'Coordinador', 'Auditor'), (req, res) => {
  const solicitud = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  if (!solicitud || !puedeVerSolicitud(solicitud, req.session.user)) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }
  res.json({ solicitud });
});

// HU04 / HU09 - Coordinador y Auditor listan (y el Coordinador prioriza) todas las solicitudes
router.get('/', requireRole('Coordinador', 'Auditor'), (req, res) => {
  const campo = COLUMNAS_ORDENABLES[req.query.ordenarPor] || 'creado_en';
  const direccion = req.query.orden === 'asc' ? 'ASC' : 'DESC';
  const { condiciones, params } = condicionesBusqueda(req.query);
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const solicitudes = db.all(
    `SELECT * FROM solicitudes ${where} ORDER BY ${campo} ${direccion}`,
    params
  );
  res.json({ solicitudes });
});

router.patch('/:id/prioridad', requireRole('Coordinador'), (req, res) => {
  const { prioridad } = req.body || {};
  if (!PRIORIDADES_VALIDAS.includes(prioridad)) {
    return res.status(400).json({ error: 'Prioridad inválida' });
  }

  const solicitud = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

  // Cambio controlado (inicio Sprint 2): Alta exige justificación + fecha objetivo. Si el
  // Solicitante ya las sugirió en HU02 y el Coordinador no envía otras, se conservan esas.
  let justificacion = null;
  let fechaObjetivo = null;
  if (prioridad === 'Alta') {
    justificacion = (req.body.justificacion || solicitud.justificacion || '').trim();
    fechaObjetivo = req.body.fechaObjetivo || solicitud.fecha_objetivo;
    if (!justificacion || !fechaObjetivoValida(fechaObjetivo)) {
      return res.status(400).json({
        error: 'La prioridad Alta requiere justificación y una fecha objetivo válida (no pasada)',
      });
    }
  }

  db.run(
    `UPDATE solicitudes
     SET prioridad = ?, justificacion = ?, fecha_objetivo = ?, prioridad_sugerida = NULL,
         actualizado_en = datetime('now')
     WHERE id = ?`,
    [prioridad, justificacion, fechaObjetivo, req.params.id]
  );
  db.run(
    `INSERT INTO historial (solicitud_id, actor_id, campo, valor_anterior, valor_nuevo)
     VALUES (?, ?, 'prioridad', ?, ?)`,
    [req.params.id, req.session.user.id, solicitud.prioridad, prioridad]
  );

  const actualizada = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  res.json({ solicitud: actualizada });
});

// HU05 - Coordinador asigna una solicitud a un agente activo
router.patch('/:id/asignar', requireRole('Coordinador'), (req, res) => {
  const { agenteId } = req.body || {};
  const solicitud = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (solicitud.estado === 'Cerrada') {
    return res.status(400).json({ error: 'No se puede asignar una solicitud cerrada' });
  }

  const agente = db.get('SELECT * FROM usuarios WHERE id = ?', [agenteId]);
  if (!agente || agente.rol !== 'Agente' || !agente.activo) {
    return res.status(400).json({ error: 'Debe asignar a un agente activo' });
  }

  const nuevoEstado = solicitud.estado === 'Nuevo' ? 'Asignada' : solicitud.estado;

  db.run(
    `UPDATE solicitudes SET asignado_a = ?, estado = ?, actualizado_en = datetime('now') WHERE id = ?`,
    [agente.id, nuevoEstado, req.params.id]
  );
  db.run(
    `INSERT INTO historial (solicitud_id, actor_id, campo, valor_anterior, valor_nuevo)
     VALUES (?, ?, 'asignado_a', ?, ?)`,
    [req.params.id, req.session.user.id, solicitud.asignado_a, agente.id]
  );
  if (nuevoEstado !== solicitud.estado) {
    db.run(
      `INSERT INTO historial (solicitud_id, actor_id, campo, valor_anterior, valor_nuevo)
       VALUES (?, ?, 'estado', ?, ?)`,
      [req.params.id, req.session.user.id, solicitud.estado, nuevoEstado]
    );
  }
  db.run(
    `INSERT INTO notificaciones (usuario_id, solicitud_id, mensaje) VALUES (?, ?, ?)`,
    [agente.id, req.params.id, `Se te asignó la solicitud #${req.params.id}: ${solicitud.titulo}`]
  );

  const actualizada = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  res.json({ solicitud: actualizada });
});

// HU07 - Agente cambia el estado siguiendo el flujo de atención permitido
router.patch('/:id/estado', requireRole('Agente'), (req, res) => {
  const { estado } = req.body || {};
  const solicitud = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  if (!solicitud || solicitud.asignado_a !== req.session.user.id) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }

  const transicionesValidas = TRANSICIONES_AGENTE[solicitud.estado] || [];
  if (!transicionesValidas.includes(estado)) {
    return res.status(400).json({ error: `Transición inválida: ${solicitud.estado} → ${estado}` });
  }

  db.run(`UPDATE solicitudes SET estado = ?, actualizado_en = datetime('now') WHERE id = ?`, [
    estado,
    req.params.id,
  ]);
  db.run(
    `INSERT INTO historial (solicitud_id, actor_id, campo, valor_anterior, valor_nuevo)
     VALUES (?, ?, 'estado', ?, ?)`,
    [req.params.id, req.session.user.id, solicitud.estado, estado]
  );

  const actualizada = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  res.json({ solicitud: actualizada });
});

// HU08 - Solicitante confirma el cierre o reabre una solución resuelta
router.patch('/:id/cierre', requireRole('Solicitante'), (req, res) => {
  const { accion, motivo } = req.body || {};
  const solicitud = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  if (!solicitud || solicitud.propietario_id !== req.session.user.id) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }
  if (solicitud.estado !== 'Resuelta') {
    return res.status(400).json({ error: 'Solo se puede confirmar o reabrir una solicitud Resuelta' });
  }
  if (!['confirmar', 'reabrir'].includes(accion)) {
    return res.status(400).json({ error: 'Acción inválida' });
  }
  if (accion === 'reabrir' && !(motivo || '').trim()) {
    return res.status(400).json({ error: 'Debe indicar el motivo de la reapertura' });
  }

  const nuevoEstado = accion === 'confirmar' ? 'Cerrada' : 'Reabierta';

  db.run(`UPDATE solicitudes SET estado = ?, actualizado_en = datetime('now') WHERE id = ?`, [
    nuevoEstado,
    req.params.id,
  ]);
  db.run(
    `INSERT INTO historial (solicitud_id, actor_id, campo, valor_anterior, valor_nuevo)
     VALUES (?, ?, 'estado', ?, ?)`,
    [req.params.id, req.session.user.id, solicitud.estado, nuevoEstado]
  );
  if (accion === 'reabrir') {
    db.run(
      `INSERT INTO comentarios (solicitud_id, autor_id, texto) VALUES (?, ?, ?)`,
      [req.params.id, req.session.user.id, `Motivo de reapertura: ${motivo.trim()}`]
    );
  }

  const actualizada = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  res.json({ solicitud: actualizada });
});

// HU06 - Agente registra comentarios de trabajo (inmutables); visibles a los roles con acceso
router.get(
  '/:id/comentarios',
  requireRole('Solicitante', 'Agente', 'Coordinador', 'Auditor'),
  (req, res) => {
    const solicitud = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
    if (!solicitud || !puedeVerSolicitud(solicitud, req.session.user)) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    const comentarios = db.all(
      `SELECT c.id, c.texto, c.creado_en, u.username AS autor
       FROM comentarios c JOIN usuarios u ON u.id = c.autor_id
       WHERE c.solicitud_id = ? ORDER BY c.creado_en ASC`,
      [req.params.id]
    );
    res.json({ comentarios });
  }
);

router.post('/:id/comentarios', requireRole('Agente'), (req, res) => {
  const { texto } = req.body || {};
  if (!(texto || '').trim()) {
    return res.status(400).json({ error: 'El comentario no puede estar vacío' });
  }

  const solicitud = db.get('SELECT * FROM solicitudes WHERE id = ?', [req.params.id]);
  if (!solicitud || solicitud.asignado_a !== req.session.user.id) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }

  const comentario = db.get(
    `INSERT INTO comentarios (solicitud_id, autor_id, texto) VALUES (?, ?, ?) RETURNING *`,
    [req.params.id, req.session.user.id, texto.trim()]
  );
  db.persist();
  res.status(201).json({ comentario });
});

module.exports = router;
