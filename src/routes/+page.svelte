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
    let pestañaActiva: 'pos' | 'fiados' = 'pos';

    let listaFiados: Fiado[] = [];
    let nombreClienteFiado = '';
    let telefonoClienteFiado = '';

    // 🔔 Estado para la notificación flotante (Toast)
    let mensajeToast = '';
    let mostrarToast = false;
    let timeoutToast: any;

    function dispararToast(mensaje: string) {
        mensajeToast = mensaje;
        mostrarToast = true;
        clearTimeout(timeoutToast);
        timeoutToast = setTimeout(() => {
            mostrarToast = false;
        }, 2000); // Se oculta solo a los 2 segundos
    }

    $: subtotalUSD = carrito.reduce((acc, item) => acc + (item.producto.precioUSD * item.cantidad), 0);
    $: totalBCV = subtotalUSD * tasaBCV;
    $: totalEuro = subtotalUSD * tasaEuro;

    // 🌸 ANIMACIÓN GEOMÉTRICA (Flor de la Vida sin cortes en canvas 200x200)
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

        if (canvasEl) {
            const ctx = canvasEl.getContext('2d');
            let animationFrameId: number;
            let angulo = 0;

            const render = () => {
                if (!ctx) return;
                ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

                const centroX = canvasEl.width / 2;
                const centroY = canvasEl.height / 2;
                const radioCirculo = 22;

                const pulsoEscala = escuchando 
                    ? (1 + Math.sin(Date.now() / 150) * 0.15)
                    : (1 + Math.sin(Date.now() / 600) * 0.04);

                const opacidad = escuchando 
                    ? (Math.sin(Date.now() / 200) * 0.35 + 0.65)
                    : (Math.sin(Date.now() / 800) * 0.2 + 0.75);

                const velocidadGiro = escuchando ? 0.02 : 0.004;
                angulo += velocidadGiro;

                ctx.save();
                ctx.translate(centroX, centroY);
                ctx.rotate(angulo);
                ctx.scale(pulsoEscala, pulsoEscala);
                ctx.globalAlpha = opacidad;

                ctx.strokeStyle = escuchando ? '#60a5fa' : '#ffffff';
                ctx.lineWidth = 1.5;

                const dibujarCirculo = (x: number, y: number) => {
                    ctx.beginPath();
                    ctx.arc(x, y, radioCirculo, 0, 2 * Math.PI);
                    ctx.stroke();
                };

                dibujarCirculo(0, 0);

                for (let i = 0; i < 6; i++) {
                    const a = (i * 2 * Math.PI) / 6;
                    const x = radioCirculo * Math.cos(a);
                    const y = radioCirculo * Math.sin(a);
                    dibujarCirculo(x, y);
                }

                for (let i = 0; i < 6; i++) {
                    const a = (i * 2 * Math.PI) / 6;
                    const x = (radioCirculo * 2) * Math.cos(a);
                    const y = (radioCirculo * 2) * Math.sin(a);
                    dibujarCirculo(x, y);
                }

                ctx.restore();
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
                    dispararToast(`📁 Inventario actualizado (${inventario.length} productos)`);
                } else {
                    dispararToast('⚠️ Formato de archivo inválido');
                }
            } catch (err) {
                dispararToast('❌ Error al leer archivo');
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
            ultimaOrden = `⚠️ Código no registrado: ${codigoLimpio}`;
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

    function procesarVenta() {
        if (carrito.length === 0) {
            dispararToast('⚠️ El ticket está vacío');
            return;
        }
        dispararToast(`✅ Venta procesada ($${subtotalUSD.toFixed(2)})`);
        actualizarCarrito([]);
    }

    function enviarAFiados() {
        if (carrito.length === 0) {
            dispararToast('⚠️ El ticket está vacío');
            return;
        }
        if (!nombreClienteFiado.trim()) {
            dispararToast('⚠️ Falta el nombre del cliente');
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

        dispararToast(`📝 Fiao guardado para ${nuevoFiado.cliente}!`);
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
            dispararToast(`🎉 Cuenta de ${fiado.cliente} saldada`);
        }
    }

    function iniciarEscuchaVoz() {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            dispararToast('⚠️ Navegador no soporta voz');
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
                procesarVenta();
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
                ultimaOrden = `⚠️ No se entendió: "${texto}"`;
            }
        } catch (e) {
            ultimaOrden = 'Error de comunicación con IA.';
        }
    }
</script>

