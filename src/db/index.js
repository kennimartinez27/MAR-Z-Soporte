const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'mar-z.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null;

async function connect() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  db.run(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  aplicarMigraciones();
  persist();
  return db;
}

// CREATE TABLE IF NOT EXISTS no agrega columnas a una tabla ya existente, así que las bases
// creadas antes del cambio controlado del Sprint 2 (justificación/fecha objetivo) se completan aquí.
function aplicarMigraciones() {
  const columnas = all("PRAGMA table_info(solicitudes)").map((c) => c.name);
  if (!columnas.includes('prioridad_sugerida')) {
    db.run('ALTER TABLE solicitudes ADD COLUMN prioridad_sugerida TEXT');
  }
  if (!columnas.includes('justificacion')) {
    db.run('ALTER TABLE solicitudes ADD COLUMN justificacion TEXT');
  }
  if (!columnas.includes('fecha_objetivo')) {
    db.run('ALTER TABLE solicitudes ADD COLUMN fecha_objetivo TEXT');
  }
}

function persist() {
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, Buffer.from(db.export()));
  fs.renameSync(tmpPath, DB_PATH);
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

module.exports = { connect, run, get, all, persist };
