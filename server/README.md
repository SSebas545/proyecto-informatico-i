# Server - Sistema de Gestión de Librería

Backend Node.js para el sistema de gestión de librería "Los Patismos".

## Estructura del Proyecto

```
server/
├── .env              # Configuración de entorno (DB, JWT, Puerto)
├── index.js          # Punto de entrada del servidor
├── database.js       # Conexión y operaciones de base de datos
└── package.json      # Dependencias del proyecto
```

## Dependencias

- `express` - Framework web para Node.js
- `mysql2` - Conexión a MySQL
- `bcryptjs` - Hashing de contraseñas
- `jsonwebtoken` - Autenticación por JWT
- `cors` - CORS habilitado para desarrollo
- `dotenv` - Manejo de variables de entorno

## Configuración

### Variables de Entorno (.env)

Crear un archivo `.env` en la carpeta `server/` con:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=libreria_db
DB_PORT=3306

JWT_SECRET=secreto-super-seguro-para-el-proyecto
PORT=3000
NODE_ENV=development
```

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

## Flujo de Trabajo

1. **Usuario se registra o inicia sesión** → Recibe JWT token
2. **Usuario navega por el catálogo** → GET `/api/libros` con filtros opcionales
3. **Usuario agrega libros al carrito** → POST `/api/carrito/:usuario_id`
4. **Usuario finaliza la compra** → POST `/api/pedidos`
5. **Pedido procesa el pago** → Stock actualizado, carrito vaciado
6. **Gerente ve estadísticas** → GET `/api/estadisticas`

## Roles

- **usuario**: Puede buscar libros, ver detalles, agregar al carrito, comprar
- **gerente**: Todo lo de usuario + CRUD de libros, gestión de usuarios, estadísticas, cambiar passwords

## Desarrollo

### Agregar nuevas rutas

1. Importar el router o agregar nuevas secciones en `index.js`
2. Usar el middleware `autenticarToken` para rutas protegidas
3. Verificar roles con `if (req.user.rol !== 'gerente')` cuando sea necesario

### Probar los endpoints

Usar Postman, Thunder Client o `curl`:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@libreria.com","password":"12345678"}'
```