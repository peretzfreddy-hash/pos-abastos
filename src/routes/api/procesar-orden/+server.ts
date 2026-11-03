import { error, json } from '@sveltejs/kit';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '$env/static/private';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 🧠 1. CACHÉ INTELIGENTE EN MEMORIA (Aprende de cada orden exitosa)
const cacheMemoria = new Map<string, any>();

// 🛡️ 2. Motor local inteligente de alta precisión (Respaldo por si falla la red)
function interpretarLocalmente(texto: string, inventario: any[]) {
    const t = texto.toLowerCase();
    
    if (t.includes('cobrar') || t.includes('pagar') || t.includes('total') || t.includes('facturar')) {
        return { items: [], accion: 'cobrar' };
    }
    if (t.includes('limpiar') || t.includes('cancelar') || t.includes('borrar') || t.includes('vaciar')) {
        return { items: [], accion: 'limpiar' };
    }

    const itemsEncontrados: any[] = [];
    let cantidadExtraida = 1;
    const matchNumero = t.match(/(\d+([.,]\d+)?)/);
    
    if (matchNumero) {
        cantidadExtraida = parseFloat(matchNumero[0].replace(',', '.'));
    } else if (t.includes('medio') || t.includes('media')) {
        cantidadExtraida = 0.5;
    } else if (t.includes('dos')) {
        cantidadExtraida = 2;
    } else if (t.includes('tres')) {
        cantidadExtraida = 3;
    } else if (t.includes('cuatro')) {
        cantidadExtraida = 4;
    }

    for (const prod of inventario) {
        const terminos = [prod.nombre.toLowerCase(), ...(prod.sinonimos || [])];
        const coincide = terminos.some(termino => t.includes(termino));

        if (coincide) {
            if (!itemsEncontrados.some(i => i.id === prod.id)) {
                itemsEncontrados.push({ id: prod.id, cantidad: cantidadExtraida });
            }
        }
    }

    return { items: itemsEncontrados, accion: 'ninguna' };
}

// 🔄 3. Función de reintento automático para Gemini
async function generarConReintento(prompt: string, maxIntentos = 3) {
    for (let intento = 1; intento <= maxIntentos; intento++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt,
            });
            return { response, desdeLocal: false };
        } catch (err: any) {
            console.warn(`Intento ${intento} con Gemini fallido:`, err.status || err.message);
            
            if ((err.status === 503 || err.message?.includes('503') || err.message?.includes('demand')) && intento < maxIntentos) {
                const tiempoEspera = Math.pow(2, intento) * 1000;
                await new Promise(resolve => setTimeout(resolve, tiempoEspera));
                continue;
            }
            
            if (intento === maxIntentos) {
                return { response: null, desdeLocal: true };
            }
        }
    }
    return { response: null, desdeLocal: true };
}

export async function POST({ request }: { request: Request }) {
    try {
        const { texto, inventario } = await request.json();

        if (!texto) {
            throw error(400, 'No se proporcionó texto de voz.');
        }

        // Normalizamos la frase para que la caché sea ultra precisa (minúsculas y sin espacios de sobra)
        const textoNormalizado = texto.toLowerCase().trim();

        // ⚡ PASO A: ¿La orden ya está en la caché local? ¡Devuélvela al instante sin gastar tokens!
        if (cacheMemoria.has(textoNormalizado)) {
            console.log(`⚡ [CACHÉ HIT]: Sirviendo "${textoNormalizado}" desde memoria local.`);
            return json(cacheMemoria.get(textoNormalizado));
        }

        let resultadoJson;
        const prompt = `
Eres el asistente estricto de un punto de venta (POS) en un abasto venezolano. 
Tu única tarea es analizar la orden de voz del cajero y devolver un JSON puro.

Inventario disponible (JSON):
${JSON.stringify(inventario)}

Orden del cajero: "${texto}"

Instrucciones obligatorias:
1. Si la orden contiene productos del inventario, devuélvelos con sus IDs y cantidades exactas.
2. Si la orden dice "cobrar", "pagar" o "facturar", pon "accion": "cobrar".
3. Si la orden dice "limpiar", "cancelar" o "borrar", pon "accion": "limpiar".
4. SI LA ORDEN ES UN SALUDO O NO TIENE RELACIÓN, DEBE SER: {"items": [], "accion": "ninguna"}

Responde ÚNICAMENTE con el objeto JSON válido, sin bloques markdown ni texto adicional.
        `;

        const { response, desdeLocal } = await generarConReintento(prompt);

        if (desdeLocal || !response) {
            console.warn('⚠️ API saturada. Usando motor local inteligente...');
            resultadoJson = interpretarLocalmente(texto, inventario);
        } else {
            let respuestaTexto = response.text?.trim() || '{}';
            respuestaTexto = respuestaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
            
            try {
                resultadoJson = JSON.parse(respuestaTexto);
            } catch (e) {
                resultadoJson = interpretarLocalmente(texto, inventario);
            }
        }

        // 🧠 PASO B: Guardar (aprender) el resultado en la caché para la próxima vez
        cacheMemoria.set(textoNormalizado, resultadoJson);
        console.log(`🧠 [APRENDIZAJE]: Orden "${textoNormalizado}" guardada en caché local.`);

        return json(resultadoJson);

    } catch (err: any) {
        console.error('❌ ERROR EN EL SERVIDOR:', err);
        return json({ items: [], accion: 'ninguna' });
    }
}