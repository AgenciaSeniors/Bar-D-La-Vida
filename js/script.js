// js/script.js - Lógica Cliente Completa con Integración IA
// Configuración de la URL de tu Google Apps Script (Backend IA)
const URL_IA_BACKEND = "https://script.google.com/macros/s/AKfycbwfGlwmuKVSy630EnyWR4gJ0k-5hPVIwWg_bXS07m0v79KahgZ8J3Eyvi_DQu1-MbOg/exec";

let todosLosProductos = [];
let productoActual = null;
let puntuacion = 0;
let searchTimeout;

document.addEventListener('DOMContentLoaded', () => {
    checkWelcome(); 
    cargarMenu();
    updateConnectionStatus();
});

// --- LÓGICA DE VISITAS Y BIENVENIDA ---
async function checkWelcome() {
    const clienteId = localStorage.getItem('cliente_id');
    const modoAnonimo = localStorage.getItem('modo_anonimo');
    const modal = document.getElementById('modal-welcome');

    if (clienteId || modoAnonimo === 'true') {
        if (modal) modal.style.display = 'none';
        if (clienteId) {
            const ultimaVisita = localStorage.getItem('ultima_visita_ts');
            const ahora = Date.now();
            const HORAS_12 = 12 * 60 * 60 * 1000;

            if (!ultimaVisita || (ahora - parseInt(ultimaVisita)) > HORAS_12) {
                const { error } = await supabaseClient.from('visitas').insert([{
                    cliente_id: clienteId,
                    motivo: 'Regreso al Menú'
                }]);
                if (!error) localStorage.setItem('ultima_visita_ts', ahora.toString());
            }
        }
    } else {
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    }
}

function cerrarWelcome() { activarModoAnonimo(); }

function activarModoAnonimo() {
    localStorage.setItem('modo_anonimo', 'true');
    const modal = document.getElementById('modal-welcome');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 400);
    }
    showToast("Modo Explorador Anónimo", "info");
}

function limpiarTelefono(input) {
    if (!input) return "";
    let limpio = input.replace(/\D/g, ''); 
    if (limpio.length === 10 && limpio.startsWith('53')) limpio = limpio.substring(2);
    return limpio;
}

async function registrarBienvenida() {
    const inputNombre = document.getElementById('welcome-nombre');
    const inputPhone = document.getElementById('welcome-phone');
    const btn = document.querySelector('#modal-welcome button');

    const nombre = inputNombre.value ? inputNombre.value.trim() : '';
    const telefono = limpiarTelefono(inputPhone.value);

    if (!nombre || !telefono || telefono.length < 8) {
        showToast("Nombre y teléfono válido requeridos.", "warning");
        return;
    }

    if(btn) { btn.textContent = "Entrando..."; btn.disabled = true; }

    try {
        let { data: cliente } = await supabaseClient.from('clientes').select('id').eq('telefono', telefono).single();
        let clienteId = cliente ? cliente.id : null;

        if (!clienteId) {
            const { data: nuevo } = await supabaseClient.from('clientes').insert([{ nombre, telefono }]).select().single();
            clienteId = nuevo.id;
        }

        await supabaseClient.from('visitas').insert([{ cliente_id: clienteId, motivo: 'Ingreso Inicial' }]);

        localStorage.setItem('cliente_id', clienteId);
        localStorage.setItem('cliente_nombre', nombre);
        localStorage.removeItem('modo_anonimo');
        localStorage.setItem('ultima_visita_ts', Date.now().toString());

        const modal = document.getElementById('modal-welcome');
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 400);
        showToast(`¡Bienvenido, ${nombre}!`, "success");
    } catch (err) {
        cerrarWelcome(); 
    } finally {
        if(btn) { btn.textContent = "INGRESAR"; btn.disabled = false; }
    }
}

