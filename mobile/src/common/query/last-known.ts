import Storage from 'expo-sqlite/kv-store';

import { useSessionStore } from '@/modules/auth/session-store';

// Ultimo valor que confirmo el server, por usuario, para que la garita
// arranque sin red con algo en pantalla (#204, #208). La query lo usa como
// initialData y lo pisa en cada fetch exitoso. Quien lo lee lo valida: lo
// guardado puede ser de una version vieja de la app.
function storageKey(name: string): string | null {
  const userId = useSessionStore.getState().user?.id;
  return userId ? `${name}.${userId}` : null;
}

export function rememberLastKnown(name: string, value: unknown): void {
  const key = storageKey(name);
  if (key) Storage.setItemSync(key, JSON.stringify(value));
}

// undefined: nada guardado o ilegible.
export function readLastKnown(name: string): unknown {
  const key = storageKey(name);
  const raw = key ? Storage.getItemSync(key) : null;
  if (raw === null) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    return value;
  } catch {
    return undefined;
  }
}
