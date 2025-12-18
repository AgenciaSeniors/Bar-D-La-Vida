// admin.js CORREGIDO Y SEGURO
let inventarioGlobal = []; 
let searchTimeout; 

// [SEGURIDAD] Función para sanitizar HTML (local scope)
function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

// 1. VERIFICACIÓN DE SEGURIDAD
async function checkAuth() {
    if (typeof supabaseClient === 'undefined') { 
        console.error("Supabase no está definido."); 
        return; 
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = "login.html";
    } else {
        cargarAdmin();
    }
}

async function cargarAdmin() {
    // RLS en Supabase rechazará esto si no hay sesión válida
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('id', { ascending: false }); // Quitamos .eq('activo', true) para que admin vea todo

    if (error) {
        console.error("Error cargando productos:", error);
        alert("Sesión expirada o sin permisos. Recarga la página.");
        return;
    }
    
    inventarioGlobal = data;
    renderizarInventario(inventarioGlobal);
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}

// --- 2. SISTEMA DE PESTAÑAS ---
function cambiarVista(vistaNombre) {
    document.querySelectorAll('.vista-seccion').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none'; // Forzamos ocultar
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const vistaDestino = document.getElementById(`vista-${vistaNombre}`);
    if (vistaDestino) {
        vistaDestino.style.display = 'block';
        // Timeout pequeño para permitir transición CSS si existe
        setTimeout(() => vistaDestino.classList.add('active'), 10);
    }

    const botones = document.querySelectorAll('.tab-btn');
    if(vistaNombre === 'inventario') botones[0]?.classList.add('active');
    if(vistaNombre === 'opiniones') botones[1]?.classList.add('active');
    if(vistaNombre === 'visitas') botones[2]?.classList.add('active');

    if (vistaNombre === 'visitas' && typeof cargarVisitas === 'function') cargarVisitas();
    if (vistaNombre === 'opiniones' && typeof cargarOpiniones === 'function') cargarOpiniones(); 
}

// --- 3. RENDERIZADO DE INVENTARIO SEGURO ---
function renderizarInventario(lista) {
    const listaContainer = document.getElementById('lista-admin');
    if (!listaContainer) return;
    
    listaContainer.innerHTML = '';

    if (!lista || lista.length === 0) {
        listaContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No hay productos.</p>';
        return;
    }

    const html = lista.map(item => {
        // Sanitización
        const nombreSafe = escapeHTML(item.nombre);
        const precioSafe = escapeHTML(item.precio);
        
        const esAgotado = item.estado === 'agotado';
        const statusText = esAgotado ? 'AGOTADO' : 'DISPONIBLE';
        const statusClass = esAgotado ? 'status-bad' : 'status-ok';
        const iconState = esAgotado ? 'toggle_off' : 'toggle_on';
        const colorStateBtn = esAgotado ? '#666' : 'var(--green-success)';
        const favColor = item.destacado ? 'var(--gold)' : '#444';
        const img = item.imagen_url || 'https://via.placeholder.com/60';

        // Opacidad si está eliminado lógicamente (activo=false)
        const opacityStyle = item.activo ? '' : 'opacity: 0.5; filter: grayscale(1);';
        const deletedBadge = !item.activo ? '<span style="color:red; font-size:0.7em; margin-left:5px;">(ELIMINADO)</span>' : '';

        return `
            <div class="inventory-item" style="${opacityStyle}">
                <img src="${img}" class="item-thumb" alt="Imagen">
                
                <div class="item-meta">
                    <span class="item-title">
                        ${nombreSafe} ${item.destacado ? '🌟' : ''} ${deletedBadge}
                    </span>
                    <span class="item-price">$${precioSafe}</span>
                    <span class="item-status ${statusClass}">${statusText}</span>
                </div>

                <div class="action-btn-group">
                    <button class="icon-btn" onclick="prepararEdicion(${item.id})" title="Editar">
                        <span class="material-icons">edit</span>
                    </button>

                    <button class="icon-btn" style="color:${favColor}" onclick="toggleDestacado(${item.id}, ${item.destacado})" title="Destacar">
                        <span class="material-icons">star</span>
                    </button>

                    <button class="icon-btn" style="color:${colorStateBtn}" onclick="toggleEstado(${item.id}, '${item.estado}')" title="Disponibilidad">
                        <span class="material-icons">${iconState}</span>
                    </button>

                    ${item.activo ? `
                    <button class="icon-btn btn-del" onclick="eliminarProducto(${item.id})" title="Eliminar">
                        <span class="material-icons">delete</span>
                    </button>` : `
                    <button class="icon-btn" onclick="restaurarProducto(${item.id})" title="Restaurar" style="color:var(--green-success)">
                        <span class="material-icons">restore_from_trash</span>
                    </button>`}
                </div>
            </div>
        `;
    }).join('');

    listaContainer.innerHTML = html;
}

function buscarInventario(e) {
    clearTimeout(searchTimeout);
    const term = e.target.value.toLowerCase();

    searchTimeout = setTimeout(() => {
        const listaFiltrada = inventarioGlobal.filter(p => 
            p.nombre.toLowerCase().includes(term) || 
            (p.descripcion && p.descripcion.toLowerCase().includes(term)) ||
            (p.categoria && p.categoria.toLowerCase().includes(term))
        );
        renderizarInventario(listaFiltrada);
    }, 300);
}