// --- MENÚ Y PRODUCTOS ---
async function cargarMenu() {
    const grid = document.getElementById('menu-grid');
    const menuCache = localStorage.getItem('menu_cache');
    
    if (menuCache) {
        todosLosProductos = JSON.parse(menuCache);
        renderizarMenu(todosLosProductos);
    } else if(grid) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px;"><span class="material-icons spin">refresh</span><p>Cargando carta...</p></div>`;
    }

    try {
        let { data: productos, error } = await supabaseClient.from('productos').select(`*, opiniones(puntuacion)`).eq('activo', true).order('destacado', { ascending: false });
        if (error) throw error;

        const productosProcesados = productos.map(prod => {
            const opiniones = prod.opiniones || [];
            const suma = opiniones.reduce((acc, curr) => acc + curr.puntuacion, 0);
            prod.ratingPromedio = opiniones.length ? (suma / opiniones.length).toFixed(1) : null;
            return prod;
        });

        localStorage.setItem('menu_cache', JSON.stringify(productosProcesados));
        todosLosProductos = productosProcesados;
        renderizarMenu(todosLosProductos);
    } catch (err) {
        if(!menuCache && grid) grid.innerHTML = `<div style="grid-column:1/-1; text-align:center;"><p>Error de conexión</p><button onclick="cargarMenu()">Reintentar</button></div>`;
    }
}

function renderizarMenu(lista) {
    const contenedor = document.getElementById('menu-grid');
    if (!contenedor) return;
    if (!lista || lista.length === 0) {
        contenedor.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;"><h4>Sin resultados</h4></div>';
        return;
    }

    contenedor.innerHTML = lista.map(item => {
        const esAgotado = item.estado === 'agotado';
        const img = item.imagen_url || 'img/logo.png';
        const rating = item.ratingPromedio ? `★ ${item.ratingPromedio}` : '';
        return `
            <div class="card ${esAgotado ? 'agotado' : ''}" ${esAgotado ? '' : `onclick="abrirDetalle(${item.id})"`}>
                ${item.destacado ? '<span class="badge-destacado">🔥 HOT</span>' : ''}
                <div class="img-box"><img src="${img}" alt="${item.nombre}"></div>
                <div class="info">
                    <h3>${item.nombre}</h3>
                    <p class="short-desc">${item.descripcion || ''}</p>
                    <div class="card-footer"><span class="price">$${item.precio}</span><span class="rating-pill">${rating}</span></div>
                </div>
            </div>`;
    }).join('');
}

// --- BÚSQUEDA Y FILTROS ---
const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const term = e.target.value.toLowerCase();
        searchTimeout = setTimeout(() => {
            const lista = todosLosProductos.filter(p => (p.nombre || '').toLowerCase().includes(term) || (p.descripcion || '').toLowerCase().includes(term));
            renderizarMenu(lista);
        }, 300);
    });
}

function filtrar(cat, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    const lista = cat === 'todos' ? todosLosProductos : todosLosProductos.filter(p => p.categoria === cat);
    renderizarMenu(lista);
}

// --- DETALLES Y CURIOSIDAD IA ---
async function abrirDetalle(id) {
    productoActual = todosLosProductos.find(p => p.id === id);
    if (!productoActual) return;

    setText('det-titulo', productoActual.nombre);
    setText('det-desc', productoActual.descripcion);
    setText('det-precio', `$${productoActual.precio}`);
    setText('det-rating-big', productoActual.ratingPromedio ? `★ ${productoActual.ratingPromedio}` : '★ --');
    
    const imgEl = document.getElementById('det-img');
    if(imgEl) imgEl.src = productoActual.imagen_url || 'img/logo.png';

    const box = document.getElementById('box-curiosidad');
    const textCur = document.getElementById('det-curiosidad');

    // Lógica Curiosidad IA Dinámica
    if (productoActual.curiosidad && productoActual.curiosidad.length > 5) {
        if(box) box.style.display = "block";
        setText('det-curiosidad', productoActual.curiosidad);
    } else {
        if(box) {
            box.style.display = "block";
            textCur.innerHTML = "<i>Generando dato curioso con IA...</i>";
            try {
                const res = await fetch(URL_IA_BACKEND, {
                    method: 'POST',
                    body: JSON.stringify({ producto: productoActual.nombre })
                });
                const data = await res.json();
                if(data.curiosidad) {
                    textCur.textContent = data.curiosidad;
                    productoActual.curiosidad = data.curiosidad;
                } else { box.style.display = "none"; }
            } catch (e) { box.style.display = "none"; }
        }
    }
    
    const modal = document.getElementById('modal-detalle');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function cerrarDetalle() {
    const modal = document.getElementById('modal-detalle');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 350);
}

