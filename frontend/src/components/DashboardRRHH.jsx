import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
} from "recharts";
import { api } from "../api.js";

const COLOR_PRIMARY = "#1F4D3A";
const COLOR_TEAL = "#2E7D5B";
const COLOR_AMBER = "#C9820A";
const COLOR_RED = "#B3433A";

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
        <KpiCard label="🚫 Empleados inactivos" value={data.empleadosInactivos} />
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
        <KpiCard
          label={`🔄 Rotación ${data.rotacion.anio}`}
          value={`${data.rotacion.porcentaje}%`}
          sub={`${data.rotacion.bajasEnAnio} baja(s) en el año`}
        />
        <KpiCard label="📋 Evaluaciones realizadas" value={data.evaluaciones.realizadas} />
        <KpiCard label="⭐ Promedio general" value={data.evaluaciones.promedioGeneral ?? "—"} />
        <KpiCard
          label="🎓 Capacitaciones"
          value={data.capacitaciones.total}
          sub={`${data.capacitaciones.completados} completadas`}
        />
        <KpiCard label="🚩 Sanciones registradas" value={data.sanciones} />
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <h2>Bajas por sector y motivo {data.rotacion.anio}</h2>
        {data.bajasPorSectorYMotivo.length === 0 ? (
          <p className="muted" style={{ fontSize: "0.85rem" }}>Todavía no hay bajas registradas.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, data.bajasPorSectorYMotivo.length * 42)}>
            <BarChart data={data.bajasPorSectorYMotivo} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E2D6" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="sector" width={130} fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="renuncia" name="Renuncia" stackId="motivo" fill={COLOR_AMBER} />
              <Bar dataKey="finPeriodoPrueba" name="Fin de período de prueba" stackId="motivo" fill={COLOR_PRIMARY} />
              <Bar dataKey="otros" name="Otros (despidos, acuerdos, etc.)" stackId="motivo" fill={COLOR_RED} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
          "Otros" agrupa despidos sin causa, acuerdos laborales, y cualquier motivo de baja
          que no mencione explícitamente "renuncia" o "período de prueba".
        </p>
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="panel">
          <h2>Sectores con mejor desempeño</h2>
          {data.sectoresMejorDesempeno.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>Todavía no hay evaluaciones suficientes.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.sectoresMejorDesempeno} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E2D6" horizontal={false} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E2D6" horizontal={false} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E2D6" />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E2D6" />
              <XAxis dataKey="rango" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                {data.distribucionCalificaciones.map((entry, i) => (
                  <Cell key={i} fill={["#B3433A", "#C9820A", "#1F4D3A", "#2E7D5B"][i]} />
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
            <p className="muted" style={{ fontSize: "0.85rem" }}>Sin evaluaciones ni comentarios positivos registrados.</p>
          ) : (
            data.colaboradoresDestacados.map((c) => (
              <div className="history-row" key={c.id} style={{ alignItems: "flex-start" }}>
                <div>
                  <div>{c.nombre} {c.apellido} — {c.puesto}</div>
                  {c.comentariosPositivos > 0 && (
                    <div className="muted" style={{ fontSize: "0.78rem", marginTop: 2 }}>
                      💬 {c.comentariosPositivos} comentario{c.comentariosPositivos !== 1 ? "s" : ""} positivo{c.comentariosPositivos !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
                <span className="status-pill teal" style={{ fontSize: "0.78rem", padding: "3px 10px", whiteSpace: "nowrap" }}>
                  {c.promedio ?? "s/eval"}
                </span>
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
              <div className="history-row" key={c.id} style={{ alignItems: "flex-start" }}>
                <div>
                  <div>{c.nombre} {c.apellido} — {c.puesto}</div>
                  {c.comentariosNegativos > 0 && (
                    <div className="muted" style={{ fontSize: "0.78rem", marginTop: 2 }}>
                      💬 {c.comentariosNegativos} comentario{c.comentariosNegativos !== 1 ? "s" : ""} negativo{c.comentariosNegativos !== 1 ? "s" : ""}/correctivo{c.comentariosNegativos !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
                <span className="status-pill red" style={{ fontSize: "0.78rem", padding: "3px 10px", whiteSpace: "nowrap" }}>
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
