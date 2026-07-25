import { useState } from "react";
import ProgressRing from "./ProgressRing.jsx";
import ComentariosPanel from "./ComentariosPanel.jsx";
import EvaluacionesPanel from "./EvaluacionesPanel.jsx";
import SancionesPanel from "./SancionesPanel.jsx";
import CursosPanel from "./CursosPanel.jsx";
import { api } from "../api.js";
import { formatFecha } from "../dateUtils.js";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "comentarios", label: "Comentarios" },
  { id: "evaluaciones", label: "Evaluaciones" },
  { id: "sanciones", label: "Sanciones" },
  { id: "cursos", label: "Cursos" },
];

const RESULTADOS = [
  { value: "CONFIRMADO", label: "Confirmado como personal efectivo" },
  { value: "EXTENSION", label: "En observación" },
  { value: "BAJA", label: "Baja del empleado" },
];

export default function LegajoEmpleado({ empleado, onDecisionRegistrada, usuario, onEliminado }) {
  const [tab, setTab] = useState("resumen");
  const [formVisible, setFormVisible] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState(null);
  const [formPuestoVisible, setFormPuestoVisible] = useState(false);
  const [enviandoPuesto, setEnviandoPuesto] = useState(false);
  const [errorPuesto, setErrorPuesto] = useState(null);
  const [formPuesto, setFormPuesto] = useState({
    puesto: "", sector: "", lugarTrabajo: "", fechaInicio: new Date().toISOString().slice(0, 10), motivo: "",
  });
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    resultado: "CONFIRMADO",
    responsable: "",
    observaciones: "",
  });

  const pp = empleado.periodoPrueba;

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.registrarDecisionPeriodoPrueba(empleado.id, form);
      setFormVisible(false);
      onDecisionRegistrada?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function handleSubmitPuesto(e) {
    e.preventDefault();
    setEnviandoPuesto(true);
    setErrorPuesto(null);
    try {
      await api.registrarCambioPuesto(empleado.id, formPuesto);
      setFormPuestoVisible(false);
      setFormPuesto({ puesto: "", sector: "", lugarTrabajo: "", fechaInicio: new Date().toISOString().slice(0, 10), motivo: "" });
      onDecisionRegistrada?.();
    } catch (err) {
      setErrorPuesto(err.message);
    } finally {
      setEnviandoPuesto(false);
    }
  }

  async function handleEliminarHistorialPuesto(historialId) {
    if (!window.confirm("¿Eliminar este registro del historial de puestos? No se puede deshacer.")) return;
    try {
      await api.eliminarHistorialPuesto(empleado.id, historialId);
      onDecisionRegistrada?.();
    } catch (err) {
      setErrorPuesto(err.message);
    }
  }

  async function handleEliminar() {
    const confirmado = window.confirm(
      `¿Seguro que querés eliminar a ${empleado.nombre} ${empleado.apellido}?\n\nEsto borra también todo su historial (comentarios, evaluaciones, sanciones, cursos). Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;
    setEliminando(true);
    try {
      await api.eliminarEmpleado(empleado.id);
      onEliminado?.();
    } catch (err) {
      setError(err.message);
      setEliminando(false);
    }
  }

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>{empleado.nombre} {empleado.apellido}</h1>
          <p className="legajo-sub">{empleado.puesto} · {empleado.sector} · {empleado.lugarTrabajo}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span className="legajo-code">Legajo {empleado.legajo} · CUIL {empleado.cuil}</span>
          {usuario?.rol === "ADMIN" && (
            <button className="link-button" style={{ color: "var(--color-red)" }} onClick={handleEliminar} disabled={eliminando}>
              {eliminando ? "Eliminando…" : "Eliminar empleado"}
            </button>
          )}
        </div>
      </div>

      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="tab-button"
            aria-current={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "comentarios" && <ComentariosPanel employeeId={empleado.id} />}
      {tab === "evaluaciones" && <EvaluacionesPanel employeeId={empleado.id} />}
      {tab === "sanciones" && <SancionesPanel employeeId={empleado.id} />}
      {tab === "cursos" && <CursosPanel employeeId={empleado.id} />}

      {tab === "resumen" && (
      <>
      {/* Tarjeta destacada — punto 1 de la especificación */}
      <div className="badge-card" style={{ "--stripe-color": `var(--color-${pp.etiqueta.color})` }}>
        <ProgressRing
          progreso={pp.progreso}
          colorKey={pp.etiqueta.color}
          centerLabel={`${pp.diasTranscurridos}d`}
          centerSub={`de ${pp.diasPeriodoPrueba}`}
        />

        <div className="badge-facts">
          <div>
            <div className="fact-label">📅 Fecha de ingreso</div>
            <div className="fact-value">{formatFecha(pp.fechaIngreso)}</div>
          </div>
          <div>
            <div className="fact-label">⏳ Antigüedad</div>
            <div className="fact-value">{empleado.antiguedad}</div>
          </div>
          <div>
            <div className="fact-label">📆 Fin de período de prueba</div>
            <div className="fact-value">{formatFecha(pp.fechaFinPeriodoPrueba)}</div>
          </div>
          <div>
            <div className="fact-label">👤 Estado laboral</div>
            <div className="fact-value">
              {pp.estado === "EN_PRUEBA" ? "En período de prueba" : pp.estado === "PERSONAL_EFECTIVO" ? "Personal efectivo" : "Baja"}
            </div>
          </div>
        </div>

        <span className={`status-pill ${pp.etiqueta.color}`}>
          {pp.etiqueta.emoji} {pp.etiqueta.texto}
        </span>
      </div>

      {pp.alerta && (
        <div className="alert-banner">
          ⚠️ Quedan <strong>{pp.diasRestantes} días</strong> para finalizar el período de prueba. Coordiná la evaluación de efectivización con el supervisor.
        </div>
      )}

      <div className="grid-2">
        <div className="panel">
          <h2>Decisión de fin de período de prueba</h2>
          {empleado.historialDecisionesPeriodoPrueba?.length ? (
            empleado.historialDecisionesPeriodoPrueba.map((d) => (
              <div className="history-row" key={d.id}>
                <span>{RESULTADOS.find((r) => r.value === d.resultado)?.label || d.resultado}</span>
                <span className="muted">{formatFecha(d.fecha)} · {d.responsable}</span>
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: "0.88rem" }}>Todavía no se registró ninguna decisión.</p>
          )}

          {pp.estado === "EN_PRUEBA" && !formVisible && (
            <button className="btn-primary" onClick={() => setFormVisible(true)}>
              Registrar decisión
            </button>
          )}

          {formVisible && (
            <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
              <div className="form-grid">
                <label>
                  Fecha
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Resultado
                  <select
                    value={form.resultado}
                    onChange={(e) => setForm({ ...form, resultado: e.target.value })}
                  >
                    {RESULTADOS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Responsable
                  <input
                    type="text"
                    value={form.responsable}
                    onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                    placeholder="Nombre del responsable"
                    required
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  Observaciones
                  <textarea
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    placeholder="Detalle de la evaluación (opcional)"
                  />
                </label>
              </div>
              {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
              <button className="btn-primary" type="submit" disabled={enviando}>
                {enviando ? "Guardando…" : "Guardar decisión"}
              </button>
            </form>
          )}
        </div>

        <div className="panel">
          <h2>Historial de puestos</h2>
          {empleado.historialPuestos?.length ? (
            empleado.historialPuestos.map((h) => (
              <div className="history-row" key={h.id}>
                <span>{h.puesto} — {h.sector}</span>
                <span className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {formatFecha(h.fechaInicio)} → {h.fechaFin ? formatFecha(h.fechaFin) : "actual"}
                  <button
                    className="link-button"
                    style={{ color: "var(--color-red)" }}
                    onClick={() => handleEliminarHistorialPuesto(h.id)}
                  >
                    eliminar
                  </button>
                </span>
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: "0.88rem" }}>Sin cambios de puesto registrados.</p>
          )}

          {!formPuestoVisible && (
            <button className="btn-primary" onClick={() => setFormPuestoVisible(true)}>
              Registrar cambio de puesto
            </button>
          )}

          {formPuestoVisible && (
            <form onSubmit={handleSubmitPuesto} style={{ marginTop: 14 }}>
              <p className="muted" style={{ fontSize: "0.78rem", marginTop: 0 }}>
                Esto actualiza el puesto/sector/lugar de trabajo vigente del empleado y cierra
                automáticamente el registro anterior.
              </p>
              <div className="form-grid">
                <label>
                  Nuevo puesto
                  <input type="text" value={formPuesto.puesto} onChange={(e) => setFormPuesto({ ...formPuesto, puesto: e.target.value })} required />
                </label>
                <label>
                  Sector
                  <input type="text" value={formPuesto.sector} onChange={(e) => setFormPuesto({ ...formPuesto, sector: e.target.value })} required />
                </label>
                <label>
                  Lugar de trabajo
                  <input type="text" value={formPuesto.lugarTrabajo} onChange={(e) => setFormPuesto({ ...formPuesto, lugarTrabajo: e.target.value })} required />
                </label>
                <label>
                  Fecha de inicio
                  <input type="date" value={formPuesto.fechaInicio} onChange={(e) => setFormPuesto({ ...formPuesto, fechaInicio: e.target.value })} required />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  Motivo
                  <input type="text" value={formPuesto.motivo} onChange={(e) => setFormPuesto({ ...formPuesto, motivo: e.target.value })} placeholder="Ej: Promoción, cambio de sucursal, reestructuración" />
                </label>
              </div>
              {errorPuesto && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{errorPuesto}</p>}
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-primary" type="submit" disabled={enviandoPuesto}>
                  {enviandoPuesto ? "Guardando…" : "Guardar cambio de puesto"}
                </button>
                <button type="button" className="link-button" onClick={() => setFormPuestoVisible(false)}>Cancelar</button>
              </div>
            </form>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
