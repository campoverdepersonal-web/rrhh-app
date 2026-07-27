import { useEffect, useState } from "react";
import { api } from "../api.js";

const NIVEL_LABELS = { 1: "Inicial", 2: "En desarrollo", 3: "Consolidado", 4: "Referente" };

function NivelPill({ nivel, tipoRequerimiento }) {
  const color = tipoRequerimiento === "OBLIGATORIA" ? "primary" : "amber";
  return (
    <span className={`status-pill ${tipoRequerimiento === "OBLIGATORIA" ? "teal" : "amber"}`} style={{ fontSize: "0.72rem", padding: "2px 9px" }}>
      {tipoRequerimiento === "OBLIGATORIA" ? "Obligatoria" : "Deseable"} · Nivel {nivel}
    </span>
  );
}

export default function CompetenciasDictionary() {
  const [modo, setModo] = useState("competencias"); // "competencias" | "puestos"
  const [competencias, setCompetencias] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [detalleCompetencia, setDetalleCompetencia] = useState(null);
  const [competenciasDePuesto, setCompetenciasDePuesto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.listCompetencias(), api.listPuestosConMatriz()])
      .then(([c, p]) => {
        setCompetencias(c);
        setPuestos(p);
        setSeleccionado(modo === "competencias" ? c[0]?.id : p[0]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!seleccionado) return;
    if (modo === "competencias") {
      api.getCompetencia(seleccionado).then(setDetalleCompetencia).catch((e) => setError(e.message));
    } else {
      api.getCompetenciasDePuesto(seleccionado).then(setCompetenciasDePuesto).catch((e) => setError(e.message));
    }
  }, [seleccionado, modo]);

  function cambiarModo(m) {
    setModo(m);
    setSeleccionado(m === "competencias" ? competencias[0]?.id : puestos[0]);
  }

  if (cargando) return <div className="loading-state">Cargando diccionario de competencias…</div>;
  if (error) return <div className="empty-state">No se pudo cargar ({error}).</div>;

  const blandas = competencias.filter((c) => c.tipo === "BLANDA");
  const tecnicas = competencias.filter((c) => c.tipo === "TECNICA");

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>Diccionario de competencias</h1>
          <p className="legajo-sub">{competencias.length} competencias · {puestos.length} puestos con matriz asignada</p>
        </div>
      </div>

      <div className="nav-tabs" style={{ maxWidth: 320, marginBottom: 20 }}>
        <button className="nav-tab" aria-current={modo === "competencias"} onClick={() => cambiarModo("competencias")}>Por competencia</button>
        <button className="nav-tab" aria-current={modo === "puestos"} onClick={() => cambiarModo("puestos")}>Por puesto</button>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel" style={{ maxHeight: 560, overflowY: "auto" }}>
          {modo === "competencias" ? (
            <>
              <h2>Blandas ({blandas.length})</h2>
              {blandas.map((c) => (
                <button key={c.id} className="employee-list-item" aria-current={seleccionado === c.id} onClick={() => setSeleccionado(c.id)} style={{ width: "100%" }}>
                  <span className="name">{c.nombre}</span>
                </button>
              ))}
              <h2 style={{ marginTop: 16 }}>Técnicas ({tecnicas.length})</h2>
              {tecnicas.map((c) => (
                <button key={c.id} className="employee-list-item" aria-current={seleccionado === c.id} onClick={() => setSeleccionado(c.id)} style={{ width: "100%" }}>
                  <span className="name">{c.nombre}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <h2>Puestos ({puestos.length})</h2>
              {puestos.map((p) => (
                <button key={p} className="employee-list-item" aria-current={seleccionado === p} onClick={() => setSeleccionado(p)} style={{ width: "100%" }}>
                  <span className="name">{p}</span>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="panel" style={{ maxHeight: 560, overflowY: "auto" }}>
          {modo === "competencias" && detalleCompetencia && (
            <CompetenciaDetalle competencia={detalleCompetencia} />
          )}
          {modo === "puestos" && competenciasDePuesto && (
            <PuestoDetalle puesto={seleccionado} lista={competenciasDePuesto} onVerCompetencia={(id) => { cambiarModo("competencias"); setSeleccionado(id); }} />
          )}
        </div>
      </div>
    </div>
  );
}

function CompetenciaDetalle({ competencia: c }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h2 style={{ marginBottom: 4 }}>{c.nombre}</h2>
        <span className="status-pill amber" style={{ fontSize: "0.72rem" }}>{c.tipo === "BLANDA" ? "Blanda" : "Técnica"}</span>
      </div>
      <p className="muted" style={{ fontSize: "0.78rem", marginTop: 0 }}>
        {c.clasificacion === "ORGANIZACIONAL" ? "Organizacional (aplica de forma transversal)" : "Específica de puesto"}
      </p>

      <p style={{ fontSize: "0.9rem" }}>{c.definicion}</p>

      <h2 style={{ fontSize: "0.85rem" }}>Importancia para la organización</h2>
      <p className="muted" style={{ fontSize: "0.85rem" }}>{c.importancia}</p>

      <div className="grid-2" style={{ marginTop: 4, marginBottom: 4 }}>
        <div>
          <h2 style={{ fontSize: "0.85rem" }}>Conductas esperadas</h2>
          <ul style={{ fontSize: "0.82rem", paddingLeft: 18, margin: 0 }}>
            {(c.conductasEsperadas || []).map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
        <div>
          <h2 style={{ fontSize: "0.85rem" }}>Conductas no esperadas</h2>
          <ul style={{ fontSize: "0.82rem", paddingLeft: 18, margin: 0 }}>
            {(c.conductasNoEsperadas || []).map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      </div>

      <h2 style={{ fontSize: "0.85rem", marginTop: 14 }}>Niveles de dominio</h2>
      {[1, 2, 3, 4].map((n) => (
        <div className="history-row" key={n} style={{ alignItems: "flex-start" }}>
          <span style={{ minWidth: 100, fontWeight: 600, fontSize: "0.8rem" }}>Nivel {n} · {NIVEL_LABELS[n]}</span>
          <span className="muted" style={{ fontSize: "0.82rem", textAlign: "left", flex: 1 }}>{c.niveles?.[n]}</span>
        </div>
      ))}

      {c.ejemplosAplicacion?.length > 0 && (
        <>
          <h2 style={{ fontSize: "0.85rem", marginTop: 14 }}>Ejemplos de aplicación</h2>
          <ul style={{ fontSize: "0.82rem", paddingLeft: 18, margin: 0 }}>
            {c.ejemplosAplicacion.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </>
      )}

      <h2 style={{ fontSize: "0.85rem", marginTop: 14 }}>Se requiere en {c.puestos.length} puesto(s)</h2>
      {c.puestos.map((p) => (
        <div className="history-row" key={p.puesto}>
          <span>{p.puesto}</span>
          <NivelPill nivel={p.nivelRequerido} tipoRequerimiento={p.tipoRequerimiento} />
        </div>
      ))}
      {c.puestos.length === 0 && (
        <p className="muted" style={{ fontSize: "0.85rem" }}>No está asignada como requerida a ningún puesto todavía.</p>
      )}
    </>
  );
}

function PuestoDetalle({ puesto, lista, onVerCompetencia }) {
  const obligatorias = lista.filter((c) => c.tipoRequerimiento === "OBLIGATORIA");
  const deseables = lista.filter((c) => c.tipoRequerimiento === "DESEABLE");

  return (
    <>
      <h2>{puesto}</h2>
      <p className="muted" style={{ fontSize: "0.82rem" }}>{lista.length} competencias asignadas</p>

      <h2 style={{ fontSize: "0.85rem", marginTop: 10 }}>Obligatorias ({obligatorias.length})</h2>
      {obligatorias.map((c) => (
        <button key={c.id} className="history-row" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }} onClick={() => onVerCompetencia(c.id)}>
          <span>{c.nombre}</span>
          <NivelPill nivel={c.nivelRequerido} tipoRequerimiento={c.tipoRequerimiento} />
        </button>
      ))}

      <h2 style={{ fontSize: "0.85rem", marginTop: 14 }}>Deseables ({deseables.length})</h2>
      {deseables.map((c) => (
        <button key={c.id} className="history-row" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }} onClick={() => onVerCompetencia(c.id)}>
          <span>{c.nombre}</span>
          <NivelPill nivel={c.nivelRequerido} tipoRequerimiento={c.tipoRequerimiento} />
        </button>
      ))}
    </>
  );
}
