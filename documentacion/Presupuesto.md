# Presupuesto — Los Patismos

Presupuesto del sistema de gestión de librería, con el alcance de las tres
etapas: relevamiento, diagramas, backend, frontend y documentación.

Moneda: **ARS**. Los valores son de referencia para un trabajo escolar; el
costo de infraestructura es cero porque todo corre en la máquina del equipo.

## Ítems

| # | ítem | detalle | horas | valor hora | subtotal |
|---|---|---|---|---|---|
| 1 | Relevamiento y análisis | Entrevistas, casos de uso (17 CU), alcance de las etapas 1 y 2 | 18 | $ 8.000 | $ 144.000 |
| 2 | Diagramas y modelo de datos | Casos de uso, modelo ER (7 tablas), kanban y backlog | 10 | $ 8.000 | $ 80.000 |
| 3 | Backend | API REST con Express 5, JWT, 21 rutas y 51 tests automatizados | 20 | $ 8.000 | $ 160.000 |
| 4 | Frontend | Catálogo, carrito y panel del gerente, HTML/CSS/JS sin frameworks | 16 | $ 8.000 | $ 128.000 |
| 5 | Documentación | Matriz de trazabilidad, manual de usuario y este presupuesto | 8 | $ 8.000 | $ 64.000 |
| 6 | Pruebas y puesta en marcha | Prueba de humo con Playwright (8 pasos) y corrección de defectos | 4 | $ 8.000 | $ 32.000 |
| **Total** | | | **76** | | **$ 608.000** |

## Infraestructura y licencias

| concepto | costo | por qué |
|---|---|---|
| Hosting | $ 0 | Corre en la máquina del equipo (`127.0.0.1:3000`), no se publica |
| Base de datos | $ 0 | MariaDB comunitaria, licencia GPL |
| Librerías | $ 0 | Express, mysql2, jsonwebtoken, bcryptjs y cors: todas open source |
| Dominio | $ 0 | No aplica sin publicación |
| Editor de diagramas | $ 0 | diagrams.net / drawio-desktop, licencia Apache 2.0 |

## Supuestos

1. El trabajo se hace en horario extraescolar, con dedicación parcial.
2. El valor hora ($ 8.000) es una referencia de mercado junior, no un costo real
   del equipo: se incluye para poder comparar el esfuerzo entre etapas.
3. No hay servidor contratado ni despliegue: la entrega se corrige en la máquina
   del equipo o en un aula, levantando el proyecto con `npm start`.
4. No se presupuesta mantenimiento posterior a la entrega.
5. Si se publicara en internet, habría que sumar hosting, dominio y respaldo de
   la base (estimado aparte, no incluido).

## Forma de pago (referencia)

50 % al inicio de la etapa 3 y 50 % contra entrega. No aplica en el marco
escolar; se deja escrito para que el presupuesto sea completo.
