import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

// Pantalla para cambiar la denominación de un puesto en toda la app:
// legajos (activos y bajas), historial de puestos, matriz de competencias y
// criterios de evaluación. Es solo un cambio de nombre: no se borra nada.
export default function PuestosPanel({ onRenombrado }) {
  const [puestos, setPuestos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState(null); // nombre del puesto en edición
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);

  function cargar() {
    setCargando(true);
    api.listPuestos().then(setPuestos).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }
  useEffect(() => { cargar(); }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? puestos.filter((p) => p.nombre.toLowerCase().includes(q)) : puestos;
  }, [puestos, busqueda]);

  function empezar(p) {
    setEditando(p.nombre);
    setNombreNuevo(p.nombre);
    setResultado(null);
    setError(null);
  }

  async function confirmar(p) {
    const nuevo = nombreNuevo.replace(/\s+/g, " ").trim();
    if (!nuevo || nuevo === p.nombre) { setEditando(null); return; }

    const yaExiste = puestos.find((x) => x.nombre.toLowerCase() === nuevo.toLowerCase() && x.nombre !== p.nombre);
    const aviso = yaExiste
      ? `\n\nOjo: ya existe un puesto llamado "${yaExiste.nombre}". Los dos quedarán unificados bajo ese nombre.`
      : "";
    const ok = window.confirm(
      `¿Cambiar el puesto "${p.nombre}" por "${nuevo}"?\n\n` +
      `Se actualizan ${p.empleadosActivos + p.empleadosBaja} legajo(s), ${p.historial} registro(s) de historial ` +
      `y ${p.competenciasMatriz} competencia(s) de la matriz.${aviso}`
    );
    if (!ok) return;

    setGuardando(true);
    setError(null);
    try {
      const r = await api.renombrarPuesto(p.nombre, nuevo);
      setResultado(r);
      setEditando(null);
      cargar();
      onRenombrado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>Puestos</h1>
          <p className="legajo-sub">
            Cambiá la denominación de un puesto en toda la aplicación: legajos, bajas, historial y matriz de competencias.
          </p>
        </div>
      </div>

      {resultado && (
        <div className="info-banner" style={{ marginTop: 0, marginBottom: 16 }}>
          ✅ <span>
            <strong>"{resultado.actual}"</strong> ahora se llama <strong>"{resultado.nuevo}"</strong>.
            {" "}Se actualizaron {resultado.cambios.empleados} legajo(s), {resultado.cambios.historial} registro(s) de
            historial y {resultado.cambios.matriz} competencia(s) de la matriz.
          </span>
        </div>
      )}

      <div className="panel">
        <input
          className="employee-search"
          placeholder="Buscar puesto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        {cargando && <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>}
        {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
        {!cargando && visibles.length === 0 && <p className="muted" style={{ fontSize: "0.88rem" }}>Sin resultados.</p>}

        {!cargando && visibles.map((p) => (
          <div className="history-row" key={p.nombre}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {editando === p.nombre ? (
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={nombreNuevo}
                    onChange={(e) => setNombreNuevo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmar(p); if (e.key === "Escape") setEditando(null); }}
                    maxLength={120}
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: "0.85rem", minWidth: 260 }}
                    autoFocus
                  />
                  <button className="link-button" disabled={guardando} onClick={() => confirmar(p)}>
                    {guardando ? "Guardando…" : "Guardar"}
                  </button>
                  <button className="link-button" disabled={guardando} onClick={() => setEditando(null)}>Cancelar</button>
                </span>
              ) : (
                <>
                  <strong>{p.nombre}</strong>{" "}
                  <button className="link-button" style={{ fontSize: "0.72rem" }} onClick={() => empezar(p)}>
                    renombrar
                  </button>
                </>
              )}
            </span>
            <span className="muted" style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
              {p.empleadosActivos} activo{p.empleadosActivos !== 1 ? "s" : ""}
              {p.empleadosBaja > 0 && ` · ${p.empleadosBaja} baja${p.empleadosBaja !== 1 ? "s" : ""}`}
              {" · "}
              {p.competenciasMatriz > 0 ? `${p.competenciasMatriz} competencias` : "sin matriz"}
            </span>
          </div>
        ))}

        <p className="muted" style={{ fontSize: "0.78rem", marginTop: 12, marginBottom: 0 }}>
          El cambio no borra nada: evaluaciones, comentarios, sanciones, cursos y uniformes siguen asociados a cada persona.
          Si escribís el nombre de un puesto que ya existe, los dos quedan unificados.
        </p>
      </div>
    </div>
  );
}
