import { useEffect, useMemo, useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api.js";
import { formatFecha, toInputDate } from "../dateUtils.js";

const FORM_VACIO = { fecha: new Date().toISOString().slice(0, 10), evaluador: "", puntajeTotal: "", resultado: "", observaciones: "" };

export default function EvaluacionesPanel({ employeeId, puesto }) {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [competenciasPuesto, setCompetenciasPuesto] = useState(null); // null = no cargado, [] = puesto sin matriz
  const [cargando, setCargando] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [nivelesCompetencias, setNivelesCompetencias] = useState({}); // { competenciaId: nivelAlcanzado }

  function cargar() {
    setCargando(true);
    api.listEvaluaciones(employeeId).then(setEvaluaciones).finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [employeeId]);

  useEffect(() => {
    if (!puesto) { setCompetenciasPuesto([]); return; }
    api.getCompetenciasDePuesto(puesto).then(setCompetenciasPuesto).catch(() => setCompetenciasPuesto([]));
  }, [puesto]);

  function abrirNueva() {
    setForm(FORM_VACIO);
    setNivelesCompetencias({});
    setEditandoId(null);
    setFormVisible(true);
  }

  function abrirEdicion(ev) {
    setForm({
      fecha: toInputDate(ev.fecha),
      evaluador: ev.evaluador,
      puntajeTotal: ev.puntajeTotal ?? "",
      resultado: ev.resultado || "",
      observaciones: ev.observaciones || "",
    });
    const niveles = {};
    (ev.competenciasEvaluadas || []).forEach((c) => { niveles[c.competenciaId] = c.nivelAlcanzado; });
    setNivelesCompetencias(niveles);
    setEditandoId(ev.id);
    setFormVisible(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const competenciasEvaluadas = Object.entries(nivelesCompetencias)
        .filter(([, nivel]) => nivel)
        .map(([competenciaId, nivelAlcanzado]) => ({ competenciaId: Number(competenciaId), nivelAlcanzado: Number(nivelAlcanzado) }));

      const payload = { ...form, puntajeTotal: form.puntajeTotal ? Number(form.puntajeTotal) : null, competenciasEvaluadas };
      if (editandoId) {
        await api.actualizarEvaluacion(employeeId, editandoId, payload);
      } else {
        await api.crearEvaluacion(employeeId, payload);
      }
      setForm(FORM_VACIO);
      setNivelesCompetencias({});
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
    if (!window.confirm("¿Eliminar esta evaluación? No se puede deshacer.")) return;
    try {
      await api.eliminarEvaluacion(employeeId, id);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const promedio = evaluaciones.length
    ? (evaluaciones.reduce((acc, e) => acc + (Number(e.puntajeTotal) || 0), 0) / evaluaciones.length).toFixed(1)
    : null;

  const ultimaEvaluacionConCompetencias = evaluaciones.find((e) => e.competenciasEvaluadas?.length > 0);

  const datosRadar = useMemo(() => {
    if (!ultimaEvaluacionConCompetencias || !competenciasPuesto?.length) return [];
    return ultimaEvaluacionConCompetencias.competenciasEvaluadas.map((ce) => {
      const req = competenciasPuesto.find((cp) => cp.id === ce.competenciaId);
      return {
        competencia: ce.nombre.length > 18 ? ce.nombre.slice(0, 16) + "…" : ce.nombre,
        Alcanzado: ce.nivelAlcanzado,
        Requerido: req?.nivelRequerido ?? null,
      };
    });
  }, [ultimaEvaluacionConCompetencias, competenciasPuesto]);

  const obligatorias = (competenciasPuesto || []).filter((c) => c.tipoRequerimiento === "OBLIGATORIA");
  const deseables = (competenciasPuesto || []).filter((c) => c.tipoRequerimiento === "DESEABLE");

  return (
    <div className="panel">
      <h2>Evaluaciones de desempeño {promedio && <span className="muted" style={{ fontWeight: 400, fontSize: "0.8rem" }}>· promedio {promedio}</span>}</h2>

      {datosRadar.length >= 3 && (
        <div style={{ marginBottom: 18 }}>
          <p className="muted" style={{ fontSize: "0.78rem", margin: "0 0 4px" }}>
            Radar de competencias — última evaluación con puntajes ({formatFecha(ultimaEvaluacionConCompetencias.fecha)})
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={datosRadar} outerRadius={90}>
              <PolarGrid />
              <PolarAngleAxis dataKey="competencia" fontSize={11} />
              <PolarRadiusAxis domain={[0, 4]} tickCount={5} fontSize={10} />
              <Radar name="Alcanzado" dataKey="Alcanzado" stroke="#2E7D5B" fill="#2E7D5B" fillOpacity={0.35} />
              <Radar name="Requerido" dataKey="Requerido" stroke="#C9820A" fill="#C9820A" fillOpacity={0.12} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {cargando && <p className="muted" style={{ fontSize: "0.88rem" }}>Cargando…</p>}
      {!cargando && evaluaciones.length === 0 && (
        <p className="muted" style={{ fontSize: "0.88rem" }}>Todavía no hay evaluaciones registradas.</p>
      )}
      {!cargando && evaluaciones.map((ev) => (
        <div className="history-row" key={ev.id} style={{ alignItems: "flex-start" }}>
          <div>
            <strong>{ev.puntajeTotal ?? "—"}</strong>{ev.resultado ? ` · ${ev.resultado}` : ""}
            {ev.observaciones && <div className="muted" style={{ marginTop: 4, fontSize: "0.82rem" }}>{ev.observaciones}</div>}
            {ev.competenciasEvaluadas?.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
                {ev.competenciasEvaluadas.map((c) => (
                  <span key={c.competenciaId} className="status-pill amber" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
                    {c.nombre}: {c.nivelAlcanzado}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="muted" style={{ whiteSpace: "nowrap", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span>{formatFecha(ev.fecha)} · {ev.evaluador}</span>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="link-button" onClick={() => abrirEdicion(ev)}>editar</button>
              <button className="link-button" style={{ color: "var(--color-red)" }} onClick={() => handleEliminar(ev.id)}>eliminar</button>
            </span>
          </span>
        </div>
      ))}

      {!formVisible && (
        <button className="btn-primary" onClick={abrirNueva}>
          Agregar evaluación
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
              Evaluador
              <input type="text" value={form.evaluador} onChange={(e) => setForm({ ...form, evaluador: e.target.value })} required />
            </label>
            <label>
              Puntaje total (0-10)
              <input type="number" step="0.1" min="0" max="10" value={form.puntajeTotal} onChange={(e) => setForm({ ...form, puntajeTotal: e.target.value })} />
            </label>
            <label>
              Resultado
              <input type="text" value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })} placeholder="Ej: Cumple expectativas" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Observaciones
              <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </label>
          </div>

          {competenciasPuesto === null && <p className="muted" style={{ fontSize: "0.8rem" }}>Cargando competencias del puesto…</p>}
          {competenciasPuesto?.length === 0 && (
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              El puesto "{puesto}" no tiene competencias configuradas en la matriz — revisá que el nombre coincida exactamente.
            </p>
          )}
          {competenciasPuesto?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p className="muted" style={{ fontSize: "0.78rem", margin: "0 0 6px" }}>
                Puntuá el nivel alcanzado (1-4) en las competencias que corresponden a este puesto. Podés dejar sin puntuar las que no evalúes esta vez.
              </p>
              {obligatorias.length > 0 && (
                <>
                  <div className="fact-label" style={{ marginTop: 8 }}>Obligatorias</div>
                  {obligatorias.map((c) => (
                    <CompetenciaSelector key={c.id} competencia={c} valor={nivelesCompetencias[c.id]} onChange={(v) => setNivelesCompetencias({ ...nivelesCompetencias, [c.id]: v })} />
                  ))}
                </>
              )}
              {deseables.length > 0 && (
                <>
                  <div className="fact-label" style={{ marginTop: 10 }}>Deseables</div>
                  {deseables.map((c) => (
                    <CompetenciaSelector key={c.id} competencia={c} valor={nivelesCompetencias[c.id]} onChange={(v) => setNivelesCompetencias({ ...nivelesCompetencias, [c.id]: v })} />
                  ))}
                </>
              )}
            </div>
          )}

          {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : editandoId ? "Guardar cambios" : "Guardar evaluación"}
            </button>
            <button type="button" className="link-button" onClick={() => { setFormVisible(false); setEditandoId(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      <p className="muted" style={{ fontSize: "0.78rem", marginTop: 14 }}>
        Los niveles requeridos salen de la matriz cargada en la pestaña "Competencias".
      </p>
    </div>
  );
}

function CompetenciaSelector({ competencia, valor, onChange }) {
  return (
    <div className="history-row" style={{ padding: "6px 0" }}>
      <span style={{ fontSize: "0.85rem" }}>
        {competencia.nombre}
        <span className="muted" style={{ fontSize: "0.74rem" }}> (requerido: nivel {competencia.nivelRequerido})</span>
      </span>
      <select
        value={valor || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: "0.82rem" }}
      >
        <option value="">Sin puntuar</option>
        <option value="1">Nivel 1</option>
        <option value="2">Nivel 2</option>
        <option value="3">Nivel 3</option>
        <option value="4">Nivel 4</option>
      </select>
    </div>
  );
}
