// src/hooks.server.ts

// Objeto global en memoria del servidor para almacenar las tasas actuales
export let tasasActuales = {
    bcv: 36.50, // Valor por defecto inicial
    euro: 39.80,
    ultimaActualizacion: 'No sincronizado'
};

async function actualizarTasas() {
    try {
        // Consultamos una API pública de confianza para Venezuela (ej. DolarAPI)
        const res = await fetch('https://ve.dolarapi.com/v1/dolares');
        const data = await res.json();

        // Buscamos la tasa oficial del BCV y el paralelo/euro en la respuesta
        const bcvOficial = data.find((item: any) => item.fuente === 'oficial' || item.fuente === 'bcv');
        const paralelo = data.find((item: any) => item.fuente === 'paralelo' || item.fuente === 'enparalelovzla');

        if (bcvOficial) {
            tasasActuales.bcv = bcvOficial.promedio;
        }
        if (paralelo) {
            tasasActuales.euro = paralelo.promedio; // O puedes usarlo como referencia paralela
        }

        tasasActuales.ultimaActualizacion = new Date().toLocaleTimeString();
        console.log(`💱 [TASAS ACTUALIZADAS]: BCV: ${tasasActuales.bcv} | Ref: ${tasasActuales.euro}`);
    } catch (error) {
        console.error('⚠️ Error al actualizar las tasas automáticamente, usando valores previos:', error);
    }
}

// 1. Ejecutar la primera actualización al encender el servidor
actualizarTasas();

// 2. Programar el intervalo de actualización cada 4 horas (4 horas * 60 min * 60 seg * 1000 ms)
const INTERVALO_4_HORAS = 4 * 60 * 60 * 1000;
setInterval(actualizarTasas, INTERVALO_4_HORAS);

export async function handle({ event, resolve }) {
    return await resolve(event);
}