<div class="p-6 bg-gray-950 text-white min-h-screen font-sans relative">
    
    <!-- 🔔 NOTIFICACIÓN FLOTANTE (TOAST) ESTILO MODERNO -->
    {#if mostrarToast}
        <div class="fixed top-6 right-6 z-50 bg-amber-500 text-black font-bold px-5 py-3 rounded-2xl shadow-2xl border border-amber-300 flex items-center gap-2 transition-all transform animate-bounce">
            <span>✨</span>
            <span class="text-xs tracking-wide">{mensajeToast}</span>
        </div>
    {/if}

    <!-- Barra Superior -->
    <header class="flex flex-col md:flex-row justify-between items-center mb-6 bg-gray-900/80 backdrop-blur p-4 rounded-2xl border border-gray-800 shadow-xl gap-4">
        <div>
            <h1 class="text-xl font-bold flex items-center gap-2">
                Abasto Voice <span class="text-xs bg-blue-600/30 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">AI Core v2</span>
            </h1>
            <p class="text-xs text-gray-400">BCV Sincronizado • {ultimaSincronizacion || 'Conectando...'}</p>
        </div>

        <div class="flex items-center gap-2 bg-gray-800/80 border border-gray-700 px-3 py-1.5 rounded-xl">
            <span class="text-xs text-gray-300">📁 Inventario:</span>
            <label class="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-lg transition shadow">
                Subir CSV/Excel
                <input type="file" accept=".csv, .txt" on:change={manejarCargaArchivo} class="hidden" />
            </label>
        </div>

        <div class="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button 
                on:click={() => pestañaActiva = 'pos'} 
                class="px-4 py-1.5 rounded-lg text-xs font-semibold transition {pestañaActiva === 'pos' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}"
            >
                🛒 POS Rápido
            </button>
            <button 
                on:click={() => pestañaActiva = 'fiados'} 
                class="px-4 py-1.5 rounded-lg text-xs font-semibold transition relative {pestañaActiva === 'fiados' ? 'bg-amber-600 text-white shadow' : 'text-gray-400 hover:text-white'}"
            >
                📒 Fiados
                {#if listaFiados.length > 0}
                    <span class="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                        {listaFiados.length}
                    </span>
                {/if}
            </button>
        </div>
        
        <div class="flex gap-3 items-center">
            <div class="bg-gray-800/60 border border-gray-700/50 px-3 py-1.5 rounded-xl text-xs">
                BCV: <span class="text-green-400 font-bold">Bs. {tasaBCV}</span>
            </div>
            <div class="bg-gray-800/60 border border-gray-700/50 px-3 py-1.5 rounded-xl text-xs">
                Ref (€): <span class="text-yellow-400 font-bold">Bs. {tasaEuro}</span>
            </div>
        </div>
    </header>

    <!-- VISTA POS RÁPIDO -->
    <div class="{pestañaActiva === 'pos' ? 'block' : 'hidden'}">
        <div class="mb-6">
            <input 
                type="text" 
                bind:value={codigoInput} 
                on:keydown={(e) => e.key === 'Enter' && manejarCodigoBarras()}
                placeholder="🔫 Pistola láser o código de barras..." 
                class="w-full bg-gray-900 border border-gray-800 p-3.5 rounded-2xl text-sm text-gray-300 focus:outline-none focus:border-blue-500 shadow-inner"
                autofocus
            />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- PANEL IA CON GEOMETRÍA SAGRADA (FLOR DE LA VIDA) -->
            <div class="lg:col-span-2 bg-gray-900/70 border border-gray-800 p-8 rounded-2xl flex flex-col items-center justify-center min-h-[340px] shadow-xl relative overflow-hidden">
                <div class="relative mb-3 flex items-center justify-center">
                    <canvas bind:this={canvasEl} width="200" height="200" class="pointer-events-none"></canvas>
                </div>

                <div class="w-full bg-gray-950/60 px-4 py-2.5 rounded-xl mb-6 border border-gray-800 text-center max-w-md">
                    <p class="text-xs font-medium text-blue-400 tracking-wide">{ultimaOrden}</p>
                </div>

                <button 
                    on:click={iniciarEscuchaVoz}
                    class="group relative flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-6 py-3.5 rounded-2xl shadow-lg transition-all transform active:scale-95 border border-blue-400/30 {escuchando ? 'ring-4 ring-blue-500/40 animate-pulse' : ''}"
                >
                    <span class="text-xl">🎙️</span>
                    <span class="text-sm font-bold tracking-wide">
                        {escuchando ? 'Escuchando...' : 'Dictar Orden'}
                    </span>
                </button>
                <p class="mt-3 text-[11px] text-gray-500">Ej: "2 harinas pan", "fiar a Don Julio", "cobrar"</p>
            </div>

            <!-- TICKET -->
            <div class="bg-gray-900/70 border border-gray-800 p-6 rounded-2xl flex flex-col justify-between shadow-xl">
                <div>
                    <h2 class="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 border-b border-gray-800 pb-2 flex justify-between items-center">
                        <span>Ticket de Venta</span>
                        <span class="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{carrito.length}</span>
                    </h2>

                    {#if carrito.length === 0}
                        <div class="py-12 text-center text-gray-600 text-xs">
                            <p>Ticket vacío. Escanea o dicta productos.</p>
                        </div>
                    {:else}
                        <ul class="space-y-2.5 mb-4 max-h-44 overflow-y-auto pr-1">
                            {#each carrito as item}
                                <li class="flex justify-between items-center text-xs bg-gray-950/50 p-2.5 rounded-xl border border-gray-800/80">
                                    <span>{item.cantidad}x {item.producto.nombre}</span>
                                    <span class="font-mono font-bold text-gray-300">${(item.producto.precioUSD * item.cantidad).toFixed(2)}</span>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>

                <div class="border-t border-gray-800 pt-4 space-y-3">
                    <div class="flex justify-between text-xs text-gray-400">
                        <span>Subtotal USD:</span>
                        <span class="font-mono">${subtotalUSD.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between font-bold text-green-400 text-base">
                        <span>Total BCV:</span>
                        <span class="font-mono">Bs. {totalBCV.toFixed(2)}</span>
                    </div>

                    <div class="bg-gray-950/80 p-3 rounded-xl border border-gray-800 space-y-2">
                        <p class="text-[11px] font-semibold text-amber-400">📝 Enviar a Cuaderno de Fiados</p>
                        <input type="text" placeholder="Nombre del cliente (o di 'fiar a...')" bind:value={nombreClienteFiado} class="w-full bg-gray-900 text-xs p-2 rounded-lg border border-gray-800 text-white focus:outline-none focus:border-amber-500" />
                        <input type="text" placeholder="Teléfono" bind:value={telefonoClienteFiado} class="w-full bg-gray-900 text-xs p-2 rounded-lg border border-gray-800 text-white focus:outline-none focus:border-amber-500" />
                        <button on:click={enviarAFiados} class="w-full bg-amber-600 hover:bg-amber-500 py-1.5 rounded-lg text-xs font-bold transition text-black">
                            Guardar Fiao
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2">
                        <button on:click={limpiarTicket} class="bg-gray-800 hover:bg-gray-700 py-2 rounded-xl text-xs font-semibold transition">
                            Limpiar
                        </button>
                        <button on:click={procesarVenta} class="bg-green-600 hover:bg-green-500 py-2 rounded-xl text-xs font-bold transition">
                            Cobrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- VISTA FIADOS -->
    <div class="{pestañaActiva === 'fiados' ? 'block' : 'hidden'}">
        <div class="bg-gray-900/70 border border-gray-800 p-6 rounded-2xl shadow-xl">
            <div class="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                <div>
                    <h2 class="text-lg font-bold text-amber-400">Cuaderno de Fiados</h2>
                    <p class="text-xs text-gray-400">Control de créditos congelados en USD (se calculan al valor del BCV actual al pagar).</p>
                </div>
                <div class="bg-gray-800/80 border border-gray-700 px-4 py-2 rounded-xl text-xs font-semibold">
                    Total Fiado Global: <span class="text-amber-400 font-mono">${listaFiados.reduce((acc, f) => acc + f.totalUSD, 0).toFixed(2)} USD</span>
                </div>
            </div>

            {#if listaFiados.length === 0}
                <div class="py-16 text-center text-gray-600 text-sm">
                    <p>No hay cuentas pendientes.</p>
                </div>
            {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {#each listaFiados as fiado}
                        <div class="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col justify-between shadow-md">
                            <div>
                                <div class="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 class="font-bold text-sm text-white">{fiado.cliente}</h3>
                                        <p class="text-[11px] text-gray-500">📞 {fiado.telefono} • 📅 {fiado.fecha}</p>
                                    </div>
                                    <span class="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium">USD Congelado</span>
                                </div>

                                <div class="my-3 bg-gray-900/50 p-2.5 rounded-xl border border-gray-800 max-h-28 overflow-y-auto">
                                    <ul class="space-y-1">
                                        {#each fiado.items as item}
                                            <li class="text-xs flex justify-between text-gray-300">
                                                <span>{item.cantidad}x {item.producto.nombre}</span>
                                                <span class="font-mono text-gray-400">${(item.producto.precioUSD * item.cantidad).toFixed(2)}</span>
                                            </li>
                                        {/each}
                                    </ul>
                                </div>
                            </div>

                            <div class="border-t border-gray-900 pt-3 mt-2">
                                <div class="flex justify-between items-center mb-1 text-xs">
                                    <span class="text-gray-500">Deuda Base USD:</span>
                                    <span class="font-bold font-mono text-white">${fiado.totalUSD.toFixed(2)}</span>
                                </div>
                                <div class="flex justify-between items-center mb-3 text-xs">
                                    <span class="text-gray-500">A pagar hoy (BCV {tasaBCV}):</span>
                                    <span class="font-bold font-mono text-green-400">Bs. {(fiado.totalUSD * tasaBCV).toFixed(2)}</span>
                                </div>

                                <button 
                                    on:click={() => saldarFiado(fiado.id)}
                                    class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-xl text-xs transition shadow"
                                >
                                    Saldar Cuenta 💵
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>