// Sin logo ni spinner a proposito: dura lo que tarda la hidratacion
// (~100-300 ms) y cualquier contenido ahi se veria como un flash propio.
// Mismo color que el fondo de la app = transicion invisible.
export function Splash() {
  return (
    <div role="status" aria-busy="true" className="min-h-screen bg-bg-base">
      <span className="sr-only">Cargando sesión</span>
    </div>
  );
}
