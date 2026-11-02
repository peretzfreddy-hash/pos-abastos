<script lang="ts">
    import { onMount } from 'svelte';
    import CargarInventarioModal from '../lib/CargarInventarioModal.svelte';

    interface Producto {
        id: string;
        nombre: string;
        precioUsd: number;
        exentoIva: boolean;
        unidad: string; // 'und' o 'kg'
        sinonimos: string[];
        categoria: string;
    }

    interface ItemCarrito extends Producto {
        cantidad: number;
    }

    // Inventario por defecto del abasto
    let inventarioAbasto = $state<Producto[]>([
        { id: '1', nombre: 'Harina P.A.N. 1kg', precioUsd: 1.20, exentoIva: true, unidad: 'und', categoria: 'Granos', sinonimos: ['harina', 'harina pan', 'pan'] },
        { id: '2', nombre: 'Queso Blanco Semi-Duro', precioUsd: 5.50, exentoIva: true, unidad: 'kg', categoria: 'Lácteos', sinonimos: ['queso', 'queso blanco'] },
        { id: '3', nombre: 'Café Molido 250g', precioUsd: 3.80, exentoIva: false, unidad: 'und', categoria: 'Bebidas', sinonimos: ['cafe', 'café'] },
        { id: '4', nombre: 'Refresco 1.5L', precioUsd: 2.00, exentoIva: false, unidad: 'und', categoria: 'Bebidas', sinonimos: ['refresco', 'gaseosa'] },
        { id: '5', nombre: 'Aceite de Maíz 1L', precioUsd: 3.50, exentoIva: false, unidad: 'und', categoria: 'Víveres', sinonimos: ['aceite'] },
        { id: '6', nombre: 'Arroz Blanco 1kg', precioUsd: 1.30, exentoIva: true, unidad: 'und', categoria: 'Granos', sinonimos: ['arroz'] },
        { id: '7', nombre: 'Azúcar Refinada 1kg', precioUsd: 1.40, exentoIva: true, unidad: 'und', sinonimos: ['azucar', 'azúcar'] },
        { id: '8', nombre: 'Malta 350ml', precioUsd: 0.80, exentoIva: false, unidad: 'und', categoria: 'Bebidas', sinonimos: ['malta'] }
       
    ]);

    // Estados reactivos
    let carrito = $state<ItemCarrito[]>([]);
    let tasaBcv = $state<number>(36.50);
    let aplicaIgtf = $state<boolean>(false);
    let escuchando = $state<boolean>(false);
    let ultimaOrden = $state<string>("Haz clic en el micrófono o presiona un producto del catálogo...");
    let modalAbierto = $state(false);
    let recognition: any = null;

    onMount(() => {
        // Cargar inventario guardado en localStorage si existe
        const guardado = localStorage.getItem('abasto_inventario');
        if (guardado) {
            try {
                inventarioAbasto = JSON.parse(guardado);
            } catch (e) {
                console.error(e);
            }
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.lang = 'es-VE';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => { escuchando = true; };
            recognition.onresult = (event: any) => {
                const texto = event.results[0][0].transcript.toLowerCase();
                ultimaOrden = `"${texto}"`;
                interpretarComandoLocal(texto);
            };
            recognition.onerror = () => { escuchando = false; };
            recognition.onend = () => { escuchando = false; };
        }
    });

    function toggleEscucha() {
        if (!recognition) {
            alert('El reconocimiento de voz requiere Google Chrome.');
            return;
        }
        if (escuchando) recognition.stop();
        else recognition.start();
    }

    function interpretarComandoLocal(texto: string) {
        if (texto.includes("cobrar") || texto.includes("pagar")) {
            procesarCobro();
            return;
        }
        if (texto.includes("limpiar") || texto.includes("vaciar") || texto.includes("cancelar")) {
            carrito = [];
            return;
        }

        let cantidad = 1;
        if (texto.includes("medio") || texto.includes("media")) cantidad = 0.5;
        else if (texto.includes("cuarto")) cantidad = 0.25;
        else if (texto.includes("dos") || texto.includes("2")) cantidad = 2;
        else if (texto.includes("tres") || texto.includes("3")) cantidad = 3;
        else if (texto.includes("cuatro") || texto.includes("4")) cantidad = 4;
        else if (texto.includes("cinco") || texto.includes("5")) cantidad = 5;

        let productoEncontrado: Producto | undefined = undefined;
        for (const p of inventarioAbasto) {
            if (p.sinonimos.some(s => texto.includes(s))) {
                productoEncontrado = p;
                break;
            }
        }

        if (productoEncontrado) {
            agregarAlCarrito(productoEncontrado, cantidad);
        } else {
            alert(`No se reconoció el producto en: "${texto}".`);
        }
    }

    function agregarAlCarrito(producto: Producto, cantidad: number) {
        const index = carrito.findIndex(i => i.id === producto.id);
        if (index > -1) {
            carrito[index].cantidad += cantidad;
            carrito = [...carrito];
        } else {
            carrito = [...carrito, { ...producto, cantidad }];
        }
    }

    function cambiarCantidad(index: number, delta: number) {
        carrito[index].cantidad += delta;
        if (carrito[index].cantidad <= 0) {
            carrito.splice(index, 1);
        }
        carrito = [...carrito];
    }

    function eliminarItem(index: number) {
        carrito.splice(index, 1);
        carrito = [...carrito];
    }

    function procesarCobro() {
        if (carrito.length === 0) return alert('El ticket está vacío.');
        alert(`¡Factura generada con éxito (SENIAT)!\nTotal a pagar: $${totalFinalUsd.toFixed(2)} USD / Bs. ${totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`);
        carrito = [];
    }

    function actualizarInventario(nuevosProductos: Producto[]) {
        inventarioAbasto = nuevosProductos;
        localStorage.setItem('abasto_inventario', JSON.stringify(nuevosProductos));
        alert(`¡Éxito! Se cargaron ${nuevosProductos.length} productos al sistema.`);
    }

    // Cálculos Fiscales Reactivos
    let subtotalUsd = $derived(carrito.reduce((acc, item) => acc + (item.precioUsd * item.cantidad), 0));
    let baseImponibleUsd = $derived(carrito.filter(i => !i.exentoIva).reduce((acc, item) => acc + (item.precioUsd * item.cantidad), 0));
    let ivaUsd = $derived(baseImponibleUsd * 0.16);
    let igtfUsd = $derived(aplicaIgtf ? (subtotalUsd + ivaUsd) * 0.03 : 0);
    let totalFinalUsd = $derived(subtotalUsd + ivaUsd + igtfUsd);
    let totalVes = $derived(totalFinalUsd * tasaBcv);
