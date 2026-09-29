# Especificaciones de Casos de Uso - Los Patismos

## Sistema de Gestión de Librería

---

## CU-01: Buscar Libro

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-01 |
| **Nombre** | Buscar Libro |
| **Actor** | Usuario/Comprador |
| **Descripción** | El usuario busca libros en el catálogo por nombre o autor |

### Precondiciones
- El usuario ha iniciado sesión o accede como invitado
- El catálogo contiene libros cargados

### Flujo Principal
1. El usuario ingresa a la página de catálogo
2. El usuario hace clic en el campo de búsqueda
3. El usuario ingresa el nombre del libro o autor
4. El sistema muestra los resultados que coinciden con la búsqueda
5. El usuario selecciona un libro de los resultados

### Flujos Alternativos
- **3a.** Si no se encuentran resultados, el sistema muestra un mensaje "No se encontraron libros"
- **3b.** Si el usuario deja el campo vacío, se muestran todos los libros

### Postcondiciones
- El usuario ve los resultados de la búsqueda
- Puede seleccionar un libro para ver más detalles

---

## CU-02: Filtrar por Categoría

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-02 |
| **Nombre** | Filtrar por Categoría |
| **Actor** | Usuario/Comprador |
| **Descripción** | El usuario filtra el catálogo por categorías específicas |

### Precondiciones
- El usuario está en la página de catálogo
- Existen categorías cargadas en el sistema

### Flujo Principal
1. El usuario selecciona una categoría del panel lateral
2. El sistema filtra los libros mostrando solo los de esa categoría
3. El usuario puede seleccionar adicionalmente filtros de stock
4. El sistema actualiza los resultados según los filtros aplicados

### Flujos Alternativos
- **1a.** El usuario puede seleccionar múltiples categorías
- **3a.** El usuario puede filtrar por "En stock" o "Sin stock"

### Postcondiciones
- El catálogo muestra solo los libros que cumplen con los filtros seleccionados

---

## CU-03: Ver Detalle del Libro

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-03 |
| **Nombre** | Ver Detalle del Libro |
| **Actor** | Usuario/Comprador |
| **Descripción** | El usuario ve la información completa de un libro seleccionado |

### Precondiciones
- El usuario ha encontrado un libro en el catálogo

### Flujo Principal
1. El usuario hace clic en un libro del catálogo
2. El sistema muestra la página de detalle con:
   - Título del libro
   - Autor
   - Descripción
   - Precio
   - Disponibilidad (en stock / sin stock)
   - Categoría
   - Estado físico (nuevo, usado, etc.)
3. El usuario puede volver al catálogo o agregar al carrito

### Flujos Alternativos
- **2a.** Si el libro está sin stock, se muestra un mensaje de "No disponible"

### Postcondiciones
- El usuario tiene la información completa del libro

---

## CU-04: Agregar al Carrito

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-04 |
| **Nombre** | Agregar al Carrito |
| **Actor** | Usuario/Comprador |
| **Descripción** | El usuario agrega un libro al carrito de compras |

### Precondiciones
- El usuario ha iniciado sesión
- El libro está disponible (en stock)

### Flujo Principal
1. El usuario ve el detalle de un libro
2. El usuario hace clic en "Agregar al carrito"
3. El sistema agrega el libro al carrito
4. El sistema muestra un mensaje de confirmación
5. El contador del carrito se incrementa

### Flujos Alternativos
- **2a.** Si el libro ya está en el carrito, se incrementa la cantidad
- **2b.** Si el libro no está disponible, se muestra un mensaje de error

### Postcondiciones
- El libro está en el carrito del usuario
- El stock reservado se actualiza

---

## CU-05: Ver Carrito

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-05 |
| **Nombre** | Ver Carrito |
| **Actor** | Usuario/Comprador |
| **Descripción** | El usuario ve los libros agregados al carrito |

### Precondiciones
- El usuario tiene al menos un libro en el carrito

### Flujo Principal
1. El usuario hace clic en "Mi carrito"
2. El sistema muestra la lista de libros en el carrito con:
   - Título
   - Precio unitario
   - Cantidad
   - Subtotal
3. El sistema muestra el total general
4. El usuario puede modificar cantidades o eliminar libros

### Flujos Alternativos
- **4a.** El usuario puede vaciar el carrito completamente

### Postcondiciones
- El usuario ve el resumen de su compra

---

## CU-06: Realizar Compra

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-06 |
| **Nombre** | Realizar Compra |
| **Actor** | Usuario/Comprador |
| **Descripción** | El usuario finaliza la compra de los libros en el carrito |

### Precondiciones
- El usuario ha iniciado sesión
- El carrito contiene al menos un libro
- Los libros están disponibles

