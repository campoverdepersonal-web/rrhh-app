import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatFecha, toInputDate } from "../dateUtils.js";

const TIPOS = [
  { value: "APERCIBIMIENTO", label: "Apercibimiento" },
  { value: "LLAMADO_ATENCION", label: "Llamado de atención" },
  { value: "SUSPENSION", label: "Suspensión" },
];

const FORM_VACIO = { fecha: new Date().toISOString().slice(0, 10), motivo: "", tipo: "APERCIBIMIENTO", responsable: "" };

export default function SancionesPanel({ employeeId }) {
  const [sanciones, setSanciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);

  function cargar() {
    setCargando(true);
    api.listSanciones(employeeId).then(setSanciones).finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [employeeId]);

  function abrirNueva() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setFormVisible(true);
  }

  function abrirEdicion(s) {
    setForm({ fecha: toInputDate(s.fecha), motivo: s.motivo, tipo: s.tipo, responsable: s.responsable });
    setEditandoId(s.id);
    setFormVisible(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      if (editandoId) {
        await api.actualizarSancion(employeeId, editandoId, form);
      } else {
        await api.crearSancion(employeeId, form);
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
    if (!window.confirm("¿Eliminar esta sanción? No se puede deshacer.")) return;
    try {
      await api.eliminarSancion(employeeId, id);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel">
      <h2>Sanciones {sanciones.length > 0 && <span className="muted" style={{ fontWeight: 400, fontSize: "0.8rem" }}>· {sanciones.length} registrada{sanciones.length !== 1 ? "s" : ""}</span>}</h2>

      {cargando && <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>}
      {!cargando && sanciones.length === 0 && (
        <p className="muted" style={{ fontSize: "0.88rem" }}>Sin sanciones registradas.</p>
      )}
      {!cargando && sanciones.map((s) => (
        <div className="history-row" key={s.id} style={{ alignItems: "flex-start" }}>
          <div>
            <span className="status-pill red" style={{ fontSize: "0.75rem", padding: "3px 10px", marginRight: 8 }}>
              {TIPOS.find((t) => t.value === s.tipo)?.label || s.tipo}
            </span>
            <div style={{ marginTop: 6 }}>{s.motivo}</div>
          </div>
          <span className="muted" style={{ whiteSpace: "nowrap", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span>{formatFecha(s.fecha)} · {s.responsable}</span>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="link-button" onClick={() => abrirEdicion(s)}>editar</button>
              <button className="link-button" style={{ color: "var(--color-red)" }} onClick={() => handleEliminar(s.id)}>eliminar</button>
            </span>
          </span>
        </div>
      ))}

      {!formVisible && (
        <button className="btn-primary" onClick={abrirNueva}>
          Registrar sanción
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
              Tipo
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label>
              Responsable
              <input type="text" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} required />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Motivo
              <textarea value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} required />
            </label>
          </div>
          {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : editandoId ? "Guardar cambios" : "Guardar sanción"}
            </button>
            <button type="button" className="link-button" onClick={() => { setFormVisible(false); setEditandoId(null); }}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
