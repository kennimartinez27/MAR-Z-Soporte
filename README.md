# MAR-Z · Gestión de solicitudes de soporte

Caso de estudio del Anexo 10 (v2.0). Sprint 1: HU01–HU04. Sprint 2: HU05–HU08. Sprint 3: HU09–HU12.

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
| agente2 | Agente#123 | Agente |
| agente_inactivo | Agente#123 | Agente (inactivo, para probar HU05) |
| coordinador1 | Coordinador#123 | Coordinador |
| auditor1 | Auditor#123 | Auditor |

## Estructura

```
src/
  server.js               punto de entrada Express
  db/                      schema, conexión sql.js y semilla
  middleware/auth.js       requireRole(...) por sesión
  routes/                  auth, solicitudes, usuarios, notificaciones, historial, reportes
  utils/filtros.js         búsqueda/filtros compartidos (HU09)
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

## Cobertura Sprint 2 (HU05–HU08)

- **HU05** — `PATCH /api/solicitudes/:id/asignar` (Coordinador): valida que el agente exista, tenga
  rol Agente y esté activo; rechaza asignar solicitudes `Cerrada`; registra el cambio en `historial`
  y crea una notificación en `notificaciones` para el agente asignado.
- **HU06** — `POST /api/solicitudes/:id/comentarios` (solo el Agente asignado): comentario no vacío;
  autor y fecha quedan fijos en la fila (`comentarios`), sin rutas de edición/borrado; visible vía
  `GET /api/solicitudes/:id/comentarios` para todos los roles con acceso a esa solicitud.
- **HU07** — `PATCH /api/solicitudes/:id/estado` (solo el Agente asignado): solo permite las
  transiciones `Asignada→En progreso`, `En progreso→Resuelta` y `Reabierta→En progreso`; cualquier
  otra combinación se rechaza con 400; cada cambio queda en `historial`.
- **HU08** — `GET /api/solicitudes/mias?q=` (búsqueda por texto en título/descripción) y
  `PATCH /api/solicitudes/:id/cierre` (Solicitante propietario, solo si el estado es `Resuelta`):
  `accion: 'confirmar'` cierra la solicitud, `accion: 'reabrir'` exige `motivo` y la deja `Reabierta`
  (el motivo se guarda como comentario trazable); cada cambio de estado queda en `historial`.

## Cobertura Sprint 3 (HU09–HU12)

- **HU09** — `?q=&estado=&prioridad=&categoria=` (combinables) en `GET /api/solicitudes/mias`
  (Solicitante), `GET /api/solicitudes/asignadas` (Agente) y `GET /api/solicitudes` (ahora también
  abierto a Auditor, antes solo Coordinador): cada rol filtra dentro del alcance que ya tenía.
- **HU10** — `GET /api/reportes/indicadores` (Coordinador): volumen de solicitudes por estado y
  tiempo mediano de ciclo (creación → `Cerrada`, calculado desde `historial`), con los mismos
  filtros de HU09; nunca devuelve desglose por solicitud ni por agente.
- **HU11** — `GET /api/historial` (solo rol Auditor): solo lectura; devuelve actor (username),
  fecha, campo y valores anterior/nuevo de cada cambio registrado en `historial`.
- **HU12** — `GET /api/reportes/export.csv` (Coordinador): exporta CSV con los filtros de HU09,
  excluye `descripcion` (texto libre) y cualquier credencial; cada exportación queda registrada en
  la tabla `exportaciones` (actor, filtros usados, cantidad de filas).

## Cambios controlados (Anexo 10)

- **Inicio Sprint 2** — "Las solicitudes de prioridad Alta requieren justificación y fecha
  objetivo": la tabla `solicitudes` suma `justificacion`, `fecha_objetivo` y `prioridad_sugerida`
  (migración automática en `src/db/index.js` para bases ya existentes). El Solicitante puede
  sugerir Alta desde `POST /api/solicitudes` (HU02) con justificación y fecha objetivo (no pasada);
  el Coordinador la confirma en `PATCH /api/solicitudes/:id/prioridad` (HU04), heredando esos datos
  si ya fueron sugeridos, o exigiéndolos si no. Bajar de Alta a otra prioridad limpia ambos campos.
- **Inicio Sprint 3** — "El auditor necesita acceso de solo lectura al historial y el reporte debe
  excluir texto libre": ya cubierto por el diseño original de HU11/HU12 (`GET /api/historial` sin
  rutas de escritura y restringido a `requireRole('Auditor')`; `export.csv` sin `descripcion`).

## Convención de nombres de archivo (Anexo 10, punto 7)

```
CódigoGrupoExperimental-SprintX-FaseDelProyecto-DescripciónContenidoDelArchivo-FechaAAAAMMDD-Versión
```

Aplíquenla a entregables (documentos, backlogs, evidencias), no al código fuente del repositorio.