### Flujo Principal
1. El usuario hace clic en "Finalizar compra"
2. El sistema muestra el resumen de la compra
3. El usuario confirma la compra
4. El sistema redirige al sistema de pago
5. El sistema de pago procesa el pago
6. El sistema confirma la compra y genera un comprobante
7. El sistema actualiza el stock de los libros comprados
8. El sistema vacía el carrito

### Flujos Alternativos
- **5a.** Si el pago falla, se muestra un mensaje de error y se reintenta
- **5b.** Si un libro se queda sin stock durante el proceso, se notifica al usuario

### Postcondiciones
- La compra queda registrada en el sistema
- El stock se actualiza
- El usuario recibe un comprobante

---

## CU-07: Ver Recomendaciones

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-07 |
| **Nombre** | Ver Recomendaciones |
| **Actor** | Usuario/Comprador |
| **Descripción** | El usuario ve recomendaciones de libros basadas en el catálogo |

### Precondiciones
- El usuario ha iniciado sesión
- El sistema tiene datos de preferencias o historial del usuario

### Flujo Principal
1. El usuario accede a la sección de recomendaciones
2. El sistema muestra libros recomendados basados en:
   - Categorías favoritas
   - Historial de compras
   - Libros populares
3. El usuario puede seleccionar un libro recomendado

### Flujos Alternativos
- **2a.** Si no hay suficientes datos, se muestran los libros más populares

### Postcondiciones
- El usuario descubre nuevos libros de su interés

---

## CU-08: Iniciar Sesión

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-08 |
| **Nombre** | Iniciar Sesión |
| **Actor** | Usuario/Comprador, Gerente |
| **Descripción** | El usuario inicia sesión en el sistema |

### Precondiciones
- El usuario tiene una cuenta registrada

### Flujo Principal
1. El usuario accede a la página de login
2. El usuario selecciona su rol (Usuario o Gerente)
3. El usuario ingresa su email y contraseña
4. El sistema valida las credenciales
5. El sistema redirige al usuario según su rol

### Flujos Alternativos
- **4a.** Si las credenciales son incorrectas, se muestra un mensaje de error
- **4b.** Si la cuenta está bloqueada, se muestra un mensaje de contacto al administrador

### Postcondiciones
- El usuario accede a su panel correspondiente

---

## CU-09: Registrarse

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-09 |
| **Nombre** | Registrarse |
| **Actor** | Usuario/Comprador |
| **Descripción** | El usuario crea una cuenta nueva |

### Precondiciones
- El usuario no tiene una cuenta registrada

### Flujo Principal
1. El usuario accede a la página de registro
2. El usuario completa el formulario (nombre, email, contraseña)
3. El sistema valida los datos
4. El sistema crea la cuenta
5. El sistema envía un email de confirmación
6. El usuario puede iniciar sesión

### Flujos Alternativos
- **3a.** Si el email ya está registrado, se muestra un mensaje de error
- **3b.** Si la contraseña no cumple los requisitos, se indican los requisitos

### Postcondiciones
- El usuario tiene una cuenta activa

---

## CU-10: Gestionar Libros

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-10 |
| **Nombre** | Gestionar Libros |
| **Actor** | Gerente/Administrador |
| **Descripción** | El gerente realiza operaciones CRUD sobre los libros |

### Precondiciones
- El gerente ha iniciado sesión

### Flujo Principal
1. El gerente accede al panel de gestión de libros
2. El gerente puede:
   - **Crear**: Agregar un nuevo libro con todos sus datos
   - **Leer**: Ver la lista de libros con filtros
   - **Actualizar**: Modificar datos de un libro existente
   - **Eliminar**: Remover un libro del catálogo
3. El sistema guarda los cambios

### Flujos Alternativos
- **2a.** Al crear un libro, se solicita: título, autor, descripción, precio, categoría, stock, estado
- **2c.** Al actualizar, se pueden modificar todos los campos

### Postcondiciones
- Los datos del libro quedan actualizados en el sistema

---

## CU-11: Gestionar Stock

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-11 |
| **Nombre** | Gestionar Stock |
| **Actor** | Gerente/Administrador |
| **Descripción** | El gerente actualiza las cantidades de stock |

### Precondiciones
- El gerente ha iniciado sesión
- Existen libros en el catálogo

### Flujo Principal
1. El gerente accede al panel de stock
2. El sistema muestra los libros con su stock actual
3. El gerente selecciona un libro
4. El gerente actualiza la cantidad de stock
5. El sistema guarda el cambio
6. Si el stock es bajo, el sistema genera una alerta

### Flujos Alternativos
- **4a.** El gerente puede agregar o quitar unidades
- **6a.** Si el stock llega a 0, el libro se marca como "Sin stock"

