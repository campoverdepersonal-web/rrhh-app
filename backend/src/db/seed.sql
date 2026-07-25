-- Datos de ejemplo para probar el legajo y el período de prueba.
-- Fechas relativas a "hoy" para que siempre haya un caso en cada estado.

INSERT INTO employees (legajo, nombre, apellido, cuil, fecha_ingreso, puesto, sector, lugar_trabajo, estado)
VALUES
  ('L-0001', 'Julieta', 'Fernández', '27-30111222-3', CURRENT_DATE - INTERVAL '10 days', 'Analista de RRHH', 'Recursos Humanos', 'Casa Central', 'ACTIVO'),
  ('L-0002', 'Martín',  'Gómez',     '20-28999888-1', CURRENT_DATE - INTERVAL '170 days', 'Supervisor de Depósito', 'Logística', 'Planta Norte', 'ACTIVO'),
  ('L-0003', 'Camila',  'Ibarra',    '27-31555777-9', CURRENT_DATE - INTERVAL '400 days', 'Vendedora', 'Comercial', 'Sucursal Centro', 'ACTIVO')
ON CONFLICT (legajo) DO NOTHING;

INSERT INTO historial_puestos (employee_id, puesto, sector, lugar_trabajo, fecha_inicio, fecha_fin, motivo)
SELECT id, 'Vendedora Junior', 'Comercial', 'Sucursal Centro', CURRENT_DATE - INTERVAL '400 days', CURRENT_DATE - INTERVAL '200 days', 'Ingreso'
FROM employees WHERE legajo = 'L-0003'
ON CONFLICT DO NOTHING;

INSERT INTO historial_puestos (employee_id, puesto, sector, lugar_trabajo, fecha_inicio, fecha_fin, motivo)
SELECT id, 'Vendedora', 'Comercial', 'Sucursal Centro', CURRENT_DATE - INTERVAL '200 days', NULL, 'Promoción'
FROM employees WHERE legajo = 'L-0003'
ON CONFLICT DO NOTHING;