</script>

<div class="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-6 flex flex-col">
    <!-- Header -->
    <header class="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-800 gap-4">
        <div>
            <h1 class="text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                <span class="bg-blue-600 text-white px-2 py-0.5 rounded-lg text-lg">Abasto</span>Voice <span class="text-blue-400 text-xs font-normal border border-blue-500/30 px-2 py-0.5 rounded-full">POS v1.1</span>
            </h1>
            <p class="text-xs text-slate-400">Automatización de ventas y control fiscal (SENIAT / BCV)</p>
        </div>
        
        <div class="flex flex-wrap items-center gap-3">
            <!-- Botón de Excel -->
            <button onclick={() => modalAbierto = true} class="bg-slate-800 hover:bg-slate-700 text-blue-400 font-semibold text-xs px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 transition shadow-sm">
                📊 Cargar Excel
            </button>

            <div class="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl shadow-inner">
                <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-400 font-medium">Tasa BCV ($):</span>
                    <input type="number" bind:value={tasaBcv} step="0.1" class="bg-slate-950 text-blue-400 font-bold w-20 px-2 py-1 rounded-xl border border-slate-700 text-center text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div class="h-4 w-px bg-slate-800 hidden md:block"></div>
                <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                    <input type="checkbox" bind:checked={aplicaIgtf} class="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 w-4 h-4" />
                    <span>Aplicar IGTF (3%)</span>
                </label>
            </div>
        </div>
    </header>

    <!-- Main Layout -->
    <main class="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 flex-1">
        
        <!-- Columna Izquierda: Voz + Catálogo Rápido -->
        <div class="lg:col-span-7 flex flex-col space-y-6">
            
            <!-- Widget de Voz -->
            <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-xl backdrop-blur-md relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none"></div>
                
                <button onclick={toggleEscucha} class="w-24 h-24 rounded-full flex items-center justify-center text-3xl shadow-2xl transition-all duration-300 relative z-10 {escuchando ? 'bg-rose-600 shadow-rose-500/50 animate-pulse scale-105' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30 hover:scale-105'}">
                    <span class="fa-solid {escuchando ? 'fa-stop' : 'fa-microphone'}"></span>
                </button>

                <p class="mt-4 text-sm font-semibold text-slate-200">
                    {escuchando ? 'Escuchando orden... Habla claro' : 'Toca el micrófono para dictar'}
                </p>
                <p class="text-[11px] text-slate-400 mt-0.5">Ej: "Dos harinas pan", "Medio kilo de queso", "Cobrar"</p>

                <div class="mt-5 w-full bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 text-left shadow-inner">
                    <span class="text-[10px] uppercase font-bold text-blue-400 tracking-wider block mb-1">Última orden procesada:</span>
                    <p class="text-xs italic text-slate-300">{ultimaOrden}</p>
                </div>
            </div>

            <!-- Catálogo Rápido Táctil -->
            <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex-1">
                <h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider flex items-center justify-between">
                    <span>Catálogo Rápido (Táctil)</span>
                    <span class="text-[10px] text-slate-500">{inventarioAbasto.length} productos disponibles</span>
                </h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                    {#each inventarioAbasto as prod}
                        <button onclick={() => agregarAlCarrito(prod, 1)} class="bg-slate-950 hover:bg-slate-800/80 border border-slate-800/80 hover:border-blue-500/50 p-3 rounded-2xl text-left transition-all duration-200 flex flex-col justify-between group shadow-sm">
                            <span class="text-xs font-bold text-slate-200 group-hover:text-blue-400 line-clamp-1">{prod.nombre}</span>
                            <div class="flex justify-between items-center mt-2">
                                <span class="text-xs font-black text-emerald-400">${prod.precioUsd.toFixed(2)}</span>
                                <span class="text-[10px] bg-slate-900 px-2 py-0.5 rounded-md text-slate-400 border border-slate-800">{prod.unidad}</span>
                            </div>
                        </button>
                    {/each}
                </div>
            </div>
        </div>

        <!-- Columna Derecha: Ticket y Facturación -->
        <div class="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
            <div>
                <div class="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                    <h2 class="font-bold text-sm uppercase tracking-wider text-slate-200">Ticket de Venta</h2>
                    <span class="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-medium">{carrito.length} ítems</span>
                </div>

                <!-- Lista de Ítems en Carrito -->
                <div class="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {#if carrito.length === 0}
                        <div class="text-center py-16 text-slate-500">
                            <span class="text-3xl block mb-2 opacity-40">🛒</span>
                            <p class="text-xs">El ticket está vacío. Agrega productos por voz o tocando el catálogo.</p>
                        </div>
                    {:else}
                        {#each carrito as item, index}
                            <div class="flex justify-between items-center bg-slate-950 p-3 rounded-2xl text-xs border border-slate-800/80 shadow-sm">
                                <div class="flex-1 pr-2">
                                    <p class="font-bold text-slate-200">{item.nombre}</p>
                                    <p class="text-slate-400">${item.precioUsd.toFixed(2)} c/u {item.exentoIva ? '(Exento)' : ''}</p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class="flex items-center bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                                        <button onclick={() => cambiarCantidad(index, -0.5)} class="px-2 py-1 text-slate-400 hover:bg-slate-800 transition">-</button>
                                        <span class="px-2 font-bold text-slate-200 text-xs">{item.cantidad}</span>
                                        <button onclick={() => cambiarCantidad(index, 0.5)} class="px-2 py-1 text-slate-400 hover:bg-slate-800 transition">+</button>
                                    </div>
                                    <span class="font-black text-emerald-400 w-14 text-right">${(item.precioUsd * item.cantidad).toFixed(2)}</span>
                                    <button onclick={() => eliminarItem(index)} class="text-slate-600 hover:text-rose-400 p-1">✕</button>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>

            <!-- Panel de Totales y Cierre Fiscal -->
            <div class="border-t border-slate-800 pt-4 space-y-2">
                <div class="flex justify-between text-xs text-slate-400">
                    <span>Subtotal:</span>
                    <span>${subtotalUsd.toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-xs text-slate-400">
                    <span>IVA (16% Base Imponible):</span>
                    <span>${ivaUsd.toFixed(2)}</span>
                </div>
                {#if aplicaIgtf}
                <div class="flex justify-between text-xs text-amber-400/90 font-medium">
                    <span>IGTF (3% Divisas):</span>
                    <span>${igtfUsd.toFixed(2)}</span>
                </div>
                {/if}
                <div class="flex justify-between text-base font-black text-emerald-400 pt-2 border-t border-slate-800">
                    <span>Total USD:</span>
                    <span>${totalFinalUsd.toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-xs font-bold text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span>Total Bolívares (BCV):</span>
                    <span class="text-blue-400">Bs. {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <!-- Botones de Acción -->
                <div class="grid grid-cols-2 gap-2 pt-2">
                    <button onclick={() => carrito = []} class="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-2xl transition text-xs border border-slate-700/50">
                        Limpiar Ticket
                    </button>
                    <button onclick={procesarCobro} class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl transition text-xs shadow-lg shadow-emerald-600/20">
                        Procesar Venta
                    </button>
                </div>
            </div>
        </div>
    </main>
</div>

<!-- Modal para Cargar Inventario Excel -->
<CargarInventarioModal bind:abierto={modalAbierto} {actualizarInventario} />