// src/routes/api/procesar-orden/+server.ts
import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '$env/static/private';

export async function POST({ request }) {
    let body;
    try {
        // 1. Leemos el body UNA sola vez al inicio de forma segura
        body = await request.json();
    } catch (e) {
        return json({ error: 'Solicitud inválida' }, { status: 400 });
    }

    const { texto, inventario } = body;

    try {
        // Si no hay API Key configurada, usamos el motor local inteligente
        if (!GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY no encontrada. Usando motor local inteligente.");
            return json(procesarLocalmente(texto, inventario));
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
Eres el asistente de un POS inteligente para un abasto en Venezuela. Analiza la orden de voz dictada de forma natural por el cajero.
El texto puede incluir sinónimos, cantidades en palabras o números (ej: "dos harinas", "un kilo de azúcar"), y modismos venezolanos.

Devuelve ÚNICAMENTE un JSON válido (sin formato Markdown, sin \`\`\`json) con esta estructura exacta:

1. Si dice algo referente a cobrar, pagar o terminar (ej: "cobrar", "procesar venta", "listo"):
   { "accion": "cobrar" }

2. Si pide fiar o anotar (ej: "fiar a Don Julio", "anotar a María"):
   { "accion": "fiar", "cliente": "Nombre Extraído" }

3. Si dice limpiar o cancelar (ej: "limpiar", "cancelar", "borrar"):
   { "accion": "limpiar" }

4. Si menciona productos, busca el producto que mejor coincida en el inventario y extrae su ID y la cantidad numérica (por defecto 1 si no se especifica):
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
        console.error('⚠️ Error en Gemini, activando respaldo local inteligente:', error);
        // Usamos las variables que ya leímos al principio (sin reintentar request.json)
        return json(procesarLocalmente(texto, inventario));
    }
}

// 🛡️ Motor de respaldo local inteligente y flexible
function procesarLocalmente(texto: string, inventario: any[]) {
    const textoLower = texto.toLowerCase();

    if (textoLower.includes('cobrar') || textoLower.includes('pagar') || textoLower.includes('cuenta')) {
        return { accion: 'cobrar' };
    }
    if (textoLower.includes('limpiar') || textoLower.includes('cancelar') || textoLower.includes('borrar')) {
        return { accion: 'limpiar' };
    }
    if (textoLower.includes('fiar a') || textoLower.includes('anotar a') || textoLower.includes('fiao a')) {
        const partes = textoLower.split(/fiar a|anotar a|fiao a/);
        const cliente = partes[1]?.trim() || 'Cliente';
        return { accion: 'fiar', cliente: cliente.charAt(0).toUpperCase() + cliente.slice(1) };
    }

    // Extraer cantidad numérica del texto (ej: "dos", "3", "un")
    let cantidad = 1;
    const matchNumero = textoLower.match(/\b(1|2|3|4|5|6|7|8|9|10|un|una|dos|tres|cuatro|cinco)\b/);
    if (matchNumero) {
        const mapaNumeros: Record<string, number> = {
            'un': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
            'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10
        };
        cantidad = mapaNumeros[matchNumero[1]] || parseInt(matchNumero[1]) || 1;
    }

    // Búsqueda flexible por palabras clave y sinónimos
    const itemsEncontrados: { id: string; cantidad: number }[] = [];
    inventario.forEach(prod => {
        const nombreLower = prod.nombre.toLowerCase();
        const palabrasClave = nombreLower.split(' ').filter(p => p.length > 3);
        
        const coincideNombre = textoLower.includes(nombreLower) || palabrasClave.some(palabra => textoLower.includes(palabra));
        const coincideSinonimo = prod.sinonimos?.some((s: string) => textoLower.includes(s.toLowerCase()));

        if (coincideNombre || coincideSinonimo) {
            itemsEncontrados.push({ id: prod.id, cantidad });
        }
    });

    return { accion: 'agregar', items: itemsEncontrados };
}