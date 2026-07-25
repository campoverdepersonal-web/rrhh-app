import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatFecha } from "../dateUtils.js";

const ESTADOS = [
  { value: "PENDIENTE", label: "Pendiente", color: "amber" },
  { value: "EN_CURSO", label: "En curso", color: "amber" },
  { value: "COMPLETADO", label: "Completado", color: "teal" },
  { value: "NO_COMPLETADO", label: "No completado", color: "red" },
];

const MODALIDADES = ["Presencial", "Virtual", "Semipresencial"];

export default function CursosPanel({ employeeId }) {
  const [cursos, setCursos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    curso: "",
    modalidad: MODALIDADES[0],
    fecha: new Date().toISOString().slice(0, 10),
    estado: "PENDIENTE",
  });

  function cargar() {
    setCargando(true);
    api.listCursos(employeeId).then(setCursos).finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [employeeId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.crearCurso(employeeId, form);
      setForm({ curso: "", modalidad: MODALIDADES[0], fecha: new Date().toISOString().slice(0, 10), estado: "PENDIENTE" });
      setFormVisible(false);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarEstado(curso, nuevoEstado) {
    setCursos((prev) => prev.map((c) => (c.id === curso.id ? { ...c, estado: nuevoEstado } : c)));
    try {
      await api.actualizarCurso(employeeId, curso.id, { estado: nuevoEstado });
    } catch (err) {
      setError(err.message);
      cargar();
    }
  }

  const completados = cursos.filter((c) => c.estado === "COMPLETADO").length;

  return (
    <div className="panel">
      <h2>
        Cursos y capacitaciones
        {cursos.length > 0 && (
          <span className="muted" style={{ fontWeight: 400, fontSize: "0.8rem" }}> · {completados} de {cursos.length} completados</span>
        )}
      </h2>

      {cargando && <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>}
      {!cargando && cursos.length === 0 && (
        <p className="muted" style={{ fontSize: "0.88rem" }}>Todavía no hay cursos registrados.</p>
      )}
      {!cargando && cursos.map((c) => (
        <div className="history-row" key={c.id} style={{ alignItems: "center" }}>
          <div>
            <strong>{c.curso}</strong>
            <div className="muted" style={{ fontSize: "0.8rem" }}>{c.modalidad || "Modalidad no especificada"} · {formatFecha(c.fecha)}</div>
          </div>
          <select
            value={c.estado}
            onChange={(e) => cambiarEstado(c, e.target.value)}
            className={`status-pill ${ESTADOS.find((e2) => e2.value === c.estado)?.color}`}
            style={{ border: "none", fontSize: "0.8rem", cursor: "pointer" }}
          >
            {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
      ))}

      {!formVisible && (
        <button className="btn-primary" onClick={() => setFormVisible(true)}>
          Agregar curso
        </button>
      )}

      {formVisible && (
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <div className="form-grid">
            <label style={{ gridColumn: "1 / -1" }}>
              Curso
              <input type="text" value={form.curso} onChange={(e) => setForm({ ...form, curso: e.target.value })} placeholder="Nombre del curso" required />
            </label>
            <label>
              Modalidad
              <select value={form.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value })}>
                {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label>
              Fecha
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </label>
            <label>
              Estado
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </label>
          </div>
          {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar curso"}
          </button>
        </form>
      )}
    </div>
  );
}
