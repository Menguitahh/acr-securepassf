import { focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

// TanStack Query pausa refetchInterval y refetchOnWindowFocus solo si
// sabe cuando la app pierde foco. En web usa document.visibilitychange;
// en React Native no hay equivalente hasta que uno cablea AppState.
// Sin esto, el polling de /stays/open (60 s) sigue corriendo con la
// pantalla apagada: quema bateria y no puede mostrar nada.
export function bindFocusManagerToAppState(): () => void {
  const handler = (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  };
  const subscription = AppState.addEventListener('change', handler);
  handler(AppState.currentState);
  return () => subscription.remove();
}
