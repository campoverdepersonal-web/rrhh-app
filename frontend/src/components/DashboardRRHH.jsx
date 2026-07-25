import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { api } from "../api.js";

const COLOR_PRIMARY = "#2B4C6F";
const COLOR_TEAL = "#0E8F79";
const COLOR_AMBER = "#C9820A";
const COLOR_RED = "#C1443B";

function KpiCard({ label, value, sub, children }) {
  return (
    <div className="kpi-card">
      <div className="fact-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {children}
    </div>
  );
}

export default function DashboardRRHH() {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getDashboardRRHH().then(setData).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="loading-state">Calculando indicadores…</div>;
  if (error) return <div className="empty-state">No se pudo cargar el dashboard ({error}).</div>;
  if (!data) return null;

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>Dashboard general de RRHH</h1>
          <p className="legajo-sub">Vista ejecutiva de toda la organización</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="👤 Empleados activos" value={data.empleadosActivos} />
        <KpiCard label="🧪 En período de prueba" value={data.empleadosEnPeriodoPrueba} />
        <KpiCard
          label="⚠️ Vencimientos próximos (≤15 días)"
          value={data.proximosAVencer.length}
        >
          {data.proximosAVencer.length > 0 && (
            <div className="hover-list-trigger">
              <span className="hover-hint">ver quiénes ▾</span>
              <div className="hover-list">
                {data.proximosAVencer.map((p) => (
                  <div key={p.id} className="hover-list-item">
                    {p.nombre} <span className="muted">({p.diasRestantes}d)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </KpiCard>
        <KpiCard label="📋 Evaluaciones realizadas" value={data.evaluaciones.realizadas} />
        <KpiCard label="⭐ Promedio general" value={data.evaluaciones.promedioGeneral ?? "—"} />
        <KpiCard
          label="🎓 Capacitaciones"
          value={data.capacitaciones.total}
          sub={`${data.capacitaciones.completados} completadas`}
        />
        <KpiCard label="🚩 Sanciones registradas" value={data.sanciones} />
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="panel">
          <h2>Sectores con mejor desempeño</h2>
          {data.sectoresMejorDesempeno.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>Todavía no hay evaluaciones suficientes.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.sectoresMejorDesempeno} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9EDF2" horizontal={false} />
                <XAxis type="number" domain={[0, 10]} fontSize={12} />
                <YAxis type="category" dataKey="sector" width={110} fontSize={12} />
                <Tooltip />
                <Bar dataKey="promedio" fill={COLOR_TEAL} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel">
          <h2>Puestos con menor desempeño</h2>
          {data.puestosMenorDesempeno.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>Todavía no hay evaluaciones suficientes.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.puestosMenorDesempeno} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9EDF2" horizontal={false} />
                <XAxis type="number" domain={[0, 10]} fontSize={12} />
                <YAxis type="category" dataKey="puesto" width={110} fontSize={12} />
                <Tooltip />
                <Bar dataKey="promedio" fill={COLOR_AMBER} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="panel">
          <h2>Evolución mensual del promedio</h2>
          {data.evolucionMensual.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>Sin datos suficientes todavía.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.evolucionMensual}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9EDF2" />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis domain={[0, 10]} fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="promedio" stroke={COLOR_PRIMARY} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel">
          <h2>Distribución de calificaciones</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.distribucionCalificaciones}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E9EDF2" />
              <XAxis dataKey="rango" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                {data.distribucionCalificaciones.map((entry, i) => (
                  <Cell key={i} fill={["#C1443B", "#C9820A", "#2B4C6F", "#0E8F79"][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="panel">
          <h2>Colaboradores destacados</h2>
          {data.colaboradoresDestacados.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>Sin evaluaciones registradas.</p>
          ) : (
            data.colaboradoresDestacados.map((c) => (
              <div className="history-row" key={c.id}>
                <span>{c.nombre} {c.apellido} — {c.puesto}</span>
                <span className="status-pill teal" style={{ fontSize: "0.78rem", padding: "3px 10px" }}>{c.promedio}</span>
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <h2>Colaboradores en riesgo</h2>
          {data.colaboradoresEnRiesgo.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>No hay colaboradores en riesgo por ahora.</p>
          ) : (
            data.colaboradoresEnRiesgo.map((c) => (
              <div className="history-row" key={c.id}>
                <span>{c.nombre} {c.apellido} — {c.puesto}</span>
                <span className="status-pill red" style={{ fontSize: "0.78rem", padding: "3px 10px" }}>
                  {c.promedio ?? "s/eval"} · {c.sanciones} sanción(es)
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
