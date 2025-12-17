// reviews.js - Lógica del Panel de Opiniones

let opinionesGlobal = [];

// Función principal que se llamará desde admin.js
async function cargarOpiniones() {
    const grid = document.getElementById('grid-opiniones');
    if(!grid) return;

    grid.innerHTML = '<p style="text-align:center; color:#666; grid-column:1/-1;">Cargando feedback...</p>';

    // CAMBIOS: 
    const { data, error } = await supabaseClient
        .from('opiniones')
        // CAMBIA LA LÍNEA DEL .select POR ESTA:
        .select(`
            id, puntuacion, comentario, cliente_nombre, created_at,
            productos ( nombre, imagen_url )
        `)
        .order('created_at', { ascending: false });

    if(error) { 
        console.error("Error cargando opiniones:", error);
        grid.innerHTML = '<p style="text-align:center; color:var(--red-danger);">Error al cargar datos.</p>';
        return; 
    }
    
    opinionesGlobal = data || [];
    calcularMetricas(opinionesGlobal);
    renderizarOpiniones(opinionesGlobal);
}

function calcularMetricas(lista) {
    if(lista.length === 0) {
        document.getElementById('stat-promedio').textContent = "--";
        document.getElementById('stat-total').textContent = "0";
        document.getElementById('stat-mejor').textContent = "--";
        return;
    }

    // 1. Promedio
    const suma = lista.reduce((acc, curr) => acc + curr.puntuacion, 0);
    const prom = (suma / lista.length).toFixed(1);
    const statPromedio = document.getElementById('stat-promedio');
    statPromedio.textContent = `★ ${prom}`;
    
    // Color semántico
    if(prom >= 4.5) statPromedio.style.color = 'var(--green-success)';
    else if(prom < 3) statPromedio.style.color = 'var(--red-danger)';
    else statPromedio.style.color = 'var(--gold)';
    
    // 2. Total
    document.getElementById('stat-total').textContent = lista.length;

    // 3. Mejor Plato (el que tiene más calificaciones de 5 estrellas)
    const conteo5 = {};
    lista.filter(o => o.puntuacion === 5).forEach(o => {
        const prod = o.productos?.nombre || 'Desconocido';
        conteo5[prod] = (conteo5[prod] || 0) + 1;
    });
    
    // Buscar el máximo
    let mejor = Object.keys(conteo5).reduce((a, b) => conteo5[a] > conteo5[b] ? a : b, "N/A");
    document.getElementById('stat-mejor').textContent = mejor !== "N/A" ? mejor : "Sin datos";
}

function renderizarOpiniones(lista) {
    const grid = document.getElementById('grid-opiniones');
    grid.innerHTML = '';

    if(lista.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:#666; grid-column:1/-1;">No hay opiniones que coincidan.</p>';
        return;
    }

    const html = lista.map(op => {
        const estrellas = '★'.repeat(op.puntuacion) + '☆'.repeat(5 - op.puntuacion);
        const fecha = new Date(op.created_at).toLocaleDateString();
        const prodNombre = op.productos?.nombre || 'Producto Borrado';
        const prodImg = op.productos?.imagen_url || 'https://via.placeholder.com/40';

        return `
            <div class="review-card">
                <div class="review-header">
                    <span class="review-stars">${estrellas}</span>
                    <span class="review-date">${fecha}</span>
                </div>

                <div class="review-product">
                    <img src="${prodImg}" class="review-prod-img" alt="${prodNombre}">
                    <span class="review-prod-name">${prodNombre}</span>
                </div>

                <p class="review-body">"${op.comentario || 'Sin comentario'}"</p>

                <div class="review-footer">
                    <span class="review-author">${op.cliente_nombre || 'Anónimo'}</span>
                    <span class="review-email">${op.cliente_email || ''}</span>
                </div>

                <button class="btn-delete-review" onclick="borrarOpinion(${op.id})" title="Borrar Opinión">
                    <span class="material-icons" style="font-size:1.2rem;">delete_outline</span>
                </button>
            </div>
        `;
    }).join('');

    grid.innerHTML = html;
}

function filtrarOpiniones(filtro, btn) {
    // UI Botones
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');

    let filtradas = [];
    if (filtro === 'todas') {
        filtradas = opinionesGlobal;
    } else if (filtro === '5') {
        filtradas = opinionesGlobal.filter(o => o.puntuacion === 5);
    } else if (filtro === 'alertas') {
        filtradas = opinionesGlobal.filter(o => o.puntuacion <= 2);
    }

    renderizarOpiniones(filtradas);
}

async function borrarOpinion(id) {
    if(confirm("¿Eliminar esta opinión permanentemente?")) {
        const { error } = await supabaseClient.from('opiniones').delete().eq('id', id);
        if(!error) {
            // Asumimos que showToast existe globalmente (en script.js o admin.js)
            // Si no, usamos alert
            if (typeof showToast === "function") showToast("Opinión eliminada", "success");
            else alert("Opinión eliminada");
            
            cargarOpiniones();
        } else {
            alert("Error al borrar: " + error.message);
        }
    }
}