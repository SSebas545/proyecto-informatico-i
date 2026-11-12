// Tienda: catálogo, filtros, detalle, carrito y sesión.
// Cubre CU-01 (buscar), CU-02 (filtrar), CU-03 (detalle), CU-04 (agregar al
// carrito), CU-05 (ver carrito), CU-06 (comprar), CU-08 (login) y CU-09
// (registro). Sin frameworks: DOM a mano y `fetch` a través de api.js.

import { pedir, sesion, guardarSesion, cerrarSesion, esGerente, precio, esc, ErrorApi } from './api.js';

const $ = (id) => document.getElementById(id);

const estado = {
  busqueda: '',
  categoria: '',
  stock: '',
  libros: [],
  detalle: null,
  carrito: null,
};

const TAPAS = ['borgona', 'verde', 'azul', 'ocre', 'pizarra', 'vino'];

// --- mensajes ------------------------------------------------------------

function avisar(elemento, texto, tipo = 'error') {
  elemento.className = `mensaje ${tipo}`;
  elemento.textContent = texto;
}

function limpiar(elemento) {
  elemento.textContent = '';
  elemento.className = 'mensaje';
}

// --- catálogo ------------------------------------------------------------

async function cargarLibros() {
  const grilla = $('grilla');
  grilla.innerHTML = '<p class="cargando">Cargando catálogo…</p>';

  const params = new URLSearchParams();
  if (estado.busqueda) params.set('search', estado.busqueda);
  if (estado.categoria) params.set('categoria', estado.categoria);
  if (estado.stock) params.set('stock', estado.stock);

  try {
    const libros = await pedir(`/api/libros${params.toString() ? `?${params}` : ''}`);
    estado.libros = libros;
    pintarLibros();
  } catch (error) {
    grilla.innerHTML = '<p class="vacio">No se pudo cargar el catálogo.</p>';
    avisar($('mensaje-catalogo'), error.message);
  }
}

function pintarLibros() {
  const grilla = $('grilla');
  const libros = estado.libros;
  $('cantidad-titulos').textContent = `${libros.length} título${libros.length === 1 ? '' : 's'}`;

  const filtros = [
    estado.busqueda && `“${estado.busqueda}”`,
    estado.categoria,
    estado.stock === 'en' ? 'con stock' : estado.stock === 'sin' ? 'sin stock' : '',
  ].filter(Boolean);
  $('bajada-catalogo').textContent = filtros.length
    ? `Resultados para ${filtros.join(' · ')}.`
    : 'Los títulos de la librería, con venta y préstamo desde el mismo catálogo.';

  if (libros.length === 0) {
    grilla.innerHTML = '<p class="vacio">No hay títulos con esos filtros. Probá con otra búsqueda.</p>';
    return;
  }

  grilla.innerHTML = libros.map((libro) => {
    const tapa = TAPAS[libro.id % TAPAS.length];
    const hayStock = libro.stock > 0;
    return `
      <article class="libro" data-id="${libro.id}">
        <div class="tapa tapa--${tapa}">
          <span class="tapa-inicial">${esc((libro.titulo || '?').charAt(0).toUpperCase())}</span>
          <div>
            <div class="tapa-titulo">${esc(libro.titulo)}</div>
            <div class="tapa-sello">Los Patismos</div>
          </div>
        </div>
        <div class="libro-texto">
          <h2 class="libro-titulo">${esc(libro.titulo)}</h2>
          <p class="libro-autor">${esc(libro.autor)}</p>
          <div class="libro-pie">
            <span class="libro-precio">${precio(libro.precio)}</span>
            <span class="disponibilidad ${hayStock ? 'hay' : 'falta'}">
              ${hayStock ? `En stock (${libro.stock})` : 'Sin stock'}
            </span>
          </div>
        </div>
      </article>`;
  }).join('');
}

async function cargarCategorias() {
  try {
    const categorias = await pedir('/api/categorias');
    const lista = $('lista-categorias');
    lista.innerHTML = `
      <div class="categoria activa" data-categoria="">
        <span class="casilla">✓</span><span>Todas</span>
      </div>
      ${categorias.map((c) => `
        <div class="categoria" data-categoria="${esc(c.nombre)}">
          <span class="casilla"></span><span>${esc(c.nombre)}</span>
        </div>`).join('')}`;
  } catch (error) {
    avisar($('mensaje-catalogo'), `No se pudieron cargar las categorías: ${error.message}`);
  }
}

// --- detalle -------------------------------------------------------------

function abrirDetalle(libro) {
  estado.detalle = libro;
  $('detalle-titulo').textContent = libro.titulo;
  const hayStock = libro.stock > 0;
  $('detalle-cuerpo').innerHTML = `
    <p><strong>${esc(libro.autor)}</strong> · ${esc(libro.categoria_nombre || 'Sin categoría')}</p>
    <p>${esc(libro.descripcion || 'Sin descripción cargada.')}</p>
    <p><span class="libro-precio">${precio(libro.precio)}</span>
       <span class="disponibilidad ${hayStock ? 'hay' : 'falta'}">
         ${hayStock ? `En stock (${libro.stock})` : 'Sin stock'}
       </span></p>`;
  $('detalle-agregar').disabled = !hayStock;
  $('dialogo-detalle').showModal();
}

