<script lang="ts">
    import { onMount } from 'svelte';

    interface Producto {
        id: string;
        codigoBarras: string;
        nombre: string;
        precioUSD: number;
        sinonimos?: string[];
    }

    interface ItemCarrito {
        producto: Producto;
        cantidad: number;
    }

    interface Fiado {
        id: string;
        cliente: string;
        telefono: string;
        items: ItemCarrito[];
        totalUSD: number;
        fecha: string;
        tasaAplicada: number;
    }

    interface VentaHistorial {
        id: string;
        fechaStr: string;
        timestamp: number;
        items: ItemCarrito[];
        totalUSD: number;
        totalBCV: number;
        metodoPago: string;
        referencia?: string;
    }

    let inventario: Producto[] = [
        { id: '1', codigoBarras: '7591012345678', nombre: 'Harina P.A.N. 1kg', precioUSD: 1.20, sinonimos: ['harina', 'harina pan'] },
        { id: '2', codigoBarras: '7592012345678', nombre: 'Queso Blanco Semi-Duro', precioUSD: 5.50, sinonimos: ['queso', 'queso blanco'] },
        { id: '3', codigoBarras: '7593012345678', nombre: 'Café Molido 250g', precioUSD: 3.80, sinonimos: ['cafe', 'cafecito'] },
        { id: '4', codigoBarras: '7594012345678', nombre: 'Refresco 1.5L', precioUSD: 2.00, sinonimos: ['refresco', 'cola'] },
        { id: '5', codigoBarras: '7595012345678', nombre: 'Aceite de Maíz 1L', precioUSD: 3.50, sinonimos: ['aceite'] }
    ];

    let carrito: ItemCarrito[] = [];
    let tasaBCV = 36.50;
    let tasaEuro = 39.80;
    let ultimaSincronizacion = '';
    let codigoInput = '';
    let ultimaOrden = 'Listo para escuchar o escanear...';
    let escuchando = false;
    let pestañaActiva: 'pos' | 'fiados' | 'historial' = 'pos';

    let listaFiados: Fiado[] = [];
    let nombreClienteFiado = '';
    let telefonoClienteFiado = '';

    // Modal de Pago
    let mostrarModalPago = false;
    let metodoPagoSeleccionado: 'efectivo_usd' | 'pago_movil' | 'punto' = 'efectivo_usd';
    let efectivoRecibidoUSD: number = 0;
    let referenciaPagoMovil = '';

    // Historial
    let listaHistorial: VentaHistorial[] = [];
    let filtroDesde = '';
    let filtroHasta = '';

    // Notificación Toast
    let mensajeToast = '';
    let mostrarToast = false;
    let timeoutToast: any;

    function dispararToast(mensaje: string) {
        mensajeToast = mensaje;
        mostrarToast = true;
        clearTimeout(timeoutToast);
        timeoutToast = setTimeout(() => {
            mostrarToast = false;
        }, 2000);
    }

    $: subtotalUSD = carrito.reduce((acc, item) => acc + (item.producto.precioUSD * item.cantidad), 0);
    $: totalBCV = subtotalUSD * tasaBCV;
    $: totalEuro = subtotalUSD * tasaEuro;

    $: vueltoUSD = Math.max(0, efectivoRecibidoUSD - subtotalUSD);
    $: vueltoBCV = vueltoUSD * tasaBCV;

    $: ventasFiltradas = listaHistorial.filter(v => {
        if (!filtroDesde && !filtroHasta) return true;
        const fechaVenta = new Date(v.timestamp).toISOString().split('T')[0];
        if (filtroDesde && fechaVenta < filtroDesde) return false;
        if (filtroHasta && fechaVenta > filtroHasta) return false;
        return true;
    });

    $: totalUSDHistorial = ventasFiltradas.reduce((acc, v) => acc + v.totalUSD, 0);
    $: totalBCVHistorial = ventasFiltradas.reduce((acc, v) => acc + v.totalBCV, 0);

    // 🌌 ANIMACIÓN: ORBE NEBULAR + PENTÁGONO GEOMÉTRICO (Actualizada a unicolor blanco outlines)
    let canvasEl: HTMLCanvasElement;
    
    onMount(() => {
        cargarTasas();
        const interval = setInterval(cargarTasas, 30 * 60 * 1000);

        const guardadoCarrito = localStorage.getItem('abasto_carrito');
        if (guardadoCarrito) { try { carrito = JSON.parse(guardadoCarrito); } catch (e) {} }

        const guardadosFiados = localStorage.getItem('abasto_fiados_v2');
        if (guardadosFiados) { try { listaFiados = JSON.parse(guardadosFiados); } catch (e) {} }

        const guardadoInventario = localStorage.getItem('abasto_inventario');
        if (guardadoInventario) { try { inventario = JSON.parse(guardadoInventario); } catch (e) {} }

        const guardadoHistorial = localStorage.getItem('abasto_historial_ventas');
        if (guardadoHistorial) { try { listaHistorial = JSON.parse(guardadoHistorial); } catch (e) {} }

        if (canvasEl) {
            const ctx = canvasEl.getContext('2d');
            let animationFrameId: number;

            const render = () => {
                if (!ctx) return;
                ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

                const centroX = canvasEl.width / 2;
                const centroY = canvasEl.height / 2;
                const time = Date.now() / 1000;
                const intensity = escuchando ? 1.8 : 1.0;

                // Pentágono de fondo
                const pAngulo = time * (escuchando ? 1.2 : 0.4);
                ctx.save();
                ctx.translate(centroX, centroY);
                ctx.rotate(pAngulo * 0.5);

                const numPoints = 5;
                const pentagonRadius = 82;
                let vertices = [];
                for (let i = 0; i < numPoints; i++) {
                    const angle = (i * 2 * Math.PI) / numPoints;
                    vertices.push({ x: Math.cos(angle) * pentagonRadius, y: Math.sin(angle) * pentagonRadius });
                }

                ctx.strokeStyle = escuchando ? 'rgba(96, 165, 250, 0.45)' : 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                for (let i = 0; i < numPoints; i++) {
                    ctx.moveTo(vertices[i].x, vertices[i].y);
                    ctx.lineTo(vertices[(i + 1) % numPoints].x, vertices[(i + 1) % numPoints].y);
                }
                ctx.stroke();

                ctx.fillStyle = escuchando ? '#60a5fa' : 'rgba(255, 255, 255, 0.4)';
                for (let i = 0; i < numPoints; i++) {
                    ctx.beginPath();
                    ctx.arc(vertices[i].x, vertices[i].y, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();

                // Orbe central
                const particleCount = 350;
                const baseRadius = 58 * (escuchando ? (1 + Math.sin(time * 12) * 0.12) : (1 + Math.sin(time * 3) * 0.03));
                ctx.fillStyle = escuchando ? '#60a5fa' : '#ffffff';
                
                for (let i = 0; i < particleCount; i++) {
                    const phi = Math.acos(-1 + (2 * i) / particleCount);
                    const theta = Math.sqrt(particleCount * Math.PI) * phi + time * (escuchando ? 2.5 : 0.6);
                    const wave = Math.sin(phi * 5 + time * 4) * 10 * intensity;
                    const r = baseRadius + wave;

                    const x = centroX + r * Math.sin(phi) * Math.cos(theta);
                    const y = centroY + r * Math.sin(phi) * Math.sin(theta);
                    const z = r * Math.cos(phi);

                    const alpha = (z + baseRadius) / (baseRadius * 2);
                    ctx.globalAlpha = Math.max(0.1, alpha) * (escuchando ? 0.9 : 0.65);
                    const size = (z > 0 ? 2.2 : 1.2) * (escuchando ? 1.4 : 1.0);

                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }

                animationFrameId = requestAnimationFrame(render);
            };

            render();

            return () => {
                cancelAnimationFrame(animationFrameId);
                clearInterval(interval);
            };
        }
    });

    async function cargarTasas() {
        try {
            const res = await fetch('/api/tasas');
            const data = await res.json();
            tasaBCV = data.bcv;
            tasaEuro = data.euro;
            ultimaSincronizacion = data.ultimaActualizacion;
        } catch (e) {
            console.error("Error al cargar tasas");
        }
    }

    function actualizarCarrito(nuevoCarrito: ItemCarrito[]) {
        carrito = nuevoCarrito;
        localStorage.setItem('abasto_carrito', JSON.stringify(carrito));
    }

    function manejarCargaArchivo(event: any) {
        const archivo = event.target.files[0];
        if (!archivo) return;

        const lector = new FileReader();
        lector.onload = (e: any) => {
            try {
                const contenido = e.target.result;
                const lineas = contenido.split('\n');
                const nuevoInventario: Producto[] = [];

                for (let i = 1; i < lineas.length; i++) {
                    const linea = lineas[i].trim();
                    if (!linea) continue;
                    const columnas = linea.split(',');
                    if (columnas.length >= 3) {
                        nuevoInventario.push({
                            id: String(i),
                            codigoBarras: columnas[0].trim(),
                            nombre: columnas[1].trim(),
                            precioUSD: parseFloat(columnas[2].trim()) || 0.00,
                            sinonimos: [columnas[1].trim().toLowerCase()]
                        });
                    }
                }

                if (nuevoInventario.length > 0) {
                    inventario = nuevoInventario;
                    localStorage.setItem('abasto_inventario', JSON.stringify(inventario));
                    dispararToast(`Inventario actualizado (${inventario.length} productos)`);
                } else {
                    dispararToast('Formato de archivo inválido');
                }
            } catch (err) {
                dispararToast('Error al leer archivo');
            }
        };
        lector.readAsText(archivo);
    }

    function manejarCodigoBarras() {
        const codigoLimpio = codigoInput.trim();
        if (!codigoLimpio) return;
        const encontrado = inventario.find(p => p.codigoBarras === codigoLimpio);
        if (encontrado) {
            agregarAlCarrito(encontrado, 1);
            ultimaOrden = `Escaneado: ${encontrado.nombre}`;
        } else {
            ultimaOrden = `Código no registrado: ${codigoLimpio}`;
        }
        codigoInput = '';
    }

    function agregarAlCarrito(producto: Producto, cantidad: number) {
        const index = carrito.findIndex(item => item.producto.id === producto.id);
        let nuevoCarrito = [...carrito];
        if (index > -1) {
            nuevoCarrito[index].cantidad += cantidad;
        } else {
            nuevoCarrito.push({ producto, cantidad });
        }
        actualizarCarrito(nuevoCarrito);
    }

    function limpiarTicket() {
        actualizarCarrito([]);
        ultimaOrden = 'Ticket limpiado.';
    }

    function abrirModalCobro() {
        if (carrito.length === 0) {
            dispararToast('El ticket está vacío');
            return;
        }
        efectivoRecibidoUSD = subtotalUSD;
        referenciaPagoMovil = '';
        mostrarModalPago = true;
    }

    function confirmarVenta() {
        if (metodoPagoSeleccionado === 'pago_movil' && !referenciaPagoMovil.trim()) {
            dispararToast('Ingresa los últimos dígitos o referencia');
            return;
        }

        const nuevaVenta: VentaHistorial = {
            id: Date.now().toString(),
            fechaStr: new Date().toLocaleString(),
            timestamp: Date.now(),
            items: [...carrito],
            totalUSD: subtotalUSD,
            totalBCV: totalBCV,
            metodoPago: metodoPagoSeleccionado === 'efectivo_usd' ? 'Efectivo USD' : metodoPagoSeleccionado === 'pago_movil' ? 'Pago Móvil' : 'Punto de Venta',
            referencia: referenciaPagoMovil.trim() || undefined
        };

        listaHistorial = [nuevaVenta, ...listaHistorial];
        localStorage.setItem('abasto_historial_ventas', JSON.stringify(listaHistorial));

        mostrarModalPago = false;
        dispararToast(`Venta procesada ($${subtotalUSD.toFixed(2)})`);
        actualizarCarrito([]);
        ultimaOrden = 'Venta registrada con éxito.';
    }

    function enviarAFiados() {
        if (carrito.length === 0) {
            dispararToast('El ticket está vacío');
            return;
        }
        if (!nombreClienteFiado.trim()) {
            dispararToast('Falta el nombre del cliente');
            return;
        }

        const nuevoFiado: Fiado = {
            id: Date.now().toString(),
            cliente: nombreClienteFiado.trim(),
            telefono: telefonoClienteFiado.trim() || 'Sin teléfono',
            items: [...carrito],
            totalUSD: subtotalUSD,
            fecha: new Date().toLocaleDateString(),
            tasaAplicada: tasaBCV
        };

        listaFiados = [nuevoFiado, ...listaFiados];
        localStorage.setItem('abasto_fiados_v2', JSON.stringify(listaFiados));

        dispararToast(`Fiao guardado para ${nuevoFiado.cliente}`);
        actualizarCarrito([]);
        nombreClienteFiado = '';
        telefonoClienteFiado = '';
        pestañaActiva = 'fiados';
    }

    function saldarFiado(id: string) {
        const fiado = listaFiados.find(f => f.id === id);
        if (!fiado) return;

        const totalEnBsActual = fiado.totalUSD * tasaBCV;
        const confirmar = confirm(`¿Saldar la cuenta de ${fiado.cliente}?\nMonto original: $${fiado.totalUSD.toFixed(2)} USD\nTotal a cobrar hoy (BCV ${tasaBCV}): Bs. ${totalEnBsActual.toFixed(2)}`);
        
        if (confirmar) {
            listaFiados = listaFiados.filter(f => f.id !== id);
            localStorage.setItem('abasto_fiados_v2', JSON.stringify(listaFiados));
            dispararToast(`Cuenta de ${fiado.cliente} saldada`);
        }
    }

    function iniciarEscuchaVoz() {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            dispararToast('Navegador no soporta voz');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-VE';

        recognition.onstart = () => { escuchando = true; ultimaOrden = 'Escuchando orden de voz...'; };
        recognition.onresult = async (event: any) => {
            const texto = event.results[0][0].transcript;
            ultimaOrden = `Procesando: "${texto}"...`;
            await enviarOrdenAlServidor(texto);
        };
        recognition.onerror = () => { escuchando = false; ultimaOrden = 'Error en micrófono.'; };
        recognition.onend = () => { escuchando = false; };
        recognition.start();
    }

    async function enviarOrdenAlServidor(texto: string) {
        try {
            const res = await fetch('/api/procesar-orden', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto, inventario })
            });
            const data = await res.json();

            if (data.accion === 'cobrar') {
                abrirModalCobro();
            } else if (data.accion === 'limpiar') {
                limpiarTicket();
            } else if (data.accion === 'fiar') {
                if (data.cliente) nombreClienteFiado = data.cliente;
                enviarAFiados();
            } else if (data.items?.length > 0) {
                data.items.forEach((i: { id: string; cantidad: number }) => {
                    const prod = inventario.find(p => p.id === i.id);
                    if (prod) agregarAlCarrito(prod, i.cantidad);
                });
                ultimaOrden = 'Orden de voz aplicada.';
            } else {
                ultimaOrden = `No se entendió: "${texto}"`;
            }
        } catch (e) {
            ultimaOrden = 'Error de comunicación con IA.';
        }
    }
