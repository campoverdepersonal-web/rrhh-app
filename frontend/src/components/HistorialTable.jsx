import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatFecha } from "../dateUtils.js";

// Config de columnas por tipo de historial. `key` puede ser una función
// para formatear (fechas, combinaciones de campos, etc.).
const CONFIG_POR_TIPO = {
  comentarios: {
    titulo: "Historial completo de comentarios",
    columnas: [
      { label: "Legajo", get: (r) => r.legajo },
      { label: "Empleado", get: (r) => `${r.nombre} ${r.apellido}` },
      { label: "Fecha", get: (r) => formatFecha(r.fecha) },
      { label: "Líder", get: (r) => r.lider },
      { label: "Tipo", get: (r) => r.tipo },
      { label: "Comentario", get: (r) => r.comentario },
    ],
  },
  evaluaciones: {
    titulo: "Historial completo de evaluaciones",
    columnas: [
      { label: "Legajo", get: (r) => r.legajo },
      { label: "Empleado", get: (r) => `${r.nombre} ${r.apellido}` },
      { label: "Fecha", get: (r) => formatFecha(r.fecha) },
      { label: "Evaluador", get: (r) => r.evaluador },
      { label: "Puntaje", get: (r) => r.puntajeTotal ?? "—" },
      { label: "Resultado", get: (r) => r.resultado || "—" },
    ],
  },
  "evaluaciones-competencias": {
    titulo: "Historial completo de evaluaciones por competencia",
    columnas: [
      { label: "Legajo", get: (r) => r.legajo },
      { label: "Empleado", get: (r) => `${r.nombre} ${r.apellido}` },
      { label: "Fecha", get: (r) => formatFecha(r.fecha) },
      { label: "Evaluador", get: (r) => r.evaluador },
      { label: "Competencia", get: (r) => r.competencia },
      { label: "Nivel alcanzado", get: (r) => r.nivelAlcanzado },
    ],
  },
  sanciones: {
    titulo: "Historial completo de sanciones",
    columnas: [
      { label: "Legajo", get: (r) => r.legajo },
      { label: "Empleado", get: (r) => `${r.nombre} ${r.apellido}` },
      { label: "Fecha", get: (r) => formatFecha(r.fecha) },
      { label: "Tipo", get: (r) => r.tipo },
      { label: "Motivo", get: (r) => r.motivo },
      { label: "Responsable", get: (r) => r.responsable },
    ],
  },
  cursos: {
    titulo: "Historial completo de cursos y capacitaciones",
    columnas: [
      { label: "Legajo", get: (r) => r.legajo },
      { label: "Empleado", get: (r) => `${r.nombre} ${r.apellido}` },
      { label: "Curso", get: (r) => r.curso },
      { label: "Modalidad", get: (r) => r.modalidad || "—" },
      { label: "Fecha", get: (r) => formatFecha(r.fecha) },
      { label: "Estado", get: (r) => r.estado },
    ],
  },
  "entregas-uniforme": {
    titulo: "Historial completo de entregas de uniforme",
    columnas: [
      { label: "Legajo", get: (r) => r.legajo },
      { label: "Empleado", get: (r) => `${r.nombre} ${r.apellido}` },
      { label: "Fecha", get: (r) => formatFecha(r.fechaEntrega) },
      { label: "Prenda", get: (r) => r.tipoPrenda },
      { label: "Color/Detalle", get: (r) => r.colorDetalle || "—" },
      { label: "Marca", get: (r) => r.marca || "—" },
      { label: "Talle", get: (r) => r.talle || "—" },
      { label: "Cant.", get: (r) => r.cantidad },
      { label: "Estado", get: (r) => r.estado },
    ],
  },
};

export default function HistorialTable({ tipo }) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const config = CONFIG_POR_TIPO[tipo];
  if (!config) return null;

  function abrir() {
    setAbierto(true);
    if (datos) return;
    setCargando(true);
    api.getHistorial(tipo).then(setDatos).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }

  return (
    <div style={{ marginTop: 20 }}>
      {!abierto ? (
        <button className="link-button" onClick={abrir}>Ver historial completo cargado hasta ahora →</button>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>{config.titulo}{datos ? ` (${datos.length})` : ""}</h2>
            <button className="link-button" onClick={() => setAbierto(false)}>Ocultar</button>
          </div>
          {cargando && <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>}
          {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
          {datos && datos.length === 0 && (
            <p className="muted" style={{ fontSize: "0.88rem" }}>Todavía no hay nada cargado.</p>
          )}
          {datos && datos.length > 0 && (
            <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, background: "var(--color-surface)" }}>
                    {config.columnas.map((c) => (
                      <th key={c.label} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--color-border)", color: "var(--color-ink-soft)", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.map((fila) => (
                    <tr key={fila.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      {config.columnas.map((c) => (
                        <td key={c.label} style={{ padding: "7px 10px", verticalAlign: "top" }}>{c.get(fila)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {datos && datos.length >= 1000 && (
            <p className="muted" style={{ fontSize: "0.76rem", marginTop: 6 }}>
              Se muestran los últimos 1000 registros.
            </p>
          )}
        </>
      )}
    </div>
  );
}
