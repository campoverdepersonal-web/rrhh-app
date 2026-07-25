const DIAS_PERIODO_PRUEBA = Number(process.env.PERIODO_PRUEBA_DIAS) || 180;
const DIAS_ALERTA = 15;
const MS_POR_DIA = 1000 * 60 * 60 * 24;

/**
 * Suma días corridos a una fecha (no hábiles, según especificación: "180 días corridos").
 */
function sumarDias(fecha, dias) {
  const resultado = new Date(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

function diffEnDias(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / MS_POR_DIA);
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula el estado del período de prueba de un empleado.
 *
 * @param {string|Date} fechaIngreso
 * @param {{resultado: 'CONFIRMADO'|'EXTENSION'|'BAJA', fecha: string} | null} ultimaEvaluacion
 * @param {Date} ahora - inyectable para testing
 */
export function calcularPeriodoPrueba(fechaIngreso, ultimaEvaluacion = null, ahora = new Date()) {
  const ingreso = new Date(fechaIngreso);
  const fechaFin = sumarDias(ingreso, DIAS_PERIODO_PRUEBA);

  const diasTranscurridos = Math.max(0, diffEnDias(ahora, ingreso));
  const diasParaFinalizar = diffEnDias(fechaFin, ahora);

  let estado;
  let motivo = null;

  if (ultimaEvaluacion) {
    motivo = ultimaEvaluacion.resultado;
    if (ultimaEvaluacion.resultado === "CONFIRMADO") {
      estado = "PERSONAL_EFECTIVO";
    } else if (ultimaEvaluacion.resultado === "BAJA") {
      estado = "BAJA";
    } else {
      // EXTENSION: sigue en prueba hasta que se cargue una nueva decisión.
      estado = "EN_PRUEBA";
    }
  } else if (ahora >= fechaFin) {
    estado = "PERSONAL_EFECTIVO";
  } else {
    estado = "EN_PRUEBA";
  }

  const enPrueba = estado === "EN_PRUEBA";
  const diasRestantes = enPrueba ? Math.max(0, diasParaFinalizar) : 0;
  const alerta = enPrueba && diasRestantes <= DIAS_ALERTA;

  const etiquetas = {
    EN_PRUEBA: { texto: "En período de prueba", emoji: "🟡", color: "amber" },
    PERSONAL_EFECTIVO: { texto: "Personal efectivo", emoji: "🟢", color: "teal" },
    BAJA: { texto: "Baja", emoji: "🔴", color: "red" },
  };

  return {
    fechaIngreso: toISODate(ingreso),
    fechaFinPeriodoPrueba: toISODate(fechaFin),
    diasPeriodoPrueba: DIAS_PERIODO_PRUEBA,
    diasTranscurridos,
    diasRestantes,
    estado,
    motivoUltimaDecision: motivo,
    alerta,
    etiqueta: etiquetas[estado],
    progreso: Math.min(1, diasTranscurridos / DIAS_PERIODO_PRUEBA),
  };
}
