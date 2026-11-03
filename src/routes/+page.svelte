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

    // Inventario base
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
    let ultimaOrden = 'Toca el micrófono o escanea un producto...';
    let escuchando = false;

    // Navegación de Pestañas ('pos' o 'fiados')
    let pestañaActiva: 'pos' | 'fiados' = 'pos';

    // Lista de Cuentas Fiadas (Idealmente se guardaría en Base de Datos, aquí en memoria reactiva)
    let listaFiados: Fiado[] = [
        {
            id: 'f1',
            cliente: 'Don Julio (Vecino)',
            telefono: '0414-6123456',
            items: [{ producto: inventario[0], cantidad: 2 }],
            totalUSD: 2.40,
            fecha: new Date().toLocaleDateString(),
            tasaAplicada: 36.50
        }
    ];

    let nombreClienteFiado = '';
    let telefonoClienteFiado = '';

    // Totales reactivos del carrito actual
    $: subtotalUSD = carrito.reduce((acc, item) => acc + (item.producto.precioUSD * item.cantidad), 0);
    $: totalBCV = subtotalUSD * tasaBCV;
    $: totalEuro = subtotalUSD * tasaEuro;

    async function cargarTasas() {
        try {
            const res = await fetch('/api/tasas');
            const data = await res.json();
            tasaBCV = data.bcv;
            tasaEuro = data.euro;
            ultimaSincronizacion = data.ultimaActualizacion;
        } catch (e) {
            console.error("No se pudieron cargar las tasas automáticas");
        }
    }

    onMount(() => {
        cargarTasas();
        const interval = setInterval(cargarTasas, 30 * 60 * 1000);
        return () => clearInterval(interval);
    });

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
        if (index > -1) {
            carrito[index].cantidad += cantidad;
            carrito = [...carrito];
        } else {
            carrito = [...carrito, { producto, cantidad }];
        }
    }

    function limpiarTicket() {
        carrito = [];
        ultimaOrden = 'Ticket limpiado.';
    }

    function procesarVenta() {
        if (carrito.length === 0) return alert('El ticket está vacío.');
        alert(`¡Venta contado procesada!\nTotal: $${subtotalUSD.toFixed(2)} USD / Bs. ${totalBCV.toFixed(2)}`);
        carrito = [];
        ultimaOrden = 'Venta de contado registrada.';
    }

    // 📒 Registrar la compra actual como "Fiado"
    function enviarAFiados() {
        if (carrito.length === 0) return alert('El ticket está vacío.');
        if (!nombreClienteFiado.trim()) return alert('Por favor, indica el nombre del cliente para el fiao.');

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
        alert(`✅ Compra fiada registrada exitosamente a nombre de: ${nuevoFiado.cliente}`);
        
        // Limpiar
        carrito = [];
        nombreClienteFiado = '';
        telefonoClienteFiado = '';
        pestañaActiva = 'fiados'; // Te lleva directo a la pestaña de fiados para ver el registro
    }

    // 💰 Saldar / Pagar un fiado
    function saldarFiado(id: string) {
        const fiado = listaFiados.find(f => f.id === id);
        if (!fiado) return;

        const totalEnBs = fiado.totalUSD * fiado.tasaAplicada;
        const confirmar = confirm(`¿Confirmar pago de la cuenta de ${fiado.cliente}?\nTotal a cobrar: $${fiado.totalUSD.toFixed(2)} (Bs. ${totalEnBs.toFixed(2)})`);
        
        if (confirmar) {
            listaFiados = listaFiados.filter(f => f.id !== id);
            alert(`🎉 Cuenta de ${fiado.cliente} saldada y cerrada con éxito.`);
        }
    }

    // Reconocimiento de voz
    function iniciarEscuchaVoz() {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return alert('Tu navegador no soporta voz. Usa Google Chrome.');

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-VE';

        recognition.onstart = () => { escuchando = true; ultimaOrden = 'Escuchando orden...'; };
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

            if (data.accion === 'cobrar') procesarVenta();
            else if (data.accion === 'limpiar') limpiarTicket();
            else if (data.items?.length > 0) {
                data.items.forEach((i: { id: string; cantidad: number }) => {
                    const prod = inventario.find(p => p.id === i.id);
                    if (prod) agregarAlCarrito(prod, i.cantidad);
                });
                ultimaOrden = 'Orden de voz aplicada.';
            }
        } catch (e) {
            ultimaOrden = 'Error de comunicación.';
        }
    }
