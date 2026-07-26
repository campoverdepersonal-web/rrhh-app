import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatFecha, toInputDate } from "../dateUtils.js";

const FORM_VACIO = { fecha: new Date().toISOString().slice(0, 10), evaluador: "", puntajeTotal: "", resultado: "", observaciones: "" };

export default function EvaluacionesPanel({ employeeId }) {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);

  function cargar() {
    setCargando(true);
    api.listEvaluaciones(employeeId).then(setEvaluaciones).finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [employeeId]);

  function abrirNueva() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setFormVisible(true);
  }

  function abrirEdicion(ev) {
    setForm({
      fecha: toInputDate(ev.fecha),
      evaluador: ev.evaluador,
      puntajeTotal: ev.puntajeTotal ?? "",
      resultado: ev.resultado || "",
      observaciones: ev.observaciones || "",
    });
    setEditandoId(ev.id);
    setFormVisible(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const payload = { ...form, puntajeTotal: form.puntajeTotal ? Number(form.puntajeTotal) : null };
      if (editandoId) {
        await api.actualizarEvaluacion(employeeId, editandoId, payload);
      } else {
        await api.crearEvaluacion(employeeId, payload);
      }
      setForm(FORM_VACIO);
      setFormVisible(false);
      setEditandoId(null);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function handleEliminar(id) {
    if (!window.confirm("¿Eliminar esta evaluación? No se puede deshacer.")) return;
    try {
      await api.eliminarEvaluacion(employeeId, id);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const promedio = evaluaciones.length
    ? (evaluaciones.reduce((acc, e) => acc + (Number(e.puntajeTotal) || 0), 0) / evaluaciones.length).toFixed(1)
    : null;

  return (
    <div className="panel">
      <h2>Evaluaciones de desempeño {promedio && <span className="muted" style={{ fontWeight: 400, fontSize: "0.8rem" }}>· promedio {promedio}</span>}</h2>

      {cargando && <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>}
      {!cargando && evaluaciones.length === 0 && (
        <p className="muted" style={{ fontSize: "0.88rem" }}>Todavía no hay evaluaciones registradas.</p>
      )}
      {!cargando && evaluaciones.map((ev) => (
        <div className="history-row" key={ev.id} style={{ alignItems: "flex-start" }}>
          <div>
            <strong>{ev.puntajeTotal ?? "—"}</strong>{ev.resultado ? ` · ${ev.resultado}` : ""}
            {ev.observaciones && <div className="muted" style={{ marginTop: 4, fontSize: "0.82rem" }}>{ev.observaciones}</div>}
          </div>
          <span className="muted" style={{ whiteSpace: "nowrap", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span>{formatFecha(ev.fecha)} · {ev.evaluador}</span>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="link-button" onClick={() => abrirEdicion(ev)}>editar</button>
              <button className="link-button" style={{ color: "var(--color-red)" }} onClick={() => handleEliminar(ev.id)}>eliminar</button>
            </span>
          </span>
        </div>
      ))}

      {!formVisible && (
        <button className="btn-primary" onClick={abrirNueva}>
          Agregar evaluación
        </button>
      )}

      {formVisible && (
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <div className="form-grid">
            <label>
              Fecha
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
            </label>
            <label>
              Evaluador
              <input type="text" value={form.evaluador} onChange={(e) => setForm({ ...form, evaluador: e.target.value })} required />
            </label>
            <label>
              Puntaje total (0-10)
              <input type="number" step="0.1" min="0" max="10" value={form.puntajeTotal} onChange={(e) => setForm({ ...form, puntajeTotal: e.target.value })} />
            </label>
            <label>
              Resultado
              <input type="text" value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })} placeholder="Ej: Cumple expectativas" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Observaciones
              <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </label>
          </div>
          {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : editandoId ? "Guardar cambios" : "Guardar evaluación"}
            </button>
            <button type="button" className="link-button" onClick={() => { setFormVisible(false); setEditandoId(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      <p className="muted" style={{ fontSize: "0.78rem", marginTop: 14 }}>
        Nota: la evaluación por competencias configurables por puesto es un paso siguiente
        (la tabla de criterios ya está lista en la base de datos).
      </p>
    </div>
  );
}
