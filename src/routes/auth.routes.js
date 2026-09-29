const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// Hash de relleno para comparar contra él cuando el usuario no existe,
// evitando que el tiempo de respuesta delate si la cuenta es real (HU01).
const DUMMY_HASH = bcrypt.hashSync('relleno-sin-significado', 10);

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }

  const usuario = db.get('SELECT * FROM usuarios WHERE username = ?', [username]);
  const passwordValida = bcrypt.compareSync(password, usuario ? usuario.password_hash : DUMMY_HASH);

  if (!usuario || !passwordValida || !usuario.activo) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  req.session.user = { id: usuario.id, username: usuario.username, rol: usuario.rol };
  res.json({ user: req.session.user });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
  res.json({ user: req.session.user });
});

module.exports = router;
