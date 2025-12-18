// --- LÓGICA DE BIENVENIDA ---

// Se ejecuta apenas carga la página
// --- LÓGICA DE BIENVENIDA Y VISITAS MEJORADA ---

// --- LÓGICA DE VISITAS INTELIGENTE (1 Visita cada 12 horas) ---

document.addEventListener('DOMContentLoaded', async () => {

    // js/script.js - Reemplaza la función cargarMenu existente

async function cargarMenu() {
    const grid = document.getElementById('menu-grid');
    if (!grid) return;

    // 1. ESTRATEGIA "CACHE-FIRST": Mostrar lo guardado INMEDIATAMENTE
    const menuCache = localStorage.getItem('menu_cache');
    if (menuCache) {
        console.log("📂 Cargando menú desde caché local...");
        todosLosProductos = JSON.parse(menuCache);
        renderizarMenu(todosLosProductos);
    } else {
        // Solo mostrar loader si no hay nada en caché
        grid.innerHTML = '<p style="text-align:center; color:#888; padding:40px;">Cargando carta...</p>';
    }

    // 2. ACTUALIZAR EN SEGUNDO PLANO (Network)
    try {
        if (typeof supabaseClient === 'undefined') throw new Error("Supabase off");

        let { data: productos, error } = await supabaseClient
            .from('productos')
            .select(`*, opiniones(puntuacion)`)
            .eq('activo', true)
            .order('destacado', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;

        // Calcular ratings
        const productosProcesados = productos.map(prod => {
            const opiniones = prod.opiniones || [];
            const total = opiniones.length;
            const suma = opiniones.reduce((acc, curr) => acc + curr.puntuacion, 0);
            prod.ratingPromedio = total ? (suma / total).toFixed(1) : null;
            return prod;
        });

        // 3. ACTUALIZAR CACHÉ Y VISTA (Solo si hubo cambios o es la primera vez)
        // Guardamos en localStorage para la próxima
        localStorage.setItem('menu_cache', JSON.stringify(productosProcesados));
        
        todosLosProductos = productosProcesados;
        renderizarMenu(todosLosProductos); 
        console.log("☁️ Menú actualizado desde Internet");

    } catch (err) {
        console.error("⚠️ Modo Offline: Usando versión en caché.", err);
        // Si falló internet y no teníamos caché, mostramos error
        if (!menuCache) {
            grid.innerHTML = '<div style="text-align:center; padding:30px;">📡 Sin conexión y sin menú guardado.<br>Intenta recargar.</div>';
        } else {
            showToast("Modo Offline: Viendo menú guardado", "warning");
        }
    }
}
});

function cerrarWelcome() {
    const modal = document.getElementById('modal-welcome');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 400);
}
// Función auxiliar para estandarizar números (Cuba / Internacional)
// Función auxiliar para limpiar teléfonos (PON ESTO FUERA DE LA FUNCIÓN registrarBienvenida)
function limpiarTelefono(input) {
    if (!input) return "";
    
    // 1. Eliminar todo lo que NO sea número
    let limpio = input.replace(/\D/g, '');

    // 2. Regla especial para Cuba (si viene como 53 + 8 dígitos = 10 en total)
    if (limpio.length === 10 && limpio.startsWith('53')) {
        limpio = limpio.substring(2);
    }

    return limpio;
}