### Postcondiciones
- El stock queda actualizado
- Se generan alertas si es necesario

---

## CU-12: Gestionar Usuarios

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-12 |
| **Nombre** | Gestionar Usuarios |
| **Actor** | Gerente/Administrador |
| **Descripción** | El gerente administra las cuentas de usuarios |

### Precondiciones
- El gerente ha iniciado sesión

### Flujo Principal
1. El gerente accede al panel de usuarios
2. El sistema muestra la lista de usuarios registrados
3. El gerente puede:
   - Ver detalles de un usuario
   - Modificar datos de un usuario
   - Desactivar/activar una cuenta
   - Eliminar una cuenta
4. El sistema guarda los cambios

### Flujos Alternativos
- **3a.** El gerente puede buscar usuarios por nombre o email

### Postcondiciones
- Los datos de los usuarios quedan actualizados

---

## CU-13: Ver Estadísticas

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-13 |
| **Nombre** | Ver Estadísticas |
| **Actor** | Gerente/Administrador |
| **Descripción** | El gerente visualiza estadísticas de ventas y tendencias |

### Precondiciones
- El gerente ha iniciado sesión
- Existen datos de ventas en el sistema

### Flujo Principal
1. El gerente accede al panel de estadísticas
2. El sistema muestra:
   - Ventas por categoría (gráfico de barras)
   - Libros más vendidos (top 10)
   - Ventas por período (día, semana, mes)
   - Ingresos totales
3. El gerente puede filtrar por período

### Flujos Alternativos
- **3a.** El gerente puede exportar las estadísticas en PDF o Excel

### Postcondiciones
- El gerente tiene información para la toma de decisiones

---

## CU-14: Ver Resumen General

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-14 |
| **Nombre** | Ver Resumen General |
| **Actor** | Gerente/Administrador |
| **Descripción** | El gerente ve el dashboard con métricas principales |

### Precondiciones
- El gerente ha iniciado sesión

### Flujo Principal
1. El gerente accede al dashboard
2. El sistema muestra:
   - Total de libros en el catálogo
   - Libros en stock
   - Pedidos del día
   - Ventas del mes
   - Libros con stock bajo
   - Precio promedio
3. El gerente puede acceder a cada sección para más detalles

### Postcondiciones
- El gerente tiene una visión general del estado del negocio

---

## CU-15: Agregar Categorías

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-15 |
| **Nombre** | Agregar Categorías |
| **Actor** | Gerente/Administrador |
| **Descripción** | El gerente crea nuevas categorías de libros |

### Precondiciones
- El gerente ha iniciado sesión

### Flujo Principal
1. El gerente accede al panel de categorías
2. El gerente hace clic en "Agregar categoría"
3. El gerente ingresa el nombre de la categoría
4. El sistema valida que no exista una categoría con el mismo nombre
5. El sistema crea la categoría
6. La categoría queda disponible para asignar a libros

### Flujos Alternativos
- **4a.** Si ya existe una categoría con ese nombre, se muestra un error

### Postcondiciones
- La nueva categoría está disponible en el sistema

---

## CU-16: Restockear Libros

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-16 |
| **Nombre** | Restockear Libros |
| **Actor** | Gerente/Administrador |
| **Descripción** | El gerente agrega unidades al inventario de libros |

### Precondiciones
- El gerente ha iniciado sesión
- Existen libros en el catálogo

### Flujo Principal
1. El gerente accede al panel de restock
2. El sistema muestra los libros con stock bajo
3. El gerente selecciona un libro
4. El gerente ingresa la cantidad a agregar
5. El sistema actualiza el stock
6. El sistema confirma la actualización

### Flujos Alternativos
- **4a.** El gerente puede buscar un libro específico para restockear

### Postcondiciones
- El stock del libro queda actualizado
- Se elimina la alerta de stock bajo si corresponde

---

## CU-17: Ver Alertas de Stock Bajo

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-17 |
| **Nombre** | Ver Alertas de Stock Bajo |
| **Actor** | Gerente/Administrador |
| **Descripción** | El gerente ve las alertas de libros con stock bajo |

### Precondiciones
- El gerente ha iniciado sesión
- Existen libros con stock bajo (configurable, ej: < 5 unidades)

### Flujo Principal
1. El gerente accede al panel de alertas
2. El sistema muestra los libros con stock bajo:
   - Nombre del libro
   - Stock actual
   - Nivel mínimo configurado
3. El gerente puede tomar acción (restockear)
4. El gerente puede descartar la alerta

### Flujos Alternativos
- **3a.** El sistema puede enviar notificaciones automáticas al gerente

### Postcondiciones
- El gerente está informado sobre los libros que necesitan reposición
