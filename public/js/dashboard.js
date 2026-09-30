const TRANSICIONES_AGENTE = {
  Asignada: ['En progreso'],
  'En progreso': ['Resuelta'],
  Reabierta: ['En progreso'],
};

async function cargarSesion() {
  const respuesta = await fetch('/api/auth/me');
  if (!respuesta.ok) {
    window.location.href = '/login.html';
    return null;
  }
  const { user } = await respuesta.json();
  return user;
}

function mostrarPanelSegunRol(user) {
  document.getElementById('nombre-usuario').textContent = `${user.username} (${user.rol})`;
  document.querySelectorAll('[data-rol]').forEach((el) => {
    el.hidden = el.dataset.rol !== user.rol;
  });
}

// HU09 - lee los controles [data-filtro] de un contenedor y arma el querystring
function leerFiltros(idContenedor) {
  const params = new URLSearchParams();
  document.querySelectorAll(`#${idContenedor} [data-filtro]`).forEach((campo) => {
    const valor = campo.value.trim();
    if (valor) params.set(campo.dataset.filtro, valor);
  });
  return params;
}

function activarFiltros(idContenedor, alCambiar) {
  document.querySelectorAll(`#${idContenedor} [data-filtro]`).forEach((campo) => {
    const evento = campo.tagName === 'SELECT' ? 'change' : 'input';
    let debounce;
    campo.addEventListener(evento, () => {
      clearTimeout(debounce);
      debounce = setTimeout(alCambiar, campo.tagName === 'SELECT' ? 0 : 300);
    });
  });
}

// Cambio controlado (inicio Sprint 2): el Solicitante puede sugerir prioridad Alta con
// justificación + fecha objetivo desde el propio formulario de creación (HU02).
function toggleCamposPrioridadAlta() {
  const marcado = document.getElementById('check-prioridad-alta').checked;
  document.getElementById('campos-prioridad-alta').hidden = !marcado;
}

async function crearSolicitud(evento) {
  evento.preventDefault();
  const form = evento.target;
  const mensaje = document.getElementById('mensaje-nueva-solicitud');
  const sugerirAlta = document.getElementById('check-prioridad-alta').checked;

  const cuerpo = {
    titulo: form.titulo.value.trim(),
    descripcion: form.descripcion.value.trim(),
    categoria: form.categoria.value.trim(),
  };
  if (sugerirAlta) {
    cuerpo.prioridadSugerida = 'Alta';
    cuerpo.justificacion = document.getElementById('justificacion-alta').value.trim();
    cuerpo.fechaObjetivo = document.getElementById('fecha-objetivo-alta').value;
  }

  const respuesta = await fetch('/api/solicitudes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });

  const datos = await respuesta.json();
  if (!respuesta.ok) {
    mensaje.textContent = datos.error || 'No se pudo crear la solicitud';
    mensaje.className = 'mensaje error';
    return;
  }

  mensaje.textContent = `Solicitud #${datos.solicitud.id} creada`;
  mensaje.className = 'mensaje ok';
  form.reset();
  toggleCamposPrioridadAlta();
  cargarMisSolicitudes();
}

// HU03 / HU08 / HU09 - listado propio con búsqueda, filtros y acciones de cierre
async function cargarMisSolicitudes() {
  const params = leerFiltros('filtros-mis-solicitudes');
  const respuesta = await fetch(`/api/solicitudes/mias?${params.toString()}`);
  if (!respuesta.ok) return;
  const { solicitudes } = await respuesta.json();

  const tbody = document.querySelector('#tabla-mis-solicitudes tbody');
  tbody.innerHTML = '';
  solicitudes.forEach((s) => {
    const fila = document.createElement('tr');
    const acciones =
      s.estado === 'Resuelta'
        ? `<button data-id="${s.id}" class="secundario btn-confirmar">Confirmar</button>
           <button data-id="${s.id}" class="secundario btn-reabrir">Reabrir</button>`
        : '—';
    const sugerida = s.prioridad_sugerida
      ? `<span title="${s.justificacion ?? ''} · Fecha objetivo: ${s.fecha_objetivo ?? ''}">${s.prioridad_sugerida} (pendiente)</span>`
      : '—';
    fila.innerHTML = `<td>${s.id}</td><td>${s.titulo}</td><td>${s.categoria}</td><td>${s.estado}</td><td>${s.prioridad ?? '—'}</td><td>${sugerida}</td><td>${s.actualizado_en}</td><td>${acciones}</td>`;
    tbody.appendChild(fila);
  });

  document.querySelectorAll('.btn-confirmar').forEach((btn) => btn.addEventListener('click', confirmarCierre));
  document.querySelectorAll('.btn-reabrir').forEach((btn) => btn.addEventListener('click', reabrirSolicitud));
}

async function enviarCierre(id, accion, motivo) {
  const respuesta = await fetch(`/api/solicitudes/${id}/cierre`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, motivo }),
  });
  if (!respuesta.ok) {
    const datos = await respuesta.json();
    alert(datos.error || 'No se pudo completar la acción');
  }
  cargarMisSolicitudes();
}

