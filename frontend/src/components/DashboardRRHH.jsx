import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { api } from "../api.js";
import { formatFecha } from "../dateUtils.js";

const COLOR_PRIMARY = "#1F4D3A";
const COLOR_AMBER = "#C9820A";
const COLOR_RED = "#B3433A";

function agruparPor(filas, campo) {
  const mapa = new Map();
  for (const f of filas) {
    const clave = f[campo] || "(sin especificar)";
    if (!mapa.has(clave)) {
      mapa.set(clave, { [campo]: clave, renuncia: 0, finPeriodoPrueba: 0, otros: 0, total: 0 });
    }
    const acc = mapa.get(clave);
    acc.renuncia += f.renuncia;
    acc.finPeriodoPrueba += f.finPeriodoPrueba;
    acc.otros += f.otros;
    acc.total += f.total;
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

const PALETA = ["#1F4D3A", "#B08D3F", "#C9820A", "#B3433A", "#2E7D5B", "#6B7F8C", "#8C6E4E", "#4A6B7C"];

function pivotearPorMes(filas) {
  const lugares = [...new Set(filas.map((f) => f.lugarTrabajo))].sort();
  const meses = [...new Set(filas.map((f) => f.mes))].sort();
  const porMes = meses.map((mes) => {
    const fila = { mes };
    for (const lugar of lugares) fila[lugar] = 0;
    return fila;
  });
  const indicePorMes = Object.fromEntries(porMes.map((f, i) => [f.mes, i]));
  for (const f of filas) {
    porMes[indicePorMes[f.mes]][f.lugarTrabajo] = f.cantidad;
  }
  return { filas: porMes, lugares };
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function formatMes(mesISO) {
  const [anio, mes] = mesISO.split("-");
  const nombre = MESES[Number(mes) - 1] || mes;
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

function HitoPill({ dias, tipo, estado }) {
  const config = {
    futura: { color: "", texto: `Día ${dias}: aún no corresponde`, style: { background: "var(--color-bg)", color: "var(--color-ink-soft)" } },
    realizada: { color: "teal", texto: `✅ ${tipo} (día ${dias}) hecha` },
    vencida: { color: "red", texto: `⚠️ ${tipo} (día ${dias}) pendiente` },
  }[estado];
  return (
    <span className={`status-pill ${config.color}`} style={{ fontSize: "0.72rem", padding: "2px 8px", ...config.style }}>
      {config.texto}
    </span>
  );
}

function KpiCard({ label, value, sub, children, onClick }) {
  return (
    <div className={`kpi-card${onClick ? " kpi-card-clickable" : ""}`} onClick={onClick} role={onClick ? "button" : undefined}>
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
  const [lugarSeleccionado, setLugarSeleccionado] = useState(null);
  const [vistaBajas, setVistaBajas] = useState("lugar"); // "lugar" | "sector" | "puesto"
  const [verPeriodoPrueba, setVerPeriodoPrueba] = useState(false);
  const [verSanciones, setVerSanciones] = useState(false);

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
          <h1>Dashboard general</h1>
          <p className="legajo-sub">Vista ejecutiva de toda la organización</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="👤 Empleados activos" value={data.empleadosActivos} />
        <KpiCard label="🚫 Empleados inactivos" value={data.empleadosInactivos}>
          {data.empleadosInactivos > 0 && data.empleadosInactivos < 10 && (
            <div className="hover-list-trigger">
              <span className="hover-hint">ver quiénes ▾</span>
              <div className="hover-list">
                {data.inactivosDetalle.map((p) => (
                  <div key={p.id} className="hover-list-item">
                    {p.nombre} <span className="muted">({p.puesto})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </KpiCard>
        <KpiCard label="🧪 En período de prueba" value={data.empleadosEnPeriodoPrueba} />
        <KpiCard
          label="⚠️ Vencimientos próximos (≤15 días)"
          value={data.proximosAVencer.length}
          onClick={() => setVerPeriodoPrueba((v) => !v)}
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
          <div className="kpi-sub" style={{ marginTop: 4 }}>Clic para ver a todos →</div>
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
        <KpiCard label="🚩 Sanciones registradas" value={data.sanciones} onClick={() => setVerSanciones((v) => !v)}>
          <div className="kpi-sub" style={{ marginTop: 4 }}>Clic para ver por mes y lugar →</div>
        </KpiCard>
      </div>

      {verSanciones && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h2>
            Sanciones por mes y lugar de trabajo
            <button className="link-button" style={{ marginLeft: 10, fontSize: "0.78rem" }} onClick={() => setVerSanciones(false)}>
              Ocultar
            </button>
          </h2>
          {data.sancionesPorMesYLugar.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>No hay sanciones registradas todavía.</p>
          ) : (
            (() => {
              const { filas, lugares } = pivotearPorMes(data.sancionesPorMesYLugar);
              return (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={filas} margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E2D6" />
                    <XAxis dataKey="mes" fontSize={12} tickFormatter={formatMes} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip labelFormatter={formatMes} />
                    <Legend />
                    {lugares.map((lugar, i) => (
                      <Bar key={lugar} dataKey={lugar} name={lugar} stackId="sanciones" fill={PALETA[i % PALETA.length]} radius={i === lugares.length - 1 ? [4, 4, 0, 0] : undefined} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              );
            })()
          )}
        </div>
      )}

      {verPeriodoPrueba && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h2>
            Todos en período de prueba
            <span className="muted" style={{ fontWeight: 400, fontSize: "0.8rem" }}> · ordenados de menos a más días para la finalización</span>
            <button className="link-button" style={{ marginLeft: 10, fontSize: "0.78rem" }} onClick={() => setVerPeriodoPrueba(false)}>
              Ocultar
            </button>
          </h2>
          {data.enPeriodoPruebaDetalle.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>No hay nadie en período de prueba ahora mismo.</p>
          ) : (
            data.enPeriodoPruebaDetalle.map((p) => (
              <div className="history-row" key={p.id} style={{ alignItems: "flex-start" }}>
                <div>
                  <div>{p.nombre} <span className="muted">— {p.puesto} · {p.lugarTrabajo}</span></div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                    <HitoPill dias={60} tipo="Evaluación simple" estado={p.evaluacion60} />
                    <HitoPill dias={120} tipo="Evaluación por competencias" estado={p.evaluacion120} />
                  </div>
                </div>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                  <span className={`status-pill ${p.diasRestantes <= 15 ? "amber" : "teal"}`} style={{ fontSize: "0.78rem", padding: "3px 10px" }}>
                    {p.diasRestantes} día{p.diasRestantes !== 1 ? "s" : ""} restantes
                  </span>
                  <span className="muted" style={{ fontSize: "0.74rem" }}>Finaliza el {formatFecha(p.fechaFinPeriodoPrueba)}</span>
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <div className="panel" style={{ marginTop: 20 }}>
        <h2>
          {lugarSeleccionado
            ? `${lugarSeleccionado} · por sector`
            : `Bajas por ${vistaBajas === "lugar" ? "lugar de trabajo" : vistaBajas} y motivo ${data.rotacion.anio}`}
          {lugarSeleccionado && (
            <button className="link-button" style={{ marginLeft: 10, fontSize: "0.78rem" }} onClick={() => setLugarSeleccionado(null)}>
              ← volver a todos los lugares
            </button>
          )}
        </h2>

        {!lugarSeleccionado && (
          <div className="nav-tabs" style={{ maxWidth: 340, marginBottom: 14 }}>
            <button className="nav-tab" aria-current={vistaBajas === "lugar"} onClick={() => { setVistaBajas("lugar"); setLugarSeleccionado(null); }}>Lugar de trabajo</button>
            <button className="nav-tab" aria-current={vistaBajas === "sector"} onClick={() => { setVistaBajas("sector"); setLugarSeleccionado(null); }}>Sector</button>
            <button className="nav-tab" aria-current={vistaBajas === "puesto"} onClick={() => { setVistaBajas("puesto"); setLugarSeleccionado(null); }}>Puesto</button>
          </div>
        )}

        {(() => {
          const campoVista = { lugar: "lugarTrabajo", sector: "sector", puesto: "puesto" }[vistaBajas];
          const filas = lugarSeleccionado
            ? data.bajasPorSectorYMotivo.filter((f) => f.lugarTrabajo === lugarSeleccionado)
            : agruparPor(data.bajasPorSectorYMotivo, campoVista);
          const claveEje = lugarSeleccionado ? "sector" : campoVista;
          const puedeDrillDown = vistaBajas === "lugar" && !lugarSeleccionado;

          if (filas.length === 0) {
            return <p className="muted" style={{ fontSize: "0.85rem" }}>Todavía no hay bajas registradas.</p>;
          }
          return (
            <>
              <ResponsiveContainer width="100%" height={Math.max(180, filas.length * 42)}>
                <BarChart
                  data={filas}
                  layout="vertical"
                  margin={{ left: 10 }}
                  onClick={(e) => {
                    if (puedeDrillDown && e?.activeLabel) setLugarSeleccionado(e.activeLabel);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E2D6" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey={claveEje} width={150} fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="renuncia" name="Renuncia" stackId="motivo" fill={COLOR_AMBER} style={{ cursor: puedeDrillDown ? "pointer" : "default" }} />
                  <Bar dataKey="finPeriodoPrueba" name="Fin de período de prueba" stackId="motivo" fill={COLOR_PRIMARY} style={{ cursor: puedeDrillDown ? "pointer" : "default" }} />
                  <Bar dataKey="otros" name="Otros (despidos, acuerdos, etc.)" stackId="motivo" fill={COLOR_RED} radius={[0, 4, 4, 0]} style={{ cursor: puedeDrillDown ? "pointer" : "default" }} />
                </BarChart>
              </ResponsiveContainer>
              {puedeDrillDown && (
                <p className="muted" style={{ fontSize: "0.78rem", marginTop: 8 }}>
                  Clic en una barra para ver el detalle por sector de ese lugar de trabajo.
                </p>
              )}
            </>
          );
        })()}
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
