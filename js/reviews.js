// reviews.js - Lógica del Panel de Opiniones (SECURED)

let opinionesGlobal = [];

// [SEGURIDAD] Función para sanitizar HTML y prevenir XSS
function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
}

async function cargarOpiniones() {
    const grid = document.getElementById('grid-opiniones');
    if(!grid) return;

    grid.innerHTML = '<p style="text-align:center; color:#666; grid-column:1/-1;">Cargando feedback...</p>';

   const { data, error } = await supabaseClient
        .from('opiniones')
        .select(`
            id, 
            puntuacion, 
            comentario, 
            cliente_nombre, 
            created_at,
            productos:productos!opiniones_producto_id_fkey ( nombre, imagen_url )
        `)
        .order('created_at', { ascending: false });

    if(error) { 
        console.error("Error cargando opiniones:", error);
        grid.innerHTML = '<p style="text-align:center; color:var(--red-danger);">Error al cargar datos o falta de permisos.</p>';
        return; 
    }
    
    opinionesGlobal = data || [];
    calcularMetricas(opinionesGlobal);
    renderizarOpiniones(opinionesGlobal);
}

function calcularMetricas(lista) {
    if(lista.length === 0) {
        setText('stat-promedio', "--");
        setText('stat-total', "0");
        setText('stat-mejor', "--");
        return;
    }

    const suma = lista.reduce((acc, curr) => acc + curr.puntuacion, 0);
    const prom = (suma / lista.length).toFixed(1);
    const statPromedio = document.getElementById('stat-promedio');
    
    if(statPromedio) {
        statPromedio.textContent = `★ ${prom}`;
        if(prom >= 4.5) statPromedio.style.color = 'var(--green-success)';
        else if(prom < 3) statPromedio.style.color = 'var(--red-danger)';
        else statPromedio.style.color = 'var(--gold)';
    }
    
    setText('stat-total', lista.length);

    // Lógica de mejor plato
    const conteo5 = {};
    lista.filter(o => o.puntuacion === 5).forEach(o => {
        const prod = o.productos?.nombre || 'Desconocido';
        conteo5[prod] = (conteo5[prod] || 0) + 1;
    });
    
    let mejor = Object.keys(conteo5).reduce((a, b) => conteo5[a] > conteo5[b] ? a : b, "N/A");
    setText('stat-mejor', mejor !== "N/A" ? mejor : "Sin datos");
}

function renderizarOpiniones(lista) {
    const grid = document.getElementById('grid-opiniones');
    if(!grid) return;
    
    grid.innerHTML = '';

    if(lista.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:#666; grid-column:1/-1;">No hay opiniones que coincidan.</p>';
        return;
    }

    const html = lista.map(op => {
        const estrellas = '★'.repeat(op.puntuacion) + '☆'.repeat(5 - op.puntuacion);
        const fecha = new Date(op.created_at).toLocaleDateString();
        
        // [SEGURIDAD] Sanitizamos datos que vienen de BD antes de insertarlos
        const prodNombre = escapeHTML(op.productos?.nombre || 'Producto Borrado');
        const autor = escapeHTML(op.cliente_nombre || 'Anónimo');
        const comentario = escapeHTML(op.comentario || 'Sin comentario');
        
        // Imagen es URL, asumimos seguro si viene de nuestro bucket, pero idealmente validar protocolo
        const prodImg = (op.productos?.imagen_url && op.productos.imagen_url.startsWith('http')) 
                        ? op.productos.imagen_url 
                        : 'https://via.placeholder.com/40';

        return `
            <div class="review-card">
                <div class="review-header">
                    <span class="review-stars">${estrellas}</span>
                    <span class="review-date">${fecha}</span>
                </div>

                <div class="review-product">
                    <img src="${prodImg}" class="review-prod-img" alt="img">
                    <span class="review-prod-name">${prodNombre}</span>
                </div>

                <p class="review-body">"${comentario}"</p>

                <div class="review-footer">
                    <span class="review-author">${autor}</span>
                </div>

                <button class="btn-delete-review" onclick="borrarOpinion(${op.id})" title="Borrar Opinión">
                    <span class="material-icons" style="font-size:1.2rem;">delete_outline</span>
                </button>
            </div>
        `;
    }).join('');

    grid.innerHTML = html; // Ahora seguro porque html contiene cadenas escapadas
}

function filtrarOpiniones(filtro, btn) {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');

    let filtradas = [];
    if (filtro === 'todas') filtradas = opinionesGlobal;
    else if (filtro === '5') filtradas = opinionesGlobal.filter(o => o.puntuacion === 5);
    else if (filtro === 'alertas') filtradas = opinionesGlobal.filter(o => o.puntuacion <= 2);

    renderizarOpiniones(filtradas);
}

async function borrarOpinion(id) {
    if(confirm("¿Eliminar esta opinión permanentemente?")) {
        const { error } = await supabaseClient.from('opiniones').delete().eq('id', id);
        if(!error) {
            alert("Opinión eliminada");
            cargarOpiniones();
        } else {
            alert("Error al borrar (Revisa permisos): " + error.message);
        }
    }
}

// Helper simple
function setText(id, val) {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
}