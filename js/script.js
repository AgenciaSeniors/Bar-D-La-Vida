// js/script.js - Lógica Cliente (Refactorizado)

let todosLosProductos = [];
let productoActual = null;
let puntuacion = 0;
let searchTimeout;

document.addEventListener('DOMContentLoaded', () => {
    checkWelcome(); // Lógica de visitas mejorada
    cargarMenu();
    updateConnectionStatus();
});

// --- LÓGICA DE VISITAS Y BIENVENIDA ---
async function checkWelcome() {
    const clienteId = localStorage.getItem('cliente_id');
    const modoAnonimo = localStorage.getItem('modo_anonimo');
    const modal = document.getElementById('modal-welcome');

    // Si ya es cliente o eligió ser anónimo
    if (clienteId || modoAnonimo === 'true') {
        if (modal) modal.style.display = 'none';

        // LÓGICA DE VISITA RECURRENTE (Solo para registrados)
        if (clienteId) {
            const ultimaVisita = localStorage.getItem('ultima_visita_ts');
            const ahora = Date.now();
            const HORAS_12 = 12 * 60 * 60 * 1000;

            if (!ultimaVisita || (ahora - parseInt(ultimaVisita)) > HORAS_12) {
                console.log("Registrando visita recurrente...");
                const { error } = await supabaseClient.from('visitas').insert([{
                    cliente_id: clienteId,
                    motivo: 'Regreso al Menú'
                }]);

                if (!error) {
                    localStorage.setItem('ultima_visita_ts', ahora.toString());
                }
            }
        }
    } else {
        // Usuario nuevo: Mostrar modal
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    }
}

// FIX: Función solicitada para el botón anónimo
function cerrarWelcome() {
    activarModoAnonimo();
}

function activarModoAnonimo() {
    localStorage.setItem('modo_anonimo', 'true');
    const modal = document.getElementById('modal-welcome');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 400);
    }
    showToast("Modo Explorador Anónimo", "info");
}

// FIX: Validación telefónica corregida
function limpiarTelefono(input) {
    if (!input) return "";
    let limpio = input.replace(/\D/g, ''); // Eliminar todo lo que no sea dígito
    
    // Si tiene 10 dígitos y empieza por 53 (formato internacional sin +), quitamos el 53
    if (limpio.length === 10 && limpio.startsWith('53')) {
        limpio = limpio.substring(2);
    }
    // NOTA: Si el usuario escribe 8 dígitos (ej: 55555555), lo dejamos pasar.
    return limpio;
}

async function registrarBienvenida() {
    const inputNombre = document.getElementById('welcome-nombre');
    const inputPhone = document.getElementById('welcome-phone');
    const btn = document.querySelector('#modal-welcome button');

    const nombre = inputNombre.value ? inputNombre.value.trim() : '';
    const telefono = limpiarTelefono(inputPhone.value);

    // Validación básica: requerimos al menos 8 dígitos para Cuba
    if (!nombre || !telefono || telefono.length < 8) {
        showToast("Nombre y teléfono válido (min 8 dígitos) requeridos.", "warning");
        return;
    }

    if(btn) { btn.textContent = "Entrando..."; btn.disabled = true; }

    try {
        // Buscar o crear cliente
        let { data: cliente } = await supabaseClient
            .from('clientes')
            .select('id')
            .eq('telefono', telefono)
            .single();

        let clienteId = cliente ? cliente.id : null;

        if (!clienteId) {
            const { data: nuevo } = await supabaseClient
                .from('clientes')
                .insert([{ nombre, telefono }])
                .select()
                .single();
            clienteId = nuevo.id;
        }

        // Registrar primera visita
        await supabaseClient.from('visitas').insert([{
            cliente_id: clienteId,
            motivo: 'Ingreso Inicial'
        }]);

        // Guardar sesión local
        localStorage.setItem('cliente_id', clienteId);
        localStorage.setItem('cliente_nombre', nombre);
        localStorage.removeItem('modo_anonimo'); // Ya no es anónimo
        localStorage.setItem('ultima_visita_ts', Date.now().toString());

        // Cerrar modal
        const modal = document.getElementById('modal-welcome');
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 400);
        showToast(`¡Bienvenido, ${nombre}!`, "success");

    } catch (err) {
        console.error("Error registro:", err);
        // Fallback: permitir entrada local en caso de error de red crítico
        cerrarWelcome(); 
    } finally {
        if(btn) { btn.textContent = "INGRESAR"; btn.disabled = false; }
    }
}

