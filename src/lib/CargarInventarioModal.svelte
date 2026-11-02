<script lang="ts">
    import * as XLSX from 'xlsx';

    let { abierto = $bindable(false), alCargarInventario }: { abierto: boolean, alCargarInventario: (productos: any[]) => void } = $props();

    let cargando = $state(false);
    let errorMsj = $state('');
    let totalCargados = $state(0);

    function manejarArchivo(e: Event) {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        cargando = true;
        errorMsj = '';

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[] = XLSX.utils.sheet_to_json(ws);

                // Normalización de productos
                const productosProcesados = data.map((row, idx) => {
                    const nombre = row['Nombre'] || row['Producto'] || row['Descripción'] || `Producto ${idx + 1}`;
                    const precioUsd = parseFloat(row['Precio USD'] || row['Precio'] || row['USD'] || 0);
                    const exentoStr = String(row['Exento'] || row['Exento IVA'] || 'SI').toUpperCase();
                    const exentoIva = exentoStr.includes('SI') || exentoStr === 'TRUE' || exentoStr === '1';
                    const unidad = (row['Unidad'] || 'und').toLowerCase();
                    const sinonimosRaw = row['Sinónimos'] || row['Sinonimos'] || nombre;

                    const sinonimos = String(sinonimosRaw)
                        .toLowerCase()
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean);

                    return {
                        id: String(idx + 1),
                        nombre,
                        precioUsd,
                        exentoIva,
                        unidad,
                        sinonimos: sinonimos.length > 0 ? sinonimos : [nombre.toLowerCase()]
                    };
                });

                if (productosProcesados.length === 0) {
                    errorMsj = 'El archivo Excel no contiene productos válidos.';
                    cargando = false;
                    return;
                }

                totalCargados = productosProcesados.length;
                alCargarInventario(productosProcesados);
                cargando = false;
                abierto = false;
            } catch (err) {
                console.error(err);
                errorMsj = 'Hubo un error al leer el archivo Excel. Revisa el formato.';
                cargando = false;
            }
        };

        reader.readAsBinaryString(file);
    }

    function descargarPlantillaEjemplo() {
        const plantilla = [
            { "Nombre": "Harina P.A.N. 1kg", "Precio USD": 1.20, "Exento IVA": "SI", "Unidad": "und", "Sinónimos": "harina, harina pan, pan" },
            { "Nombre": "Queso Blanco Semi-Duro", "Precio USD": 5.50, "Exento IVA": "SI", "Unidad": "kg", "Sinónimos": "queso, queso blanco" },
            { "Nombre": "Café Molido 250g", "Precio USD": 3.80, "Exento IVA": "NO", "Unidad": "und", "Sinónimos": "cafe, café" },
            { "Nombre": "Arroz Blanco 1kg", "Precio USD": 1.30, "Exento IVA": "SI", "Unidad": "und", "Sinónimos": "arroz" }
        ];

        const ws = XLSX.utils.json_to_sheet(plantilla);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario_Abasto");
        XLSX.writeFile(wb, "Plantilla_Inventario_Abasto.xlsx");
    }
</script>

{#if abierto}
<div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100 relative">
        <button onclick={() => abierto = false} class="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
        
        <h3 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
            📊 Cargar Inventario desde Excel
        </h3>
        <p class="text-xs text-slate-400 mb-6">
            Importa cientos o miles de productos instantáneamente desde un archivo `.xlsx` o `.csv`.
        </p>

        <!-- Zona de Drop / Input -->
        <div class="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center transition bg-slate-950/50 cursor-pointer relative mb-4">
            <input type="file" accept=".xlsx, .xls, .csv" onchange={manejarArchivo} class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            <span class="text-3xl block mb-2">📁</span>
            <p class="text-xs font-semibold text-slate-300">Haz clic o arrastra tu archivo Excel aquí</p>
            <p class="text-[10px] text-slate-500 mt-1">Soporta cualquier cantidad de productos</p>
        </div>

        {#if cargando}
            <p class="text-xs text-blue-400 text-center animate-pulse mb-3">Procesando productos...</p>
        {/if}

        {#if errorMsj}
            <p class="text-xs text-rose-400 text-center mb-3">{errorMsj}</p>
        {/if}

        <div class="border-t border-slate-800 pt-4 flex justify-between items-center text-xs">
            <button onclick={descargarPlantillaEjemplo} class="text-blue-400 hover:underline flex items-center gap-1 font-medium">
                📥 Descargar plantilla de ejemplo
            </button>
            <button onclick={() => abierto = false} class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl">
                Cerrar
            </button>
        </div>
    </div>
</div>
{/if}