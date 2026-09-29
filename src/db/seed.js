const bcrypt = require('bcryptjs');
const db = require('./index');

// Credenciales de datos semilla para pruebas (Anexo 10, punto 2: "los datos
// semilla para efectos de pruebas pueden ser utilizados por los participantes").
const USUARIOS_SEED = [
  { username: 'solicitante1', password: 'Solicitante#123', rol: 'Solicitante' },
  { username: 'agente1', password: 'Agente#123', rol: 'Agente' },
  { username: 'coordinador1', password: 'Coordinador#123', rol: 'Coordinador' },
  { username: 'auditor1', password: 'Auditor#123', rol: 'Auditor' },
];

async function seed() {
  await db.connect();

  const existentes = db.all('SELECT id FROM usuarios');
  if (existentes.length > 0) {
    console.log('La base de datos ya tiene usuarios; se omite la siembra.');
    return;
  }

  for (const u of USUARIOS_SEED) {
    const hash = bcrypt.hashSync(u.password, 10);
    db.run('INSERT INTO usuarios (username, password_hash, rol) VALUES (?, ?, ?)', [
      u.username,
      hash,
      u.rol,
    ]);
  }

  console.log('Usuarios semilla creados:');
  USUARIOS_SEED.forEach((u) => console.log(`  - ${u.username} / ${u.password} (${u.rol})`));
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seed;
