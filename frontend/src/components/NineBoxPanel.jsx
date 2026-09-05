import { Fragment, useEffect, useState } from "react";
import { api } from "../api.js";

const COLOR_POR_CELDA = {
  "Alto|Alto": "teal", "Alto|Medio": "teal", "Alto|Bajo": "amber",
  "Medio|Alto": "teal", "Medio|Medio": "amber", "Medio|Bajo": "amber",
  "Bajo|Alto": "amber", "Bajo|Medio": "red", "Bajo|Bajo": "red",
};
const BORDE_POR_COLOR = { teal: "var(--color-teal)", amber: "var(--color-amber)", red: "var(--color-red)" };

export default function NineBoxPanel({ onVerLegajo }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [celdaAbierta, setCeldaAbierta] = useState(null);

  useEffect(() => {
    api.getNineBox().then(setDatos).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="loading-state">Calculando el Nine Box…</div>;
  if (error) return <div className="empty-state">No se pudo cargar ({error}).</div>;
  if (!datos) return null;

  // Orden visual: filas = Potencial (Alto arriba), columnas = Desempeño (Bajo, Medio, Alto)
  const NIVELES = ["Bajo", "Medio", "Alto"];
  const potencialFilas = ["Alto", "Medio", "Bajo"];

  function celdaDe(potencial, desempeno) {
    return datos.celdas.find((c) => c.potencialNivel === potencial && c.desempenoNivel === desempeno);
  }

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>Nine Box</h1>
          <p className="legajo-sub">
            Desempeño × Potencial — {datos.totalPersonas} persona{datos.totalPersonas !== 1 ? "s" : ""} con ambos datos cargados
            (puestos clave y mandos)
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "110px repeat(3, 1fr)", gap: 10 }}>
        <div />
        {NIVELES.map((d) => (
          <div key={d} className="muted" style={{ textAlign: "center", fontSize: "0.8rem", fontWeight: 600 }}>
            Desempeño {d}
          </div>
        ))}

        {potencialFilas.map((potencial) => (
          <Fragment key={potencial}>
            <div className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center" }}>
              Potencial {potencial}
            </div>
            {NIVELES.map((desempeno) => {
              const celda = celdaDe(potencial, desempeno);
              const color = COLOR_POR_CELDA[`${desempeno}|${potencial}`] || "";
              const abierta = celdaAbierta === `${potencial}|${desempeno}`;
              return (
                <div
                  key={`${potencial}-${desempeno}`}
                  className="panel"
                  style={{ cursor: "pointer", borderColor: celda?.personas.length ? BORDE_POR_COLOR[color] : undefined }}
                  onClick={() => setCeldaAbierta(abierta ? null : `${potencial}|${desempeno}`)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{celda?.nombreCelda}</strong>
                    <span className={`status-pill ${color}`} style={{ fontSize: "0.72rem" }}>{celda?.personas.length || 0}</span>
                  </div>
                  {abierta && (
                    <div style={{ marginTop: 10 }}>
                      {celda.personas.length === 0 ? (
                        <p className="muted" style={{ fontSize: "0.78rem" }}>Nadie en esta celda por ahora.</p>
                      ) : (
                        celda.personas.map((p) => (
                          <div key={p.id} className="history-row" style={{ padding: "6px 0" }}>
                            <button className="link-button" onClick={(e) => { e.stopPropagation(); onVerLegajo(p.id); }}>
                              {p.nombre}
                            </button>
                            <span className="muted" style={{ fontSize: "0.76rem" }}>D:{p.puntajeCompetencias} · P:{p.potencialFinal}</span>
                          </div>
                        ))
                      )}
                      {celda.focoDesarrollo && (
                        <p className="muted" style={{ fontSize: "0.76rem", marginTop: 8 }}><strong>Foco:</strong> {celda.focoDesarrollo}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      {datos.totalPersonas === 0 && (
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: 16 }}>
          Todavía no hay nadie con Desempeño y Potencial cargados a la vez. Importalos desde
          Configuración → Importar.
        </p>
      )}
    </div>
  );
}
