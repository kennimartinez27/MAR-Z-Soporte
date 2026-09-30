CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('Solicitante','Agente','Coordinador','Auditor')),
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS solicitudes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  categoria TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Nuevo' CHECK (estado IN ('Nuevo','Asignada','En progreso','Resuelta','Reabierta','Cerrada')),
  prioridad TEXT CHECK (prioridad IN ('Baja','Media','Alta')),
  -- Cambio controlado (inicio Sprint 2): Alta exige justificación + fecha objetivo (HU02/HU04).
  prioridad_sugerida TEXT,
  justificacion TEXT,
  fecha_objetivo TEXT,
  propietario_id INTEGER NOT NULL REFERENCES usuarios(id),
  asignado_a INTEGER REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id),
  actor_id INTEGER NOT NULL REFERENCES usuarios(id),
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  fecha TEXT NOT NULL DEFAULT (datetime('now'))
);

-- HU06: comentarios de trabajo, inmutables una vez creados (sin UPDATE/DELETE expuestos).
CREATE TABLE IF NOT EXISTS comentarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id),
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  texto TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- HU05: notificaciones en la aplicación (ej. asignación de una solicitud).
CREATE TABLE IF NOT EXISTS notificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  solicitud_id INTEGER REFERENCES solicitudes(id),
  mensaje TEXT NOT NULL,
  leida INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- HU12: registro de cada exportación de reporte (quién, cuándo, con qué filtros).
CREATE TABLE IF NOT EXISTS exportaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER NOT NULL REFERENCES usuarios(id),
  filtros TEXT NOT NULL,
  filas INTEGER NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