function confirmarCierre(evento) {
  enviarCierre(evento.target.dataset.id, 'confirmar');
}

function reabrirSolicitud(evento) {
  const motivo = prompt('Motivo de la reapertura:');
  if (!motivo || !motivo.trim()) return;
  enviarCierre(evento.target.dataset.id, 'reabrir', motivo.trim());
}

// HU04 / HU05 / HU09 - Coordinador prioriza, asigna y filtra solicitudes
async function cargarAgentesDisponibles() {
  const respuesta = await fetch('/api/usuarios/agentes');
  if (!respuesta.ok) return [];
  const { agentes } = await respuesta.json();
  return agentes;
}

async function cargarTodasSolicitudes() {
  const params = leerFiltros('filtros-todas-solicitudes');
  const ordenarPor = document.getElementById('ordenar-por').value;
  params.set('ordenarPor', ordenarPor);

  const [respuesta, agentes] = await Promise.all([
    fetch(`/api/solicitudes?${params.toString()}`),
    cargarAgentesDisponibles(),
  ]);
  if (!respuesta.ok) return;
  const { solicitudes } = await respuesta.json();

  const opcionesAgentes = agentes
    .map((a) => `<option value="${a.id}">${a.username}</option>`)
    .join('');

  const tbody = document.querySelector('#tabla-todas-solicitudes tbody');
  tbody.innerHTML = '';
  solicitudes.forEach((s) => {
    const fila = document.createElement('tr');
    const sugerida = s.prioridad_sugerida
      ? `<span title="${s.justificacion ?? ''} · Fecha objetivo: ${s.fecha_objetivo ?? ''}">${s.prioridad_sugerida} (pendiente)</span>`
      : '—';
    fila.innerHTML = `
      <td>${s.id}</td><td>${s.titulo}</td><td>${s.categoria}</td><td>${s.estado}</td>
      <td>
        <select data-id="${s.id}" class="selector-prioridad">
          <option value="" ${!s.prioridad ? 'selected' : ''}>—</option>
          <option value="Baja" ${s.prioridad === 'Baja' ? 'selected' : ''}>Baja</option>
          <option value="Media" ${s.prioridad === 'Media' ? 'selected' : ''}>Media</option>
          <option value="Alta" ${s.prioridad === 'Alta' ? 'selected' : ''}>Alta</option>
        </select>
      </td>
      <td>${sugerida}</td>
      <td>
        <select data-id="${s.id}" class="selector-agente" ${s.estado === 'Cerrada' ? 'disabled' : ''}>
          <option value="">Sin asignar</option>
          ${opcionesAgentes}
        </select>
      </td>
      <td>${s.creado_en}</td>`;
    const selectAgente = fila.querySelector('.selector-agente');
    if (s.asignado_a) selectAgente.value = String(s.asignado_a);
    tbody.appendChild(fila);
  });

  document.querySelectorAll('.selector-prioridad').forEach((select) => {
    select.addEventListener('change', cambiarPrioridad);
  });
  document.querySelectorAll('.selector-agente').forEach((select) => {
    select.addEventListener('change', asignarAgente);
  });
}

// Cambio controlado (inicio Sprint 2): si el Coordinador pone Alta y la solicitud no trae ya una
// justificación/fecha objetivo (p. ej. sugerida por el Solicitante en HU02), se piden aquí.
async function enviarPrioridad(id, prioridad, extra) {
  return fetch(`/api/solicitudes/${id}/prioridad`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prioridad, ...extra }),
  });
}

