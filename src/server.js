require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const db = require('./db');
const authRoutes = require('./routes/auth.routes');
const solicitudesRoutes = require('./routes/solicitudes.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'cambia-este-secreto-en-desarrollo',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 4 },
  })
);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/solicitudes', solicitudesRoutes);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

async function start() {
  await db.connect();
  app.listen(PORT, () => console.log(`MAR-Z escuchando en http://localhost:${PORT}`));
}

start();
