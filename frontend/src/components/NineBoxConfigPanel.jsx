import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function NineBoxConfigPanel() {
  const [sub, setSub] = useState("opciones"); // "opciones" | "celdas"

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>Configuración de Nine Box</h1>
          <p className="legajo-sub">Puntaje por opción de Potencial, y nombre/foco/acción de cada una de las 9 celdas</p>
        </div>
      </div>

      <div className="nav-tabs" style={{ maxWidth: 420, marginBottom: 16 }}>
        <button className="nav-tab" aria-current={sub === "opciones"} onClick={() => setSub("opciones")}>Puntaje por opción (Potencial)</button>
        <button className="nav-tab" aria-current={sub === "celdas"} onClick={() => setSub("celdas")}>Las 9 celdas</button>
      </div>

      {sub === "opciones" ? <ConfigOpciones /> : <ConfigCeldas />}
    </div>
  );
}

function ConfigOpciones() {
  const [opciones, setOpciones] = useState(null);
  const [error, setError] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ opcionTexto: "", puntaje: 1 });
  const [guardando, setGuardando] = useState(false);

  function cargar() {
    api.getNineBoxConfigOpciones().then(setOpciones).catch((e) => setError(e.message));
  }
  useEffect(cargar, []);

  if (error) return <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>;
  if (!opciones) return <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>;

  const porPregunta = new Map();
  for (const o of opciones) {
    if (!porPregunta.has(o.preguntaNumero)) porPregunta.set(o.preguntaNumero, []);
    porPregunta.get(o.preguntaNumero).push(o);
  }

  async function guardar(id) {
    setGuardando(true);
    try {
      await api.actualizarNineBoxOpcion(id, form);
      setEditandoId(null);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      {[...porPregunta.entries()].sort((a, b) => a[0] - b[0]).map(([num, opts]) => (
        <div className="panel" key={num} style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: "0.95rem" }}>
            {num}. {opts[0].preguntaTexto}
            <span className="muted" style={{ fontWeight: 400, fontSize: "0.76rem" }}> · {opts[0].dimension}</span>
          </h2>
          {opts.sort((a, b) => a.puntaje - b.puntaje).map((o) => (
            <div className="history-row" key={o.id}>
              {editandoId === o.id ? (
                <>
                  <input
                    type="text"
                    value={form.opcionTexto}
                    onChange={(e) => setForm({ ...form, opcionTexto: e.target.value })}
                    style={{ flex: 1, marginRight: 10, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border)" }}
                  />
                  <select value={form.puntaje} onChange={(e) => setForm({ ...form, puntaje: Number(e.target.value) })} style={{ marginRight: 8 }}>
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button className="link-button" onClick={() => guardar(o.id)} disabled={guardando}>Guardar</button>
                  <button className="link-button" onClick={() => setEditandoId(null)} style={{ marginLeft: 6 }}>Cancelar</button>
                </>
              ) : (
                <>
                  <span>{o.opcionTexto}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="status-pill teal" style={{ fontSize: "0.76rem" }}>{o.puntaje} pts</span>
                    <button className="link-button" onClick={() => { setEditandoId(o.id); setForm({ opcionTexto: o.opcionTexto, puntaje: o.puntaje }); }}>editar</button>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ConfigCeldas() {
  const [celdas, setCeldas] = useState(null);
  const [error, setError] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ nombreCelda: "", focoDesarrollo: "", accionSugerida: "" });
  const [guardando, setGuardando] = useState(false);

  function cargar() {
    api.getNineBoxConfigCeldas().then(setCeldas).catch((e) => setError(e.message));
  }
  useEffect(cargar, []);

  if (error) return <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>;
  if (!celdas) return <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>;

  async function guardar(id) {
    setGuardando(true);
    try {
      await api.actualizarNineBoxCelda(id, form);
      setEditandoId(null);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      {celdas.map((c) => (
        <div className="panel" key={c.id} style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: "0.9rem" }}>
            Desempeño {c.desempenoNivel} · Potencial {c.potencialNivel}
          </h2>
          {editandoId === c.id ? (
            <div className="form-grid">
              <label>
                Nombre de la celda
                <input type="text" value={form.nombreCelda} onChange={(e) => setForm({ ...form, nombreCelda: e.target.value })} />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Foco de desarrollo
                <textarea value={form.focoDesarrollo || ""} onChange={(e) => setForm({ ...form, focoDesarrollo: e.target.value })} />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Acción sugerida
                <textarea value={form.accionSugerida || ""} onChange={(e) => setForm({ ...form, accionSugerida: e.target.value })} />
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-primary" onClick={() => guardar(c.id)} disabled={guardando}>Guardar</button>
                <button className="link-button" onClick={() => setEditandoId(null)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>{c.nombreCelda}</p>
              <p className="muted" style={{ fontSize: "0.82rem" }}>{c.focoDesarrollo}</p>
              <p className="muted" style={{ fontSize: "0.82rem" }}>{c.accionSugerida}</p>
              <button
                className="link-button"
                onClick={() => { setEditandoId(c.id); setForm({ nombreCelda: c.nombreCelda, focoDesarrollo: c.focoDesarrollo, accionSugerida: c.accionSugerida }); }}
              >
                editar
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
