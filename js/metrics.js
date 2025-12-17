// js/metrics.js - Dashboard Inteligente con Chart.js

let visitasChart = null;
let horasChart = null;

async function cargarVisitas() {
    // Referencias al DOM
    const els = {
        hoy: document.getElementById('stat-hoy'),
        mes: document.getElementById('stat-mes'),
        unique: document.getElementById('stat-unique-clients'),
        retorno: document.getElementById('stat-tasa-retorno'),
        trendHoy: document.getElementById('trend-hoy')
    };

    // Loaders
    Object.values(els).forEach(el => { if(el) el.textContent = '...'; });

    try {
        // 1. OBTENER DATOS (Optimizamos para traer solo lo necesario)
        // Traemos visitas de los últimos 30 días para gráficos + conteos totales
        
        const hoy = new Date();
        const hace30dias = new Date();
        hace30dias.setDate(hoy.getDate() - 30);

        // A. Consulta de Visitas Recientes (para gráficos)
        const { data: rawVisitas, error: errVisitas } = await supabaseClient
            .from('visitas')
            .select('created_at')
            .gte('created_at', hace30dias.toISOString());

        if (errVisitas) throw errVisitas;

        // B. Consulta Totales (para KPIs históricos)
        const { count: totalVisitas, error: errTotal } = await supabaseClient
            .from('visitas')
            .select('*', { count: 'exact', head: true });
            
        const { count: totalClientes, error: errClients } = await supabaseClient
            .from('clientes')
            .select('*', { count: 'exact', head: true });

        if (errTotal || errClients) throw new Error("Error obteniendo totales");

        // 2. PROCESAR KPIs
        procesarKPIs(rawVisitas, totalVisitas, totalClientes, els);

        // 3. RENDERIZAR GRÁFICOS
        renderizarGraficoTendencia(rawVisitas);
        renderizarGraficoHoras(rawVisitas);

        // 4. CARGAR TOP CLIENTES (Consulta separada con Join)
        cargarTopClientesAvanzado();

    } catch (e) {
        console.error("Error Dashboard:", e);
        if(els.hoy) els.hoy.textContent = "Error";
    }
}

function procesarKPIs(visitasRecientes, totalVisitas, totalClientes, els) {
    const hoyStr = new Date().toISOString().split('T')[0];
    const mesStr = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Filtrar localmente
    const visitasHoy = visitasRecientes.filter(v => v.created_at.startsWith(hoyStr)).length;
    const visitasMes = visitasRecientes.filter(v => v.created_at.startsWith(mesStr)).length;

    // Calcular Ayer para comparación
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const ayerStr = ayer.toISOString().split('T')[0];
    const visitasAyer = visitasRecientes.filter(v => v.created_at.startsWith(ayerStr)).length;

    // Renderizar Texto
    if(els.hoy) els.hoy.textContent = visitasHoy;
    if(els.mes) els.mes.textContent = visitasMes;
    if(els.unique) els.unique.textContent = totalClientes;

    // Tendencia (Comparación visual)
    if(els.trendHoy) {
        if(visitasHoy > visitasAyer) {
            els.trendHoy.innerHTML = `<span style="color:var(--green-success)">▲ ${visitasHoy - visitasAyer} más que ayer</span>`;
        } else if (visitasHoy < visitasAyer) {
            els.trendHoy.innerHTML = `<span style="color:var(--red-danger)">▼ ${visitasAyer - visitasHoy} menos que ayer</span>`;
        } else {
            els.trendHoy.innerHTML = `<span style="color:#888">= Igual que ayer</span>`;
        }
    }

    // Tasa Retorno
    if (totalClientes > 0) {
        const tasa = (totalVisitas / totalClientes).toFixed(1);
        if(els.retorno) els.retorno.textContent = `${tasa}x`;
    }
}

// --- GRÁFICOS CON CHART.JS ---

