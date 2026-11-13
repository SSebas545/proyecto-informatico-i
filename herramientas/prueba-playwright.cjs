// Prueba de humo del frontend con Playwright, contra el servidor real.
//
// Requisitos: el backend levantado en 127.0.0.1:3000 y el módulo de Playwright
// que trae el MCP (no está en /usr/lib/node_modules, hay que apuntarle
// NODE_PATH). Se corre así:
//
//   NODE_PATH=/usr/lib/node_modules/@playwright/mcp/node_modules \
//     node herramientas/prueba-playwright.cjs
//
// Verifica: catálogo con libros, filtro por categoría, búsqueda, detalle,
// login real, agregar al carrito, compra, panel del gerente y la tabla de
// usuarios de CU-12 (con gerente se ve, con comprador no).
// Guarda capturas en documentacion/capturas/. Sale con rc=1 si algo falla.
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const CAPTURAS = path.join(__dirname, '..', 'documentacion', 'capturas');

// Regla medida: un locator por texto puede caer en un nodo oculto y colgarse
// esperando `visible` (verificaciones.md:2322). Se filtra por visible=true.
const locVisible = (pagina, selector) => pagina.locator(`${selector}:visible`).first();
const esperarVisible = (pagina, selector) => locVisible(pagina, selector)
  .waitFor({ state: 'visible', timeout: 10000 });

// `networkidle` no espera a los fetch que dispara el JS (medido: la grilla
// todavía estaba en "Cargando…" y el conteo daba 0). Se espera la condición.
const esperarLibros = (pagina, condicion, descripcion) => pagina.waitForFunction(
  `(() => { const n = document.querySelectorAll('#grilla .libro').length; return ${condicion}; })()`,
  null, { timeout: 10000 }
);

