import { useState } from "react";
import ProgressRing from "./ProgressRing.jsx";
import ComentariosPanel from "./ComentariosPanel.jsx";
import EvaluacionesPanel from "./EvaluacionesPanel.jsx";
import SancionesPanel from "./SancionesPanel.jsx";
import CursosPanel from "./CursosPanel.jsx";
import UniformesPanel from "./UniformesPanel.jsx";
import { api } from "../api.js";
import { formatFecha } from "../dateUtils.js";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "comentarios", label: "Comentarios" },
  { id: "evaluaciones", label: "Evaluaciones" },
  { id: "sanciones", label: "Sanciones" },
  { id: "cursos", label: "Cursos y capacitaciones" },
  { id: "uniformes", label: "Uniformes" },
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
  const [formBajaVisible, setFormBajaVisible] = useState(false);
  const [enviandoBaja, setEnviandoBaja] = useState(false);
  const [errorBaja, setErrorBaja] = useState(null);
  const [formBaja, setFormBaja] = useState({ fecha: new Date().toISOString().slice(0, 10), motivo: "" });
  const [editandoLegajo, setEditandoLegajo] = useState(false);
  const [legajoEditado, setLegajoEditado] = useState(empleado.legajo);
  const [enviandoLegajo, setEnviandoLegajo] = useState(false);
  const [errorLegajo, setErrorLegajo] = useState(null);
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

  async function handleGuardarLegajo() {
    setEnviandoLegajo(true);
    setErrorLegajo(null);
    try {
      await api.actualizarEmpleado(empleado.id, { legajo: legajoEditado });
      setEditandoLegajo(false);
      onDecisionRegistrada?.();
    } catch (err) {
      setErrorLegajo(err.message);
    } finally {
      setEnviandoLegajo(false);
    }
  }

  async function handleRegistrarBaja(e) {
    e.preventDefault();
    setEnviandoBaja(true);
    setErrorBaja(null);
    try {
      await api.registrarBaja(empleado.id, formBaja);
      setFormBajaVisible(false);
      onDecisionRegistrada?.();
    } catch (err) {
      setErrorBaja(err.message);
    } finally {
      setEnviandoBaja(false);
    }
  }

  async function handleReactivar() {
    const confirmado = window.confirm(`¿Reactivar a ${empleado.nombre} ${empleado.apellido}? Vuelve a la nómina activa.`);
    if (!confirmado) return;
    setEnviandoBaja(true);
    try {
      await api.reactivarEmpleado(empleado.id);
      onDecisionRegistrada?.();
    } catch (err) {
      setErrorBaja(err.message);
    } finally {
      setEnviandoBaja(false);
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {!editandoLegajo ? (
            <span className="legajo-code">
              Legajo {empleado.legajo} · CUIL {empleado.cuil}
              {usuario?.rol === "ADMIN" && (
                <button
                  className="link-button"
                  style={{ marginLeft: 8, fontSize: "0.72rem" }}
                  onClick={() => { setLegajoEditado(empleado.legajo); setEditandoLegajo(true); }}
                >
                  editar
                </button>
              )}
            </span>
          ) : (
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text"
                value={legajoEditado}
                onChange={(e) => setLegajoEditado(e.target.value)}
                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: "0.85rem", width: 100 }}
                autoFocus
              />
              <button className="link-button" onClick={handleGuardarLegajo} disabled={enviandoLegajo}>
                {enviandoLegajo ? "Guardando…" : "Guardar"}
              </button>
              <button className="link-button" onClick={() => setEditandoLegajo(false)}>Cancelar</button>
            </span>
          )}
          {errorLegajo && <span style={{ color: "var(--color-red)", fontSize: "0.76rem" }}>{errorLegajo}</span>}

          {usuario?.rol === "ADMIN" && (
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              {empleado.estado !== "BAJA" && !formBajaVisible && (
                <button className="link-button" style={{ color: "var(--color-red)" }} onClick={() => setFormBajaVisible(true)}>
                  Dar de baja
                </button>
              )}
              {empleado.estado === "BAJA" && (
                <button className="link-button" onClick={handleReactivar} disabled={enviandoBaja}>
                  {enviandoBaja ? "Reactivando…" : "Reactivar"}
                </button>
              )}
              <button className="link-button" style={{ color: "var(--color-red)" }} onClick={handleEliminar} disabled={eliminando}>
                {eliminando ? "Eliminando…" : "Eliminar empleado"}
              </button>
            </div>
          )}
        </div>
      </div>

      {empleado.estado === "BAJA" && (
        <div className="alert-banner" style={{ background: "var(--color-red-soft)", borderColor: "#E3BDB8", color: "#7A2E27" }}>
          🔴 <strong>Baja</strong> registrada el {formatFecha(empleado.fechaBaja)}
          {empleado.motivoBaja ? ` — ${empleado.motivoBaja}` : ""}
        </div>
      )}

      {formBajaVisible && (
        <form onSubmit={handleRegistrarBaja} className="panel" style={{ marginBottom: 20 }}>
          <h2>Registrar baja de {empleado.nombre} {empleado.apellido}</h2>
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: -6 }}>
            No se borra nada de su historial — solo deja de aparecer en la nómina activa,
            y queda disponible para análisis (rotación, uniformes entregados, etc.) en la pestaña "Bajas".
          </p>
          <div className="form-grid">
            <label>
              Fecha de baja
              <input type="date" value={formBaja.fecha} onChange={(e) => setFormBaja({ ...formBaja, fecha: e.target.value })} required />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Motivo
              <input type="text" value={formBaja.motivo} onChange={(e) => setFormBaja({ ...formBaja, motivo: e.target.value })} placeholder="Ej: Renuncia, despido, fin de contrato" />
            </label>
          </div>
          {errorBaja && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{errorBaja}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" type="submit" disabled={enviandoBaja}>
              {enviandoBaja ? "Guardando…" : "Confirmar baja"}
            </button>
            <button type="button" className="link-button" onClick={() => setFormBajaVisible(false)}>Cancelar</button>
          </div>
        </form>
      )}

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
      {tab === "evaluaciones" && <EvaluacionesPanel employeeId={empleado.id} puesto={empleado.puesto} />}
      {tab === "sanciones" && <SancionesPanel employeeId={empleado.id} />}
      {tab === "cursos" && <CursosPanel employeeId={empleado.id} />}
      {tab === "uniformes" && <UniformesPanel employeeId={empleado.id} />}

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

      <div>
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
