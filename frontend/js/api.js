// Cliente de la API. Todo el frontend pasa por acá: un solo lugar donde se
// arma la URL, se adjunta el token y se traducen los errores del backend.
//
// El token vive en sessionStorage (no en localStorage): se borra al cerrar la
// pestaña, que es lo que se espera de una sesión de mostrador.

const CLAVE_SESION = 'patismos.sesion';

export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
  }
}

export function sesion() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_SESION)) || null;
  } catch {
    return null; // valor corrupto: se trata como "sin sesión"
  }
}

export function guardarSesion({ token, usuario }) {
  sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ token, usuario }));
}

export function cerrarSesion() {
  sessionStorage.removeItem(CLAVE_SESION);
}

export function esGerente() {
  const actual = sesion();
  return Boolean(actual && actual.usuario && actual.usuario.rol === 'gerente');
}

// pedir('/api/libros?search=borges') · pedir('/api/carrito/1', { conToken: true })
export async function pedir(ruta, opciones = {}) {
  const { metodo = 'GET', cuerpo, conToken = false } = opciones;
  const cabeceras = {};
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

  const actual = sesion();
  if (conToken && actual?.token) cabeceras.Authorization = `Bearer ${actual.token}`;

  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi('No se pudo conectar con el servidor. ¿Está levantado en el puerto 3000?', 0);
  }

  // 204 o cuerpo vacío: no hay JSON que leer.
  const texto = await respuesta.text();
  let datos = null;
  if (texto) {
    try { datos = JSON.parse(texto); } catch { datos = { mensaje: texto }; }
  }

  if (!respuesta.ok) {
    // Un 401 con token guardado significa que venció: se limpia para no
    // quedar en un bucle de peticiones rechazadas.
    if (respuesta.status === 401 && conToken) cerrarSesion();
    throw new ErrorApi(datos?.mensaje || `Error ${respuesta.status}`, respuesta.status);
  }

  return datos;
}

// Precio en pesos, sin centavos: el catálogo usa valores enteros.
const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
});
export const precio = (valor) => formatoPrecio.format(Number(valor) || 0);

// Escapa texto que viene de la base antes de meterlo en innerHTML.
export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
