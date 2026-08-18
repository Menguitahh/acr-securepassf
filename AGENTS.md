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

**Restriccion dura: todo debe correr en Expo Go.** Nada de modulos nativos custom.
No VisionCamera, no MMKV, no WatermelonDB. Si una libreria requiere `expo prebuild`,
no va.

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
- [ ] Probado en Expo Go, no solo en web
- [ ] PR con `Closes #N`

## Que no hacer

- No agregar dependencias que rompan Expo Go.
- No implementar captura de patente. Decidido para v2.
- No construir componentes manuales que ya existen en el design system.
- No inventar endpoints. Los que hay estan en `spec.md` seccion 7.