async function cambiarPrioridad(evento) {
  const id = evento.target.dataset.id;
  const prioridad = evento.target.value;
  if (!prioridad) return;

  let respuesta = await enviarPrioridad(id, prioridad);

  if (!respuesta.ok && prioridad === 'Alta') {
    const justificacion = prompt('Prioridad Alta requiere justificación:');
    if (!justificacion || !justificacion.trim()) {
      cargarTodasSolicitudes();
      return;
    }
    const fechaObjetivo = prompt('Fecha objetivo (AAAA-MM-DD):');
    if (!fechaObjetivo) {
      cargarTodasSolicitudes();
      return;
    }
    respuesta = await enviarPrioridad(id, prioridad, { justificacion, fechaObjetivo });
  }

  if (!respuesta.ok) {
    const datos = await respuesta.json();
    alert(datos.error || 'No se pudo actualizar la prioridad');
  }
  cargarTodasSolicitudes();
}

async function asignarAgente(evento) {
  const id = evento.target.dataset.id;
  const agenteId = evento.target.value;
  if (!agenteId) return;

  const respuesta = await fetch(`/api/solicitudes/${id}/asignar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agenteId: Number(agenteId) }),
  });

  if (!respuesta.ok) {
    const datos = await respuesta.json();
    alert(datos.error || 'No se pudo asignar la solicitud');
  }
  cargarTodasSolicitudes();
}

// HU10 - indicadores agregados (sin desglose individual), respetando los filtros de arriba
async function cargarIndicadores() {
  const params = leerFiltros('filtros-todas-solicitudes');
  params.delete('q');
  const respuesta = await fetch(`/api/reportes/indicadores?${params.toString()}`);
  if (!respuesta.ok) return;
  const { volumenPorEstado, tiempoMedianoCicloHoras } = await respuesta.json();

  document.getElementById('indicador-mediana').textContent =
    tiempoMedianoCicloHoras === null ? '—' : tiempoMedianoCicloHoras;

  const lista = document.getElementById('indicador-volumen');
  lista.innerHTML =
    Object.entries(volumenPorEstado)
      .map(([estado, cantidad]) => `<li>${estado}: ${cantidad}</li>`)
      .join('') || '<li>Sin datos para estos filtros.</li>';
}

function exportarCsv() {
  const params = leerFiltros('filtros-todas-solicitudes');
  window.location.href = `/api/reportes/export.csv?${params.toString()}`;
}

// HU05 / HU06 / HU07 / HU09 - Agente atiende y filtra sus solicitudes asignadas
async function cargarAsignadas() {
  const params = leerFiltros('filtros-asignadas');
  const respuesta = await fetch(`/api/solicitudes/asignadas?${params.toString()}`);
  if (!respuesta.ok) return;
  const { solicitudes } = await respuesta.json();

  const tbody = document.querySelector('#tabla-asignadas tbody');
  tbody.innerHTML = '';

  for (const s of solicitudes) {
    const transiciones = TRANSICIONES_AGENTE[s.estado] || [];
    const opcionesEstado = transiciones.map((e) => `<option value="${e}">${e}</option>`).join('');

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${s.id}</td>
      <td>${s.titulo}</td>
      <td>${s.estado}</td>
      <td>
        ${
          transiciones.length
            ? `<select data-id="${s.id}" class="selector-estado">
                 <option value="">—</option>
                 ${opcionesEstado}
               </select>`
            : '—'
        }
      </td>
      <td>
        <button class="secundario btn-ver-comentarios" data-id="${s.id}">Ver / comentar</button>
        <div class="comentarios-solicitud" data-id="${s.id}" hidden>
          <ul class="lista-comentarios"></ul>
          <form class="form-comentario">
            <textarea rows="2" placeholder="Nuevo comentario…" required></textarea>
            <button type="submit">Agregar</button>
          </form>
        </div>
      </td>`;
    tbody.appendChild(fila);
  }

  document.querySelectorAll('.selector-estado').forEach((select) => {
    select.addEventListener('change', cambiarEstado);
  });
  document.querySelectorAll('.btn-ver-comentarios').forEach((btn) => {
    btn.addEventListener('click', toggleComentarios);
  });
}

