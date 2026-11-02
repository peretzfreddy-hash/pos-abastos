<script lang="ts">
    import { onMount } from 'svelte';
    import CargarInventarioModal from '../lib/CargarInventarioModal.svelte';

    interface Producto {
        id: string;
        nombre: string;
        precioUsd: number;
        exentoIva: boolean;
        unidad: string;
        categoria: string;
        sinonimos?: string[];
    }

    interface ItemCarrito {
        producto: Producto;
        cantidad: number;
    }

    // Estado reactivo con Svelte 5 ($state)
    let inventarioAbasto = $state<Producto[]>([
        { id: '1', nombre: 'Harina P.A.N. 1kg', precioUsd: 1.20, exentoIva: true, unidad: 'und', categoria: 'Granos', sinonimos: ['harina', 'harina pan', 'pan'] },
        { id: '2', nombre: 'Queso Blanco Semi-Duro', precioUsd: 5.50, exentoIva: false, unidad: 'kg', categoria: 'Lácteos', sinonimos: ['queso', 'queso blanco'] },
        { id: '3', nombre: 'Café Molido 250g', precioUsd: 3.80, exentoIva: false, unidad: 'und', categoria: 'Bebidas', sinonimos: ['cafe', 'cafecito'] },
        { id: '4', nombre: 'Refresco 1.5L', precioUsd: 2.00, exentoIva: false, unidad: 'und', categoria: 'Bebidas', sinonimos: ['refresco', 'cola', 'soda'] },
        { id: '5', nombre: 'Aceite de Maíz 1L', precioUsd: 3.50, exentoIva: false, unidad: 'und', categoria: 'Viveres', sinonimos: ['aceite'] },
        { id: '6', nombre: 'Arroz Blanco 1kg', precioUsd: 1.30, exentoIva: true, unidad: 'und', categoria: 'Granos', sinonimos: ['arroz'] },
        { id: '7', nombre: 'Azúcar Refinada 1kg', precioUsd: 1.40, exentoIva: true, unidad: 'und', categoria: 'Viveres', sinonimos: ['azucar'] },
        { id: '8', nombre: 'Malta 350ml', precioUsd: 0.80, exentoIva: false, unidad: 'und', categoria: 'Bebidas', sinonimos: ['malta', 'maltica'] }
    ]);

    let carrito = $state<ItemCarrito[]>([]);
    let tasaBcv = $state<number>(36.5);
    let aplicarIgtf = $state<boolean>(false);
    let modalAbierto = $state<boolean>(false);

    let escuchando = $state(false);
    let ultimaOrden = $state("Haz clic en el micrófono o presiona un producto del catálogo...");
    let recognition: any = null;

    onMount(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.lang = 'es-VE';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => { 
                escuchando = true; 
                ultimaOrden = "Escuchando... Di algo ahora mismo.";
            };

            recognition.onresult = (event: any) => {
                const texto = event.results[0][0].transcript.toLowerCase();
                ultimaOrden = `"${texto}"`;
                interpretarComandoLocal(texto);
            };

            recognition.onerror = (event: any) => {
                console.error("Error de voz:", event.error);
                ultimaOrden = `⚠️ Error de voz: ${event.error}`;
                escuchando = false;
            };

            recognition.onend = () => { 
                escuchando = false; 
            };
        }
    });

    function alternarEscucha() {
        if (!recognition) {
            alert("Tu navegador no soporta reconocimiento de voz. Usa Google Chrome.");
            return;
        }
        if (escuchando) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (e) {
                console.error(e);
            }
        }
    }

    // Función inteligente que se conecta al endpoint de Gemini
    async function interpretarComandoLocal(texto: string) {
        ultimaOrden = `Procesando con IA: "${texto}"...`;

        try {
            const res = await fetch('/api/procesar-orden', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto, inventario: inventarioAbasto })
            });

            const data = await res.json();

            if (data.error) {
                alert(data.error);
                return;
            }

            if (data.accion === 'cobrar') {
                procesarCobro();
                return;
            }
            if (data.accion === 'limpiar') {
                carrito = [];
                ultimaOrden = 'Ticket limpiado por voz.';
                return;
            }

            if (data.items && data.items.length > 0) {
                for (const itemAi of data.items) {
                    const productoReal = inventarioAbasto.find(p => p.id === itemAi.id);
                    if (productoReal) {
                        agregarAlCarrito(productoReal, itemAi.cantidad);
                    }
                }
                ultimaOrden = `"${texto}" (Procesado con éxito por Gemini)`;
            } else {
                ultimaOrden = `La IA no identificó productos en: "${texto}"`;
            }

        } catch (e) {
            console.error(e);
            ultimaOrden = `Error de conexión con la IA.`;
        }
    }

    function agregarAlCarrito(producto: Producto, cantidad: number = 1) {
        const index = carrito.findIndex(item => item.producto.id === producto.id);
        if (index > -1) {
            carrito[index].cantidad += cantidad;
        } else {
            carrito.push({ producto, cantidad });
        }
    }

    function cambiarCantidad(id: string, delta: number) {
        const index = carrito.findIndex(item => item.producto.id === id);
        if (index > -1) {
            carrito[index].cantidad += delta;
            if (carrito[index].cantidad <= 0) {
                carrito.splice(index, 1);
            }
        }
    }

    function actualizarInventario(nuevoInventario: Producto[]) {
        inventarioAbasto = nuevoInventario;
        ultimaOrden = `Inventario actualizado: ${nuevoInventario.length} productos cargados.`;
    }

    // Cálculos fiscales venezolanos
    let subtotalUsd = $derived(carrito.reduce((acc, item) => acc + (item.producto.precioUsd * item.cantidad), 0));
    
    let baseImponibleUsd = $derived(carrito.reduce((acc, item) => {
        return item.producto.exentoIva ? acc : acc + (item.producto.precioUsd * item.cantidad);
    }, 0));

    let ivaUsd = $derived(baseImponibleUsd * 0.16);
    let igtfUsd = $derived(aplicarIgtf ? (subtotalUsd + ivaUsd) * 0.03 : 0);

    let totalUsd = $derived(subtotalUsd + ivaUsd + igtfUsd);
    let totalBs = $derived(totalUsd * tasaBcv);

    function procesarCobro() {
        if (carrito.length === 0) {
            alert("El ticket está vacío.");
            return;
        }
        alert(`¡Venta procesada con éxito!\nTotal a pagar: $${totalUsd.toFixed(2)} (Bs. ${totalBs.toFixed(2)})`);
        carrito = [];
    }