async function main() {
  fs.mkdirSync(CAPTURAS, { recursive: true });

  const navegador = await chromium.launch();
  try {
    const contexto = await navegador.newContext({ viewport: { width: 1360, height: 900 } });
    const pagina = await contexto.newPage();

    const erroresConsola = [];
    pagina.on('console', (mensaje) => {
      if (mensaje.type() === 'error') erroresConsola.push(mensaje.text());
    });
    pagina.on('pageerror', (error) => erroresConsola.push(`pageerror: ${error.message}`));

    const pasos = [];
    const paso = (nombre) => { pasos.push(nombre); console.log(`  ok  ${nombre}`); };

    // 1. Catálogo con libros reales de MySQL
    await pagina.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await esperarLibros(pagina, 'n > 0', 'catálogo');
    const cantidad = await pagina.locator('#grilla .libro').count();
    paso(`catálogo con ${cantidad} títulos desde MySQL`);
    await pagina.screenshot({ path: path.join(CAPTURAS, '01-catalogo.png'), fullPage: true });

    // 2. Filtro por categoría (CU-02)
    await pagina.locator('#lista-categorias [data-categoria="Tecnología"]').click();
    await esperarLibros(pagina, `n > 0 && n < ${cantidad}`, 'filtro');
    const filtrados = await pagina.locator('#grilla .libro').count();
    paso(`filtro por categoría: ${filtrados} de ${cantidad}`);
    await pagina.locator('#lista-categorias [data-categoria=""]').click();
    await esperarLibros(pagina, `n === ${cantidad}`, 'sin filtro');

    // 3. Búsqueda (CU-01)
    await pagina.fill('#buscador', 'borges');
    await pagina.press('#buscador', 'Enter');
    await esperarLibros(pagina, 'n === 1', 'búsqueda');
    assert.strictEqual(await pagina.locator('#grilla .libro').count(), 1);
    paso('búsqueda por autor devuelve 1 título');

    // 4. Detalle (CU-03)
    await locVisible(pagina, '#grilla .libro').click();
    await esperarVisible(pagina, '#dialogo-detalle');
    assert.match(await pagina.locator('#detalle-titulo').textContent(), /Ficciones/);
    await pagina.screenshot({ path: path.join(CAPTURAS, '02-detalle.png') });
    paso('detalle del libro abre con sus datos');
    await pagina.locator('#dialogo-detalle [data-cerrar]').first().click();

    // 5. Login real contra /api/auth/login (CU-08)
    await pagina.click('#enlace-sesion');
    await esperarVisible(pagina, '#dialogo-sesion');
    await pagina.fill('#login-email', 'admin@libreria.com');
    await pagina.fill('#login-password', '12345678');
    await pagina.click('#form-login button[type="submit"]');
    await esperarVisible(pagina, '#franja-sesion');
    const token = await pagina.evaluate(() => JSON.parse(sessionStorage.getItem('patismos.sesion')).token);
    assert.ok(token && token.split('.').length === 3, 'no se guardó un JWT en sessionStorage');
    paso('login con JWT guardado en sessionStorage');

    // 6. Agregar al carrito (CU-04) y ver el total (CU-05)
    // Vaciar primero: la prueba tiene que dar el mismo resultado si se corre
    // dos veces seguidas.
    await pagina.evaluate(async () => {
      const s = JSON.parse(sessionStorage.getItem('patismos.sesion'));
      const cabeceras = { Authorization: `Bearer ${s.token}` };
      const carrito = await (await fetch(`/api/carrito/${s.usuario.id}`, { headers: cabeceras })).json();
      for (const item of carrito.items || []) {
        await fetch(`/api/carrito-item/${item.id}`, { method: 'DELETE', headers: cabeceras });
      }
    });
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await esperarLibros(pagina, 'n > 0', 'catálogo tras recargar');
    await pagina.fill('#buscador', 'principito');
    await pagina.press('#buscador', 'Enter');
    await esperarLibros(pagina, 'n === 1', 'búsqueda principito');
    await locVisible(pagina, '#grilla .libro').click();
    await esperarVisible(pagina, '#dialogo-detalle');
    await pagina.click('#detalle-agregar');
    await pagina.waitForFunction(
      () => document.getElementById('contador-carrito')?.textContent === '1',
      null, { timeout: 8000 }
    );
    await pagina.click('#ver-carrito');
    await esperarVisible(pagina, '#dialogo-carrito');
    const total = (await pagina.textContent('#total-carrito')).trim();
    assert.notStrictEqual(total.replace(/\D/g, ''), '0', 'el total del carrito quedó en cero');
    await pagina.screenshot({ path: path.join(CAPTURAS, '03-carrito.png') });
    paso(`carrito con 1 ítem y total ${total}`);

    // 7. Compra (CU-06)
    await pagina.click('#comprar');
    await pagina.waitForFunction(
      () => document.getElementById('mensaje-carrito')?.textContent.includes('Compra confirmada'),
      null, { timeout: 10000 }
    );
    paso('compra confirmada contra /api/pedidos');

    // 8. Panel del gerente (CU-13, CU-14, CU-17)
    await pagina.goto(`${BASE}/admin.html`, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(
      () => document.getElementById('stat-libros')?.textContent !== '—',
      null, { timeout: 10000 }
    );
    const titulos = Number(await pagina.textContent('#stat-libros'));
    const filasInventario = await pagina.locator('#cuerpo-inventario tr').count();
    assert.ok(titulos > 0, 'las estadísticas no trajeron títulos');
    assert.ok(filasInventario > 0, 'el inventario está vacío');
    await pagina.screenshot({ path: path.join(CAPTURAS, '04-panel-gerente.png'), fullPage: true });
    paso(`panel del gerente: ${titulos} títulos, ${filasInventario} filas de inventario`);

    // 9. Tabla de usuarios (CU-12), con la sesión de gerente que quedó abierta.
    await pagina.waitForFunction(
      () => document.querySelectorAll('#tabla-usuarios tbody tr').length > 0,
      null, { timeout: 10000 }
    );
    const filasUsuarios = await pagina.locator('#tabla-usuarios tbody tr').count();
    const selectoresRol = await pagina.locator('#tabla-usuarios tbody select').count();
    assert.equal(selectoresRol, filasUsuarios, 'cada usuario tiene que tener su selector de rol');
    await pagina.screenshot({ path: path.join(CAPTURAS, '05-panel-usuarios.png'), fullPage: true });
    paso(`tabla de usuarios: ${filasUsuarios} filas con selector de rol`);

    // 10. Con sesión de comprador la tabla de usuarios no se pinta ni se ve.
    // Se cierra la sesión de gerente y se entra con la cuenta de comprador.
    await pagina.click('#cerrar-sesion');
    await pagina.waitForURL(/index\.html$/, { timeout: 10000 }).catch(() => {});
    await pagina.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await pagina.click('#enlace-sesion');
    await esperarVisible(pagina, '#dialogo-sesion');
    await pagina.fill('#login-email', 'usuario@test.com');
    await pagina.fill('#login-password', '12345678');
    await pagina.click('#form-login button[type="submit"]');
    await esperarVisible(pagina, '#franja-sesion');
    await pagina.goto(`${BASE}/admin.html`, { waitUntil: 'domcontentloaded' });
    await esperarVisible(pagina, '#bloqueo');
    const tablaUsuariosVisible = await pagina.locator('#tabla-usuarios').isVisible();
    assert.equal(tablaUsuariosVisible, false, 'un comprador no puede ver la tabla de usuarios');
    const filasComprador = await pagina.locator('#tabla-usuarios tbody tr').count();
    assert.equal(filasComprador, 0, 'un comprador no debería tener filas pintadas');
    paso('con sesión de comprador la tabla de usuarios queda oculta');

    assert.deepStrictEqual(erroresConsola, [], `errores de consola: ${erroresConsola.join(' | ')}`);
    console.log(`\n${pasos.length}/10 pasos OK. Capturas en documentacion/capturas/`);
  } finally {
    await navegador.close();
  }
}

main().catch((error) => {
  console.error('\nFALLA:', error.message);
  process.exit(1);
});