// --- carrito -------------------------------------------------------------

function usuarioActual() {
  const actual = sesion();
  return actual ? actual.usuario : null;
}

async function cargarCarrito() {
  const usuario = usuarioActual();
  if (!usuario) { estado.carrito = null; pintarCarrito(); return; }

  try {
    estado.carrito = await pedir(`/api/carrito/${usuario.id}`, { conToken: true });
  } catch (error) {
    estado.carrito = null;
    if (error instanceof ErrorApi && error.estado !== 401) {
      avisar($('mensaje-carrito'), error.message);
    }
  }
  pintarCarrito();
}

function pintarCarrito() {
  const carrito = estado.carrito;
  const items = carrito?.items || [];
  const cantidad = items.reduce((suma, item) => suma + item.cantidad, 0);

  $('contador-carrito').textContent = cantidad;
  $('resumen-carrito').textContent = usuarioActual()
    ? (items.length ? `${items.length} título${items.length === 1 ? '' : 's'} esperando.` : 'Todavía no agregaste títulos.')
    : 'Ingresá para usar el carrito.';

  const lista = $('lista-carrito');
  lista.innerHTML = items.length
    ? items.map((item) => `
        <li class="carrito-item" data-item="${item.id}">
          <div>
            <strong>${esc(item.titulo)}</strong><br>
            <small>${esc(item.autor)} · ${precio(item.precio_libro)} c/u</small>
          </div>
          <div class="carrito-acciones">
            <button class="boton-mini" data-menos="${item.id}" aria-label="Quitar uno">−</button>
            <span>${item.cantidad}</span>
            <button class="boton-mini" data-mas="${item.id}" aria-label="Agregar uno">+</button>
            <button class="boton-mini" data-borrar="${item.id}" aria-label="Eliminar">×</button>
          </div>
        </li>`).join('')
    : '<li class="vacio">El carrito está vacío.</li>';

  $('total-carrito').textContent = precio(carrito?.total || 0);
  $('comprar').disabled = items.length === 0;
}

async function agregarAlCarrito(libroId, cantidad = 1) {
  const usuario = usuarioActual();
  if (!usuario) {
    $('dialogo-sesion').showModal();
    avisar($('mensaje-sesion'), 'Ingresá para guardar el carrito.');
    return;
  }

  try {
    await pedir(`/api/carrito/${usuario.id}`, {
      metodo: 'POST', conToken: true, cuerpo: { libro_id: libroId, cantidad },
    });
    await cargarCarrito();
    avisar($('mensaje-catalogo'), 'Agregado al carrito.', 'ok');
  } catch (error) {
    avisar($('mensaje-catalogo'), error.message);
  }
}

async function cambiarCantidad(itemId, cantidad) {
  const usuario = usuarioActual();
  try {
    await pedir(`/api/carrito-item/${itemId}`, { metodo: 'PUT', conToken: true, cuerpo: { cantidad } });
    await cargarCarrito();
  } catch (error) {
    avisar($('mensaje-carrito'), error.message);
  }
}

async function borrarItem(itemId) {
  try {
    await pedir(`/api/carrito-item/${itemId}`, { metodo: 'DELETE', conToken: true });
    await cargarCarrito();
  } catch (error) {
    avisar($('mensaje-carrito'), error.message);
  }
}

async function comprar() {
  const boton = $('comprar');
  boton.disabled = true;
  try {
    await pedir('/api/pedidos', { metodo: 'POST', conToken: true });
    avisar($('mensaje-carrito'), 'Compra confirmada. ¡Gracias!', 'ok');
    await Promise.all([cargarCarrito(), cargarLibros()]);
  } catch (error) {
    avisar($('mensaje-carrito'), error.message);
  } finally {
    boton.disabled = false;
  }
}

// --- sesión --------------------------------------------------------------

function pintarSesion() {
  const actual = sesion();
  const franja = $('franja-sesion');
  const enlace = $('enlace-sesion');

  if (actual?.usuario) {
    const esAdmin = esGerente();
    franja.innerHTML = `Sesión: ${esc(actual.usuario.nombre)} (${esc(actual.usuario.rol)}) ·
      <a href="#" id="salir">Cerrar sesión</a>${esAdmin ? ' · <a href="admin.html">Panel del gerente</a>' : ''}`;
    franja.classList.remove('oculto');
    enlace.textContent = esAdmin ? 'Panel' : 'Mi cuenta';
    enlace.href = esAdmin ? 'admin.html' : '#';
    $('salir').addEventListener('click', (evento) => {
      evento.preventDefault();
      cerrarSesion();
      pintarSesion();
      cargarCarrito();
    });
  } else {
    franja.classList.add('oculto');
    enlace.textContent = 'Ingresar';
    enlace.href = '#';
  }
}

