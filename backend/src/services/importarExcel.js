import * as XLSX from "xlsx";

export function leerFilasExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const hoja = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(hoja, { defval: "" });
}

export function buscarColumna(raw, ...nombresPosibles) {
  for (const key of Object.keys(raw)) {
    const keyNorm = key.trim().toLowerCase();
    if (nombresPosibles.includes(keyNorm)) return String(raw[key]).trim();
  }
  return "";
}

export function buscarColumnaCruda(raw, ...nombresPosibles) {
  for (const key of Object.keys(raw)) {
    const keyNorm = key.trim().toLowerCase();
    if (nombresPosibles.includes(keyNorm)) return raw[key];
  }
  return "";
}

export function parsearFecha(valor, formato = "DMY") {
  if (valor === null || valor === undefined || valor === "") return null;
  if (valor instanceof Date) return isNaN(valor) ? null : valor.toISOString().slice(0, 10);
  const texto = String(valor).trim();

  // AAAA-MM-DD (con o sin hora al final)
  let m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (m) return fechaValida(+m[1], +m[2], +m[3]);

  // DD/MM/AAAA (o MM/DD/AAAA si el archivo viene en formato estadounidense),
  // con / - o . como separador y con o sin hora al final.
  m = texto.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s.*)?$/);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    return formato === "MDY" ? fechaValida(y, a, b) : fechaValida(y, b, a);
  }
  return null;
}

// Devuelve "AAAA-MM-DD" solo si la fecha existe de verdad (descarta 32/13 o
// 31/02, que antes llegaban a la base y hacían fallar toda la importación).
function fechaValida(y, mes, dia) {
  if (y < 1900 || y > 2100 || mes < 1 || mes > 12 || dia < 1) return null;
  const d = new Date(Date.UTC(y, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${y}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Mira todas las fechas escritas como texto en una columna y decide si el
 * archivo está en formato argentino (DD/MM/AAAA, el normal) o estadounidense
 * (MM/DD/AAAA, como exportan algunos sistemas). Es estadounidense solo si
 * hay alguna fecha que únicamente tiene sentido así (ej. 06/25/2026) y
 * ninguna que únicamente tenga sentido en formato argentino (ej. 25/06/2026).
 */
export function detectarFormatoFechas(valores) {
  let soloDMY = false, soloMDY = false;
  for (const v of valores) {
    if (v instanceof Date) continue;
    const m = String(v ?? "").trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.]\d{4}/);
    if (!m) continue;
    if (+m[1] > 12) soloDMY = true;
    if (+m[2] > 12) soloMDY = true;
  }
  return soloMDY && !soloDMY ? "MDY" : "DMY";
}

// Convierte "Llamado de Atención" -> "llamado de atencion" para poder matchear
// sin importar tildes, mayúsculas o espacios de más.
export function normalizarTexto(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function mapearValor(valor, diccionario) {
  return diccionario[normalizarTexto(valor)] || null;
}
