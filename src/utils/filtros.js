// HU09 - búsqueda por texto (título/descripción) + filtros por estado/prioridad/categoría,
// combinables entre sí (AND). Cada router antepone sus propias condiciones de alcance por rol.
function condicionesBusqueda(query = {}) {
  const condiciones = [];
  const params = [];

  const q = (query.q || '').trim();
  if (q) {
    condiciones.push('(LOWER(titulo) LIKE ? OR LOWER(descripcion) LIKE ?)');
    const comodin = `%${q.toLowerCase()}%`;
    params.push(comodin, comodin);
  }
  if (query.estado) {
    condiciones.push('estado = ?');
    params.push(query.estado);
  }
  if (query.prioridad) {
    condiciones.push('prioridad = ?');
    params.push(query.prioridad);
  }
  if (query.categoria) {
    condiciones.push('categoria = ?');
    params.push(query.categoria);
  }

  return { condiciones, params };
}

module.exports = { condicionesBusqueda };