// --- MENÚ Y PRODUCTOS ---
// FIX: Mejor manejo de estados (Loading, Error, Vacío)
async function cargarMenu() {
    const grid = document.getElementById('menu-grid');
    
    // 1. Mostrar estado de carga si no hay caché inmediata
    const menuCache = localStorage.getItem('menu_cache');
    if (menuCache) {
        todosLosProductos = JSON.parse(menuCache);
        renderizarMenu(todosLosProductos);
    } else {
        if(grid) grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px;">
                <span class="material-icons spin" style="font-size:2rem; color:var(--neon-cyan);">refresh</span>
                <p style="color:#888; margin-top:10px;">Cargando carta...</p>
            </div>`;
    }

    // 2. Network Update
    try {
        if (typeof supabaseClient === 'undefined') throw new Error("Supabase no definido");

        let { data: productos, error } = await supabaseClient
            .from('productos')
            .select(`*, opiniones(puntuacion)`)
            .eq('activo', true)
            .order('destacado', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;

        // Manejo explícito de carta vacía desde BD
        if (!productos || productos.length === 0) {
            todosLosProductos = [];
            localStorage.removeItem('menu_cache');
            renderizarMenu([]); // Renderizará el mensaje de "Carta Vacía"
            return;
        }

        // Calcular ratings
        const productosProcesados = productos.map(prod => {
            const opiniones = prod.opiniones || [];
            const total = opiniones.length;
            const suma = opiniones.reduce((acc, curr) => acc + curr.puntuacion, 0);
            prod.ratingPromedio = total ? (suma / total).toFixed(1) : null;
            return prod;
        });

        localStorage.setItem('menu_cache', JSON.stringify(productosProcesados));
        todosLosProductos = productosProcesados;
        renderizarMenu(todosLosProductos);

    } catch (err) {
        console.warn("Offline o error:", err);
        // Si no tenemos caché y falló la red
        if(!menuCache && grid) {
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:30px;">
                    <span class="material-icons" style="font-size:3rem; color:var(--neon-red);">wifi_off</span>
                    <h4 style="margin:10px 0;">Error de Conexión</h4>
                    <button class="btn-modal-action" onclick="cargarMenu()" style="width:auto; padding:0 20px;">REINTENTAR</button>
                </div>`;
        }
    }
}

function renderizarMenu(lista) {
    const contenedor = document.getElementById('menu-grid');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (!lista || lista.length === 0) {
        contenedor.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;"><h4>Carta Vacía o Sin Resultados</h4></div>';
        return;
    }

    const html = lista.map(item => {
        const esAgotado = item.estado === 'agotado';
        let badgeHTML = '';
        
        if (esAgotado) badgeHTML = `<span class="badge-agotado" style="color:var(--neon-red); border:1px solid var(--neon-red);">AGOTADO</span>`;
        else if (item.destacado) badgeHTML = `<span class="badge-destacado">🔥 HOT</span>`;

        const img = item.imagen_url || 'img/logo.png'; // Fallback a logo local
        const rating = item.ratingPromedio ? `★ ${item.ratingPromedio}` : '';
        const accionClick = esAgotado ? '' : `onclick="abrirDetalle(${item.id})"`;
        const claseAgotado = esAgotado ? 'agotado' : '';

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

// --- BÚSQUEDA Y FILTROS ---
const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const term = e.target.value.toLowerCase();
        searchTimeout = setTimeout(() => {
            const lista = todosLosProductos.filter(p => 
                (p.nombre || '').toLowerCase().includes(term) || 
                (p.descripcion || '').toLowerCase().includes(term)
            );
            renderizarMenu(lista);
        }, 300);
    });
}

function filtrar(cat, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    if(searchInput) searchInput.value = '';
    
    const lista = cat === 'todos' ? todosLosProductos : todosLosProductos.filter(p => p.categoria === cat);
    renderizarMenu(lista);
}

