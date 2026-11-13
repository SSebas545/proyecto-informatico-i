// Panel del gerente: estadísticas, inventario y altas.
// Cubre CU-10 (gestionar libros), CU-11 (stock), CU-13 (estadísticas),
// CU-14 (resumen), CU-15 (categorías), CU-16 (restock) y CU-17 (alertas).
// CU-12 (usuarios) tiene su propia sección: la tabla la pinta js/usuarios.js.

import { pedir, sesion, cerrarSesion, esGerente, precio, esc } from './api.js';
import { cargarUsuarios } from './usuarios.js';

const $ = (id) => document.getElementById(id);

let libros = [];
let categorias = [];

function avisar(elemento, texto, tipo = 'error') {
  elemento.className = `mensaje ${tipo}`;
  elemento.textContent = texto;
}

function limpiar(elemento) {
  elemento.textContent = '';
  elemento.className = 'mensaje';
}

function requerirGerente() {
  const actual = sesion();
  if (esGerente()) {
    $('gestion').classList.remove('oculto');
    $('bloqueo').classList.add('oculto');
    $('bajada-panel').textContent = `Sesión de ${actual.usuario.nombre}.`;
    return true;
  }
  $('gestion').classList.add('oculto');
  $('bloqueo').classList.remove('oculto');
  $('bajada-panel').textContent = 'Sin sesión de gerente.';
  return false;
}

// --- datos ---------------------------------------------------------------

async function cargarEstadisticas() {
  try {
    const datos = await pedir('/api/estadisticas', { conToken: true });
    $('stat-libros').textContent = datos.total_libros;
    $('stat-stock').textContent = datos.libros_en_stock;
    $('stat-sin-stock').textContent = datos.libros_sin_stock;
    $('stat-bajo').textContent = datos.stock_bajo;
    $('stat-ventas').textContent = precio(datos.ventas_totales);
  } catch (error) {
    avisar($('mensaje-panel'), error.message);
  }
}

async function cargarLibros() {
  try {
    libros = await pedir('/api/libros');
    pintarInventario();
    pintarAlertas();
  } catch (error) {
    avisar($('mensaje-panel'), error.message);
  }
}

async function cargarCategorias() {
  try {
    categorias = await pedir('/api/categorias');
    $('nuevo-categoria').innerHTML = categorias
      .map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  } catch (error) {
    avisar($('mensaje-panel'), error.message);
  }
}

// --- pintado -------------------------------------------------------------

function pintarInventario() {
  $('cuerpo-inventario').innerHTML = libros.map((libro) => `
    <tr data-id="${libro.id}">
      <td>${esc(libro.titulo)}</td>
      <td>${esc(libro.autor)}</td>
      <td>${esc(libro.categoria_nombre || '—')}</td>
      <td>${precio(libro.precio)}</td>
      <td><input type="number" min="0" step="1" value="${libro.stock}" data-stock aria-label="Stock de ${esc(libro.titulo)}"></td>
      <td><button class="boton-mini" type="button" data-guardar>Guardar</button></td>
    </tr>`).join('');
}

function pintarAlertas() {
  const bajos = libros.filter((libro) => libro.stock < 5);
  $('sin-alertas').classList.toggle('oculto', bajos.length > 0);
  $('tabla-alertas').classList.toggle('oculto', bajos.length === 0);
  $('tabla-alertas').querySelector('tbody').innerHTML = bajos.map((libro) => `
    <tr>
      <td>${esc(libro.titulo)}</td>
      <td>${esc(libro.autor)}</td>
      <td class="${libro.stock === 0 ? 'insignia-baja' : ''}">${libro.stock}</td>
    </tr>`).join('');
}

// --- acciones ------------------------------------------------------------

async function guardarStock(fila) {
  const libro = libros.find((l) => String(l.id) === fila.dataset.id);
  const stock = Number(fila.querySelector('[data-stock]').value);
  if (!libro || !Number.isInteger(stock) || stock < 0) {
    avisar($('mensaje-panel'), 'El stock tiene que ser un entero mayor o igual a 0.');
    return;
  }

  try {
    // El PUT exige el objeto completo: se manda el libro tal como vino con el
    // stock nuevo, para no borrar campos sin querer.
    await pedir(`/api/libros/${libro.id}`, {
      metodo: 'PUT',
      conToken: true,
      cuerpo: {
        titulo: libro.titulo,
        autor: libro.autor,
        descripcion: libro.descripcion,
        precio: libro.precio,
        stock,
        categoria_id: libro.categoria_id,
      },
    });
    avisar($('mensaje-panel'), `Stock de “${libro.titulo}” actualizado a ${stock}.`, 'ok');
    await Promise.all([cargarLibros(), cargarEstadisticas()]);
  } catch (error) {
    avisar($('mensaje-panel'), error.message);
  }
}

async function altaLibro(evento) {
  evento.preventDefault();
  const cuerpo = {
    titulo: $('nuevo-titulo').value.trim(),
    autor: $('nuevo-autor').value.trim(),
    descripcion: $('nuevo-descripcion').value.trim(),
    precio: Number($('nuevo-precio').value),
    stock: Number($('nuevo-stock').value),
    categoria_id: Number($('nuevo-categoria').value) || null,
  };
  try {
    await pedir('/api/libros', { metodo: 'POST', conToken: true, cuerpo });
    avisar($('mensaje-alta'), `“${cuerpo.titulo}” agregado al catálogo.`, 'ok');
    $('form-libro').reset();
    $('nuevo-stock').value = 0;
    await Promise.all([cargarLibros(), cargarEstadisticas()]);
  } catch (error) {
    avisar($('mensaje-alta'), error.message);
  }
}

async function altaCategoria(evento) {
  evento.preventDefault();
  const nombre = $('nueva-categoria').value.trim();
  try {
    await pedir('/api/categorias', { metodo: 'POST', conToken: true, cuerpo: { nombre } });
    avisar($('mensaje-categoria'), `Categoría “${nombre}” creada.`, 'ok');
    $('nueva-categoria').value = '';
    await cargarCategorias();
  } catch (error) {
    avisar($('mensaje-categoria'), error.message);
  }
}

// --- eventos -------------------------------------------------------------

$('cuerpo-inventario').addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-guardar]');
  if (boton) guardarStock(boton.closest('tr'));
});

$('form-libro').addEventListener('submit', altaLibro);
$('form-categoria').addEventListener('submit', altaCategoria);

$('cerrar-sesion').addEventListener('click', () => {
  cerrarSesion();
  window.location.href = 'index.html';
});

// --- arranque ------------------------------------------------------------

if (requerirGerente()) {
  await Promise.all([cargarEstadisticas(), cargarLibros(), cargarCategorias(), cargarUsuarios()]);
}
