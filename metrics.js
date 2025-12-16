// metrics.js - Lógica de Métricas de Visitas y Clientes

/**
 * Calcula la fecha de inicio para el filtro ISO, con un offset opcional (ej: -1 para ayer)
 * @param {string} tipo - 'dia', 'mes', 'anual'
 * @param {number} [offset=0] - Desplazamiento de días, meses o años.
 * @returns {string} Fecha ISO 8601
 */
function getFechaFiltro(tipo, offset = 0) {
    const now = new Date();
    let start;

    switch (tipo) {
        case 'dia':
            // Asegura que el filtro empiece exactamente a las 00:00:00 del día actual (hora local)
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
            break;
        case 'mes':
            start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
            break;
        case 'anual':
            start = new Date(now.getFullYear() + offset, 0, 1);
            break;
        default:
            return null;
    }
    // Formato ISO para Supabase (YYYY-MM-DDTHH:MM:SSZ)
    return start.toISOString(); 
}

/**
 * Calcula el porcentaje de cambio y devuelve un objeto con el valor y el color semántico.
 * @param {number} actual - Valor actual.
 * @param {number} anterior - Valor del período anterior.
 * @returns {{text: string, color: string}}
 */
function calcularComparacion(actual, anterior) {
    if (anterior === 0) {
        // Si el valor anterior es 0 y el actual es > 0, es crecimiento infinito
        return { 
            text: actual > 0 ? '▲ ∞%' : '0%', 
            color: actual > 0 ? 'var(--green-success)' : '#888' 
        };
    }
    const cambio = ((actual - anterior) / anterior) * 100;
    const absCambio = Math.abs(cambio).toFixed(0);
    
    // Regla: 0% o positivo es verde, negativo es rojo
    const color = cambio >= 0 ? 'var(--green-success)' : 'var(--red-danger)';
    const icon = cambio >= 0 ? '▲' : '▼';
    
    return { 
        text: `${icon} ${absCambio}%`, 
        color: color 
    };
}


/**
 * Función principal para cargar todas las métricas de visitas y clientes.
 * Debe ser llamada cuando se abre la pestaña 'visitas'.
 */
async function cargarVisitas() {
    // Definición de todos los elementos de la interfaz para actualizar
    const elements = {
        hoy: document.getElementById('stat-hoy'),
        mes: document.getElementById('stat-mes'),
        anual: document.getElementById('stat-anual'),
        total: document.getElementById('stat-total-visitas'),
        unique: document.getElementById('stat-unique-clients'),
        tasaRetorno: document.getElementById('stat-tasa-retorno'),
        compHoy: document.getElementById('comp-hoy-val'),
        compMes: document.getElementById('comp-mes-val')
    };

    // Poner loaders
    Object.values(elements).forEach(el => {
        if(el) el.textContent = '...';
    });

    try {
        // --- 1. Conteo de Clientes Únicos y Visitas Totales ---
        // Requiere RLS SELECT en 'clientes' y 'visitas'
        const { count: uniqueCount, error: uniqueError } = await supabaseClient
            .from('clientes')
            .select('*', { count: 'exact', head: true });
            
        if (uniqueError) throw uniqueError;

        const { count: totalCount, error: totalError } = await supabaseClient
            .from('visitas')
            .select('*', { count: 'exact', head: true });

        if (totalError) throw totalError;

        // --- Actualizar Totales Simples y Tasa de Retorno ---
        if(elements.unique) elements.unique.textContent = uniqueCount;
        if(elements.total) elements.total.textContent = totalCount;

        if (uniqueCount > 0) {
            const tasa = (totalCount / uniqueCount).toFixed(1);
            if (elements.tasaRetorno) elements.tasaRetorno.textContent = tasa;
        } else {
            if (elements.tasaRetorno) elements.tasaRetorno.textContent = '0.0';
        }


        // --- 2. Comparación Diaria (Hoy vs Ayer) ---
        const startDia = getFechaFiltro('dia');
        const startAyer = getFechaFiltro('dia', -1);
        
        const { count: diaCount } = await supabaseClient.from('visitas').select('*', { count: 'exact', head: true }).gte('created_at', startDia); 
        const { count: ayerCount } = await supabaseClient.from('visitas').select('*', { count: 'exact', head: true }).gte('created_at', startAyer).lt('created_at', startDia); 

        if(elements.hoy) elements.hoy.textContent = diaCount;
        const compHoy = calcularComparacion(diaCount, ayerCount);
        if (elements.compHoy) {
            elements.compHoy.textContent = compHoy.text;
            elements.compHoy.style.color = compHoy.color;
        }


        // --- 3. Comparación Mensual (Este Mes vs Mes Anterior) ---
        const startMes = getFechaFiltro('mes');
        const startMesAnterior = getFechaFiltro('mes', -1);
        const startAnual = getFechaFiltro('anual');

        const { count: mesCount } = await supabaseClient.from('visitas').select('*', { count: 'exact', head: true }).gte('created_at', startMes); 
        const { count: mesAnteriorCount } = await supabaseClient.from('visitas').select('*', { count: 'exact', head: true }).gte('created_at', startMesAnterior).lt('created_at', startMes); 
        const { count: anualCount } = await supabaseClient.from('visitas').select('*', { count: 'exact', head: true }).gte('created_at', startAnual);
        
        if(elements.mes) elements.mes.textContent = mesCount;
        if(elements.anual) elements.anual.textContent = anualCount;

        const compMes = calcularComparacion(mesCount, mesAnteriorCount);
        if (elements.compMes) {
            elements.compMes.textContent = compMes.text;
            elements.compMes.style.color = compMes.color;
        }


    } catch (e) {
        console.error("Error al cargar estadísticas de visitas (RLS?):", e.message);
        // Si hay error, actualizamos todos los contadores a 'Error'
        Object.values(elements).forEach(el => {
            if(el) el.textContent = 'Error';
        });
    }
}