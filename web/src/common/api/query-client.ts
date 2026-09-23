import { isServer, QueryClient } from "@tanstack/react-query";

let browserClient: QueryClient | undefined;

// En el server un client por request (no compartir cache entre usuarios);
// en el browser uno solo, para poder limpiarlo al cerrar sesion.
export function getQueryClient(): QueryClient {
  if (isServer) return new QueryClient();
  browserClient ??= new QueryClient();
  return browserClient;
}
