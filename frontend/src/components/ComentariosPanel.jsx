import { useEffect, useState } from "react";
import { api } from "../api.js";

const TIPOS = [
  { value: "POSITIVO", label: "Positivo", color: "teal" },
  { value: "FELICITACION", label: "Felicitación", color: "teal" },
  { value: "OBSERVACION", label: "Observación", color: "amber" },
  { value: "CORRECTIVO", label: "Correctivo", color: "amber" },
  { value: "NEGATIVO", label: "Negativo", color: "red" },
];

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ComentariosPanel({ employeeId }) {
  const [comentarios, setComentarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    lider: "",
    tipo: "POSITIVO",
    comentario: "",
    lugarTrabajo: "",
  });

  function cargar() {
    setCargando(true);
    api.listComentarios(employeeId).then(setComentarios).finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [employeeId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.crearComentario(employeeId, form);
      setForm({ ...form, comentario: "", lider: "" });
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
      <h2>Comentarios de líderes</h2>

      {cargando && <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>}
      {!cargando && comentarios.length === 0 && (
        <p className="muted" style={{ fontSize: "0.88rem" }}>Todavía no hay comentarios registrados.</p>
      )}
      {!cargando && comentarios.map((c) => {
        const tipoInfo = TIPOS.find((t) => t.value === c.tipo);
        return (
          <div className="history-row" key={c.id} style={{ alignItems: "flex-start" }}>
            <div>
              <span className={`status-pill ${tipoInfo?.color || "amber"}`} style={{ marginRight: 8, fontSize: "0.75rem", padding: "3px 10px" }}>
                {tipoInfo?.label || c.tipo}
              </span>
              <div style={{ marginTop: 6 }}>{c.comentario}</div>
            </div>
            <span className="muted" style={{ whiteSpace: "nowrap" }}>{formatFecha(c.fecha)} · {c.lider}</span>
          </div>
        );
      })}

      {!formVisible && (
        <button className="btn-primary" onClick={() => setFormVisible(true)}>
          Agregar comentario
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
              Líder
              <input type="text" value={form.lider} onChange={(e) => setForm({ ...form, lider: e.target.value })} placeholder="Nombre del líder" required />
            </label>
            <label>
              Tipo
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label>
              Lugar de trabajo
              <input type="text" value={form.lugarTrabajo} onChange={(e) => setForm({ ...form, lugarTrabajo: e.target.value })} placeholder="Opcional" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Comentario
              <textarea value={form.comentario} onChange={(e) => setForm({ ...form, comentario: e.target.value })} required />
            </label>
          </div>
          {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar comentario"}
          </button>
        </form>
      )}
    </div>
  );
}
