// src/routes/api/procesar-orden/+server.ts
import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '$env/static/private';

export async function POST({ request }) {
    try {
        const { texto, inventario } = await request.json();

        // Si no hay API Key configurada, saltamos directo al motor local de respaldo
        if (!GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY no encontrada. Usando motor local de respaldo.");
            return json(procesarLocalmente(texto, inventario));
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
Analiza la orden de voz dictada en una bodega en Venezuela.
Devuelve ÚNICAMENTE un JSON válido (sin formato Markdown, sin \`\`\`json) con esta estructura exacta:

1. Si dice "cobrar", "procesar venta", "listo":
   { "accion": "cobrar" }

2. Si pide fiar (ej. "fiar a Don Julio", "guardar fiao a María"):
   { "accion": "fiar", "cliente": "Nombre Extraído" }

3. Si dice "limpiar", "cancelar", "borrar":
   { "accion": "limpiar" }

4. Si menciona productos del inventario:
   { "accion": "agregar", "items": [{ "id": "ID_PRODUCTO", "cantidad": NUMERO }] }

Inventario disponible:
${JSON.stringify(inventario)}

Texto recibido: "${texto}"
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(responseText);

        return json(data);
    } catch (error) {
        console.error('⚠️ Error en Gemini, activando respaldo local:', error);
        const { texto, inventario } = await request.json();
        return json(procesarLocalmente(texto, inventario));
    }
}

// 🛡️ Motor de respaldo local por si falla la red o la API key
function procesarLocalmente(texto: string, inventario: any[]) {
    const textoLower = texto.toLowerCase();

    if (textoLower.includes('cobrar') || textoLower.includes('procesar')) {
        return { accion: 'cobrar' };
    }
    if (textoLower.includes('limpiar') || textoLower.includes('cancelar')) {
        return { accion: 'limpiar' };
    }
    if (textoLower.includes('fiar a') || textoLower.includes('fiao a')) {
        const cliente = textoLower.split(/fiar a|fiao a/)[1]?.trim() || 'Cliente';
        return { accion: 'fiar', cliente: cliente.charAt(0).toUpperCase() + cliente.slice(1) };
    }

    // Buscar coincidencias sencillas en el inventario
    const itemsEncontrados: { id: string; cantidad: number }[] = [];
    inventario.forEach(prod => {
        const nombreProd = prod.nombre.toLowerCase();
        if (textoLower.includes(nombreProd) || prod.sinonimos?.some((s: string) => textoLower.includes(s))) {
            itemsEncontrados.push({ id: prod.id, cantidad: 1 });
        }
    });

    return { items: itemsEncontrados };
}