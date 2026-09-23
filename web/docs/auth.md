# Auth del dashboard admin

Estado: aceptada (#126). Revisar cuando se cumpla el trigger de abajo.

## Decisión

- Access token (JWT, 15 min) y user en `localStorage`.
- Refresh token (opaco, rota en cada uso) en `sessionStorage`.
- Header `Authorization: Bearer`, igual que mobile.
- Guard de rutas client-side en `app/(admin)/layout.tsx` (`AdminGuard`).

## Por qué

- Hasta 5 admins por barrio, y el dashboard no renderiza contenido subido
  por terceros: superficie XSS baja.
- Cookies httpOnly piden cambios en el backend (`AuthController` seteando
  cookies, filtro JWT leyéndolas, token CSRF en POST/PATCH/DELETE). No vale
  frenar el arranque del dashboard por eso.
- Mismo patrón Bearer que mobile.
- Refresh en `sessionStorage` para que muera al cerrar el tab: aunque roben
  el access, la ventana para obtener uno nuevo con el refresh se limita al
  tab abierto.

## Trigger para revisar

Cuando el dashboard renderice contenido subido por usuarios (fotos con
thumbnails, texto libre sin escapar, uploads). Ahí migrar a cookies
httpOnly + token CSRF deja de ser opcional.

## El guard no es seguridad

`AdminGuard` evita mostrar el dashboard sin sesión. El control real es
`@PreAuthorize` en `/admin/**` del backend: un usuario que se saltee el guard
recibe 403 en cada dato.

Las páginas se prerenderizan como estáticas y el server no lee storage, así
que lo que se pinta siempre sale en estado `restoring` (pantalla vacía): un
browser sin sesión no ve el dashboard ni por un frame.

Lo que sí viaja es el markup estático de las páginas: son children de
`AdminGuard` y van serializados en el payload RSC, igual que el JS del bundle
es público. Verificado en #126: el texto del placeholder de `/` está en el
payload y no en el DOM. Por eso la regla:

**Ninguna página de `(admin)` trae datos del lado del server de Next.** Todo
dato sale de `api` en el cliente, con Bearer, contra el backend. Un fetch en
un Server Component de `(admin)` quedaría serializado en el HTML estático
para cualquiera que lo pida.

## Refresh

En `src/common/api/client.ts`, dentro del `fetch` custom de `openapi-fetch`:
toda llamada de `api` pasa por ahí, no hay wrapper opcional que olvidar.

- **Single-flight.** El backend revoca toda la familia si recibe un refresh
  ya rotado. Dos refresh en paralelo matan la sesión. Todos los 401
  simultáneos esperan la misma promesa (`inFlight`). Mobile tenía este bug:
  #131.
- **401 tardío.** Si el access cambió desde que salió el request, otro ya
  refrescó: se reintenta con el actual sin gastar otro refresh.
- **Un solo reintento.** Si vuelve 401, se cierra la sesión. Sin loops.
- **Fallo según motivo.** 400/401 del refresh: se cierra la sesión con
  motivo `expired`. Error de red o 5xx: la sesión queda intacta, el refresh
  sigue siendo válido y el request falla con error de conexión.

## Limitaciones conocidas

**Un tab nuevo arranca deslogueado.** Abrir el dashboard en otro tab (URL
nueva, ctrl+click) no copia `sessionStorage`: sin refresh no hay sesión y se
pide login. Es consecuencia directa de la decisión, no un bug.

**"Duplicar pestaña" termina en login en los dos tabs.** Duplicar sí copia
`sessionStorage`: los dos tabs quedan con el mismo refresh. El primero que
refresca lo rota; cuando el otro refresca con la copia vieja, el backend lo
ve como reuso y revoca la familia. Verificado contra el backend (#126):

| Paso | Respuesta |
|---|---|
| Tab A refresca con R0 | 200, recibe R1 y A1 |
| Tab B refresca con R0 | 401, familia revocada |
| Tab A llama a `/admin/**` con A1 | 200 (el JWT sobrevive hasta vencer) |
| Tab A refresca con R1 | 401 |

Sin nada más, B quedaría afuera y A seguiría hasta 15 min. Para que no
pase, cada tab escucha el evento `storage`: cuando otro tab borra el access,
este cierra sesión también con el motivo "Se cerró la sesión desde otra
pestaña". Los dos terminan en login juntos. El mismo mecanismo hace que
"Cerrar sesión" cierre todos los tabs.

**Chrome con "Continuar donde lo dejaste" restaura `sessionStorage`.** Con
esa opción (Configuración → Al iniciar), cerrar y reabrir el navegador
restaura los tabs con su `sessionStorage`, y la sesión sobrevive. El
criterio "cerrar el navegador corta la sesión" se verifica con "Abrir la
página Nueva pestaña". En una computadora compartida, la salida confiable es
"Cerrar sesión", que revoca la familia en el server.

## Configuración

`NEXT_PUBLIC_API_URL` (default `http://localhost:8080`). El backend tiene
que tener el origen del dashboard en `SECUREPASS_CORS_ALLOWED_ORIGINS`
(en dev, `http://localhost:3000`).
