// Fondo de las pantallas mientras transicionan. Sin esto el contenedor de
// react-navigation es claro y cada cambio de ruta (login -> home, push de una
// pantalla) muestra un flash blanco sobre la app oscura. Mismo valor que el
// token bg-base de tailwind.config.js.
export const STACK_SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: '#09090b' },
} as const;
