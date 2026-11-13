// Administración de usuarios (CU-12) en el panel del gerente.
// El HTML de la tabla está en admin.html (#tabla-usuarios); acá sólo se pinta
// y se manda el cambio de rol. Si la sesión no es de gerente, no hace nada:
// el panel entero ya está oculto en ese caso.

import { pedir, esGerente } from './api.js';

const ROLES = ['usuario', 'gerente'];

const MENSAJE_ERROR = 'No se pudo cambiar el rol';

// Pinta la tabla con los usuarios que devuelve la API.
export async function cargarUsuarios() {
  const cuerpo = document.querySelector('#tabla-usuarios tbody');
  if (!cuerpo || !esGerente()) return;

  let usuarios;
  try {
    usuarios = await pedir('/api/usuarios', { conToken: true });
  } catch (error) {
    console.error(error);
    cuerpo.textContent = '';
    return;
  }

  cuerpo.textContent = '';
  for (const usuario of usuarios) {
    cuerpo.append(filaDeUsuario(usuario));
  }
}

function filaDeUsuario(usuario) {
  const fila = document.createElement('tr');

  const nombre = document.createElement('td');
  nombre.textContent = usuario.nombre;
  fila.append(nombre);

  const email = document.createElement('td');
  email.textContent = usuario.email;
  fila.append(email);

  const celdaRol = document.createElement('td');
  const selector = document.createElement('select');
  selector.className = 'selector-rol';
  selector.setAttribute('aria-label', `Rol de ${usuario.nombre}`);
  for (const rol of ROLES) {
    const opcion = document.createElement('option');
    opcion.value = rol;
    opcion.textContent = rol;
    selector.append(opcion);
  }
  selector.value = usuario.rol;
  selector.addEventListener('change', () => cambiarRol(usuario, selector));
  celdaRol.append(selector);
  fila.append(celdaRol);

  const acciones = document.createElement('td');
  const aviso = document.createElement('span');
  aviso.className = 'mensaje';
  aviso.setAttribute('role', 'status');
  aviso.setAttribute('aria-live', 'polite');
  acciones.append(aviso);
  fila.append(acciones);

  fila.dataset.usuarioId = String(usuario.id);
  return fila;
}

async function cambiarRol(usuario, selector) {
  const aviso = selector.closest('tr').querySelector('.mensaje');
  const anterior = usuario.rol;
  try {
    const actualizado = await pedir(`/api/usuarios/${usuario.id}/rol`, {
      metodo: 'PUT',
      cuerpo: { rol: selector.value },
      conToken: true
    });
    usuario.rol = actualizado.rol;
    selector.value = actualizado.rol;
    aviso.textContent = '';
  } catch (error) {
    console.error(error);
    selector.value = anterior;
    aviso.textContent = `${MENSAJE_ERROR}: ${error.message}`;
  }
}
