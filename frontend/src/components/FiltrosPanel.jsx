import { useMemo, useState } from "react";

const ANTIGUEDAD_OPCIONES = [
  { value: "", label: "Todas" },
  { value: "menos6", label: "Menos de 6 meses" },
  { value: "6a12", label: "6 meses a 1 año" },
  { value: "mas1", label: "Más de 1 año" },
];

const ESTADO_PP_OPCIONES = [
  { value: "", label: "Todos" },
  { value: "EN_PRUEBA", label: "🟡 En período de prueba" },
  { value: "PERSONAL_EFECTIVO", label: "🟢 Personal efectivo" },
  { value: "BAJA", label: "🔴 Baja" },
];

function unicos(empleados, campo) {
  return [...new Set(empleados.map((e) => e[campo]).filter(Boolean))].sort();
}

export function useEmpleadosFiltrados(empleados, busqueda, filtros) {
  return useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return empleados.filter((e) => {
      if (q && !`${e.nombre} ${e.apellido} ${e.legajo}`.toLowerCase().includes(q)) return false;
      if (filtros.puesto && e.puesto !== filtros.puesto) return false;
      if (filtros.sector && e.sector !== filtros.sector) return false;
      if (filtros.lugarTrabajo && e.lugarTrabajo !== filtros.lugarTrabajo) return false;
      if (filtros.estado && e.estado !== filtros.estado) return false;
      if (filtros.estadoPeriodoPrueba && e.periodoPrueba.estado !== filtros.estadoPeriodoPrueba) return false;
      if (filtros.antiguedad) {
        const dias = e.periodoPrueba.diasTranscurridos;
        if (filtros.antiguedad === "menos6" && dias >= 180) return false;
        if (filtros.antiguedad === "6a12" && (dias < 180 || dias > 365)) return false;
        if (filtros.antiguedad === "mas1" && dias <= 365) return false;
      }
      return true;
    });
  }, [empleados, busqueda, filtros]);
}

export const FILTROS_VACIOS = {
  puesto: "", sector: "", lugarTrabajo: "", estado: "", estadoPeriodoPrueba: "", antiguedad: "",
};

export default function FiltrosPanel({ empleados, filtros, setFiltros }) {
  const [abierto, setAbierto] = useState(false);

  const puestos = useMemo(() => unicos(empleados, "puesto"), [empleados]);
  const sectores = useMemo(() => unicos(empleados, "sector"), [empleados]);
  const lugares = useMemo(() => unicos(empleados, "lugarTrabajo"), [empleados]);

  const cantidadActivos = Object.values(filtros).filter(Boolean).length;

  function set(campo, valor) {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }

  return (
    <div style={{ marginBottom: 2 }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="employee-search"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: "var(--color-surface)" }}
      >
        <span>🔎 Filtros{cantidadActivos > 0 ? ` (${cantidadActivos})` : ""}</span>
        <span>{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className="filtros-panel">
          <label className="filtro-label">
            Puesto
            <select value={filtros.puesto} onChange={(e) => set("puesto", e.target.value)}>
              <option value="">Todos</option>
              {puestos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="filtro-label">
            Sector
            <select value={filtros.sector} onChange={(e) => set("sector", e.target.value)}>
              <option value="">Todos</option>
              {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="filtro-label">
            Lugar de trabajo
            <select value={filtros.lugarTrabajo} onChange={(e) => set("lugarTrabajo", e.target.value)}>
              <option value="">Todos</option>
              {lugares.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="filtro-label">
            Estado del período de prueba
            <select value={filtros.estadoPeriodoPrueba} onChange={(e) => set("estadoPeriodoPrueba", e.target.value)}>
              {ESTADO_PP_OPCIONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="filtro-label">
            Antigüedad
            <select value={filtros.antiguedad} onChange={(e) => set("antiguedad", e.target.value)}>
              {ANTIGUEDAD_OPCIONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="filtro-label">
            Estado del empleado
            <select value={filtros.estado} onChange={(e) => set("estado", e.target.value)}>
              <option value="">Todos</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </label>

          {cantidadActivos > 0 && (
            <button className="btn-primary" style={{ marginTop: 4 }} onClick={() => setFiltros(FILTROS_VACIOS)}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
