document.getElementById('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const form = evento.target;
  const mensaje = document.getElementById('mensaje-login');
  mensaje.textContent = '';

  const respuesta = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: form.username.value.trim(),
      password: form.password.value,
    }),
  });

  const datos = await respuesta.json();
  if (!respuesta.ok) {
    mensaje.textContent = datos.error || 'No se pudo iniciar sesión';
    return;
  }

  window.location.href = '/dashboard.html';
});
