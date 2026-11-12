# Matriz de trazabilidad — Los Patismos

Una fila por caso de uso, con la pantalla que lo resuelve, el archivo o handler
que lo implementa y los dos caminos que hay que poder mostrar en la defensa:
el que sale bien y el que sale mal.

Fuente de los CU: `casos_de_uso/especificaciones_casos_de_uso.md:7-485`.
Rutas del backend verificadas en `server/index.js`; pantallas en `frontend/`.

| CU | pantalla | archivo/handler | estado | caso de éxito | caso de fracaso |
|---|---|---|---|---|---|
| CU-01 Buscar libro | Catálogo, barra de búsqueda | `frontend/js/tienda.js` (`form-buscar`) → `GET /api/libros?search=` (`server/index.js:218`) | hecho | Escribir "borges" y Enter devuelve 1 título: *Ficciones*. | Buscar un texto inexistente muestra "No hay títulos con esos filtros" y el catálogo sigue navegable. |
| CU-02 Filtrar por categoría | Catálogo, columna Categorías | `frontend/js/tienda.js` (`#lista-categorias`) → `GET /api/libros?categoria=` (`index.js:218`) | hecho | Clic en *Tecnología* deja 2 de 12 títulos. | Una categoría sin libros deja la grilla vacía con el mensaje de vacío, sin romper los filtros. |
| CU-03 Ver detalle del libro | Diálogo de detalle | `frontend/js/tienda.js` (`abrirDetalle`) → `GET /api/libros/:id` (`index.js:256`) | hecho | Clic en una tapa abre el diálogo con autor, descripción, precio y stock. | Un libro con `stock = 0` muestra "Sin stock" y el botón *Agregar* queda deshabilitado. |
| CU-04 Agregar al carrito | Diálogo de detalle / carrito | `frontend/js/tienda.js` (`agregarAlCarrito`) → `POST /api/carrito/:id` (`index.js:455`) | hecho | Agregar *El principito* sube el contador a 1 y el total a $ 12.000. | Sin sesión se abre el diálogo de acceso; si el stock no alcanza, el backend responde 400 y se muestra el mensaje. |
| CU-05 Ver carrito | Diálogo *Mi carrito* | `frontend/js/tienda.js` (`cargarCarrito`, `pintarCarrito`) → `GET /api/carrito/:id` (`index.js:418`) | hecho | El carrito lista título, autor, cantidad, subtotal y total. | Sin token la API responde **401** (medido con `curl`) y la vista queda en "Ingresá para usar el carrito". |
| CU-06 Realizar compra | Diálogo *Mi carrito* | `frontend/js/tienda.js` (`comprar`) → `POST /api/pedidos` (`index.js:582`) | hecho | Confirmar la compra responde "Compra confirmada", descuenta stock y vacía el carrito (transacción con rollback). | Con el carrito vacío el botón está deshabilitado; si el stock cambió, el backend hace rollback y devuelve 400. |
| CU-07 Ver recomendaciones | — | — | **hueco** | Derivado: se pueden sugerir títulos de la misma categoría del último pedido, sin tabla propia. | No está implementado ni tiene tabla en el ER; se declara como pendiente. |
| CU-08 Iniciar sesión | Diálogo de acceso | `frontend/js/tienda.js` (`iniciarSesion`) → `POST /api/auth/login` (`index.js:92`) | hecho | `admin@libreria.com` / `12345678` entra y guarda el JWT en `sessionStorage`. | Contraseña incorrecta: 401 y "Credenciales inválidas" en el diálogo, sin cerrar la página. |
| CU-09 Registrarse | Diálogo de acceso, pestaña *Crear cuenta* | `frontend/js/tienda.js` (`registrarse`) → `POST /api/auth/register` (`index.js:132`) | hecho | Un email nuevo crea el usuario y deja la sesión iniciada. | Email repetido devuelve 409 con el mensaje del backend; contraseña de menos de 6 no pasa la validación del formulario. |
| CU-10 Gestionar libros (CRUD) | Panel del gerente, Inventario y Alta | `frontend/js/admin.js` (`altaLibro`, `guardarStock`) → `POST/PUT/DELETE /api/libros` (`index.js:273,313,351`) | hecho (alta y edición) | Guardar una fila actualiza el libro y refresca inventario y estadísticas. | Un libro sin título o con precio no numérico responde 400 y se muestra el mensaje. |
| CU-11 Gestionar stock | Panel, columna Stock | `frontend/js/admin.js` (`guardarStock`) → `PUT /api/libros/:id` (`index.js:313`) | hecho | Cambiar el stock de 3 a 5 y guardar muestra "Stock actualizado a 5". | Stock negativo o decimal: el formulario y el backend lo rechazan. |
| CU-12 Gestionar usuarios | — | — | **pendiente** | El backend sólo expone `GET/PUT /api/usuario` (el propio perfil): falta el listado de usuarios para el gerente. | No hay pantalla ni endpoint de administración de usuarios; se declara en la defensa. |
| CU-13 Ver estadísticas | Panel, tarjetas de indicadores | `frontend/js/admin.js` (`cargarEstadisticas`) → `GET /api/estadisticas` (`index.js:677`) | hecho | El panel muestra títulos, con stock, sin stock, stock bajo y ventas. | Sin rol gerente la API responde 403 y el panel muestra el bloqueo con el enlace de acceso. |
| CU-14 Ver resumen general | Panel, encabezado y tarjetas | `frontend/js/admin.js` → `GET /api/estadisticas` (`index.js:677`) | hecho | Al entrar se ve el resumen del local con la sesión de quien entró. | Sin sesión se muestra "Este panel necesita una sesión de gerente" y no se renderiza nada de gestión. |
| CU-15 Agregar categorías | Panel, Alta de categoría | `frontend/js/admin.js` (`altaCategoria`) → `POST /api/categorias` (`index.js:383`) | hecho | Crear "Poesía" la agrega a la lista y al alta de libros. | Nombre repetido responde 409 y se muestra el mensaje sin duplicar la fila. |
| CU-16 Restockear libros | Panel, Inventario | `frontend/js/admin.js` (`guardarStock`) → `PUT /api/libros/:id` (`index.js:313`) | hecho (es CU-11 con otra intención) | Reponer un libro en 0 lo devuelve al catálogo público en la siguiente recarga. | Si el libro se borró mientras la tabla estaba abierta, el PUT responde 404 y se avisa. |
| CU-17 Ver alertas de stock bajo | Panel, tabla *Alertas* | `frontend/js/admin.js` (`pintarAlertas`) + `GET /api/estadisticas` (`index.js:677`) | hecho, **sin tabla propia** | La tabla lista los libros con `stock < 5` y resalta en rojo los que están en 0. | Sin libros bajos la tabla se oculta y se muestra "No hay alertas": el caso de fracaso queda cubierto. |

## Cómo se verifica esta matriz

```bash
grep -cE '^\| *CU-[0-9]{2}' documentacion/Matriz_Trazabilidad.md   # 17
grep -cE '^\| CU-07.*hueco' documentacion/Matriz_Trazabilidad.md    # 1
grep -cE '^\| CU-12.*pendiente' documentacion/Matriz_Trazabilidad.md # 1
```

(Medido el 2026-11-12: 17, 1 y 1.)

## Decisiones que se defienden en la oral

1. **CU-07 y CU-17 no llevan tabla.** Son consultas derivadas: recomendaciones
   por categoría del último pedido y alertas por `libros.stock`. Agregar tablas
   sería duplicar un dato que ya está y que puede quedar desincronizado.
2. **CU-12 queda afuera con nombre y apellido.** El sistema tiene dos roles y el
   gerente puede editar su propio perfil, pero no crear ni borrar usuarios: es
   la deuda declarada, no un olvido.
3. **Préstamos** aparecen en la ficha del cliente del relevamiento, pero no
   están entre los 17 CU acordados; no se inventó un CU-18.