async function cambiarEstado(evento) {
  const id = evento.target.dataset.id;
  const estado = evento.target.value;
  if (!estado) return;

  const respuesta = await fetch(`/api/solicitudes/${id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  });

  if (!respuesta.ok) {
    const datos = await respuesta.json();
    alert(datos.error || 'No se pudo cambiar el estado');
  }
  cargarAsignadas();
}

async function toggleComentarios(evento) {
  const id = evento.target.dataset.id;
  const contenedor = document.querySelector(`.comentarios-solicitud[data-id="${id}"]`);
  contenedor.hidden = !contenedor.hidden;
  if (contenedor.hidden) return;

  await cargarComentarios(id, contenedor);
  const form = contenedor.querySelector('.form-comentario');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const textarea = form.querySelector('textarea');
    const respuesta = await fetch(`/api/solicitudes/${id}/comentarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: textarea.value.trim() }),
    });
    if (!respuesta.ok) {
      const datos = await respuesta.json();
      alert(datos.error || 'No se pudo agregar el comentario');
      return;
    }
    textarea.value = '';
    cargarComentarios(id, contenedor);
  };
}

async function cargarComentarios(id, contenedor) {
  const respuesta = await fetch(`/api/solicitudes/${id}/comentarios`);
  if (!respuesta.ok) return;
  const { comentarios } = await respuesta.json();
  const lista = contenedor.querySelector('.lista-comentarios');
  lista.innerHTML = comentarios
    .map((c) => `<li>${c.texto}<div class="meta">${c.autor} · ${c.creado_en}</div></li>`)
    .join('') || '<li class="meta">Sin comentarios todavía.</li>';
}

// HU11 - Auditor consulta el historial de decisiones (solo lectura)
async function cargarHistorial() {
  const respuesta = await fetch('/api/historial');
  if (!respuesta.ok) return;
  const { eventos } = await respuesta.json();

  const tbody = document.querySelector('#tabla-historial tbody');
  tbody.innerHTML = eventos
    .map(
      (e) => `<tr>
        <td>${e.fecha}</td>
        <td>#${e.solicitud_id} ${e.solicitud_titulo}</td>
        <td>${e.actor}</td>
        <td>${e.campo}</td>
        <td>${e.valor_anterior ?? '—'}</td>
        <td>${e.valor_nuevo ?? '—'}</td>
      </tr>`
    )
    .join('');
}

// HU05 - notificaciones en la aplicación
async function cargarNotificaciones() {
  const respuesta = await fetch('/api/notificaciones');
  if (!respuesta.ok) return;
  const { notificaciones } = await respuesta.json();

  const contenedor = document.getElementById('notificaciones');
  contenedor.hidden = notificaciones.length === 0;

  const noLeidas = notificaciones.filter((n) => !n.leida).length;
  document.getElementById('contador-notificaciones').textContent = noLeidas > 0 ? noLeidas : '';

  const lista = document.getElementById('lista-notificaciones');
  lista.innerHTML = notificaciones
    .map((n) => `<li class="${n.leida ? '' : 'no-leida'}" data-id="${n.id}">${n.mensaje}<div class="meta">${n.creado_en}</div></li>`)
    .join('');
}

function toggleListaNotificaciones() {
  const lista = document.getElementById('lista-notificaciones');
  lista.hidden = !lista.hidden;
  if (!lista.hidden) {
    lista.querySelectorAll('li.no-leida').forEach((li) => {
      fetch(`/api/notificaciones/${li.dataset.id}/leida`, { method: 'PATCH' });
      li.classList.remove('no-leida');
    });
    document.getElementById('contador-notificaciones').textContent = '';
  }
}

async function cerrarSesion() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

(async function iniciar() {
  const user = await cargarSesion();
  if (!user) return;

  mostrarPanelSegunRol(user);
  document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
  document.getElementById('btn-notificaciones').addEventListener('click', toggleListaNotificaciones);
  cargarNotificaciones();

  if (user.rol === 'Solicitante') {
    document.getElementById('form-nueva-solicitud').addEventListener('submit', crearSolicitud);
    document
      .getElementById('check-prioridad-alta')
      .addEventListener('change', toggleCamposPrioridadAlta);
    activarFiltros('filtros-mis-solicitudes', cargarMisSolicitudes);
    cargarMisSolicitudes();
  }
  if (user.rol === 'Coordinador') {
    document.getElementById('ordenar-por').addEventListener('change', cargarTodasSolicitudes);
    activarFiltros('filtros-todas-solicitudes', () => {
      cargarTodasSolicitudes();
      cargarIndicadores();
    });
    document.getElementById('btn-exportar-csv').addEventListener('click', exportarCsv);
    cargarTodasSolicitudes();
    cargarIndicadores();
  }
  if (user.rol === 'Agente') {
    activarFiltros('filtros-asignadas', cargarAsignadas);
    cargarAsignadas();
  }
  if (user.rol === 'Auditor') {
    cargarHistorial();
  }
})();
