import { describe, expect, it } from 'vitest';

// #66: el CI no detectaba que _layout.tsx quedaba con `default: undefined`
// cuando algun import de la cadena explotaba en runtime. tsc/eslint/vitest/
// expo-doctor pasan verde con la app rota. Este test cierra la brecha
// generica: si el default export del root layout no queda como funcion,
// rojo. Detecta imports que rompen en Node (imports circulares, symbols
// faltantes, referencias a globals inexistentes en runtime plano).
//
// NO cachea el bug especifico de expo-notifications en Expo Go — ese es
// condicional a Hermes + Expo Go + import, no reproducible en Node. Para
// eso el fix va en la fuente (guard/import dinamico en _layout.tsx), no
// en el pipeline. Ver #66.

describe('_layout smoke test', () => {
  it('exporta un default de tipo funcion (componente React)', async () => {
    const mod = await import('@/app/_layout');
    expect(typeof mod.default).toBe('function');
  });
});
