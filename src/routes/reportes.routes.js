const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { condicionesBusqueda } = require('../utils/filtros');

const router = express.Router();

function mediana(numeros) {
  if (!numeros.length) return null;
  const ordenados = [...numeros].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  const valor =
    ordenados.length % 2 === 1
      ? ordenados[mitad]
      : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
  return Math.round(valor * 100) / 100;
}

// HU10 - Coordinador consulta indicadores agregados (volumen por estado, tiempo mediano de
// ciclo). Nunca devuelve desglose por solicitud individual ni por agente (sin ranking individual).
router.get('/indicadores', requireRole('Coordinador'), (req, res) => {
  const { condiciones, params } = condicionesBusqueda(req.query);
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const solicitudes = db.all(`SELECT id, estado, creado_en FROM solicitudes ${where}`, params);

  const volumenPorEstado = {};
  solicitudes.forEach((s) => {
    volumenPorEstado[s.estado] = (volumenPorEstado[s.estado] || 0) + 1;
  });

  const duracionesHoras = [];
  solicitudes
    .filter((s) => s.estado === 'Cerrada')
    .forEach((s) => {
      const cierre = db.get(
        `SELECT fecha FROM historial
         WHERE solicitud_id = ? AND campo = 'estado' AND valor_nuevo = 'Cerrada'
         ORDER BY fecha DESC LIMIT 1`,
        [s.id]
      );
      if (!cierre) return;
      const inicio = new Date(`${s.creado_en.replace(' ', 'T')}Z`).getTime();
      const fin = new Date(`${cierre.fecha.replace(' ', 'T')}Z`).getTime();
      duracionesHoras.push((fin - inicio) / 3_600_000);
    });

  res.json({
    filtros: {
      estado: req.query.estado || null,
      prioridad: req.query.prioridad || null,
      categoria: req.query.categoria || null,
    },
    volumenPorEstado,
    tiempoMedianoCicloHoras: mediana(duracionesHoras),
  });
});

const COLUMNAS_CSV = [
  'id',
  'titulo',
  'categoria',
  'estado',
  'prioridad',
  'propietario',
  'agente',
  'creado_en',
  'actualizado_en',
];

function escaparCsv(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// HU12 - Coordinador exporta un reporte CSV con los mismos filtros de HU09; excluye descripción
// (texto libre) y cualquier credencial; cada exportación queda registrada en `exportaciones`.
router.get('/export.csv', requireRole('Coordinador'), (req, res) => {
  const { condiciones, params } = condicionesBusqueda(req.query);
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const solicitudes = db.all(
    `SELECT s.id, s.titulo, s.categoria, s.estado, s.prioridad, s.creado_en, s.actualizado_en,
            up.username AS propietario, ua.username AS agente
     FROM solicitudes s
     JOIN usuarios up ON up.id = s.propietario_id
     LEFT JOIN usuarios ua ON ua.id = s.asignado_a
     ${where}
     ORDER BY s.creado_en DESC`,
    params
  );

  const filas = [COLUMNAS_CSV.join(',')];
  solicitudes.forEach((s) => filas.push(COLUMNAS_CSV.map((c) => escaparCsv(s[c])).join(',')));

  db.run('INSERT INTO exportaciones (actor_id, filtros, filas) VALUES (?, ?, ?)', [
    req.session.user.id,
    JSON.stringify(req.query || {}),
    solicitudes.length,
  ]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="solicitudes.csv"');
  res.send(filas.join('\n'));
});

module.exports = router;