</script>

<div class="p-6 bg-gray-900 text-white min-h-screen font-sans">
    <!-- Barra Superior -->
    <header class="flex flex-col md:flex-row justify-between items-center mb-6 bg-gray-800 p-4 rounded-xl shadow gap-4">
        <div>
            <h1 class="text-xl font-bold flex items-center gap-2">
                Abasto Voice <span class="text-xs bg-blue-600 px-2 py-1 rounded">POS + Fiados</span>
            </h1>
            <p class="text-xs text-gray-400">Actualizado BCV: {ultimaSincronizacion || 'Sincronizando...'}</p>
        </div>

        <!-- Selector de Pestañas -->
        <div class="flex bg-gray-900 p-1 rounded-lg border border-gray-700">
            <button 
                on:click={() => pestañaActiva = 'pos'} 
                class="px-4 py-1.5 rounded-md text-sm font-medium transition {pestañaActiva === 'pos' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}"
            >
                🛒 Punto de Venta
            </button>
            <button 
                on:click={() => pestañaActiva = 'fiados'} 
                class="px-4 py-1.5 rounded-md text-sm font-medium transition relative {pestañaActiva === 'fiados' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'}"
            >
                📒 Cuaderno de Fiados
                {#if listaFiados.length > 0}
                    <span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">
                        {listaFiados.length}
                    </span>
                {/if}
            </button>
        </div>
        
        <!-- Tasas -->
        <div class="flex gap-3 items-center">
            <div class="bg-gray-700 px-3 py-1.5 rounded-lg text-xs">
                BCV: <span class="text-green-400 font-bold">Bs. {tasaBCV}</span>
            </div>
            <div class="bg-gray-700 px-3 py-1.5 rounded-lg text-xs">
                Ref (€): <span class="text-yellow-400 font-bold">Bs. {tasaEuro}</span>
            </div>
        </div>
    </header>

    {#if pestañaActiva === 'pos'}
        <!-- 🛒 VISTA PUNTO DE VENTA -->
        <div class="mb-6">
            <input 
                type="text" 
                bind:value={codigoInput} 
                on:keydown={(e) => e.key === 'Enter' && manejarCodigoBarras()}
                placeholder="🔫 Escanea con la pistola láser o escribe el código de barras..." 
                class="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-blue-500 shadow-inner"
                autofocus
            />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Voz -->
            <div class="lg:col-span-2 bg-gray-800 p-6 rounded-xl flex flex-col items-center justify-center min-h-[300px] shadow">
                <div class="w-full bg-gray-900/50 p-4 rounded-lg mb-6 border border-gray-700/50">
                    <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Estado:</p>
                    <p class="text-sm font-medium text-blue-300">{ultimaOrden}</p>
                </div>

                <button 
                    on:click={iniciarEscuchaVoz}
                    class="relative bg-blue-600 hover:bg-blue-500 p-8 rounded-full shadow-2xl transition transform active:scale-95 flex items-center justify-center {escuchando ? 'animate-pulse bg-red-600' : ''}"
                >
                    <span class="text-3xl">🎤</span>
                </button>
                <p class="mt-4 text-sm text-gray-400">Toca para dictar ("dos harinas pan", "medio queso")</p>
            </div>

            <!-- Ticket y Fiao -->
            <div class="bg-gray-800 p-6 rounded-xl flex flex-col justify-between shadow">
                <div>
                    <h2 class="text-lg font-semibold mb-4 border-b border-gray-700 pb-2 flex justify-between items-center">
                        <span>Ticket Actual</span>
                        <span class="text-xs bg-gray-700 px-2 py-0.5 rounded-full">{carrito.length} ítems</span>
                    </h2>

                    {#if carrito.length === 0}
                        <div class="py-8 text-center text-gray-500 text-sm">
                            <p>El ticket está vacío.</p>
                        </div>
                    {:else}
                        <ul class="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                            {#each carrito as item}
                                <li class="flex justify-between items-center text-xs bg-gray-900/40 p-2 rounded-lg border border-gray-700/40">
                                    <span>{item.cantidad}x {item.producto.nombre}</span>
                                    <span class="font-mono font-semibold">${(item.producto.precioUSD * item.cantidad).toFixed(2)}</span>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>

                <!-- Totales y Opciones de Cierre / Fiao -->
                <div class="border-t border-gray-700 pt-4 space-y-3">
                    <div class="flex justify-between text-sm text-gray-400">
                        <span>Subtotal USD:</span>
                        <span>${subtotalUSD.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between font-bold text-green-400 text-base">
                        <span>Total BCV:</span>
                        <span>Bs. {totalBCV.toFixed(2)}</span>
                    </div>

                    <!-- Inputs para Fiado -->
                    <div class="bg-gray-900/60 p-3 rounded-lg border border-gray-700 space-y-2">
                        <p class="text-xs font-semibold text-yellow-400">📝 ¿Enviar al Cuaderno de Fiados?</p>
                        <input type="text" placeholder="Nombre del cliente" bind:value={nombreClienteFiado} class="w-full bg-gray-800 text-xs p-2 rounded border border-gray-700 text-white" />
                        <input type="text" placeholder="Teléfono (opcional)" bind:value={telefonoClienteFiado} class="w-full bg-gray-800 text-xs p-2 rounded border border-gray-700 text-white" />
                        <button on:click={enviarAFiados} class="w-full bg-yellow-600 hover:bg-yellow-500 py-1.5 rounded text-xs font-bold transition text-black">
                            Guardar como Fiao
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2">
                        <button on:click={limpiarTicket} class="bg-gray-700 hover:bg-gray-600 py-2 rounded text-xs font-semibold">
                            Limpiar
                        </button>
                        <button on:click={procesarVenta} class="bg-green-600 hover:bg-green-500 py-2 rounded text-xs font-bold">
                            Cobrar Contado
                        </button>
                    </div>
                </div>
            </div>
        </div>

    {:else}
        <!-- 📒 VISTA CUADERNO DE FIADOS -->
        <div class="bg-gray-800 p-6 rounded-xl shadow">
            <div class="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                <div>
                    <h2 class="text-xl font-bold text-yellow-400">Cuaderno de Fiados (Cuentas por Cobrar)</h2>
                    <p class="text-xs text-gray-400">Control de créditos abiertos en el abasto a la tasa del día de la compra.</p>
                </div>
                <div class="bg-gray-700 px-4 py-2 rounded-lg text-sm font-semibold">
                    Total Fiado Global: <span class="text-yellow-400 font-mono">${listaFiados.reduce((acc, f) => acc + f.totalUSD, 0).toFixed(2)} USD</span>
                </div>
            </div>

            {#if listaFiados.length === 0}
                <div class="py-16 text-center text-gray-500">
                    <p class="text-lg">No hay cuentas fiadas pendientes. ¡Todo al día!</p>
                </div>
            {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {#each listaFiados as fiado}
                        <div class="bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-col justify-between shadow-lg">
                            <div>
                                <div class="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 class="font-bold text-base text-white">{fiado.cliente}</h3>
                                        <p class="text-xs text-gray-400">📞 {fiado.telefono} • 📅 {fiado.fecha}</p>
                                    </div>
                                    <span class="text-[10px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30">Deuda Abierta</span>
                                </div>

                                <div class="my-3 bg-gray-800/60 p-2.5 rounded-lg border border-gray-700/50 max-h-32 overflow-y-auto">
                                    <p class="text-[11px] text-gray-400 mb-1 font-semibold">Detalle de productos:</p>
                                    <ul class="space-y-1">
                                        {#each fiado.items as item}
                                            <li class="text-xs flex justify-between">
                                                <span>{item.cantidad}x {item.producto.nombre}</span>
                                                <span class="font-mono">${(item.producto.precioUSD * item.cantidad).toFixed(2)}</span>
                                            </li>
                                        {/each}
                                    </ul>
                                </div>
                            </div>

                            <div class="border-t border-gray-800 pt-3 mt-2">
                                <div class="flex justify-between items-center mb-1 text-xs">
                                    <span class="text-gray-400">Total USD:</span>
                                    <span class="font-bold font-mono text-white">${fiado.totalUSD.toFixed(2)}</span>
                                </div>
                                <div class="flex justify-between items-center mb-3 text-xs">
                                    <span class="text-gray-400">Equivalente BCV ({fiado.tasaAplicada}):</span>
                                    <span class="font-bold font-mono text-green-400">Bs. {(fiado.totalUSD * fiado.tasaAplicada).toFixed(2)}</span>
                                </div>

                                <button 
                                    on:click={() => saldarFiado(fiado.id)}
                                    class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg text-xs transition shadow"
                                >
                                    Saldar / Pagar Cuenta 💵
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>