# securepassf

Frontend del sistema de control de accesos para barrios privados. Es un
monorepo con dos aplicaciones (`mobile/` y `web/`) y un paquete compartido
de tipos generados (`packages/contracts`). El backend vive en un repo
aparte: `securepassb`.

## Qué resuelve

Un barrio privado tiene una garita en la entrada y un guardia que decide
quién pasa. El problema no es técnico sino operativo: el guardia tiene que
verificar identidad rápido, con una fila de autos atrás, y muchas veces
sin conexión estable. La app del guardia existe para eso. Escanea el QR
del pase, valida la firma criptográfica localmente y responde en el acto:
permitido o denegado, con el motivo. Si es la primera vez que ese invitado
entra, le pide el DNI para dejarlo registrado. Si no hay red, valida igual
con lo que tiene cacheado y encola el evento para sincronizar después.

El residente crea los pases desde su teléfono. Elige el tipo (único o
evento), carga el nombre y el DNI del invitado, define la ventana de
vigencia y comparte el QR por WhatsApp o donde quiera. También ve quién
está adentro de su lote en este momento, y si una visita se pasó del
horario puede extenderle el pase o pedir que se retire.

El titular del lote tiene además el manejo de su unidad familiar: da de
alta a los familiares mayores de 16 (que reciben su propia cuenta y pueden
invitar si él los habilita), y lleva un padrón de los menores, que no
tienen cuenta ni QR propio hasta que cumplen la edad. Cuando eso pasa, los
gradúa a familiares con cuenta desde la misma pantalla. La distinción
entre "familiar con cuenta" y "menor del padrón" no es cosmética: define
quién puede generar accesos al barrio.

## Estructura

```
securepassf/
├── mobile/              app Expo / React Native (guardia + residente)
├── web/                 dashboard admin en Next.js
├── packages/contracts/  tipos TypeScript generados del OpenAPI del backend
└── .github/workflows/   CI y el cron que detecta drift del SDK
```

`mobile/` es la app del guardia y del residente. `web/` es el panel del
administrador del barrio: login con rol `ADMIN`, ocupación, afluencia por
hora, denegados y permanencias excedidas. La decisión de auth de web
(dónde viven los tokens, refresh, limitaciones) está en `web/docs/auth.md`.

`packages/contracts` no se escribe a mano. Es un único `.d.ts` generado
desde el `openapi.json` del backend, y las dos apps lo consumen como
`@securepass/contracts`.

### Dentro de mobile/

```
mobile/src/
├── app/              rutas (expo-router, file-based)
├── modules/          lógica por dominio: scanner, stays, resident-stays,
│                     family, invitation, manual-access, offline, auth,
│                     shifts, devices
└── common/           infraestructura transversal: api, db, components
```

La regla es que `modules/` tiene la lógica y `app/` solo arma pantallas.
Cada módulo separa lo puro (`lib.ts`, testeable con vitest sin device) de
lo que toca React o nativo (`hooks.ts`, componentes). Esa división es lo
que permite tener tests reales de la lógica de validación offline sin
levantar un emulador.

## Stack

| Qué | Con qué |
|---|---|
| App móvil | Expo SDK 57, React Native, expo-router |
| Estilos | NativeWind (Tailwind sobre RN) |
| Estado servidor | TanStack Query |
| Estado local | Zustand (sesión) |
| Persistencia | expo-sqlite (offline), expo-secure-store (tokens) |
| Cliente HTTP | openapi-fetch tipado con `@securepass/contracts` |
| Cripto | @noble/ed25519 (v3) |
| Tests | Vitest |
| Web | Next.js 16, React 19, Tailwind 4, Recharts, TanStack Table v9 |

Node 22. npm workspaces.

## Ruteo y separación por rol

`expo-router` con grupos. Los paréntesis en el nombre de la carpeta crean
un grupo que no aparece en la URL:

```
app/
├── _layout.tsx        root: providers, restore de sesión
├── index.tsx          redirect segun rol (homeRouteFor)
├── (auth)/            login y flujos previos a sesión
├── (guard)/           scanner, presentes, turno
└── (resident)/        invitaciones, crear, familia, perfil
```

La separación es por carpeta, no por condicionales dentro de las
pantallas. Al iniciar sesión, `homeRouteFor(user)` decide a qué grupo
mandar según el rol: un guardia entra al scanner, un residente a sus
invitaciones. Si la sesión no tiene un rol de mobile válido (por ejemplo
un admin, que usa el panel web), rutea al login en vez de dejar la app en
un ciclo de redirecciones.

Esto mantiene cada grupo con su propio layout y sus propias pantallas, y
hace que agregar una vista de guardia no pueda romper accidentalmente una
de residente.

## El flujo offline del scanner

