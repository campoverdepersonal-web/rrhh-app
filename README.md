# RRHH · Legajo dinámico de empleados

Primer módulo funcional del sistema de gestión y seguimiento de empleados:
**legajo individual con seguimiento automático del período de prueba** (180
días corridos), tal como está descripto en el punto 1 de la especificación.

## Qué incluye este MVP

- **Backend** (Express + PostgreSQL): API REST para alta/edición de
  empleados, cálculo automático del período de prueba, registro de la
  decisión de efectivización (confirmado / extensión / baja), historial de
  puestos y endpoint de alertas (≤15 días para el vencimiento).
- **Frontend** (React + Vite): listado de empleados con semáforo de estado,
  y el legajo individual con la tarjeta destacada pedida en la spec (fecha de
  ingreso, antigüedad, estado del período de prueba con colores, fecha de
  efectivización, alerta y anillo de progreso hacia los 180 días).
- **Modelo de datos completo**: el `schema.sql` ya crea las tablas para
  comentarios de líderes, evaluaciones de desempeño, sanciones, evaluaciones
  teóricas, cursos, criterios de evaluación por puesto e historial de
  cambios — quedan listas para conectar en las próximas etapas, sin tener
  que modificar la estructura ya construida.

## Qué falta (próximas etapas, no incluido todavía)

- Endpoints y UI para comentarios, evaluaciones, sanciones, cursos y
  evaluaciones teóricas (tablas ya creadas en `schema.sql`).
- Dashboards por puesto, por lugar de trabajo y general de RRHH.
- Autenticación con roles y permisos.
- Importación masiva desde Excel y, más adelante, integración con Humand.
- Exportación a Excel/PDF.
- Registro automático de auditoría (tabla `historial_cambios` ya creada).

## Cómo correrlo localmente

### 1. Base de datos

Necesitás PostgreSQL corriendo localmente (o accesible por red).

```bash
cd backend
cp .env.example .env
# Editá .env con los datos de tu conexión (PGHOST, PGUSER, PGPASSWORD, etc.)
npm install
npm run db:init   # crea las tablas
npm run db:seed   # carga 3 empleados de ejemplo (uno por cada estado)
```

### 2. Backend

```bash
cd backend
npm run dev       # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173 (con proxy a la API)
```

Abrí `http://localhost:5173` y vas a ver 3 empleados de ejemplo: uno recién
ingresado, uno a pocos días de cumplir el período de prueba (con la alerta
activa) y uno ya efectivo.

## Notas de diseño de la API

- Todas las fechas se calculan en días corridos (no hábiles), como indica la
  especificación.
- El estado del período de prueba se puede recalcular en cualquier momento a
  partir de `fecha_ingreso` — no se guarda como campo fijo, así nunca queda
  desactualizado. Cuando RRHH registra una decisión (confirmado/extensión/
  baja) esa decisión pasa a tener prioridad sobre el cálculo automático.
- `GET /api/employees/alertas/periodo-prueba` devuelve los empleados a ≤15
  días del vencimiento, pensado para alimentar el dashboard general y las
  notificaciones a RRHH/supervisores.