async function iniciarSesion(evento) {
  evento.preventDefault();
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  try {
    const datos = await pedir('/api/auth/login', { metodo: 'POST', cuerpo: { email, password } });
    guardarSesion({ token: datos.token, usuario: datos.usuario });
    limpiar($('mensaje-sesion'));
    $('dialogo-sesion').close();
    pintarSesion();
    await cargarCarrito();
    if (datos.usuario.rol === 'gerente') avisar($('mensaje-catalogo'), 'Entraste como gerente: el panel está en la barra.', 'ok');
  } catch (error) {
    avisar($('mensaje-sesion'), error.message);
  }
}

async function registrarse(evento) {
  evento.preventDefault();
  const cuerpo = {
    nombre: $('reg-nombre').value.trim(),
    email: $('reg-email').value.trim(),
    password: $('reg-password').value,
    rol: 'usuario',
  };
  try {
    const datos = await pedir('/api/auth/register', { metodo: 'POST', cuerpo });
    // El backend puede devolver el token al registrarse; si no, se loguea.
    if (datos?.token) {
      guardarSesion({ token: datos.token, usuario: datos.usuario });
    } else {
      const login = await pedir('/api/auth/login', { metodo: 'POST', cuerpo: { email: cuerpo.email, password: cuerpo.password } });
      guardarSesion({ token: login.token, usuario: login.usuario });
    }
    limpiar($('mensaje-sesion'));
    $('dialogo-sesion').close();
    pintarSesion();
    await cargarCarrito();
  } catch (error) {
    avisar($('mensaje-sesion'), error.message);
  }
}

// --- eventos -------------------------------------------------------------

function conectarEventos() {
  $('form-buscar').addEventListener('submit', (evento) => {
    evento.preventDefault();
    estado.busqueda = $('buscador').value.trim();
    cargarLibros();
  });

  $('lista-categorias').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-categoria]');
    if (!boton) return;
    estado.categoria = boton.dataset.categoria;
    document.querySelectorAll('#lista-categorias .categoria')
      .forEach((nodo) => nodo.classList.toggle('activa', nodo === boton));
    cargarLibros();
  });

  document.querySelectorAll('input[name="stock"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      estado.stock = radio.value;
      cargarLibros();
    });
  });

  $('grilla').addEventListener('click', (evento) => {
    const tarjeta = evento.target.closest('[data-id]');
    if (!tarjeta) return;
    const libro = estado.libros.find((l) => String(l.id) === tarjeta.dataset.id);
    if (libro) abrirDetalle(libro);
  });

  $('detalle-agregar').addEventListener('click', () => {
    if (!estado.detalle) return;
    $('dialogo-detalle').close();
    agregarAlCarrito(estado.detalle.id);
  });

  $('boton-carrito').addEventListener('click', async () => {
    await cargarCarrito();
    $('dialogo-carrito').showModal();
  });
  $('ver-carrito').addEventListener('click', async () => {
    await cargarCarrito();
    $('dialogo-carrito').showModal();
  });

  $('lista-carrito').addEventListener('click', (evento) => {
    const { mas, menos, borrar } = evento.target.dataset;
    if (mas) {
      const item = estado.carrito.items.find((i) => String(i.id) === mas);
      cambiarCantidad(mas, item.cantidad + 1);
    } else if (menos) {
      const item = estado.carrito.items.find((i) => String(i.id) === menos);
      if (item.cantidad > 1) cambiarCantidad(menos, item.cantidad - 1);
      else borrarItem(menos);
    } else if (borrar) {
      borrarItem(borrar);
    }
  });

  $('comprar').addEventListener('click', comprar);

  $('enlace-sesion').addEventListener('click', (evento) => {
    if (sesion()) return; // con sesión, el enlace lleva a la cuenta o al panel
    evento.preventDefault();
    limpiar($('mensaje-sesion'));
    $('dialogo-sesion').showModal();
  });

  $('form-login').addEventListener('submit', iniciarSesion);
  $('form-registro').addEventListener('submit', registrarse);
  $('ir-registro').addEventListener('click', () => {
    $('form-login').classList.add('oculto');
    $('form-registro').classList.remove('oculto');
    $('titulo-sesion').textContent = 'Crear cuenta';
  });
  $('ir-login').addEventListener('click', () => {
    $('form-registro').classList.add('oculto');
    $('form-login').classList.remove('oculto');
    $('titulo-sesion').textContent = 'Iniciar sesión';
  });

  document.querySelectorAll('[data-cerrar]').forEach((boton) => {
    boton.addEventListener('click', () => boton.closest('dialog').close());
  });
}

// --- arranque ------------------------------------------------------------

conectarEventos();
pintarSesion();
await Promise.all([cargarCategorias(), cargarLibros(), cargarCarrito()]);
