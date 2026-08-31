# securepassf - Reglas para agentes

Frontend de Securepass: app mobile (guardia y residente) + dashboard admin web.
La fuente de verdad del proyecto es `spec.md`. Leelo antes de tocar codigo.

## Antes de escribir codigo

Primero entende el problema: lee el codigo que la tarea toca y trazá el flujo real.
Recien despues, frená en el primer escalon que aplique:

1. Esto necesita existir? Si no, no lo escribas.
2. Ya existe en este codebase? Reusalo.
3. Lo resuelve la plataforma nativa? Usalo.
4. Lo resuelve una dependencia ya instalada? Usala.
5. Entra en una linea? Una linea.
6. Recien ahi: lo minimo que funciona.

Ejemplo concreto de este proyecto: para elegir cantidad de acompanantes no se
construye un stepper custom. Hay un control nativo. Usalo.

**Nunca se recorta:** validacion de entrada, manejo de errores, seguridad, y
accesibilidad. Esas cuatro no entran en el escalon 1 jamas.

## Stack

Expo SDK 52+ · React Native · TypeScript strict · expo-router · TanStack Query v5 ·
expo-sqlite · expo-camera · nativewind v4.
Web: Next.js 16 App Router · React 19 · Tailwind CSS 4 · @base-ui/react.

**Restriccion dura: nada de modulos nativos custom** que impidan usar EAS Build
managed workflow. No VisionCamera, no MMKV, no WatermelonDB. Si una libreria
requiere config nativo escrito a mano (no un config plugin de Expo), no va.

**El proyecto NO corre en Expo Go**. Necesita development build (EAS). Razon:
`expo-notifications` tira al importar el modulo cuando esta corriendo en Expo Go,
por un side effect de `DevicePushTokenAutoRegistration.fx.js` que llama
`warnOfExpoGoPushUsage` -> THROW. Rompe `_layout.tsx` en la carga, todos los
routes cascadean con "missing default export" + "Cannot read property
'ErrorBoundary' of undefined". Detalles y stack en issue securepassf#66.

Un import con side effects puede romper el modulo entero aunque la funcion
problematica nunca se llame. `getExpoPushTokenAsync` esta guarded con try/catch
y jamas se invoca en boot; alcanza con el `import * as Notifications from
'expo-notifications'` para tirar.

Setup de development build: seccion "Development build" mas abajo.

## Estructura de modulos

```
src/modules/<modulo>/
  types.ts            interfaces, type aliases, enums
  data.ts             constantes y config estatica
  lib.ts              funciones puras, sin React
  hooks.ts            custom hooks
  components/         subcomponentes exclusivos
  <modulo>-view.tsx   vista principal
src/common/           api, components, layout, lib, providers
```

Reglas:

1. Types en `types.ts`, nunca inline en vistas ni hooks.
2. Constantes en `data.ts`.
3. Funciones puras en `lib.ts`. Si importa React, no va ahi.
4. Hooks en `hooks.ts`.
5. Usado por 2+ modulos, va a `common/`.
6. La unica interface inline permitida en un componente es su `Props`.

## TypeScript

- `strict`, mas `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
- Prohibido `any`. Para lo desconocido, `unknown` mas narrowing.
- Prohibido `as` salvo `as const` y type predicates. Si necesitas castear,
  el tipo esta mal modelado: arreglá el tipo.
- Unions discriminadas en vez de booleans opcionales. Hace imposible el estado
  invalido:

```ts
type ScanResult =
  | { status: 'allowed'; guestName: string; lotCode: string; companions: number }
  | { status: 'denied'; reason: DenialReason; message: string }
```

- Los tipos de la API se generan desde el OpenAPI del backend en
  `packages/contracts`. No se escriben a mano.

## Early returns

Orden fijo en toda vista: error, loading, empty, data.

```tsx
if (isError) return <ErrorState message={error.message} />
if (isLoading) return <Spinner />
if (!data?.length) return <EmptyState action="Crear invitacion" />
return <List data={data} />
```

Excepcion: `else` dentro de loops para control de flujo.

## UI

Dark minimalist monocromatico. Tokens en `spec.md` seccion 9.1.
El color aparece unicamente en el resultado del escaneo. El resto es monocromatico.

- Inputs `rounded-xl`, cards `rounded-lg`, botones `rounded-md`.
- Toques minimos 48x48 dp. Se opera con guantes.
- Cero emojis en codigo, nombres ni UI.
- Textos en espanol rioplatense, voz activa, sentence case.
- Los errores dicen que paso y que hacer. No piden disculpas.
- Un boton que dice "Registrar ingreso" produce un toast que dice
  "Ingreso registrado". La misma palabra en todo el flujo.

## Tests

Vitest para `lib.ts` (funciones puras). React Native Testing Library para flujos.
`validateOffline` necesita cobertura de los 8 motivos de denegacion: es la
funcion que decide si alguien entra al barrio.

## Flujo de trabajo

Un issue = una rama = un PR. Ramas `feature/`, `fix/`, `refactor/` desde `develop`.
Conventional Commits. Scopes: `scanner`, `invitation`, `access`, `ui`, `offline`, `admin`.

```
feat(scanner): agregar verificacion ed25519 offline

Refs: #31
```

## Definition of Done

- [ ] Criterios de aceptacion del issue cumplidos
- [ ] `tsc --noEmit` limpio, `eslint` sin warnings
- [ ] Tests nuevos pasan
- [ ] Probado en el development build (no en Expo Go: el proyecto no corre ahi, ver arriba)
- [ ] PR con `Closes #N`

## Que no hacer

- No agregar dependencias que requieran editar `android/` o `ios/` a mano
  (rompen `expo prebuild` limpio). Config plugins de Expo si, patches nativos no.
- No implementar captura de patente. Decidido para v2.
- No construir componentes manuales que ya existen en el design system.
- No inventar endpoints. Los que hay estan en `spec.md` seccion 7.

## Development build

El proyecto necesita development build para correr en device. Expo Go no sirve
(ver "Restriccion dura" arriba, y securepassf#66).

Setup una sola vez:

```bash
npm install -g eas-cli
cd mobile && npx expo install expo-dev-client
eas login             # cuenta en expo.dev, tier free alcanza
eas build --profile development --platform android
```

El build corre en la nube EAS (~15-25 min primera vez). Descargar el APK del
link que da el CLI, instalar en el telefono (habilitar "Install unknown apps"
para el navegador o file manager).

Desarrollo diario:

```bash
cd mobile && npx expo start --dev-client
```

Abrir el dev client instalado en el telefono (no Expo Go) y pegarle la URL de
Metro. Cambios en JS hot-reloadean sin rebuild. Solo rebuild cuando cambian
modulos nativos o `app.json`.
