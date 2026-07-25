import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api.js";
import { formatFecha, toInputDate } from "../dateUtils.js";

const TIPOS = [
  { value: "POSITIVO", label: "Positivo", color: "teal", hex: "#0E8F79" },
  { value: "FELICITACION", label: "Felicitación", color: "teal", hex: "#37B6A0" },
  { value: "OBSERVACION", label: "Observación", color: "amber", hex: "#C9820A" },
  { value: "CORRECTIVO", label: "Correctivo", color: "amber", hex: "#E0A544" },
  { value: "NEGATIVO", label: "Negativo", color: "red", hex: "#C1443B" },
];

const FORM_VACIO = { fecha: new Date().toISOString().slice(0, 10), lider: "", tipo: "POSITIVO", comentario: "", lugarTrabajo: "" };

export default function ComentariosPanel({ employeeId }) {
  const [comentarios, setComentarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);

  function cargar() {
    setCargando(true);
    api.listComentarios(employeeId).then(setComentarios).finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [employeeId]);

  const datosGrafico = useMemo(() => {
    return TIPOS.map((t) => ({
      tipo: t.label,
      cantidad: comentarios.filter((c) => c.tipo === t.value).length,
      hex: t.hex,
    })).filter((d) => d.cantidad > 0);
  }, [comentarios]);

  function abrirNuevo() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setFormVisible(true);
  }

  function abrirEdicion(c) {
    setForm({
      fecha: toInputDate(c.fecha),
      lider: c.lider,
      tipo: c.tipo,
      comentario: c.comentario,
      lugarTrabajo: c.lugarTrabajo || "",
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
        await api.actualizarComentario(employeeId, editandoId, form);
      } else {
        await api.crearComentario(employeeId, form);
      }
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
    if (!window.confirm("¿Eliminar este comentario? No se puede deshacer.")) return;
    try {
      await api.eliminarComentario(employeeId, id);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel">
      <h2>Comentarios de líderes</h2>

      {datosGrafico.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={datosGrafico} dataKey="cantidad" nameKey="tipo" innerRadius={40} outerRadius={65} paddingAngle={2}>
                {datosGrafico.map((d, i) => <Cell key={i} fill={d.hex} />)}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="middle" layout="vertical" align="right" wrapperStyle={{ fontSize: "0.8rem" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

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
              {c.lugarTrabajo && (
                <div className="muted" style={{ fontSize: "0.78rem", marginTop: 3 }}>📍 {c.lugarTrabajo}</div>
              )}
            </div>
            <span className="muted" style={{ whiteSpace: "nowrap", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span>{formatFecha(c.fecha)} · {c.lider}</span>
              <span style={{ display: "flex", gap: 8 }}>
                <button className="link-button" onClick={() => abrirEdicion(c)}>editar</button>
                <button className="link-button" style={{ color: "var(--color-red)" }} onClick={() => handleEliminar(c.id)}>eliminar</button>
              </span>
            </span>
          </div>
        );
      })}

      {!formVisible && (
        <button className="btn-primary" onClick={abrirNuevo}>
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
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : editandoId ? "Guardar cambios" : "Guardar comentario"}
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => { setFormVisible(false); setEditandoId(null); }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