Es la parte más particular del proyecto y la razón por la que existe tanta
infraestructura local. Un guardia en una garita puede quedarse sin red en
cualquier momento, y no puede dejar de trabajar por eso.

### Qué se cachea en SQLite

El dispositivo mantiene varias tablas locales, versionadas con migraciones
en `common/db/migrations.ts`:

- **`signing_keys_cache`** — las claves públicas Ed25519 del barrio. Sin
  esto no se puede verificar la firma de un QR offline. Se bajan solas de
  `/access/keys` cuando hay red.
- **`revoked_cache`** — los pases revocados conocidos, para poder
  rechazarlos sin consultar al server.
- **`consumed_tokens`** — los tokens ya usados en este dispositivo, para
  respetar el cupo sin red.
- **`enrollments_cache`** — qué invitaciones ya tienen el DNI capturado.
  Evita pedirlo de nuevo en cada ingreso del mismo invitado.
- **`outbox`** — los eventos de acceso que todavía no llegaron al server.
- **`stay_warnings`** — los avisos de permanencia ya emitidos localmente,
  para no repetirlos entre reinicios de la app.

### Qué pasa cuando se escanea

El QR no es un identificador: es un token firmado (formato `SP1.`) que
lleva adentro el id de la invitación, la ventana de validez, el tipo de
pase y el cupo. Eso permite validarlo sin preguntarle a nadie.

Con red, se consulta al server y **el veredicto del server gana siempre**.
El camino offline es un fallback para cuando no hubo respuesta, no una
alternativa cuando la respuesta no nos gusta. Esto está escrito como
invariante en `scanner/scan-flow.ts` porque hubo un bug donde el cliente
ignoraba una respuesta válida del server y caía al offline: el dispositivo
puede tener el reloj corrido, la lista de revocados vieja o el cupo
desactualizado, y en todos esos casos el server tiene razón.

Sin red, `validateOffline` decide localmente y en este orden: firma,
revocación, ventana temporal, franja horaria (para pases recurrentes),
cupo local, y por último si el invitado está enrolado. El default es
**denegar**: el costo de un falso permitido es un desconocido adentro del
barrio, el de un falso denegado es un registro manual.

### Cómo se encolan los intentos

Cada decisión se persiste en el `outbox` con un `clientEventId` generado
en el dispositivo, que es lo que hace el sync idempotente. Un ciclo de
sincronización toma un lote, lo manda a `/access/sync`, y el server
responde el resultado **por evento**. Los aceptados y los rechazados de
forma terminal se borran de la cola; solo un fallo de red deja todo para
el próximo intento, con backoff escalonado.

El enrolamiento también funciona offline: si el guardia captura el DNI sin
conexión, se guarda en el cache local y viaja en el mismo evento del
outbox. El invitado entra, y el registro se concilia cuando vuelve la red.

## packages/contracts

Los tipos de la API se generan desde el OpenAPI del backend. No se
escriben a mano.

```bash
cd packages/contracts
npm run generate
```

El script lee `../../../securepassb/openapi.json`, así que **los dos repos
tienen que estar clonados como hermanos** bajo la misma carpeta padre.

Hay que regenerar cada vez que el backend cambia un endpoint o un schema.
Por convención del repo, la regeneración va en su propio PR
(`chore(contracts): regenerar ...`), mergeado antes del PR que consume los
tipos nuevos. Eso mantiene el diff del feature limpio y hace evidente
cuándo un cambio de contrato rompe algo.

## Levantar el entorno

### Backend primero

La app no hace nada sin el backend. Ver el README de `securepassb`.

### Instalar

```bash
npm ci
```

### Variables de entorno

`mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.100:8080
EXPO_PUBLIC_GATE_ID=<uuid de la garita>
```

`EXPO_PUBLIC_API_URL` tiene que apuntar a la **IP de tu máquina en la red
local**, no a `localhost`. El bundler corre en tu computadora pero la app
corre en el teléfono: para el teléfono, `localhost` es el teléfono mismo.
Esa IP la ves cuando arranca el bundler, o con `ipconfig` / `ifconfig`.

`EXPO_PUBLIC_GATE_ID` identifica la garita de este dispositivo. Sin eso el
guardia no puede abrir turno ni escanear. Sale de la tabla `gates` del
backend.

Las variables `EXPO_PUBLIC_*` se inlinean en el bundle al arrancar, así que
después de editarlas hay que reiniciar con `--clear`.

### Correr mobile

Siempre desde `mobile/`, nunca desde la raíz del monorepo: Expo no
encuentra el entry point y falla buscando un `App.tsx` que no existe.

```bash
cd mobile
npx expo start --dev-client   # development build
npx expo start                # Expo Go
```

