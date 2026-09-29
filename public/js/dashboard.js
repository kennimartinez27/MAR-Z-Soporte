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

async function crearSolicitud(evento) {
  evento.preventDefault();
  const form = evento.target;
  const mensaje = document.getElementById('mensaje-nueva-solicitud');

  const respuesta = await fetch('/api/solicitudes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo: form.titulo.value.trim(),
      descripcion: form.descripcion.value.trim(),
      categoria: form.categoria.value.trim(),
    }),
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
  cargarMisSolicitudes();
}

async function cargarMisSolicitudes() {
  const respuesta = await fetch('/api/solicitudes/mias');
  if (!respuesta.ok) return;
  const { solicitudes } = await respuesta.json();

  const tbody = document.querySelector('#tabla-mis-solicitudes tbody');
  tbody.innerHTML = '';
  solicitudes.forEach((s) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `<td>${s.id}</td><td>${s.titulo}</td><td>${s.categoria}</td><td>${s.estado}</td><td>${s.prioridad ?? '—'}</td><td>${s.actualizado_en}</td>`;
    tbody.appendChild(fila);
  });
}

async function cargarTodasSolicitudes() {
  const ordenarPor = document.getElementById('ordenar-por').value;
  const respuesta = await fetch(`/api/solicitudes?ordenarPor=${ordenarPor}`);
  if (!respuesta.ok) return;
  const { solicitudes } = await respuesta.json();

  const tbody = document.querySelector('#tabla-todas-solicitudes tbody');
  tbody.innerHTML = '';
  solicitudes.forEach((s) => {
    const fila = document.createElement('tr');
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
      <td>${s.creado_en}</td>`;
    tbody.appendChild(fila);
  });

  document.querySelectorAll('.selector-prioridad').forEach((select) => {
    select.addEventListener('change', cambiarPrioridad);
  });
}

async function cambiarPrioridad(evento) {
  const id = evento.target.dataset.id;
  const prioridad = evento.target.value;
  if (!prioridad) return;

  const respuesta = await fetch(`/api/solicitudes/${id}/prioridad`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prioridad }),
  });

  if (!respuesta.ok) {
    const datos = await respuesta.json();
    alert(datos.error || 'No se pudo actualizar la prioridad');
  }
  cargarTodasSolicitudes();
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

  if (user.rol === 'Solicitante') {
    document.getElementById('form-nueva-solicitud').addEventListener('submit', crearSolicitud);
    cargarMisSolicitudes();
  }
  if (user.rol === 'Coordinador') {
    document.getElementById('ordenar-por').addEventListener('change', cargarTodasSolicitudes);
    cargarTodasSolicitudes();
  }
})();