// --- 4. GENERAR CURIOSIDAD (Mantenido igual) ---
async function generarCuriosidad() {
    const nombreInput = document.getElementById('nombre');
    const campoResultado = document.getElementById('curiosidad');
    const loader = document.getElementById('loader-ia');
    const btn = document.getElementById('btn-ia');
    const nombre = nombreInput.value;

    if (!nombre) { alert("⚠️ Escribe el nombre del producto."); nombreInput.focus(); return; }

    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwfGlwmuKVSy630EnyWR4gJ0k-5hPVIwWg_bXS07m0v79KahgZ8J3Eyvi_DQu1-MbOg/exec";

    if(btn) { btn.disabled = true; btn.textContent = "✨ ..."; btn.style.opacity = "0.7"; }
    if(loader) loader.style.display = "inline-block"; 
    campoResultado.value = "Consultando a la IA...";

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ producto: nombre }),
            headers: { "Content-Type": "text/plain" } 
        });
        const data = await response.json();
        if (data.curiosidad) campoResultado.value = data.curiosidad;
        else campoResultado.value = "La IA no respondió.";
    } catch (err) {
        campoResultado.value = "Error de conexión.";
    } finally {
        if(loader) loader.style.display = "none"; 
        if(btn) { btn.disabled = false; btn.textContent = "Generar"; btn.style.opacity = "1"; }
    }
}

// --- 5. EDICIÓN ---
function prepararEdicion(id) {
    const producto = inventarioGlobal.find(p => p.id === id);
    if (!producto) return;

    document.getElementById('edit-id').value = producto.id;
    document.getElementById('nombre').value = producto.nombre;
    document.getElementById('precio').value = producto.precio;
    document.getElementById('categoria').value = producto.categoria;
    document.getElementById('descripcion').value = producto.descripcion || '';
    document.getElementById('curiosidad').value = producto.curiosidad || '';
    document.getElementById('destacado').checked = producto.destacado;

    const btnSubmit = document.getElementById('btn-submit');
    if(btnSubmit) btnSubmit.textContent = "ACTUALIZAR PRODUCTO";
    
    const btnCancel = document.getElementById('btn-cancelar');
    if(btnCancel) btnCancel.style.display = "block";
    
    // Cambiar a vista inventario y subir
    cambiarVista('inventario');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    document.getElementById('form-producto').reset();
    document.getElementById('edit-id').value = ""; 
    const btnSubmit = document.getElementById('btn-submit');
    if(btnSubmit) btnSubmit.textContent = "GUARDAR PRODUCTO";
    const btnCancel = document.getElementById('btn-cancelar');
    if(btnCancel) btnCancel.style.display = "none";
}

// --- 6. GUARDAR (INSERT/UPDATE) ---
const form = document.getElementById('form-producto');
if(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('btn-submit');
        const textoOriginal = btn.textContent;
        btn.textContent = "Guardando..."; btn.disabled = true;

        try {
            const idEdicion = document.getElementById('edit-id').value;
            const nombre = document.getElementById('nombre').value;
            const precio = document.getElementById('precio').value;
            const categoria = document.getElementById('categoria').value;
            const descripcion = document.getElementById('descripcion').value;
            const curiosidad = document.getElementById('curiosidad').value;
            const destacado = document.getElementById('destacado').checked;
            const fileInput = document.getElementById('imagen-file');

            let urlImagen = null;

            if (fileInput.files.length > 0) {
                const archivo = fileInput.files[0];
                const extension = archivo.name.split('.').pop();
                const nombreArchivo = `prod_${Date.now()}.${extension}`;
                
                // Nota: Requiere política de Storage en Supabase
                const { error: upErr } = await supabaseClient.storage
                    .from('imagenes')
                    .upload(nombreArchivo, archivo);
                
                if (upErr) throw upErr;

                const { data: urlData } = supabaseClient.storage
                    .from('imagenes')
                    .getPublicUrl(nombreArchivo);
                urlImagen = urlData.publicUrl;
            }

            const datos = { nombre, precio, categoria, descripcion, curiosidad, destacado };
            if (urlImagen) datos.imagen_url = urlImagen;

            let errorDb;
            if (idEdicion) {
                const { error } = await supabaseClient.from('productos').update(datos).eq('id', idEdicion);
                errorDb = error;
            } else {
                datos.estado = 'disponible';
                datos.activo = true;
                const { error } = await supabaseClient.from('productos').insert([datos]);
                errorDb = error;
            }

            if (errorDb) throw errorDb;
            alert(idEdicion ? "¡Actualizado!" : "¡Creado!");
            cancelarEdicion();
            cargarAdmin();

        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            btn.textContent = textoOriginal; btn.disabled = false;
        }
    });
}

// --- 7. ACCIONES RÁPIDAS ---
async function toggleDestacado(id, valorActual) {
    await supabaseClient.from('productos').update({ destacado: !valorActual }).eq('id', id);
    cargarAdmin();
}

async function toggleEstado(id, estadoActual) {
    const nuevoEstado = estadoActual === 'disponible' ? 'agotado' : 'disponible';
    await supabaseClient.from('productos').update({ estado: nuevoEstado }).eq('id', id);
    cargarAdmin();
}

async function eliminarProducto(id) {
    if(confirm("¿Estás seguro de eliminar este producto?")) {
        // Borrado lógico
        await supabaseClient.from('productos').update({ activo: false }).eq('id', id);
        cargarAdmin();
    }
}

async function restaurarProducto(id) {
    await supabaseClient.from('productos').update({ activo: true }).eq('id', id);
    cargarAdmin();
}

document.addEventListener('DOMContentLoaded', checkAuth);