function renderizarGraficoTendencia(data) {
    const ctx = document.getElementById('chart-visitas').getContext('2d');
    
    // Agrupar por fecha (últimos 15 días)
    const dias = {};
    for(let i=14; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dias[key] = 0; // Inicializar en 0
    }

    data.forEach(v => {
        const key = v.created_at.split('T')[0];
        if (dias.hasOwnProperty(key)) dias[key]++;
    });

    const labels = Object.keys(dias).map(fecha => {
        const [y, m, d] = fecha.split('-');
        return `${d}/${m}`;
    });
    const valores = Object.values(dias);

    // Destruir anterior si existe
    if(visitasChart) visitasChart.destroy();

    visitasChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Visitas',
                data: valores,
                borderColor: '#FFD700', // Gold
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                borderWidth: 2,
                tension: 0.4, // Curva suave
                fill: true,
                pointBackgroundColor: '#000',
                pointBorderColor: '#FFD700'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#888' } }
            }
        }
    });
}

function renderizarGraficoHoras(data) {
    const ctx = document.getElementById('chart-horas').getContext('2d');

    // Inicializar horas 00-23
    const horas = new Array(24).fill(0);

    data.forEach(v => {
        const fecha = new Date(v.created_at);
        const hora = fecha.getHours(); // Hora local del navegador
        horas[hora]++;
    });

    // Etiquetas
    const labels = horas.map((_, i) => `${i}:00`);

    if(horasChart) horasChart.destroy();

    horasChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tráfico',
                data: horas,
                backgroundColor: horas.map(val => val > 0 ? 'rgba(0, 230, 118, 0.6)' : 'rgba(255,255,255,0.05)'),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false }, // Ocultar eje Y para limpieza
                x: { grid: { display: false }, ticks: { color: '#666', maxTicksLimit: 8 } }
            }
        }
    });
}

// --- TOP CLIENTES MEJORADO ---
async function cargarTopClientesAvanzado() {
    const listContainer = document.getElementById('top-clientes-list');
    
    try {
        const { data: visitas, error } = await supabaseClient
            .from('visitas')
            .select(`
                created_at,
                cliente:clientes!visitas_cliente_id_fkey (nombre, telefono)
            `); 
            
        if (error) throw error;
        
        // Procesar en JS: Agrupar por Cliente
        const clientesMap = {};
        
        visitas.forEach(v => {
            if(!v.cliente) return;
            const key = v.cliente.telefono; // Usamos tel como ID único simple
            
            if(!clientesMap[key]) {
                clientesMap[key] = {
                    nombre: v.cliente.nombre,
                    telefono: v.cliente.telefono,
                    visitas: 0,
                    ultimaVisita: v.created_at
                };
            }
            clientesMap[key].visitas++;
            // Actualizar fecha si esta visita es más reciente
            if (new Date(v.created_at) > new Date(clientesMap[key].ultimaVisita)) {
                clientesMap[key].ultimaVisita = v.created_at;
            }
        });

        // Ordenar y cortar top 5
        const ranking = Object.values(clientesMap)
            .sort((a, b) => b.visitas - a.visitas)
            .slice(0, 5);

        // Renderizar
        const html = ranking.map((c, index) => {
            const lastDate = new Date(c.ultimaVisita).toLocaleDateString();
            const rankIcon = ['🥇','🥈','🥉'][index] || '✨';
            
            return `
                <div class="inventory-item" style="border-left: 3px solid ${index === 0 ? 'var(--gold)' : '#333'};">
                    <span style="font-size:1.5rem; width: 30px; text-align:center;">${rankIcon}</span>
                    <div class="item-meta">
                        <span class="item-title">${c.nombre}</span>
                        <span style="font-size:0.75rem; color:#888;">Última vez: ${lastDate}</span>
                    </div>
                    <div style="text-align:right;">
                        <span class="item-price" style="color: var(--green-success); font-size:1.1rem;">${c.visitas}</span>
                        <small style="display:block; color:#555; font-size:0.7rem;">Visitas</small>
                    </div>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = html || '<p style="text-align:center; color:#666;">Sin datos aún.</p>';

    } catch (e) {
        console.error("Top Clientes Error:", e);
        listContainer.innerHTML = '<p style="color:var(--red-danger); text-align:center;">Error cargando ranking</p>';
    }
}