</script>

<!-- LAYOUT PRINCIPAL ESTILO GOOGLE AI STUDIO (SIDEBAR + WORKSPACE) -->
<div class="flex h-screen bg-[#121212] text-[#e0e0e0] font-sans overflow-hidden selection:bg-blue-500 selection:text-white">
    
    <!-- 🔔 TOAST FLOTANTE MINIMALISTA -->
    {#if mostrarToast}
        <div class="fixed top-6 right-6 z-50 bg-[#1e1e1e] border border-[#333] text-white text-xs font-medium px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 transition-all">
            <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>{mensajeToast}</span>
        </div>
    {/if}

    <!-- 💳 MODAL DE PAGO LIMPIO CON ICONOS OUTLINE -->
    {#if mostrarModalPago}
        <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5">
                <div class="flex justify-between items-center border-b border-[#27272a] pb-3">
                    <h3 class="font-semibold text-sm text-white tracking-wide">Completar Pago</h3>
                    <button on:click={() => mostrarModalPago = false} class="text-zinc-400 hover:text-white text-xs">✕</button>
                </div>

                <div class="bg-[#121212] p-4 rounded-xl border border-[#27272a] text-center space-y-1">
                    <p class="text-[11px] text-zinc-400 uppercase tracking-wider">Total a Pagar</p>
                    <p class="text-2xl font-bold font-mono text-white">${subtotalUSD.toFixed(2)}</p>
                    <p class="text-xs font-mono text-emerald-400">Bs. {totalBCV.toFixed(2)} <span class="text-[10px] text-zinc-500">(BCV: {tasaBCV})</span></p>
                </div>

                <div class="grid grid-cols-3 gap-1.5 bg-[#121212] p-1 rounded-xl border border-[#27272a]">
                    <button 
                        on:click={() => metodoPagoSeleccionado = 'efectivo_usd'}
                        class="py-2 rounded-lg text-[11px] font-medium transition flex flex-col items-center gap-1.5 {metodoPagoSeleccionado === 'efectivo_usd' ? 'bg-[#27272a] text-white shadow' : 'text-zinc-400 hover:text-white'}"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span>Efectivo ($)</span>
                    </button>
                    <button 
                        on:click={() => metodoPagoSeleccionado = 'pago_movil'}
                        class="py-2 rounded-lg text-[11px] font-medium transition flex flex-col items-center gap-1.5 {metodoPagoSeleccionado === 'pago_movil' ? 'bg-[#27272a] text-white shadow' : 'text-zinc-400 hover:text-white'}"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                        <span>Pago Móvil</span>
                    </button>
                    <button 
                        on:click={() => metodoPagoSeleccionado = 'punto'}
                        class="py-2 rounded-lg text-[11px] font-medium transition flex flex-col items-center gap-1.5 {metodoPagoSeleccionado === 'punto' ? 'bg-[#27272a] text-white shadow' : 'text-zinc-400 hover:text-white'}"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                        <span>Punto POS</span>
                    </button>
                </div>

                {#if metodoPagoSeleccionado === 'efectivo_usd'}
                    <div class="space-y-2 bg-[#121212] p-3.5 rounded-xl border border-[#27272a]">
                        <label class="text-[11px] text-zinc-400 block">Efectivo recibido ($):</label>
                        <input type="number" step="0.5" bind:value={efectivoRecibidoUSD} class="w-full bg-[#18181b] border border-[#27272a] p-2.5 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-zinc-500" />
                        <div class="flex justify-between items-center text-xs pt-2 border-t border-[#27272a]">
                            <span class="text-zinc-400">Vuelto:</span>
                            <span class="font-mono font-bold text-amber-400">${vueltoUSD.toFixed(2)} (Bs. {vueltoBCV.toFixed(2)})</span>
                        </div>
                    </div>
                {:else if metodoPagoSeleccionado === 'pago_movil'}
                    <div class="space-y-2 bg-[#121212] p-3.5 rounded-xl border border-[#27272a]">
                        <label class="text-[11px] text-zinc-400 block">Referencia / Últimos 4 dígitos:</label>
                        <input type="text" placeholder="Ej: 4829" bind:value={referenciaPagoMovil} class="w-full bg-[#18181b] border border-[#27272a] p-2.5 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-zinc-500" />
                    </div>
                {:else}
                    <div class="bg-[#121212] p-4 rounded-xl border border-[#27272a] text-center text-xs text-zinc-400">
                        Procesa en el terminal y presiona confirmar al aprobarse.
                    </div>
                {/if}

                <div class="grid grid-cols-2 gap-2 pt-2">
                    <button on:click={() => mostrarModalPago = false} class="bg-[#27272a] hover:bg-[#3f3f46] text-white py-2 rounded-xl text-xs font-medium transition">
                        Cancelar
                    </button>
                    <button on:click={confirmarVenta} class="bg-white hover:bg-zinc-200 text-black py-2 rounded-xl text-xs font-semibold transition">
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- 🧭 SIDEBAR IZQUIERDO CON ICONOS OUTLINE -->
    <aside class="w-64 bg-[#161616] border-r border-[#222] flex flex-col justify-between p-4 select-none shrink-0">
        <div class="space-y-6">
            <!-- Logo / Título -->
            <div class="flex items-center gap-3 px-2 py-1">
                <div class="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]"></div>
                <div>
                    <h1 class="text-xs font-semibold tracking-wider text-white uppercase">Abasto Voice AI</h1>
                    <p class="text-[10px] text-zinc-500 font-mono">Workspace v2.5</p>
                </div>
            </div>

            <!-- Menú de Navegación -->
            <nav class="space-y-1">
                <p class="text-[10px] uppercase tracking-wider text-zinc-600 px-2 pb-1 font-semibold">Navegación</p>
                <button 
                    on:click={() => pestañaActiva = 'pos'} 
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition {pestañaActiva === 'pos' ? 'bg-[#222] text-white font-medium' : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'}"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                    POS Rápido
                </button>
                <button 
                    on:click={() => pestañaActiva = 'fiados'} 
                    class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition {pestañaActiva === 'fiados' ? 'bg-[#222] text-white font-medium' : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'}"
                >
                    <span class="flex items-center gap-3">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                        Fiados
                    </span>
                    {#if listaFiados.length > 0}
                        <span class="bg-amber-500 text-black text-[9px] px-1.5 py-0.5 rounded-full font-bold">{listaFiados.length}</span>
                    {/if}
                </button>
                <button 
                    on:click={() => pestañaActiva = 'historial'} 
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition {pestañaActiva === 'historial' ? 'bg-[#222] text-white font-medium' : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'}"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2zm0 0h5a2 2 0 002-2v-3a2 2 0 00-2-2h-5m3 2l3 3m0 0l3-3m-3 3V3"></path></svg>
                    Historial de Ventas
                </button>
            </nav>
        </div>

        <!-- Indicador de Tasas -->
        <div class="bg-[#121212] border border-[#222] p-3 rounded-xl space-y-2">
            <div class="flex justify-between items-center text-xs">
                <span class="text-zinc-500 px-1 border-l-2 border-emerald-500">BCV:</span>
                <span class="text-emerald-400 font-mono font-bold">Bs. {tasaBCV}</span>
            </div>
            <div class="flex justify-between items-center text-xs">
                <span class="text-zinc-500 px-1 border-l-2 border-yellow-500">Euro:</span>
                <span class="text-yellow-400 font-mono">Bs. {tasaEuro}</span>
            </div>
            <p class="text-[9px] text-zinc-600 truncate pt-1 border-t border-[#1e1e1e]">Actualizado automáticamente</p>
        </div>
    </aside>

    <!-- 🖥️ ÁREA DE TRABAJO PRINCIPAL -->
    <main class="flex-1 flex flex-col overflow-y-auto">
        
        <!-- Top bar del Workspace -->
        <header class="h-14 border-b border-[#222] bg-[#141414]/50 backdrop-blur-md px-8 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2 text-xs text-zinc-400">
                <span class="capitalize text-white font-medium">{pestañaActiva}</span>
                <span>/</span>
                <span class="text-zinc-500">Punto de Venta Local</span>
            </div>

            <div class="flex items-center gap-3">
                <label class="cursor-pointer bg-[#1e1e1e] hover:bg-[#27272a] border border-[#27272a] text-zinc-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    Cargar Inventario CSV
                    <input type="file" accept=".csv, .txt" on:change={manejarCargaArchivo} class="hidden" />
                </label>
            </div>
        </header>

        <!-- Contenido dinámico -->
        <div class="p-8 max-w-6xl mx-auto w-full space-y-6">
            
            <!-- VISTA POS -->
            <div class="{pestañaActiva === 'pos' ? 'block' : 'hidden'} space-y-6">
                
                <!-- Barra de Escáner -->
                <div>
                    <input 
                        type="text" 
                        bind:value={codigoInput} 
                        on:keydown={(e) => e.key === 'Enter' && manejarCodigoBarras()}
                        placeholder="🔫 Escanear código de barras o pistola láser..." 
                        class="w-full bg-[#18181b] border border-[#27272a] px-4 py-3.5 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 transition shadow-inner placeholder:text-zinc-600"
                        autofocus
                    />
                </div>

                <!-- Grid Principal -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    <!-- PANEL IA / ORBE CON ICONO OUTLINE -->
                    <div class="lg:col-span-2 bg-[#161616] border border-[#222] p-8 rounded-2xl flex flex-col items-center justify-center min-h-[385px] shadow-xl relative overflow-hidden selection:bg-black selection:text-white">
                        <div class="relative mb-4 flex items-center justify-center">
                            <canvas bind:this={canvasEl} width="220" height="220" class="pointer-events-none"></canvas>
                        </div>

                        <div class="w-full bg-[#121212]/80 px-4 py-2.5 rounded-xl mb-6 border border-[#222] text-center max-w-md">
                            <p class="text-xs font-mono text-blue-400 tracking-wide">{ultimaOrden}</p>
                        </div>

                        <button 
                            on:click={iniciarEscuchaVoz}
                            class="group relative flex items-center gap-2.5 bg-white hover:bg-zinc-200 text-black px-6 py-3 rounded-xl shadow-lg transition-all transform active:scale-95 {escuchando ? 'ring-4 ring-blue-500/30' : ''}"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                            <span class="text-xs font-semibold tracking-wide">
                                {escuchando ? 'Escuchando orden...' : 'Dictar Orden de Voz'}
                            </span>
                        </button>
                        <p class="mt-3 text-[11px] text-zinc-500">Ej: "2 harinas pan", "fiar a Don Julio", "cobrar"</p>
                    </div>

                    <!-- TICKET DE VENTA MINIMALISTA CON ICONOS OUTLINE -->
                    <div class="bg-[#161616] border border-[#222] p-6 rounded-2xl flex flex-col justify-between shadow-xl">
                        <div>
                            <div class="flex justify-between items-center mb-4 border-b border-[#222] pb-3">
                                <span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">Ticket Actual</span>
                                <span class="text-[10px] bg-[#222] text-zinc-300 px-2 py-0.5 rounded-md font-mono">{carrito.length} items</span>
                            </div>

                            {#if carrito.length === 0}
                                <div class="py-16 text-center text-zinc-600 text-xs">
                                    <p>El ticket está vacío.<br/>Escanea o usa el dictado por voz.</p>
                                </div>
                            {:else}
                                <ul class="space-y-2 mb-4 max-h-52 overflow-y-auto pr-1">
                                    {#each carrito as item}
                                        <li class="flex justify-between items-center text-xs bg-[#121212] p-2.5 rounded-xl border border-[#222]">
                                            <span class="text-zinc-300">{item.cantidad}x {item.producto.nombre}</span>
                                            <span class="font-mono font-medium text-white">${(item.producto.precioUSD * item.cantidad).toFixed(2)}</span>
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                        </div>

                        <div class="border-t border-[#222] pt-4 space-y-3">
                            <div class="flex justify-between text-xs text-zinc-400">
                                <span>Subtotal:</span>
                                <span class="font-mono text-white">${subtotalUSD.toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between font-bold text-emerald-400 text-sm border-l-2 border-emerald-500 pl-2">
                                <span>Total BCV:</span>
                                <span class="font-mono">Bs. {totalBCV.toFixed(2)}</span>
                            </div>

                            <div class="bg-[#121212] p-3 rounded-xl border border-[#222] space-y-2">
                                <p class="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Cuaderno de Fiados</p>
                                <input type="text" placeholder="Nombre del cliente" bind:value={nombreClienteFiado} class="w-full bg-[#18181b] text-xs p-2 rounded-lg border border-[#27272a] text-white focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600" />
                                <input type="text" placeholder="Teléfono" bind:value={telefonoClienteFiado} class="w-full bg-[#18181b] text-xs p-2 rounded-lg border border-[#27272a] text-white focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600" />
                                <button on:click={enviarAFiados} class="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                                    Guardar Fiao
                                </button>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-2">
                                <button on:click={limpiarTicket} class="bg-[#1e1e1e] hover:bg-[#2a2a2a] text-zinc-300 py-2 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    Limpiar
                                </button>
                                <button on:click={abrirModalCobro} class="bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 selection:bg-black selection:text-white">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                    Cobrar
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- VISTA FIADOS CON ICONOS OUTLINE -->
            <div class="{pestañaActiva === 'fiados' ? 'block' : 'hidden'} space-y-6">
                <div class="bg-[#161616] border border-[#222] p-6 rounded-2xl shadow-xl space-y-6">
                    <div class="flex justify-between items-center border-b border-[#222] pb-4 gap-4">
                        <div>
                            <h2 class="text-sm font-semibold text-amber-400">Cuaderno de Fiados</h2>
                            <p class="text-xs text-zinc-500">Créditos congelados en USD (calculados al BCV del día al pagar).</p>
                        </div>
                        <div class="bg-[#121212] border border-[#222] px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                            <span class="text-zinc-500 px-1 border-l-2 border-amber-500">Total Global USD:</span>
                            <span class="text-amber-400 font-mono font-bold">${listaFiados.reduce((acc, f) => acc + f.totalUSD, 0).toFixed(2)} USD</span>
                        </div>
                    </div>

                    {#if listaFiados.length === 0}
                        <div class="py-16 text-center text-zinc-600 text-xs space-y-2">
                            <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                            <p>No hay cuentas pendientes.</p>
                        </div>
                    {:else}
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 selection:bg-blue-500 selection:text-white">
                            {#each listaFiados as fiado}
                                <div class="bg-[#121212] border border-[#222] rounded-2xl p-4 flex flex-col justify-between shadow-md">
                                    <div>
                                        <div class="flex justify-between items-start mb-2 gap-2">
                                            <div>
                                                <h3 class="font-semibold text-xs text-white">{fiado.cliente}</h3>
                                                <p class="text-[10px] text-zinc-500">{fiado.telefono} • {fiado.fecha}</p>
                                            </div>
                                            <span class="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20 font-mono uppercase tracking-wider">USD Congelado</span>
                                        </div>

                                        <div class="my-3 bg-[#161616] p-2.5 rounded-xl border border-[#222] max-h-28 overflow-y-auto pr-1">
                                            <ul class="space-y-1">
                                                {#each fiado.items as item}
                                                    <li class="text-xs flex justify-between text-zinc-300">
                                                        <span>{item.cantidad}x {item.producto.nombre}</span>
                                                        <span class="font-mono text-zinc-500">${(item.producto.precioUSD * item.cantidad).toFixed(2)}</span>
                                                    </li>
                                                {/each}
                                            </ul>
                                        </div>
                                    </div>

                                    <div class="border-t border-[#222] pt-3 mt-2 space-y-2">
                                        <div class="flex justify-between items-center text-xs">
                                            <span class="text-zinc-500 px-1 border-l-2 border-zinc-500">Base USD:</span>
                                            <span class="font-bold font-mono text-white">${fiado.totalUSD.toFixed(2)}</span>
                                        </div>
                                        <div class="flex justify-between items-center text-xs border-t border-[#1a1a1a] pt-1.5">
                                            <span class="text-zinc-500 px-1 border-l-2 border-emerald-500">A pagar hoy:</span>
                                            <span class="font-bold font-mono text-emerald-400 pl-1.5">Bs. {(fiado.totalUSD * tasaBCV).toFixed(2)}</span>
                                        </div>

                                        <button 
                                            on:click={() => saldarFiado(fiado.id)}
                                            class="w-full bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white font-medium py-2 rounded-xl text-xs transition border border-[#27272a] flex items-center justify-center gap-1.5"
                                        >
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                            Saldar Cuenta
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>

            <!-- VISTA HISTORIAL CON ICONOS OUTLINE -->
            <div class="{pestañaActiva === 'historial' ? 'block' : 'hidden'} space-y-6">
                <div class="bg-[#161616] border border-[#222] p-6 rounded-2xl shadow-xl space-y-6">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#222] pb-4">
                        <div>
                            <h2 class="text-sm font-semibold text-emerald-400 pl-1.5 border-l-2 border-emerald-500">Historial y Reporte de Ventas</h2>
                            <p class="text-xs text-zinc-500">Filtrado dinámico por rangos de fecha.</p>
                        </div>

                        <div class="flex flex-wrap items-center gap-2 bg-[#121212] p-1.5 rounded-xl border border-[#222] text-xs">
                            <span class="text-zinc-500 px-1">Desde:</span>
                            <input type="date" bind:value={filtroDesde} class="bg-[#18181b] text-white px-2 py-1 rounded-lg border border-[#27272a] focus:outline-none" />
                            <span class="text-zinc-500 px-1">Hasta:</span>
                            <input type="date" bind:value={filtroHasta} class="bg-[#18181b] text-white px-2 py-1 rounded-lg border border-[#27272a] focus:outline-none" />
                            {#if filtroDesde || filtroHasta}
                                <button on:click={() => { filtroDesde = ''; filtroHasta = ''; }} class="bg-[#27272a] hover:bg-[#3f3f46] px-2.5 py-1 rounded-lg text-zinc-300 flex items-center gap-1.5 transition">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Limpiar
                                </button>
                            {/if}
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="bg-[#121212] border border-[#222] p-4 rounded-xl flex items-center justify-between gap-4 selection:bg-white selection:text-black">
                            <div>
                                <p class="text-[11px] text-zinc-500 uppercase tracking-wider">Total Facturado</p>
                                <p class="text-xl font-bold font-mono text-white mt-0.5">${totalUSDHistorial.toFixed(2)} USD</p>
                            </div>
                            <svg class="w-7 h-7 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <div class="bg-[#121212] border border-[#222] p-4 rounded-xl flex items-center justify-between gap-4">
                            <div>
                                <p class="text-[11px] text-zinc-500 uppercase tracking-wider">Total Bolívares</p>
                                <p class="text-xl font-bold font-mono text-emerald-400 mt-0.5 border-l-2 border-emerald-500 pl-1.5">Bs. {totalBCVHistorial.toFixed(2)}</p>
                            </div>
                            <svg class="w-7 h-7 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 11-4 0 2 2 0 014 0z"></path></svg>
                        </div>
                    </div>

                    {#if ventasFiltradas.length === 0}
                        <div class="py-16 text-center text-zinc-600 text-xs space-y-2">
                             <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2zm0 0h5a2 2 0 002-2v-3a2 2 0 00-2-2h-5m3 2l3 3m0 0l3-3m-3 3V3"></path></svg>
                            <p>No hay registros de ventas en este rango.</p>
                        </div>
                    {:else}
                        <div class="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                            {#each ventasFiltradas as venta}
                                <div class="bg-[#121212] border border-[#222] p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div class="flex items-center gap-2 mb-1 selection:bg-blue-500 selection:text-white">
                                            <span class="text-xs font-mono font-medium text-emerald-400">#{venta.id.slice(-6)}</span>
                                            <span class="text-[11px] text-zinc-500">{venta.fechaStr}</span>
                                            <span class="text-[10px] bg-[#222] text-zinc-300 px-2 py-0.5 rounded-md border border-[#27272a]">{venta.metodoPago}</span>
                                        </div>
                                        <p class="text-xs text-zinc-300 pr-4">
                                            {#each venta.items as it, idx}
                                                {it.cantidad}x {it.producto.nombre}{idx < venta.items.length - 1 ? ', ' : ''}
                                            {/each}
                                        </p>
                                    </div>
                                    <div class="text-right selection:bg-blue-500 selection:text-white">
                                        <p class="font-bold font-mono text-xs text-white">${venta.totalUSD.toFixed(2)}</p>
                                        <p class="text-[11px] font-mono text-emerald-400 pl-1 border-l border-emerald-500">Bs. {venta.totalBCV.toFixed(2)}</p>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>

        </div>
    </main>
</div>