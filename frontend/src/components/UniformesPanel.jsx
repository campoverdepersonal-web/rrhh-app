import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatFecha, toInputDate, diasTranscurridos, formatDuracion } from "../dateUtils.js";

const CAMPOS_TALLES = [
  { key: "remera", label: "Remera" },
  { key: "buzo", label: "Buzo" },
  { key: "pantalonNautico", label: "Pantalón náutico" },
  { key: "pantalonCargo", label: "Pantalón cargo" },
  { key: "calzado", label: "Calzado" },
  { key: "faja", label: "Faja" },
];

function AlertaPill({ dias, diasApto, diasPosibilidadCambio }) {
  if (dias === null) return null;
  let color, texto;
  if (dias <= diasApto) { color = "teal"; texto = "Apto para uso"; }
  else if (dias <= diasPosibilidadCambio) { color = "amber"; texto = "Posibilidad de cambio"; }
  else { color = "red"; texto = "Reponer"; }
  return <span className={`status-pill ${color}`} style={{ fontSize: "0.72rem", padding: "2px 9px" }}>{texto}</span>;
}

export default function UniformesPanel({ employeeId }) {
  const [sub, setSub] = useState("talles"); // "talles" | "vigente" | "historial"
  const [catalogo, setCatalogo] = useState(null);
  const [talles, setTalles] = useState(null);
  const [entregas, setEntregas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  function cargar() {
    setCargando(true);
    Promise.all([
      api.getCatalogoUniformes(),
      api.getTallesUniforme(employeeId),
      api.listEntregasUniforme(employeeId),
    ])
      .then(([cat, t, e]) => { setCatalogo(cat); setTalles(t); setEntregas(e); })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [employeeId]);

  if (cargando) return <div className="panel"><p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p></div>;
  if (error) return <div className="panel"><p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p></div>;

  const vigentes = entregas.filter((e) => {
    const dias = diasTranscurridos(e.fechaEntrega);
    return dias !== null && dias <= catalogo.diasApto;
  });

  return (
    <div>
      <div className="nav-tabs" style={{ maxWidth: 460, marginBottom: 16 }}>
        <button className="nav-tab" aria-current={sub === "talles"} onClick={() => setSub("talles")}>Talles</button>
        <button className="nav-tab" aria-current={sub === "vigente"} onClick={() => setSub("vigente")}>Uniforme vigente</button>
        <button className="nav-tab" aria-current={sub === "historial"} onClick={() => setSub("historial")}>Historial de entrega</button>
      </div>

      {sub === "talles" && <TallesPanel employeeId={employeeId} talles={talles} onGuardado={cargar} />}
      {sub === "vigente" && <UniformeVigentePanel vigentes={vigentes} catalogo={catalogo} />}
      {sub === "historial" && (
        <HistorialEntregaPanel employeeId={employeeId} entregas={entregas} catalogo={catalogo} onCambio={cargar} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Talles
// ---------------------------------------------------------------------------
function TallesPanel({ employeeId, talles, onGuardado }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    remera: talles?.remera || "", buzo: talles?.buzo || "",
    pantalonNautico: talles?.pantalonNautico || "", pantalonCargo: talles?.pantalonCargo || "",
    calzado: talles?.calzado || "", faja: talles?.faja || "",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  function abrirEdicion() {
    setForm({
      remera: talles?.remera || "", buzo: talles?.buzo || "",
      pantalonNautico: talles?.pantalonNautico || "", pantalonCargo: talles?.pantalonCargo || "",
      calzado: talles?.calzado || "", faja: talles?.faja || "",
    });
    setEditando(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.guardarTallesUniforme(employeeId, form);
      setEditando(false);
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="panel">
      <h2>Talles por prenda</h2>
      {!editando ? (
        <>
          <div className="badge-facts">
            {CAMPOS_TALLES.map((c) => (
              <div key={c.key}>
                <div className="fact-label">{c.label}</div>
                <div className="fact-value">{talles?.[c.key] || "N/C"}</div>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={abrirEdicion} style={{ marginTop: 16 }}>
            {talles ? "Editar talles" : "Cargar talles"}
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {CAMPOS_TALLES.map((c) => (
              <label key={c.key}>
                {c.label}
                <input
                  type="text"
                  value={form[c.key]}
                  onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                  placeholder="N/C, talle o número"
                />
              </label>
            ))}
          </div>
          {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : "Guardar talles"}
            </button>
            <button type="button" className="link-button" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </form>
      )}
      <p className="muted" style={{ fontSize: "0.78rem", marginTop: 14 }}>
        Usá "N/C" cuando la prenda no corresponda para este puesto.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Uniforme vigente (derivado, se actualiza solo)
// ---------------------------------------------------------------------------
function UniformeVigentePanel({ vigentes, catalogo }) {
  return (
    <div className="panel">
      <h2>Uniforme vigente <span className="muted" style={{ fontWeight: 400, fontSize: "0.8rem" }}>· entregado en los últimos {catalogo.diasApto} días</span></h2>
      {vigentes.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.88rem" }}>No hay prendas entregadas dentro del período vigente.</p>
      ) : (
        vigentes.map((e) => {
          const dias = diasTranscurridos(e.fechaEntrega);
          return (
            <div className="history-row" key={e.id}>
              <div>
                <strong>{e.tipoPrenda}</strong>{e.colorDetalle ? ` — ${e.colorDetalle}` : ""}
                <div className="muted" style={{ fontSize: "0.78rem" }}>
                  {e.marca && `${e.marca} · `}Talle {e.talle || "—"} · Cant. {e.cantidad}
                </div>
              </div>
              <span className="muted" style={{ textAlign: "right", fontSize: "0.8rem" }}>
                {formatFecha(e.fechaEntrega)}<br />
                <span style={{ fontSize: "0.74rem" }}>hace {formatDuracion(dias)}</span>
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Historial de entrega
// ---------------------------------------------------------------------------
const FORM_VACIO = { fechaEntrega: new Date().toISOString().slice(0, 10), tipoPrenda: "", colorDetalle: "", marca: "", talle: "", cantidad: 1, estado: "NUEVA" };

function HistorialEntregaPanel({ employeeId, entregas, catalogo, onCambio }) {
  const [formVisible, setFormVisible] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const opcionesColor = form.tipoPrenda ? catalogo.prendas[form.tipoPrenda] || [] : [];

  function abrirNueva() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setFormVisible(true);
  }

  function abrirEdicion(e) {
    setForm({
      fechaEntrega: toInputDate(e.fechaEntrega), tipoPrenda: e.tipoPrenda, colorDetalle: e.colorDetalle || "",
      marca: e.marca || "", talle: e.talle || "", cantidad: e.cantidad, estado: e.estado,
    });
    setEditandoId(e.id);
    setFormVisible(true);
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const payload = { ...form, cantidad: Number(form.cantidad) || 1 };
      if (editandoId) await api.actualizarEntregaUniforme(employeeId, editandoId, payload);
      else await api.crearEntregaUniforme(employeeId, payload);
      setFormVisible(false);
      setEditandoId(null);
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function handleEliminar(id) {
    if (!window.confirm("¿Eliminar esta entrega del historial? No se puede deshacer.")) return;
    try {
      await api.eliminarEntregaUniforme(employeeId, id);
      onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel">
      <h2>Historial de entrega</h2>

      {entregas.length === 0 && <p className="muted" style={{ fontSize: "0.88rem" }}>Todavía no hay entregas registradas.</p>}
      {entregas.map((e) => {
        const dias = diasTranscurridos(e.fechaEntrega);
        return (
          <div className="history-row" key={e.id} style={{ alignItems: "flex-start" }}>
            <div>
              <strong>{e.tipoPrenda}</strong>{e.colorDetalle ? ` — ${e.colorDetalle}` : ""}
              <div className="muted" style={{ fontSize: "0.78rem" }}>
                {e.marca && `${e.marca} · `}Talle {e.talle || "—"} · Cant. {e.cantidad} · {e.estado === "NUEVA" ? "Nueva" : "Usada"}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button className="link-button" onClick={() => abrirEdicion(e)}>editar</button>
                <button className="link-button" style={{ color: "var(--color-red)" }} onClick={() => handleEliminar(e.id)}>eliminar</button>
              </div>
            </div>
            <span className="muted" style={{ textAlign: "right", fontSize: "0.8rem", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span>{formatFecha(e.fechaEntrega)}</span>
              <span style={{ fontSize: "0.74rem" }}>hace {formatDuracion(dias)}</span>
              <AlertaPill dias={dias} diasApto={catalogo.diasApto} diasPosibilidadCambio={catalogo.diasPosibilidadCambio} />
            </span>
          </div>
        );
      })}

      {!formVisible && (
        <button className="btn-primary" onClick={abrirNueva}>Registrar entrega</button>
      )}

      {formVisible && (
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <div className="form-grid">
            <label>
              Fecha de entrega
              <input type="date" value={form.fechaEntrega} onChange={(e) => setForm({ ...form, fechaEntrega: e.target.value })} required />
            </label>
            <label>
              Tipo de prenda
              <select value={form.tipoPrenda} onChange={(e) => setForm({ ...form, tipoPrenda: e.target.value, colorDetalle: "" })} required>
                <option value="">Elegir…</option>
                {Object.keys(catalogo.prendas).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            {opcionesColor.length > 0 && (
              <label>
                Color / detalle
                <select value={form.colorDetalle} onChange={(e) => setForm({ ...form, colorDetalle: e.target.value })}>
                  <option value="">Elegir…</option>
                  {opcionesColor.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}
            <label>
              Marca
              <select value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })}>
                <option value="">Elegir…</option>
                {catalogo.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label>
              Talle
              <input type="text" value={form.talle} onChange={(e) => setForm({ ...form, talle: e.target.value })} placeholder="Letra o número" />
            </label>
            <label>
              Cantidad
              <input type="number" min="1" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            </label>
            <label>
              Estado al entregar
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="NUEVA">Nueva</option>
                <option value="USADA">Usada</option>
              </select>
            </label>
          </div>
          {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : editandoId ? "Guardar cambios" : "Registrar entrega"}
            </button>
            <button type="button" className="link-button" onClick={() => { setFormVisible(false); setEditandoId(null); }}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
