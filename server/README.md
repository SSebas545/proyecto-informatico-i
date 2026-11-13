# Server - Sistema de Gestión de Librería

Backend Node.js para el sistema de gestión de librería "Los Patismos".

## Estructura del Proyecto

```
server/
├── .env                # Configuración de entorno (DB, JWT, Puerto)
├── index.js            # Punto de entrada y rutas generales
├── database.js         # Conexión y operaciones de base de datos
├── rutas-usuarios.js   # CU-12: listar usuarios y cambiar rol (sólo gerente)
├── rutas-recomendaciones.js  # CU-07: sugerencias del cliente
├── test/               # Pruebas con `npm test` (base de datos simulada)
└── package.json        # Dependencias del proyecto
```

Cada router nuevo se exporta como fábrica —`module.exports =
(autenticarToken) => router`— y se monta en `index.js` con
`app.use(require('./rutas-x')(autenticarToken))`, así no duplica el middleware.

## Dependencias

- `express` - Framework web para Node.js
- `mysql2` - Conexión a MySQL
- `bcryptjs` - Hashing de contraseñas
- `jsonwebtoken` - Autenticación por JWT
- `cors` - CORS habilitado para desarrollo
- `dotenv` - Manejo de variables de entorno

## Cómo levantar el proyecto

```bash
cd server
npm install      # solo la primera vez
cp .env.example .env   # y completar los valores reales
npm run seed     # carga 12 libros de ejemplo (idempotente)
npm start        # API + frontend en http://localhost:3000
```

Abrir `http://localhost:3000` para la tienda y `http://localhost:3000/admin.html`
para el panel del gerente (`admin@libreria.com` / `12345678`).

## Configuración

### Variables de Entorno (.env)

Copiar `.env.example` a `.env` en esta carpeta y completar con los valores
reales. La plantilla trae las claves con valores de mentira a propósito: el
`.env` verdadero nunca se commitea.

Claves: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`,
`JWT_SECRET`, `PORT`, `NODE_ENV` y, opcional, `CORS_ORIGIN`.

### Base de Datos MySQL

La base de datos `libreria_db` debe estar disponible en MySQL. El servidor creará automáticamente las tablas al iniciar por primera vez:

- `usuarios` - Usuarios del sistema (clientes y gerentes)
- `categorias` - Categorías de libros (Ficción, Arte, Tecnología, etc.)
- `libros` - Catálogo de libros
- `carritos` - Carros de compras
- `carrito_items` - Items del carrito
- `pedidos` - Pedidos realizados
- `pedido_items` - Items de los pedidos

## Scripts Disponibles

### Inicializar la base de datos

```bash
cd server
node -e "require('./database').inicializar().then(() => console.log('DB initialized')).catch(e => console.error(e))"
```

### Iniciar el servidor

```bash
cd server
node index.js
```

El servidor correrá en `http://localhost:3000` por defecto.

## API Endpoints

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/register` | Registrarse nuevo usuario |

### Libros

| Método | Endpoint | Descripción | Requiere Auth |
|--------|----------|-------------|--------------|
| GET | `/api/libros` | Listar libros con filtros | No |
| GET | `/api/libros/:id` | Obtener un libro | No |
| POST | `/api/libros` | Crear libro | Sí (gerente) |
| PUT | `/api/libros/:id` | Actualizar libro | Sí (gerente) |
| DELETE | `/api/libros/:id` | Eliminar libro | Sí (gerente) |

### Categorías

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/categorias` | Listar todas las categorías |

### Carrito

| Método | Endpoint | Descripción | Requiere Auth |
|--------|----------|-------------|--------------|
| GET | `/api/carrito/:usuario_id` | Ver carrito | Sí |
| POST | `/api/carrito/:usuario_id` | Agregar item | Sí |
| PUT | `/api/carrito-item/:item_id` | Actualizar cantidad | Sí |
| DELETE | `/api/carrito-item/:item_id` | Eliminar item | Sí |

### Pedidos

| Método | Endpoint | Descripción | Requiere Auth |
|--------|----------|-------------|--------------|
| POST | `/api/pedidos` | Crear pedido | Sí |
| GET | `/api/pedidos/historial` | Historial de pedidos | Sí |

### Usuario

| Método | Endpoint | Descripción | Requiere Auth |
|--------|----------|-------------|--------------|
| GET | `/api/usuario` | Datos del usuario | Sí |
| PUT | `/api/usuario` | Actualizar perfil | Sí |
| PUT | `/api/usuario/password` | Cambiar contraseña | Sí |
| PUT | `/api/gerente/cambiar-password` | Cambiar password (gerente) | Sí (gerente) |

### Estadísticas (Gerente)

| Método | Endpoint | Descripción | Requiere Auth |
|--------|----------|-------------|--------------|
| GET | `/api/estadisticas` | Estadísticas del sistema | Sí (gerente) |

### Usuarios (Gerente, CU-12)

| Método | Endpoint | Descripción | Requiere Auth |
|--------|----------|-------------|--------------|
| GET | `/api/usuarios` | Listar cuentas con su rol | Sí (gerente) |
| PUT | `/api/usuarios/:id/rol` | Cambiar el rol (`usuario` \| `gerente`) | Sí (gerente) |

### Recomendaciones (CU-07)

| Método | Endpoint | Descripción | Requiere Auth |
|--------|----------|-------------|--------------|
| GET | `/api/recomendaciones` | Hasta 6 libros de las categorías de las últimas 4 compras, sin los ya comprados | Sí |

## Flujo de Trabajo

1. **Usuario se registra o inicia sesión** → Recibe JWT token
2. **Usuario navega por el catálogo** → GET `/api/libros` con filtros opcionales
3. **Usuario agrega libros al carrito** → POST `/api/carrito/:usuario_id`
4. **Usuario finaliza la compra** → POST `/api/pedidos`
5. **Pedido procesa el pago** → Stock actualizado, carrito vaciado
6. **Gerente ve estadísticas** → GET `/api/estadisticas`

## Roles

- **usuario**: Puede buscar libros, ver detalles, agregar al carrito, comprar
- **gerente**: Todo lo de usuario + CRUD de libros, listar usuarios y cambiar
  su rol (`/api/usuarios`), estadísticas, cambiar passwords

## Desarrollo

### Agregar nuevas rutas

1. Importar el router o agregar nuevas secciones en `index.js`
2. Usar el middleware `autenticarToken` para rutas protegidas
3. Verificar roles con `if (req.user.rol !== 'gerente')` cuando sea necesario

### Correr las pruebas

```bash
cd server
npm test        # node --test; no necesita MySQL, la base está simulada
```

### Probar los endpoints

Usar Postman, Thunder Client o `curl`:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@libreria.com","password":"12345678"}'
```