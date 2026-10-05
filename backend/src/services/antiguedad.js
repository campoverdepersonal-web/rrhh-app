/**
 * Calcula la antigüedad de un empleado en años, meses y días, y devuelve
 * también un texto legible en español ("2 años, 3 meses").
 */
export function calcularAntiguedad(fechaIngreso, ahora = new Date()) {
  const ingreso = new Date(fechaIngreso);

  // Ingreso programado a futuro (aunque sea mañana): todavía no hay
  // antigüedad. Sin este control, la resta daba negativa y el cálculo la
  // "daba vuelta" mostrando antigüedades falsas como "11 meses".
  const diasParaIngreso = diasHastaIngreso(ingreso, ahora);
  if (diasParaIngreso > 0) {
    return {
      años: 0,
      meses: 0,
      dias: 0,
      ingresoFuturo: true,
      diasParaIngreso,
      texto: diasParaIngreso === 1 ? "Ingresa mañana" : `Ingresa en ${diasParaIngreso} días`,
    };
  }

  let años = ahora.getUTCFullYear() - ingreso.getUTCFullYear();
  let meses = ahora.getUTCMonth() - ingreso.getUTCMonth();
  let dias = ahora.getUTCDate() - ingreso.getUTCDate();

  if (dias < 0) {
    meses -= 1;
    const mesAnterior = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 0));
    dias += mesAnterior.getUTCDate();
  }
  if (meses < 0) {
    años -= 1;
    meses += 12;
  }

  const partes = [];
  if (años > 0) partes.push(`${años} año${años !== 1 ? "s" : ""}`);
  if (meses > 0) partes.push(`${meses} mes${meses !== 1 ? "es" : ""}`);
  if (años === 0 && meses === 0) partes.push(`${dias} día${dias !== 1 ? "s" : ""}`);

  return {
    años,
    meses,
    dias,
    ingresoFuturo: false,
    diasParaIngreso: 0,
    texto: partes.join(", ") || "0 días",
  };
}

/**
 * Días corridos que faltan para la fecha de ingreso (0 o negativo si ya
 * ingresó). Compara solo año/mes/día, sin horas.
 */
export function diasHastaIngreso(fechaIngreso, ahora = new Date()) {
  const ingreso = new Date(fechaIngreso);
  const diaIngreso = Date.UTC(ingreso.getUTCFullYear(), ingreso.getUTCMonth(), ingreso.getUTCDate());
  const diaHoy = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
  return Math.round((diaIngreso - diaHoy) / 86400000);
}
