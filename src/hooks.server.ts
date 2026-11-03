// src/hooks.server.ts
export let tasasActuales = {
    bcv: 36.50,
    euro: 39.80,
    ultimaActualizacion: 'No sincronizado'
};

async function actualizarTasas() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares');
        const data = await res.json();

        const bcvOficial = data.find((item: any) => item.fuente === 'oficial' || item.fuente === 'bcv');
        const paralelo = data.find((item: any) => item.fuente === 'paralelo' || item.fuente === 'enparalelovzla');

        if (bcvOficial) {
            tasasActuales.bcv = bcvOficial.promedio;
        }
        if (paralelo) {
            tasasActuales.euro = paralelo.promedio;
        }

        tasasActuales.ultimaActualizacion = new Date().toLocaleTimeString();
        console.log(`💱 [TASAS ACTUALIZADAS]: BCV: ${tasasActuales.bcv} | Ref: ${tasasActuales.euro}`);
    } catch (error) {
        console.error('⚠️ Error al actualizar las tasas automáticamente:', error);
    }
}

// Primera ejecución y programación cada 4 horas
actualizarTasas();
const INTERVALO_4_HORAS = 4 * 60 * 60 * 1000;
setInterval(actualizarTasas, INTERVALO_4_HORAS);

export async function handle({ event, resolve }) {
    return await resolve(event);
}