async function registrarBienvenida() {
    const inputNombre = document.getElementById('welcome-nombre');
    const inputPhone = document.getElementById('welcome-phone');
    const btn = document.querySelector('#modal-welcome button');

    // 2. Obtener valores y Limpiar
    const nombre = inputNombre.value ? inputNombre.value.trim() : '';
    
    const telefonoRaw = inputPhone.value; 
    const telefono = limpiarTelefono(telefonoRaw); // Usamos nuestra función mágica

    // 3. Validación Correcta
    // Si no hay nombre, O no hay teléfono, O el teléfono tiene MENOS de 8 dígitos...
    if (!nombre || !telefono || telefono.length < 8) {
        showToast("Por favor ingresa un nombre y un teléfono válido (8 dígitos).");
        return;
    }

    btn.textContent = "Ingresando..."; 
    btn.disabled = true;

    try {
        // 4. Buscar si ya existe el cliente
        let { data: cliente, error } = await supabaseClient
            .from('clientes')
            .select('id')
            .eq('telefono', telefono)
            .single();

        let clienteId;

        // 5. Si no existe, lo creamos
        if (!cliente) {
            const { data: nuevo, error: errCrear } = await supabaseClient
                .from('clientes')
                .insert([{ nombre, telefono }])
                .select()
                .single();
            
            if (errCrear) throw errCrear;
            clienteId = nuevo.id;
        } else {
            clienteId = cliente.id;
        }

        // 6. Registramos la visita
        await supabaseClient.from('visitas').insert([{
            cliente_id: clienteId,
            motivo: 'Ingreso Menú'
        }]);

        sessionStorage.setItem('visita_registrada', 'true');

        // 7. Guardamos en el celular (LocalStorage)
        localStorage.setItem('cliente_id', clienteId);
        localStorage.setItem('cliente_nombre', nombre);
        localStorage.setItem('ultima_visita_ts', Date.now().toString());
        
        // 8. Cerrar modal y notificar éxito
        cerrarWelcome();
        showToast(`¡Bienvenido, ${nombre}!`, "success");

    } catch (err) {
        console.error("Error registro:", err);
        // Si falla (ej: error de red), dejamos pasar al usuario igual para no bloquearlo
        alert("Ocurrió un error de conexión, pero puedes ver el menú.");
        cerrarWelcome();
    } finally {
        // Restaurar botón por si acaso el modal no se cerró
        if(btn) {
            btn.textContent = "INGRESAR AL BAR";
            btn.disabled = false;
        }
    }
}
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
        contenedor.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#666;"><h4>Carta Vacía</h4></div>';
        return;
    }

    const html = lista.map(item => {
        const esAgotado = item.estado === 'agotado';
        
        let badgeHTML = '';
        if (esAgotado) {
            // Estilo Agotado en Rojo Neon
            badgeHTML = `<span class="badge-agotado" style="color:var(--neon-red); border-color:var(--neon-red);">AGOTADO</span>`;
        } else if (item.destacado) {
            // Estilo Destacado
            badgeHTML = `<span class="badge-destacado">🔥 HOT</span>`;
        }

        const img = item.imagen_url || 'https://via.placeholder.com/300x300/000000/333333?text=No+Image';
        const rating = item.ratingPromedio ? `★ ${item.ratingPromedio}` : '';
        const accionClick = esAgotado ? '' : `onclick="abrirDetalle(${item.id})"`;
        const claseAgotado = esAgotado ? 'agotado' : '';

        return `
            <div class="card ${claseAgotado}" ${accionClick}>
                ${badgeHTML}
                <div class="img-box">
                    <img src="${img}" loading="lazy" alt="${item.nombre}">
                </div>
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

    // Manejo de curiosidad (CORREGIDO: Se muestra correctamente aquí)
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
        
        const nombreGuardado = localStorage.getItem('cliente_nombre');
        const inputNombre = document.getElementById('cliente-nombre');
        
        // Si existe el nombre guardado y el input, lo escribimos
        if(nombreGuardado && inputNombre) {
            inputNombre.value = nombreGuardado;
        }

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
        showToast("¡Gracias! Tu opinión ha sido registrada.", "success");
        cerrarModalOpiniones();
        document.getElementById('cliente-comentario').value = "";
        cargarMenu(); 
    } else {
        showToast("Error: " + error.message, "error");
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

function showToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;

    // Crear el elemento HTML
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    // Icono según tipo
    const icono = tipo === 'success' ? '✨' : '⚠️';
    
    toast.innerHTML = `
        <span class="toast-icon">${icono}</span>
        <span class="toast-msg">${mensaje}</span>
    `;

    // Agregar al contenedor
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.4s forwards';
        setTimeout(() => toast.remove(), 400); // Esperar a que termine la animación
    }, 4000);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log('PWA registrada (Modo Cuba activado)'))
    .catch((err) => console.log('Error PWA:', err));
}

// Lógica de Estado de Conexión (Offline/Online)
function updateConnectionStatus() {
    const statusText = document.getElementById('connection-status');
    const statusDot = document.getElementById('status-dot');
    
    if (!statusText) return;

    if (navigator.onLine) {
        statusText.textContent = "Conectado";
        statusText.style.color = "var(--green-success)"; // Asegúrate de tener esta variable o usa #00e676
        statusDot.style.backgroundColor = "#00e676";
        statusDot.style.boxShadow = "0 0 8px #00e676";
    } else {
        statusText.textContent = "Modo Offline";
        statusText.style.color = "var(--neon-red)";
        statusDot.style.backgroundColor = "var(--neon-red)";
        statusDot.style.boxShadow = "none";
    }
}

// Escuchar cambios de red
window.addEventListener('online', () => {
    updateConnectionStatus();
    showToast("¡Conexión restaurada!", "success");
    cargarMenu(); // Reintentar cargar menú fresco
});

window.addEventListener('offline', () => {
    updateConnectionStatus();
    showToast("Sin conexión. Usando datos guardados.", "error");
});

// Ejecutar al inicio
document.addEventListener('DOMContentLoaded', updateConnectionStatus);