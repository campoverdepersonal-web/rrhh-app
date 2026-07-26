import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatFecha, toInputDate } from "../dateUtils.js";

const ESTADOS = [
  { value: "PENDIENTE", label: "Pendiente", color: "amber" },
  { value: "EN_CURSO", label: "En curso", color: "amber" },
  { value: "COMPLETADO", label: "Completado", color: "teal" },
  { value: "NO_COMPLETADO", label: "No completado", color: "red" },
];

const MODALIDADES = ["Presencial", "Virtual", "Semipresencial"];

const FORM_VACIO = {
  curso: "", modalidad: MODALIDADES[0], fecha: new Date().toISOString().slice(0, 10),
  estado: "PENDIENTE", capacitador: "", observaciones: "",
};

export default function CursosPanel({ employeeId }) {
  const [cursos, setCursos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);

  function cargar() {
    setCargando(true);
    api.listCursos(employeeId).then(setCursos).finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [employeeId]);

  function abrirNuevo() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setFormVisible(true);
  }

  function abrirEdicion(c) {
    setForm({
      curso: c.curso,
      modalidad: c.modalidad || MODALIDADES[0],
      fecha: toInputDate(c.fecha),
      estado: c.estado,
      capacitador: c.capacitador || "",
      observaciones: c.observaciones || "",
    });
    setEditandoId(c.id);
    setFormVisible(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      if (editandoId) {
        await api.actualizarCurso(employeeId, editandoId, form);
      } else {
        await api.crearCurso(employeeId, form);
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
    if (!window.confirm("¿Eliminar este curso? No se puede deshacer.")) return;
    try {
      await api.eliminarCurso(employeeId, id);
      cargar();
    } catch (err) {
      setError(err.message);
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
        <div className="history-row" key={c.id} style={{ alignItems: "flex-start" }}>
          <div>
            <strong>{c.curso}</strong>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              {c.modalidad || "Modalidad no especificada"} · {formatFecha(c.fecha)}
              {c.capacitador && ` · Capacitador: ${c.capacitador}`}
            </div>
            {c.observaciones && (
              <div className="muted" style={{ fontSize: "0.78rem", marginTop: 3 }}>📝 {c.observaciones}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="link-button" onClick={() => abrirEdicion(c)}>editar</button>
              <button className="link-button" style={{ color: "var(--color-red)" }} onClick={() => handleEliminar(c.id)}>eliminar</button>
            </div>
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
        <button className="btn-primary" onClick={abrirNuevo}>
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
            <label>
              Capacitador
              <input type="text" value={form.capacitador} onChange={(e) => setForm({ ...form, capacitador: e.target.value })} placeholder="Nombre del capacitador (opcional)" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Observaciones
              <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Comentarios o detalles del curso y/o la persona (opcional)" />
            </label>
          </div>
          {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : editandoId ? "Guardar cambios" : "Guardar curso"}
            </button>
            <button type="button" className="link-button" onClick={() => { setFormVisible(false); setEditandoId(null); }}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