// --- DETALLES Y OPINIONES ---
function abrirDetalle(id) {
    productoActual = todosLosProductos.find(p => p.id === id);
    if (!productoActual) return;

    const imgEl = document.getElementById('det-img');
    if(imgEl) imgEl.src = productoActual.imagen_url || '';
    
    setText('det-titulo', productoActual.nombre);
    setText('det-desc', productoActual.descripcion);
    setText('det-precio', `$${productoActual.precio}`);
    setText('det-rating-big', productoActual.ratingPromedio ? `★ ${productoActual.ratingPromedio}` : '★ --');

    const box = document.getElementById('box-curiosidad');
    if (productoActual.curiosidad && productoActual.curiosidad.length > 5) {
        if(box) box.style.display = "block";
        setText('det-curiosidad', productoActual.curiosidad);
    } else {
        if(box) box.style.display = "none";
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

function abrirOpinionDesdeDetalle() {
    cerrarDetalle();
    const modal = document.getElementById('modal-opinion');
    setTimeout(() => {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        
        const nombreGuardado = localStorage.getItem('cliente_nombre');
        const inputNombre = document.getElementById('cliente-nombre');
        if(nombreGuardado && inputNombre) inputNombre.value = nombreGuardado;

        puntuacion = 0;
        actualizarEstrellas();
    }, 300);
}

function cerrarModalOpiniones() {
    const modal = document.getElementById('modal-opinion');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 350);
}

// Estrellas
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

    // Rate Limiting (Anti-Spam Local)
    const LAST_OPINION = 'last_opinion_ts';
    const lastTime = localStorage.getItem(LAST_OPINION);
    const ahora = Date.now();
    
    if (lastTime && (ahora - parseInt(lastTime)) < 12 * 60 * 60 * 1000) {
        showToast("Solo puedes opinar cada 12 horas.", "warning");
        return;
    }

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
        localStorage.setItem(LAST_OPINION, ahora.toString());
        showToast("¡Gracias por tu opinión!", "success");
        cerrarModalOpiniones();
        document.getElementById('cliente-comentario').value = "";
        cargarMenu();
    } else {
        showToast("Error: " + error.message, "error");
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

window.addEventListener('online', () => { updateConnectionStatus(); showToast("Conexión restaurada"); cargarMenu(); });
window.addEventListener('offline', () => { updateConnectionStatus(); showToast("Modo Offline", "warning"); });

// ==========================================
// 🌪️ SHAKER VIRTUAL (Mixer IA)
// ==========================================

const ESENCIAS = [
    { id: 'fresco', icono: '🧊', nombre: 'Fresco' },
    { id: 'dulce', icono: '🍬', nombre: 'Dulce' },
    { id: 'fuerte', icono: '🔥', nombre: 'Potente' },
    { id: 'frutal', icono: '🍍', nombre: 'Frutal' },
    { id: 'amargo', icono: '🍋', nombre: 'Ácido' },
    { id: 'party', icono: '🎉', nombre: 'Fiesta' }
];

let shakerState = {
    seleccionados: [],
    isShaking: false,
    shakeCount: 0
};

let watchID = null; // Para el acelerómetro

function abrirShaker() {
    const modal = document.getElementById('modal-shaker');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Reiniciar estado
    shakerState.seleccionados = [];
    renderizarEsencias();
    actualizarEstadoShaker();
    
    // FIX: Intentar pedir permisos para iOS al abrir el shaker (user gesture)
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
    } else {
        if (shakerState.seleccionados.length < 3) {
            shakerState.seleccionados.push(esencia.nombre);
            btnElement.classList.add('selected');
        } else {
            showToast("Máximo 3 ingredientes", "warning");
        }
    }
    actualizarEstadoShaker();
}

function actualizarEstadoShaker() {
    const count = shakerState.seleccionados.length;
    const visual = document.getElementById('shaker-img');
    const status = document.getElementById('shaker-status');
    const btn = document.getElementById('btn-mix-manual');
    const icon = visual.querySelector('.material-icons');

    if (count === 0) {
        status.textContent = "Añade ingredientes...";
        visual.classList.remove('ready');
        icon.style.color = "#ccc";
        btn.disabled = true;
        btn.style.opacity = "0.5";
    } else {
        status.textContent = `${count}/3 Ingredientes`;
        icon.style.color = "white";
        
        if (count >= 1) { 
            visual.classList.add('ready');
            status.textContent = "¡Agita tu móvil o pulsa el botón!";
            status.style.color = "var(--gold)";
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
}

// --- DETECTOR DE AGITACIÓN (SHAKE) ---
function iniciarDetectorMovimiento() {
    // FIX: Soporte para iOS 13+ que requiere permiso explícito
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    activarSensores();
                } else {
                    showToast("Permiso de acelerómetro denegado.", "error");
                }
            })
            .catch(console.error);
    } else {
        // Dispositivos no-iOS o versiones antiguas
        activarSensores();
    }
}

