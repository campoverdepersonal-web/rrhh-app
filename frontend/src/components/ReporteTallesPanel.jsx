import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api.js";

// Reporte general de talles de uniforme del personal activo: cuántas
// personas necesitan cada talle de cada prenda, para planificar compras.

const PRENDAS = [
  { key: "remera", label: "Remera" },
  { key: "buzo", label: "Buzo" },
  { key: "pantalonNautico", label: "Pantalón náutico" },
  { key: "pantalonCargo", label: "Pantalón cargo" },
  { key: "calzado", label: "Calzado" },
  { key: "faja", label: "Faja" },
];

const NC = "N/C";
const ORDEN_LETRAS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "XXXXL", "4XL", "5XL", "6XL"];

// Unifica cómo se escribió el talle ("m", " M ", "xl" -> "M", "XL") para que
// no se cuenten por separado. Vacío o "N/C" = la prenda no corresponde.
function normalizarTalle(valor) {
  const t = String(valor ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!t || ["N/C", "NC", "N/A", "NA", "-", "—"].includes(t)) return NC;
  if (/^\d+([.,]0+)?$/.test(t)) return String(parseInt(t, 10));
  return t;
}

// Orden lógico: talles de letra de chico a grande, después números de menor
// a mayor, después cualquier otro texto.
function compararTalles(a, b) {
  const ia = ORDEN_LETRAS.indexOf(a), ib = ORDEN_LETRAS.indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  const na = parseFloat(a), nb = parseFloat(b);
  const esNumA = /^\d/.test(a), esNumB = /^\d/.test(b);
  if (esNumA && esNumB) return na - nb;
  if (esNumA !== esNumB) return esNumA ? -1 : 1;
  return a.localeCompare(b, "es", { numeric: true });
}

// Para cada prenda: lista de { talle, cantidad } ordenada, total y N/C.
function resumir(personas) {
  const conTalles = personas.filter((p) => p.tieneTalles);
  return PRENDAS.map(({ key, label }) => {
    const conteo = new Map();
    let noCorresponde = 0;
    for (const p of conTalles) {
      const t = normalizarTalle(p.talles[key]);
      if (t === NC) { noCorresponde++; continue; }
      conteo.set(t, (conteo.get(t) || 0) + 1);
    }
    const talles = [...conteo.entries()]
      .map(([talle, cantidad]) => ({ talle, cantidad }))
      .sort((a, b) => compararTalles(a.talle, b.talle));
    const total = talles.reduce((s, t) => s + t.cantidad, 0);
    return { key, label, talles, total, noCorresponde };
  });
}

