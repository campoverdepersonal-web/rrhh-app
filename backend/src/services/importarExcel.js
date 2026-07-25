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

export function parsearFecha(valor) {
  if (!valor && valor !== 0) return null;
  if (valor instanceof Date && !isNaN(valor)) return valor.toISOString().slice(0, 10);
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const match = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
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