</script>

<main class="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans flex flex-col gap-4">
    <!-- Header -->
    <header class="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
        <div>
            <div class="flex items-center gap-2">
                <span class="bg-blue-600 text-white font-bold px-2 py-0.5 rounded text-sm">Abasto</span>
                <h1 class="text-xl font-black tracking-wide text-white">Voice <span class="text-xs bg-slate-800 text-blue-400 px-2 py-0.5 rounded-full border border-slate-700">POS v1.1</span></h1>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">Automatización de ventas y control fiscal (SENIAT / BCV)</p>
        </div>

        <div class="flex items-center gap-4">
            <button onclick={() => modalAbierto = true} class="bg-slate-800 hover:bg-slate-700 text-blue-400 font-semibold text-xs px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 transition shadow-sm">
                📊 Cargar Excel
            </button>

            <div class="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                <span class="text-xs text-slate-400 font-medium">Tasa BCV ($):</span>
                <input type="number" step="0.1" bind:value={tasaBcv} class="bg-transparent text-blue-400 font-bold w-16 text-right focus:outline-none" />
            </div>

            <label class="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 cursor-pointer select-none">
                <input type="checkbox" bind:checked={aplicarIgtf} class="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0" />
                <span class="text-xs text-slate-300 font-medium">Aplicar IGTF (3%)</span>
            </label>
        </div>
    </header>

    <!-- Layout Principal -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        
        <!-- Panel Izquierdo: Voz y Catálogo -->
        <div class="lg:col-span-2 flex flex-col gap-4">
            
            <!-- Sección de Voz -->
            <section class="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
                <div class="absolute inset-0 bg-blue-600/5 pointer-events-none"></div>
                
                <button 
                    onclick={alternarEscucha} 
                    class="w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-xl relative {escuchando ? 'bg-red-600 animate-pulse shadow-red-900/50' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/50'}"
                >
                    <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                    </svg>
                </button>

                <h2 class="text-lg font-bold mt-4 text-white">
                    {escuchando ? 'Escuchando orden... Habla claro' : 'Toca el micrófono para dictar'}
                </h2>
                <p class="text-xs text-slate-400 mt-1">Ej: "Dos harinas pan", "Medio kilo de queso", "Cobrar"</p>

                <div class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-4 text-left">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Última orden procesada:</span>
                    <p class="text-sm text-blue-300 font-medium truncate">{ultimaOrden}</p>
                </div>
            </section>

            <!-- Catálogo Táctil Rápido -->
            <section class="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 shadow-md flex-1">
                <div class="flex justify-between items-center">
                    <h3 class="text-sm font-bold text-slate-300 uppercase tracking-wider">Catálogo Rápido (Táctil)</h3>
                    <span class="text-xs text-slate-500">{inventarioAbasto.length} productos disponibles</span>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 overflow-y-auto max-h-[320px] pr-1">
                    {#each inventarioAbasto as producto}
                        <button 
                            onclick={() => agregarAlCarrito(producto, 1)}
                            class="bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 p-3 rounded-xl text-left transition flex flex-col justify-between group shadow-sm"
                        >
                            <span class="text-xs font-semibold text-slate-200 group-hover:text-blue-400 line-clamp-2">{producto.nombre}</span>
                            <div class="flex justify-between items-end mt-2">
                                <span class="text-sm font-bold text-emerald-400">${producto.precioUsd.toFixed(2)}</span>
                                <span class="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">{producto.unidad}</span>
                            </div>
                        </button>
                    {/each}
                </div>
            </section>

        </div>

        <!-- Panel Derecho: Ticket de Venta -->
        <section class="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between shadow-lg">
            <div>
                <div class="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                    <h3 class="text-sm font-bold uppercase tracking-wider text-white">Ticket de Venta</h3>
                    <span class="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">{carrito.reduce((acc, i) => acc + i.cantidad, 0)} ítems</span>
                </div>

                <!-- Lista del Carrito -->
                <div class="overflow-y-auto max-h-[260px] flex flex-col gap-2 pr-1">
                    {#if carrito.length === 0}
                        <div class="text-center py-16 text-slate-500">
                            <svg class="w-12 h-12 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                            <p class="text-xs">El ticket está vacío. Agrega productos por voz o tocando el catálogo.</p>
                        </div>
                    {:else}
                        {#each carrito as item}
                            <div class="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center">
                                <div class="flex-1 pr-2">
                                    <h4 class="text-xs font-semibold text-slate-200">{item.producto.nombre}</h4>
                                    <span class="text-[10px] text-emerald-400 font-bold">${item.producto.precioUsd.toFixed(2)} c/u</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button onclick={() => cambiarCantidad(item.producto.id, -1)} class="w-6 h-6 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 font-bold text-xs flex items-center justify-center">-</button>
                                    <span class="text-xs font-bold text-white w-4 text-center">{item.cantidad}</span>
                                    <button onclick={() => cambiarCantidad(item.producto.id, 1)} class="w-6 h-6 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 font-bold text-xs flex items-center justify-center">+</button>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>

            <!-- Resumen Fiscal y Botones -->
            <div class="border-t border-slate-800 pt-3 mt-3 flex flex-col gap-2">
                <div class="flex justify-between text-xs text-slate-400">
                    <span>Subtotal:</span>
                    <span>${subtotalUsd.toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-xs text-slate-400">
                    <span>IVA (16% Base Imponible):</span>
                    <span>${ivaUsd.toFixed(2)}</span>
                </div>
                {#if aplicarIgtf}
                    <div class="flex justify-between text-xs text-amber-400">
                        <span>IGTF (3%):</span>
                        <span>${igtfUsd.toFixed(2)}</span>
                    </div>
                {/if}
                <div class="flex justify-between items-baseline pt-2 border-t border-slate-800/60">
                    <span class="text-sm font-bold text-white">Total USD:</span>
                    <span class="text-lg font-black text-emerald-400">${totalUsd.toFixed(2)}</span>
                </div>
                <div class="flex justify-between items-baseline bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                    <span class="text-xs font-semibold text-slate-300">Total Bolívares (BCV):</span>
                    <span class="text-sm font-bold text-blue-400">Bs. {totalBs.toFixed(2)}</span>
                </div>

                <div class="grid grid-cols-2 gap-2 mt-2">
                    <button onclick={() => carrito = []} class="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-3 rounded-xl border border-slate-700 transition">
                        Limpiar Ticket
                    </button>
                    <button onclick={procesarCobro} class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl transition shadow-lg shadow-emerald-900/40">
                        Procesar Venta
                    </button>
                </div>
            </div>
        </section>

    </div>
</main>

<CargarInventarioModal bind:abierto={modalAbierto} {actualizarInventario} />