// --- OPINIONES ---
function abrirOpinionDesdeDetalle() {
    cerrarDetalle();
    const modal = document.getElementById('modal-opinion');
    setTimeout(() => {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        const inputNombre = document.getElementById('cliente-nombre');
        if(inputNombre) inputNombre.value = localStorage.getItem('cliente_nombre') || '';
        puntuacion = 0;
        actualizarEstrellas();
    }, 300);
}

function cerrarModalOpiniones() {
    const modal = document.getElementById('modal-opinion');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 350);
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
    if (puntuacion === 0) { showToast("¡Marca las estrellas!", "warning"); return; }
    const LAST_OPINION = 'last_opinion_ts';
    const lastTime = localStorage.getItem(LAST_OPINION);
    if (lastTime && (Date.now() - parseInt(lastTime)) < 12 * 60 * 60 * 1000) {
        showToast("Solo puedes opinar cada 12 horas.", "warning");
        return;
    }

    const btn = document.querySelector('#modal-opinion .btn-big-action');
    if(btn) { btn.textContent = "Enviando..."; btn.disabled = true; }

    const { error } = await supabaseClient.from('opiniones').insert([{
        producto_id: productoActual.id,
        cliente_nombre: document.getElementById('cliente-nombre').value || "Anónimo",
        comentario: document.getElementById('cliente-comentario').value, 
        puntuacion: puntuacion
    }]);

    if (!error) {
        localStorage.setItem(LAST_OPINION, Date.now().toString());
        showToast("¡Gracias!", "success");
        cerrarModalOpiniones();
        cargarMenu();
    }
    if(btn) { btn.textContent = "ENVIAR"; btn.disabled = false; }
}

// --- UTILIDADES ---
function setText(id, val) { const el = document.getElementById(id); if(el) el.textContent = val; }

