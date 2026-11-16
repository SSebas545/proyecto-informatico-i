# Manual de usuario — Los Patismos

Sistema de gestión de la librería **Los Patismos**. Tiene dos recorridos: el de
quien compra (catálogo y carrito) y el de quien gestiona (panel del gerente).

Capturas de referencia en `documentacion/capturas/`:
`01-catalogo.png`, `02-detalle.png`, `03-carrito.png`, `04-panel-gerente.png`.

## 1. Antes de empezar

El sistema necesita dos cosas andando:

1. **MariaDB/MySQL** con la base `libreria_db` (el servidor la crea sola la
   primera vez, con las tablas, las 8 categorías y dos usuarios de prueba).
2. **El servidor Node** en el puerto 3000.

Desde la carpeta `server/`:

```bash
npm install          # solo la primera vez
npm run seed         # carga 12 libros de ejemplo (se puede repetir)
npm start            # levanta API y frontend en http://localhost:3000
```

Abrir `http://localhost:3000` en el navegador. No hace falta instalar nada más:
la página y la API se sirven desde el mismo servidor.

### Usuarios de prueba

| rol | email | contraseña |
|---|---|---|
| Gerente | `admin@libreria.com` | `12345678` |
| Comprador | `usuario@test.com` | `12345678` |

## 2. Recorrido del comprador

### 2.1 Entrar

1. Clic en **Ingresar**, arriba a la derecha.
2. Completar email y contraseña, y **Entrar**.
3. Si no tiene cuenta, **Crear una cuenta**: pide nombre, email y una contraseña
   de 6 caracteres como mínimo.

La sesión se guarda en la pestaña del navegador: al cerrarla, se cierra la
sesión. Arriba aparece una franja con el nombre y el enlace **Cerrar sesión**.

### 2.2 Buscar libros

- Escribir en la barra de búsqueda (por título o autor) y presionar **Enter** o
  **Buscar**.
- Para limpiar la búsqueda, borrar el texto y volver a buscar.

### 2.3 Filtrar

- **Categorías**: clic en una categoría de la columna derecha. *Todas* quita el
  filtro.
- **Disponibilidad**: *Todos*, *En stock* o *Sin stock*.
- Los filtros se combinan: se puede buscar "borges" dentro de *Ficción* con
  stock disponible.

Cada tarjeta muestra el precio y si hay stock, con la cantidad disponible.

### 2.4 Ver el detalle

Clic sobre una tapa: se abre una ficha con autor, categoría, descripción, precio
y stock. Si el libro no tiene stock, el botón **Agregar al carrito** está
deshabilitado.

### 2.5 Carrito y compra

1. **Agregar al carrito** desde la ficha (o directamente, si ya está en la
   ficha abierta).
2. **Mi carrito** (arriba a la derecha) muestra los títulos, con botones `+`,
   `−` y `×` para cambiar cantidades o quitar.
3. **Confirmar compra** genera el pedido, descuenta el stock y vacía el carrito.
   Aparece el mensaje "Compra confirmada".

Si algo falla —por ejemplo, otro usuario compró el último ejemplar— el sistema
no deja el pedido a medias: avisa y no descuenta nada.

## 3. Recorrido del gerente

Entrar con `admin@libreria.com`. En la franja de sesión aparece el enlace
**Panel**, que lleva a `admin.html`.

### 3.1 Resumen

Cinco indicadores: títulos en catálogo, con stock, sin stock, con stock bajo
(menos de 5) y ventas totales de los pedidos pagados.

### 3.2 Alertas de stock bajo

Tabla con los libros que tienen menos de 5 ejemplares; los que están en cero se
muestran en rojo. Si no hay ninguno, dice "No hay alertas".

### 3.3 Inventario: cambiar el stock

1. Buscar la fila del libro.
2. Escribir el número nuevo en la columna **Stock**.
3. Clic en **Guardar** en esa fila.

El resto de los datos del libro no se modifica. El sistema no acepta stock
negativo ni decimal.

### 3.4 Alta de libro

Completar título, autor, precio, stock, categoría y (opcional) descripción.
**Agregar al catálogo** lo publica de inmediato: aparece en la tienda.

### 3.5 Alta de categoría

Escribir el nombre y **Agregar categoría**. Queda disponible en el alta de
libros y en el filtro del catálogo. No se permiten nombres repetidos.

### 3.6 Usuarios y roles

La sección **Usuarios** lista todas las cuentas con su nombre, email y rol. El
selector de la columna *Rol* cambia la cuenta entre **usuario** (comprador) y
**gerente** (administra el local); el cambio se guarda al instante y, si la API
lo rechaza, el selector vuelve al rol anterior y aparece el motivo.

Sólo ve esta sección quien entró como gerente. Con una sesión de comprador el
panel entero queda bloqueado y la tabla ni se dibuja.

No se pueden crear ni borrar cuentas desde el panel: cada persona se registra
sola y las cuentas con pedidos no se borran para no romper el historial.

## 4. Problemas frecuentes

| síntoma | causa probable | qué hacer |
|---|---|---|
| "No se pudo conectar con el servidor" | El servidor Node no está corriendo | `cd server && npm start` |
| El catálogo aparece vacío | Falta cargar libros | `cd server && npm run seed` |
| "Credenciales inválidas" | Email o contraseña incorrectos | Revisar mayúsculas; usar los usuarios de prueba de la sección 1 |
| La sesión se cierra sola | El token vence a las 24 h, o se cerró la pestaña | Volver a ingresar |
| El panel dice "necesita una sesión de gerente" | Se entró con un usuario comprador | Cerrar sesión e ingresar como `admin@libreria.com` |
| El selector de rol vuelve atrás solo | El backend rechazó el cambio (token vencido o sesión de comprador) | Volver a ingresar como gerente y reintentar |

## 5. Qué queda afuera de esta versión

- **Alta y baja de usuarios (CU-12)**: el gerente lista y cambia roles, pero no
  crea ni borra cuentas; cada uno se registra solo y borrar una cuenta con
  pedidos rompería el historial.
- **Recomendaciones (CU-07)**: el endpoint `GET /api/recomendaciones` devuelve
  hasta 6 libros de las categorías de las últimas compras, sin los ya
  comprados, pero todavía no hay una sección en la tienda que los muestre.
- **Préstamos**: se mencionan en el relevamiento, pero no están entre los 17
  casos de uso acordados.

Estas ausencias están declaradas en `documentacion/Matriz_Trazabilidad.md`.
