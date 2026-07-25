import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatFecha } from "../dateUtils.js";

const TIPOS = [
  { value: "APERCIBIMIENTO", label: "Apercibimiento" },
  { value: "LLAMADO_ATENCION", label: "Llamado de atención" },
  { value: "SUSPENSION", label: "Suspensión" },
];

export default function SancionesPanel({ employeeId }) {
  const [sanciones, setSanciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    motivo: "",
    tipo: "APERCIBIMIENTO",
    responsable: "",
  });

  function cargar() {
    setCargando(true);
    api.listSanciones(employeeId).then(setSanciones).finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [employeeId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.crearSancion(employeeId, form);
      setForm({ fecha: new Date().toISOString().slice(0, 10), motivo: "", tipo: "APERCIBIMIENTO", responsable: "" });
      setFormVisible(false);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
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
          <span className="muted" style={{ whiteSpace: "nowrap" }}>{formatFecha(s.fecha)} · {s.responsable}</span>
        </div>
      ))}

      {!formVisible && (
        <button className="btn-primary" onClick={() => setFormVisible(true)}>
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
          <button className="btn-primary" type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar sanción"}
          </button>
        </form>
      )}
    </div>
  );
}