function showToast(msg, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const t = document.createElement('div');
    t.className = `toast ${tipo}`;
    t.innerHTML = `<span class="toast-msg">${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.style.animation = 'fadeOut 0.4s forwards'; setTimeout(() => t.remove(), 400); }, 3000);
}

function updateConnectionStatus() {
    const el = document.getElementById('connection-status');
    const dot = document.getElementById('status-dot');
    if (!el) return;
    if (navigator.onLine) {
        el.textContent = "Conectado"; el.style.color = "var(--green-success)";
        if(dot) dot.style.backgroundColor = "var(--green-success)";
    } else {
        el.textContent = "Offline"; el.style.color = "var(--neon-red)";
        if(dot) dot.style.backgroundColor = "var(--neon-red)";
    }
}

window.addEventListener('online', () => { updateConnectionStatus(); showToast("Conexión restaurada"); });
window.addEventListener('offline', () => { updateConnectionStatus(); showToast("Modo Offline", "warning"); });

// ==========================================
// 🌪️ SHAKER VIRTUAL (MIXER IA)
// ==========================================
const ESENCIAS = [
    { id: 'fresco', icono: '🧊', nombre: 'Fresco' },
    { id: 'dulce', icono: '🍬', nombre: 'Dulce' },
    { id: 'fuerte', icono: '🔥', nombre: 'Potente' },
    { id: 'frutal', icono: '🍍', nombre: 'Frutal' },
    { id: 'amargo', icono: '🍋', nombre: 'Ácido' },
    { id: 'party', icono: '🎉', nombre: 'Fiesta' }
];

let shakerState = { seleccionados: [], isShaking: false, shakeCount: 0, isProcessing: false };
let watchID = null;

function abrirShaker() {
    const modal = document.getElementById('modal-shaker');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    shakerState.seleccionados = [];
    renderizarEsencias();
    actualizarEstadoShaker();
    iniciarDetectorMovimiento();
}

function cerrarShaker() {
    const modal = document.getElementById('modal-shaker');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
    detenerDetectorMovimiento();
}

function renderizarEsencias() {
    const grid = document.getElementById('essences-grid');
    grid.innerHTML = '';
    ESENCIAS.forEach(esencia => {
        const btn = document.createElement('div');
        btn.className = 'essence-btn';
        btn.innerHTML = `<span>${esencia.icono}</span><small>${esencia.nombre}</small>`;
        btn.onclick = () => toggleEsencia(esencia, btn);
        grid.appendChild(btn);
    });
}

function toggleEsencia(esencia, btnElement) {
    const index = shakerState.seleccionados.indexOf(esencia.nombre);
    if (index > -1) {
        shakerState.seleccionados.splice(index, 1);
        btnElement.classList.remove('selected');
    } else if (shakerState.seleccionados.length < 3) {
        shakerState.seleccionados.push(esencia.nombre);
        btnElement.classList.add('selected');
    }
    actualizarEstadoShaker();
}

function actualizarEstadoShaker() {
    const count = shakerState.seleccionados.length;
    const visual = document.getElementById('shaker-img');
    const status = document.getElementById('shaker-status');
    const btn = document.getElementById('btn-mix-manual');
    if (count === 0) {
        status.textContent = "Añade ingredientes...";
        if(btn) btn.disabled = true;
    } else {
        status.textContent = "¡Agita o pulsa el botón!";
        if(btn) btn.disabled = false;
        visual.classList.add('ready');
    }
}

// --- DETECTOR MOVIMIENTO ---
function iniciarDetectorMovimiento() {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(state => { if (state === 'granted') activarSensores(); });
    } else { activarSensores(); }
}

function activarSensores() {
    if (window.DeviceMotionEvent) {
        const umbral = 25; 
        let lastX = 0, lastY = 0, lastZ = 0;
        const handleMotion = (event) => {
            if (shakerState.isProcessing || shakerState.seleccionados.length === 0) return;
            const acc = event.accelerationIncludingGravity;
            if (!acc) return;
            if (Math.abs(acc.x - lastX) + Math.abs(acc.y - lastY) > umbral) {
                shakerState.shakeCount++;
                document.getElementById('shaker-img').classList.add('shaking');
                if (shakerState.shakeCount > 8) { procesarMezcla(); shakerState.shakeCount = 0; }
                setTimeout(() => document.getElementById('shaker-img').classList.remove('shaking'), 300);
            }
            lastX = acc.x; lastY = acc.y; lastZ = acc.z;
        };
        window.addEventListener('devicemotion', handleMotion, true);
        watchID = handleMotion;
    }
}

function detenerDetectorMovimiento() { if (watchID) window.removeEventListener('devicemotion', watchID, true); }

// --- PROCESAR MIXER IA (CORREGIDO) ---
async function procesarMezcla() {
    if (shakerState.isProcessing || todosLosProductos.length === 0) return;
    shakerState.isProcessing = true;
    
    const btn = document.getElementById('btn-mix-manual');
    const visual = document.getElementById('shaker-img');
    if(btn) btn.disabled = true;
    if(visual) visual.classList.add('shaking');

    const menuRandom = [...todosLosProductos].sort(() => Math.random() - 0.5).map(p => p.nombre).join(', ');

    try {
        const response = await fetch(URL_IA_BACKEND, {
            method: 'POST',
            body: JSON.stringify({
                tipo: "coctel", // <--- CORRECCIÓN: Para que el servidor reconozca la petición
                sabor: shakerState.seleccionados.join(', '), 
                menu: menuRandom 
            })
        });

        const data = await response.json();
        if (data.recomendacion) {
            mostrarResultadoShaker(data.recomendacion);
        } else { throw new Error("IA sin respuesta"); }
    } catch (error) {
        showToast("La IA sugiere algo especial, ¡mira la carta!", "info");
        shakerState.isProcessing = false;
        if(visual) visual.classList.remove('shaking');
        if(btn) btn.disabled = false;
    }
}

function mostrarResultadoShaker(nombreRecibido) {
    const nombreIA = nombreRecibido.toLowerCase().trim();
    const producto = todosLosProductos.find(p => {
        const n = p.nombre.toLowerCase();
        return n === nombreIA || n.includes(nombreIA) || nombreIA.includes(n);
    });

    cerrarShaker();
    if (producto) {
        abrirDetalle(producto.id);
        showToast(`✨ Recomendación: ${producto.nombre}`);
    } else {
        showToast("¡Explora nuestras opciones destacadas!", "info");
    }
    shakerState.isProcessing = false;
    const visual = document.getElementById('shaker-img');
    if(visual) visual.classList.remove('shaking');
}