function activarSensores() {
    if (window.DeviceMotionEvent) {
        // FIX: Umbral aumentado para evitar falsos positivos
        const umbral = 25; 
        let lastX = 0, lastY = 0, lastZ = 0;

        const handleMotion = (event) => {
            if (shakerState.isProcessing) return; 
            if (shakerState.seleccionados.length === 0) return;

            const acc = event.accelerationIncludingGravity;
            if (!acc) return;

            const deltaX = Math.abs(acc.x - lastX);
            const deltaY = Math.abs(acc.y - lastY);
            const deltaZ = Math.abs(acc.z - lastZ);

            if (deltaX + deltaY + deltaZ > umbral) {
                shakerState.shakeCount++;
                document.getElementById('shaker-img').classList.add('shaking');
                
                // Necesita agitarse un poco más consistentemente
                if (shakerState.shakeCount > 8) {
                    procesarMezcla();
                    shakerState.shakeCount = 0; 
                }
                
                clearTimeout(shakerState.shakeTimer);
                shakerState.shakeTimer = setTimeout(() => {
                    document.getElementById('shaker-img').classList.remove('shaking');
                }, 300);
            }

            lastX = acc.x;
            lastY = acc.y;
            lastZ = acc.z;
        };
        
        window.addEventListener('devicemotion', handleMotion, true);
        watchID = handleMotion;
    }
}

function detenerDetectorMovimiento() {
    if (watchID) {
        window.removeEventListener('devicemotion', watchID, true);
        watchID = null;
    }
}

// --- LLAMADA A LA IA ---
async function procesarMezcla() {
    if (shakerState.isProcessing) return;
    shakerState.isProcessing = true;
    detenerDetectorMovimiento(); 

    // UI Feedback
    const btn = document.getElementById('btn-mix-manual');
    const status = document.getElementById('shaker-status');
    const visual = document.getElementById('shaker-img');
    
    btn.textContent = "Mezclando sabores...";
    status.textContent = "🧠 La IA está probando la mezcla...";
    visual.classList.add('shaking'); 

    // Preparar datos para Google Script
    const menuSimple = todosLosProductos.map(p => p.nombre).join(', ');
    const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbwfGlwmuKVSy630EnyWR4gJ0k-5hPVIwWg_bXS07m0v79KahgZ8J3Eyvi_DQu1-MbOg/exec";

    try {
        const response = await fetch(URL_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({
                tipo: "Cualquiera", 
                sabor: shakerState.seleccionados.join(', '), 
                menu: menuSimple 
            }),
            headers: { "Content-Type": "text/plain" }
        });

        const data = await response.json();
        
        if (data.recomendacion) {
            mostrarResultadoShaker(data.recomendacion);
        } else {
            throw new Error("Sin respuesta válida");
        }

    } catch (error) {
        console.error(error);
        status.textContent = "Error de conexión. Intenta de nuevo.";
        shakerState.isProcessing = false;
        visual.classList.remove('shaking');
        btn.textContent = "¡MEZCLAR AHORA!";
        btn.disabled = false;
    }
}

function mostrarResultadoShaker(nombreRecibido) {
    const nombreIA = nombreRecibido.toLowerCase().trim();

    const producto = todosLosProductos.find(p => {
        const nombreBD = p.nombre.toLowerCase();
        return nombreBD.includes(nombreIA) || nombreIA.includes(nombreBD);
    });

    cerrarShaker();

    if (producto) {
        abrirDetalle(producto.id);
        showToast(`✨ Combinación perfecta: ${producto.nombre}`);
    } else {
        const fallback = todosLosProductos.find(p => p.destacado) || todosLosProductos[0];
        if (fallback) abrirDetalle(fallback.id);
        showToast("¡Sorpresa! Prueba nuestra recomendación de la casa", "info");
    }
    
    shakerState.isProcessing = false;
}