function unicos(personas, campo) {
  return [...new Set(personas.map((p) => p[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// En el Excel, los talles numéricos (calzado) van como número para que Excel
// no los marque como "número guardado como texto".
const celdaTalle = (t) => (/^\d+$/.test(t) ? Number(t) : t);

function descargarExcel(personas, resumen, filtros) {
  const wb = XLSX.utils.book_new();
  const filtroTexto = [
    filtros.lugarTrabajo && `Lugar: ${filtros.lugarTrabajo}`,
    filtros.sector && `Sector: ${filtros.sector}`,
    filtros.puesto && `Puesto: ${filtros.puesto}`,
  ].filter(Boolean).join(" | ") || "Todo el personal activo";
  const sinTalles = personas.filter((p) => !p.tieneTalles);

  // --- Hoja 1: resumen por prenda ---
  const filas1 = [
    ["Reporte de talles de uniforme — Campo Verde"],
    [`Generado el ${hoyISO().split("-").reverse().join("/")}`],
    [filtroTexto],
    [`Personas incluidas: ${personas.length} (${personas.length - sinTalles.length} con talles cargados, ${sinTalles.length} sin cargar)`],
    [],
    ["Prenda", "Talle", "Cantidad"],
  ];
  for (const r of resumen) {
    for (const t of r.talles) filas1.push([r.label, celdaTalle(t.talle), t.cantidad]);
    filas1.push([r.label, "TOTAL", r.total]);
    if (r.noCorresponde) filas1.push([r.label, "No corresponde (N/C)", r.noCorresponde]);
    filas1.push([]);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(filas1);
  ws1["!cols"] = [{ wch: 20 }, { wch: 22 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen por prenda");

  // --- Hoja 2: misma cuenta, abierta por lugar de trabajo ---
  const lugares = unicos(personas, "lugarTrabajo");
  const filas2 = [["Prenda", "Talle", ...lugares, "Total"]];
  for (const r of resumen) {
    for (const t of r.talles) {
      const porLugar = lugares.map((l) =>
        personas.filter((p) => p.tieneTalles && p.lugarTrabajo === l && normalizarTalle(p.talles[r.key]) === t.talle).length
      );
      filas2.push([r.label, celdaTalle(t.talle), ...porLugar.map((n) => n || ""), t.cantidad]);
    }
  }
  const ws2 = XLSX.utils.aoa_to_sheet(filas2);
  ws2["!cols"] = [{ wch: 20 }, { wch: 10 }, ...lugares.map((l) => ({ wch: Math.max(12, l.length + 2) })), { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Por lugar de trabajo");

  // --- Hoja 3: detalle persona por persona ---
  const filas3 = [["Legajo", "Apellido", "Nombre", "Puesto", "Sector", "Lugar de trabajo", ...PRENDAS.map((p) => p.label)]];
  for (const p of personas) {
    filas3.push([
      p.legajo, p.apellido, p.nombre, p.puesto, p.sector, p.lugarTrabajo,
      ...PRENDAS.map(({ key }) => (p.tieneTalles ? celdaTalle(normalizarTalle(p.talles[key])) : "Sin cargar")),
    ]);
  }
  const ws3 = XLSX.utils.aoa_to_sheet(filas3);
  ws3["!cols"] = [{ wch: 9 }, { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 20 }, ...PRENDAS.map(() => ({ wch: 13 }))];
  ws3["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas3.length - 1, c: 5 + PRENDAS.length } }) };
  XLSX.utils.book_append_sheet(wb, ws3, "Detalle por persona");

  const sufijo = (filtros.lugarTrabajo || filtros.sector || filtros.puesto || "").replace(/[^\p{L}\p{N}]+/gu, "_");
  XLSX.writeFile(wb, `Talles_uniforme${sufijo ? "_" + sufijo : ""}_${hoyISO()}.xlsx`);
}

export default function ReporteTallesPanel({ onVerLegajo }) {
  const [personas, setPersonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({ lugarTrabajo: "", sector: "", puesto: "" });
  const [verSinTalles, setVerSinTalles] = useState(false);

  useEffect(() => {
    api.getReporteTalles().then(setPersonas).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, []);

  const filtradas = useMemo(() => personas.filter((p) =>
    (!filtros.lugarTrabajo || p.lugarTrabajo === filtros.lugarTrabajo) &&
    (!filtros.sector || p.sector === filtros.sector) &&
    (!filtros.puesto || p.puesto === filtros.puesto)
  ), [personas, filtros]);

  const resumen = useMemo(() => resumir(filtradas), [filtradas]);
  const sinTalles = filtradas.filter((p) => !p.tieneTalles);
  const hayFiltro = Object.values(filtros).some(Boolean);

  const set = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <div>
      <div className="legajo-header">
        <div>
          <h1>Talles de uniforme</h1>
          <p className="legajo-sub">Cuántas personas activas usan cada talle, por prenda. Sirve para calcular la próxima compra.</p>
        </div>
        <button
          className="btn-primary"
          disabled={cargando || filtradas.length === 0}
          onClick={() => descargarExcel(filtradas, resumen, filtros)}
        >
          Descargar Excel
        </button>
      </div>

      <div className="panel talles-filtros">
        <label className="filtro-label">
          Lugar de trabajo
          <select value={filtros.lugarTrabajo} onChange={set("lugarTrabajo")}>
            <option value="">Todos</option>
            {unicos(personas, "lugarTrabajo").map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="filtro-label">
          Sector
          <select value={filtros.sector} onChange={set("sector")}>
            <option value="">Todos</option>
            {unicos(personas, "sector").map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="filtro-label">
          Puesto
          <select value={filtros.puesto} onChange={set("puesto")}>
            <option value="">Todos</option>
            {unicos(personas, "puesto").map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        {hayFiltro && (
          <button className="link-button" onClick={() => setFiltros({ lugarTrabajo: "", sector: "", puesto: "" })}>
            Limpiar filtros
          </button>
        )}
      </div>

      {cargando && <div className="loading-state">Cargando talles…</div>}
      {error && <p style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}

      {!cargando && !error && (
        <>
          <p className="talles-cobertura">
            <strong>{filtradas.length}</strong> persona{filtradas.length !== 1 ? "s" : ""} activa{filtradas.length !== 1 ? "s" : ""}
            {hayFiltro ? " con estos filtros" : ""}: {filtradas.length - sinTalles.length} con talles cargados
            {sinTalles.length > 0 && (
              <>
                {" y "}
                <button className="link-button talles-faltantes" onClick={() => setVerSinTalles((v) => !v)}>
                  {sinTalles.length} sin cargar {verSinTalles ? "▲" : "▼"}
                </button>
              </>
            )}
            .
          </p>

          {verSinTalles && sinTalles.length > 0 && (
            <div className="alert-banner talles-sin-cargar">
              <div>
                <strong>Estas personas no tienen talles cargados</strong> y no están contadas en el resumen.
                Conviene completarlas antes de hacer la compra.
                <div className="talles-sin-cargar-lista">
                  {sinTalles.map((p) => (
                    <button key={p.id} className="link-button" onClick={() => onVerLegajo?.(p.id)}>
                      {p.apellido}, {p.nombre} ({p.legajo})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="talles-grid">
            {resumen.map((r) => {
              const max = Math.max(1, ...r.talles.map((t) => t.cantidad));
              return (
                <section className="panel talles-prenda" key={r.key}>
                  <header>
                    <h2>{r.label}</h2>
                    <span className="talles-total">{r.total}</span>
                  </header>
                  {r.talles.length === 0 ? (
                    <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>Nadie tiene talle cargado para esta prenda.</p>
                  ) : (
                    <table className="talles-tabla">
                      <tbody>
                        {r.talles.map((t) => (
                          <tr key={t.talle}>
                            <th scope="row">{t.talle}</th>
                            <td className="talles-barra-celda">
                              <span className="talles-barra" style={{ width: `${(t.cantidad / max) * 100}%` }} />
                            </td>
                            <td className="talles-cantidad">{t.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {r.noCorresponde > 0 && (
                    <p className="muted talles-nc">No corresponde (N/C): {r.noCorresponde}</p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