### Expo Go vs development build

Los dos funcionan, pero no son equivalentes.

**Expo Go** sirve para iterar interfaz sin esperar 15-25 minutos de build.
Lo que no anda ahí son las notificaciones: `expo-notifications` no se
carga, el registro de push token es no-op y los avisos locales no se
programan. Eso es intencional — el módulo se importa dinámicamente detrás
de un guard (`common/notifications/safe.ts`) porque su side effect al
importar rompía la app entera en Expo Go.

**Development build** es el binario que se instala en la garita, y el único
donde las notificaciones funcionan:

```bash
cd mobile
eas build --profile development --platform android
```

El APK se instala una vez y después levanta el JS del bundler, así que no
hace falta rebuildear salvo que cambie algo nativo (una dependencia con
código nativo, el config plugin, o `app.json`).

Cualquier feature que toque cámara, SQLite, permisos nativos o
notificaciones se verifica en el development build. Expo Go puede
resolverlos distinto que el binario real.

### Web (dashboard admin)

`web/.env.local` (copiar de `web/.env.example`):

```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Si falta, el default es `http://localhost:8080`. A diferencia de mobile,
acá `localhost` está bien: el dashboard corre en el navegador de tu misma
máquina. Las variables `NEXT_PUBLIC_*` se inlinean al arrancar, así que
después de editarlas hay que reiniciar `next dev`.

El backend tiene que permitir el origen del dashboard por CORS, en el
`.env` de `securepassb`:

```
SECUREPASS_CORS_ALLOWED_ORIGINS=http://localhost:8081,http://localhost:3000
```

CORS compara el origen **exacto**. Abrí el dashboard en
`http://localhost:3000`: desde `http://127.0.0.1:3000` o la IP de la red
local el backend rechaza el preflight (403), el navegador bloquea el
request y el login muestra "No se pudo conectar con el servidor" aunque el
backend esté arriba. En la consola del navegador aparece como error de
CORS. Para abrirlo desde otro origen, agregalo a la lista.

```bash
npm --workspace web run dev     # http://localhost:3000
```

Con el seed de desarrollo del backend, el admin es `admin@dev.local` /
`admin123`. Un usuario sin rol `ADMIN` (por ejemplo `owner@test.com`) se
rechaza en el login con un mensaje de permisos.

## Tests

```bash
npm run typecheck --workspaces
npm run lint --workspaces
cd mobile && npm test
npm --workspace web run test
```

El CI corre eso más `next build` de web y `expo-doctor`.

### Lo que los tests NO prueban

Esto importa más que la lista de comandos: **que tsc, eslint y vitest pasen
significa que el código compila y que la lógica pura hace lo que dice, no
que la app funcione.**

Hubo un período donde `develop` tenía los cuatro checks en verde y la app
no montaba en el dispositivo: un módulo con un side effect al importar
rompía el árbol entero sin que ninguna función se llegara a llamar.
Compilar, importar y ejecutar son tres cosas distintas.

También pasó que un componente renderizaba, no tiraba error, y sin embargo
el valor que el usuario elegía nunca llegaba al formulario. Los tests
estaban verdes.

Por eso hay un smoke test que verifica que el layout raíz siga exportando
un componente (`src/__tests__/layout.smoke.test.tsx`), y por eso todo
cambio de interfaz se prueba en un dispositivo antes de mergear. No hay
atajo.

## Convenciones

**Ramas y PRs.** Un issue, una rama, un PR. `develop` es la rama por
defecto y el destino de todos los PRs. Merge con squash.

**Relevamiento antes de código.** Para cualquier cambio no trivial, primero
se releva: qué existe, qué falta, qué endpoints hacen falta, qué casos
límite hay. Recién con el plan aprobado se escribe código. Varias veces el
relevamiento mostró que el issue ya estaba resuelto, o que el enfoque
propuesto no cerraba el problema.

**Los comentarios explican el porqué.** El qué se lee en el código. Donde
hay una decisión no obvia — por qué no hay un timeout acá, por qué este
guard no puede relajarse, por qué el server gana sobre el offline — el
comentario dice el motivo y referencia el issue. Es lo que evita que
alguien lo "arregle" de vuelta en seis meses.

**Fail-closed.** Ante la duda, denegar. Un pase que no se puede evaluar no
se permite. Un resultado del server que no se reconoce no se interpreta. El
costo de un falso denegado es un registro manual; el de un falso permitido
es alguien adentro del barrio que no debería estar.

**Español en la interfaz y los comentarios.** Inglés en los nombres de
código.

**Sin dependencias nuevas sin discutirlo.** El proyecto usa el managed
workflow de Expo. Una librería que necesite editar `android/` o `ios/` a
mano no entra; los config plugins sí.
