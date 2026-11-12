# Proyecto Informático I — Los Patismos

Sistema de gestión de librería. La etapa actual es la **3**: frontend funcional
contra MySQL, diagramas cerrados y manual de usuario. La entrega es el
**2026-11-18**.

## Stack

HTML5, CSS3, JavaScript (módulos, sin frameworks), Node.js y MySQL (MariaDB).

## Dónde está cada cosa

| qué | dónde |
|---|---|
| frontend funcional | `frontend/` (`index.html` tienda, `admin.html` panel) |
| API + base de datos | `server/` (Express 5, 21 rutas, 51 tests) |
| wireframes (etapa 2) | `wireframes/` |
| casos de uso | `casos_de_uso/` |
| documentación | `documentacion/` (matriz, presupuesto, manual, diagramas) |
| scripts de herramientas | `herramientas/` (exportar diagramas, prueba Playwright) |

## Cómo levantar

```bash
cd server
npm install && cp .env.example .env   # completar valores reales
npm run seed && npm start             # http://localhost:3000
```

Login de prueba: `admin@libreria.com` / `12345678` (gerente).
`usuario@test.com` / `12345678` (comprador).

## Comandos que se usan como criterio de terminado

| comando | qué prueba |
|---|---|
| `cd server && npm test` | 51/51 tests de la API |
| `npm run seed` | catálogo con libros, sin duplicar si se repite |
| `bash herramientas/exportar-diagramas.sh` | PNG + SVG de cada `.drawio` |
| `NODE_PATH=/usr/lib/node_modules/@playwright/mcp/node_modules node herramientas/prueba-playwright.cjs` | 8 pasos de humo del frontend (requiere el servidor levantado) |

## Reglas del proyecto

- **Criterio por encima de comodidad**: si una decisión no se puede defender en
  una defensa oral, no va.
- Nada de frameworks ni bundlers: es un proyecto escolar y el frontend se lee
  directamente.
- Los comentarios del código van en español.
- **Nunca commitear** `server/.env` ni `server/.env.bak-*`: tienen la contraseña
  de la base y el `JWT_SECRET`.
- Lo que no se midió se dice como hipótesis, no como hecho.

## Notas de Obsidian

Antes de tocar diagramas o documentación, leer las notas del vault:

- `~/.config/obsidian-notes/proyectos/Proyecto_Informatico_I.md`
- `~/.config/obsidian-notes/proyectos/Proyecto_Informatico_I_Casos_de_Uso.md`
- `~/.config/obsidian-notes/proyectos/Proyecto_Informatico_I_Wireframes.md`
- `~/.config/obsidian-notes/proyectos/Proyecto_Informatico_I_Modelo_ER.md`

## Estado conocido

- CU-07 (recomendaciones) y CU-17 (alertas de stock) no tienen tabla propia: son
  derivados. CU-12 (gestión de usuarios) no tiene pantalla. Está declarado en
  `documentacion/Matriz_Trazabilidad.md`.
- `documentacion/*.drawio` es la fuente; los `.png` y `.svg` se regeneran con
  `herramientas/exportar-diagramas.sh`.
