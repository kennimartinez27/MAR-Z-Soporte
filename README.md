# MAR-Z · Gestión de solicitudes de soporte

Caso de estudio del Anexo 10 (v2.0). Sprint 1 en desarrollo: HU01–HU04.

## Stack

- Backend: Node.js + Express, sesiones con `express-session`, contraseñas con `bcryptjs`.
- Base de datos: SQLite real vía `sql.js` (WebAssembly, sin dependencias nativas — el equipo
  no tiene herramientas de compilación de C++ instaladas). El archivo vive en `data/mar-z.sqlite`
  y se regenera a partir de `src/db/schema.sql` si no existe.
- Frontend: HTML/CSS/JS sin frameworks, servido como archivos estáticos desde `public/`.

## Primeros pasos

```bash
npm install
npm run seed   # crea usuarios de prueba (uno por rol)
npm run dev    # http://localhost:3000
```

Usuarios semilla (ver `src/db/seed.js`):

| Usuario | Contraseña | Rol |
|---|---|---|
| solicitante1 | Solicitante#123 | Solicitante |
| agente1 | Agente#123 | Agente |
| coordinador1 | Coordinador#123 | Coordinador |
| auditor1 | Auditor#123 | Auditor |

## Estructura

```
src/
  server.js               punto de entrada Express
  db/                      schema, conexión sql.js y semilla
  middleware/auth.js       requireRole(...) por sesión
  routes/                  auth.routes.js, solicitudes.routes.js
public/
  login.html / dashboard.html + css/js
```

## Cobertura Sprint 1 (HU01–HU04)

- **HU01** — `POST /api/auth/login`: credenciales inválidas no distinguen si el usuario existe;
  sesión por cookie; cada ruta protegida valida el rol con `requireRole`.
- **HU02** — `POST /api/solicitudes`: solo rol Solicitante; título/descripción/categoría obligatorios.
- **HU03** — `GET /api/solicitudes/mias` y `GET /api/solicitudes/:id`: solo solicitudes propias.
- **HU04** — `GET /api/solicitudes` (ordenable por prioridad/estado/fecha) y
  `PATCH /api/solicitudes/:id/prioridad`: solo rol Coordinador; cada cambio queda en `historial`.

## Convención de nombres de archivo (Anexo 10, punto 7)

```
CódigoGrupoExperimental-SprintX-FaseDelProyecto-DescripciónContenidoDelArchivo-FechaAAAAMMDD-Versión
```

Aplíquenla a entregables (documentos, backlogs, evidencias), no al código fuente del repositorio.
