import { QueryClient } from '@tanstack/react-query';

// Modulo y no dentro de _layout: endSession (auth) lo limpia al cortar la
// sesion, para que no queden datos del usuario anterior en cache.
export const queryClient = new QueryClient();
