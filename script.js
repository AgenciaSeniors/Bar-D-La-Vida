// --- script.js CORREGIDO ---

let searchTimeout;
let todosLosProductos = [];
let productoActual = null;
let puntuacion = 0;

// 1. CARGAR MENÚ
async function cargarMenu() {
    const grid = document.getElementById('menu-grid');
    // Loader visible
    if (grid) grid.innerHTML = '<p style="text-align:center; color:#888; grid-column:1/-1; padding:40px;">Cargando carta...</p>';

    try {
        if (typeof supabaseClient === 'undefined') {
            throw new Error("Error: Supabase no está conectado.");
        }

        // Cargar productos
        let { data: productos, error } = await supabaseClient
            .from('productos')
            .select(`*, opiniones(puntuacion)`)
            .eq('activo', true)
            .order('destacado', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;

        // Calcular ratings
        todosLosProductos = productos.map(prod => {
            const opiniones = prod.opiniones || [];
            const total = opiniones.length;
            const suma = opiniones.reduce((acc, curr) => acc + curr.puntuacion, 0);
            prod.ratingPromedio = total ? (suma / total).toFixed(1) : null;
            return prod;
        });

    } catch (err) {
        console.error("Error cargando:", err);
        // Fallback de seguridad
        try {
            let { data: simple } = await supabaseClient.from('productos').select('*').eq('activo', true);
            if (simple) todosLosProductos = simple;
        } catch (e) {}
    }

    renderizarMenu(todosLosProductos);
}

// 2. RENDERIZAR (SIN ANIMACIONES OCULTAS)

function renderizarMenu(lista) {
    const contenedor = document.getElementById('menu-grid');
    if (!contenedor) return;
    
    contenedor.innerHTML = '';

    if (!lista || lista.length === 0) {
        contenedor.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#666;"><h4>Carta Vacía</h4></div>';
        return;
    }

    const html = lista.map(item => {
        // Lógica Agotado
        const esAgotado = item.estado === 'agotado';
        const claseAgotado = esAgotado ? 'agotado' : '';
        
        // Si está agotado mostramos cartel ROJO, si es destacado mostramos corona
        let badgeHTML = '';
        if (esAgotado) {
            badgeHTML = `<span class="badge-agotado">AGOTADO</span>`;
        } else if (item.destacado) {
            badgeHTML = `<span class="badge-destacado">👑 TOP</span>`;
        }

        const img = item.imagen_url || 'https://via.placeholder.com/300';
        const rating = item.ratingPromedio ? `★ ${item.ratingPromedio}` : '';
        
        // Nota: Si está agotado, quitamos el onclick para que no abran el detalle
        const accionClick = esAgotado ? '' : `onclick="abrirDetalle(${item.id})"`;

        return `
            <div class="card ${claseAgotado}" ${accionClick}>
                ${badgeHTML}
                <div class="img-box"><img src="${img}" loading="lazy" alt="${item.nombre}"></div>
                <div class="info">
                    <h3>${item.nombre}</h3>
                    <p class="short-desc">${item.descripcion || ''}</p>
                    <div class="card-footer">
                         <span class="price">$${item.precio}</span>
                         <span class="rating-pill">${rating}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    contenedor.innerHTML = html;
}

// 3. DETALLE
function abrirDetalle(id) {
    productoActual = todosLosProductos.find(p => p.id === id);
    if (!productoActual) return;

    // Llenar datos
    const imgEl = document.getElementById('det-img');
    const box = document.getElementById('box-curiosidad');
    
    if(imgEl) imgEl.src = productoActual.imagen_url || '';
    setText('det-titulo', productoActual.nombre);
    setText('det-desc', productoActual.descripcion);
    setText('det-precio', `$${productoActual.precio}`);
    
    const ratingBig = productoActual.ratingPromedio ? `★ ${productoActual.ratingPromedio}` : '★ --';
    setText('det-rating-big', ratingBig);

    // Manejo de curiosidad
    if (productoActual.curiosidad && productoActual.curiosidad.length > 5) {
        if(box) box.style.display = "block";
        setText('det-curiosidad', productoActual.curiosidad);
    } else {
        if(box) box.style.display = "none";
    }
    
    // ANIMACIÓN DE ENTRADA
    const modal = document.getElementById('modal-detalle');
    if(modal) {
        modal.style.display = 'flex'; // 1. Hacer visible el contenedor
        // Pequeño delay para permitir que el navegador procese el display:flex antes de animar
        setTimeout(() => {
            modal.classList.add('active'); // 2. Activar animación CSS
        }, 10);
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if(el) el.textContent = text;
}

function cerrarDetalle() {
    const modal = document.getElementById('modal-detalle');
    if(modal) {
        modal.classList.remove('active'); // 1. Iniciar animación de salida
        
        // 2. Esperar a que termine la animación (350ms) antes de ocultar
        setTimeout(() => {
            modal.style.display = 'none';
        }, 350);
    }
}

// 4. OPINIONES
function abrirOpinionDesdeDetalle() {
    const modalDetalle = document.getElementById('modal-detalle');
    const modalOpinion = document.getElementById('modal-opinion');
    
    // Cierra detalle
    modalDetalle.classList.remove('active');
    setTimeout(() => {
        modalDetalle.style.display = 'none';
        
        // Abre opinión inmediatamente después
        modalOpinion.style.display = 'flex';
        setTimeout(() => modalOpinion.classList.add('active'), 10);
        
        puntuacion = 0;
        actualizarEstrellas();
    }, 300); // Espera un poco menos para que se sienta fluido
}

function cerrarModalOpiniones() {
    const modal = document.getElementById('modal-opinion');
    if(modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 350);
    }
}

const starsContainer = document.getElementById('stars-container');
if(starsContainer) {
    starsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
            puntuacion = parseInt(e.target.dataset.val);
            actualizarEstrellas();
        }
    });
}

function actualizarEstrellas() {
    document.querySelectorAll('#stars-container span').forEach(s => {
        const val = parseInt(s.dataset.val);
        s.style.color = val <= puntuacion ? 'var(--gold)' : '#444';
        s.textContent = val <= puntuacion ? '★' : '☆';
    });
}

async function enviarOpinion() {
    if (puntuacion === 0) { alert("¡Puntúa con estrellas!"); return; }
    
    const nombre = document.getElementById('cliente-nombre').value || "Anónimo";
    const comentario = document.getElementById('cliente-comentario').value;
    const btn = document.querySelector('#modal-opinion .btn-big-action');

    if(btn) { btn.textContent = "Enviando..."; btn.disabled = true; }

    const { error } = await supabaseClient.from('opiniones').insert([{
        producto_id: productoActual.id,
        cliente_nombre: nombre,
        comentario: comentario,
        puntuacion: puntuacion
    }]);

    if (!error) {
        alert("¡Gracias!");
        cerrarModalOpiniones();
        document.getElementById('cliente-comentario').value = "";
        cargarMenu(); 
    } else {
        alert("Error: " + error.message);
    }
    if(btn) { btn.textContent = "ENVIAR"; btn.disabled = false; }
}

// 5. FILTROS
function filtrar(cat, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    
    const searchInput = document.getElementById('search-input');
    if(searchInput) searchInput.value = '';
    
    const lista = cat === 'todos' ? todosLosProductos : todosLosProductos.filter(p => p.categoria === cat);
    renderizarMenu(lista);
}

const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const term = e.target.value.toLowerCase();
        searchTimeout = setTimeout(() => {
            const lista = todosLosProductos.filter(p => 
                p.nombre.toLowerCase().includes(term) || 
                (p.descripcion && p.descripcion.toLowerCase().includes(term))
            );
            renderizarMenu(lista);
        }, 300);
    });
}

document.addEventListener('DOMContentLoaded', cargarMenu);