// admin.js CORREGIDO
let inventarioGlobal = []; 
let searchTimeout; 

// 1. VERIFICACIÓN DE SEGURIDAD
async function checkAuth() {
    if (typeof supabaseClient === 'undefined') { 
        console.error("Supabase no está definido. Revisa config.js"); 
        return; 
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = "login.html";
    } else {
        // Cargar vista inicial
        cargarAdmin();
    }
}

async function cargarAdmin() {
    // Por defecto cargamos el inventario
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('id', { ascending: false });

    if (error) {
        console.error("Error cargando productos:", error);
        return;
    }
    
    inventarioGlobal = data;
    renderizarInventario(inventarioGlobal);
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}

// --- 2. SISTEMA DE PESTAÑAS (Lógica Única y Correcta) ---
function cambiarVista(vistaNombre) {
    // A. Ocultar todas las secciones (quitando la clase active)
    document.querySelectorAll('.vista-seccion').forEach(el => {
        el.classList.remove('active');
        // Aseguramos que no queden estilos inline basura
        el.style.display = ''; 
    });
    
    // B. Desactivar todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // C. Mostrar la sección deseada
    const vistaDestino = document.getElementById(`vista-${vistaNombre}`);
    if (vistaDestino) {
        // Esto dispara la animación de opacidad en el CSS
        vistaDestino.classList.add('active');
    }

    // D. Activar el botón correspondiente (Visual)
    const botones = document.querySelectorAll('.tab-btn');
    if(vistaNombre === 'inventario') botones[0].classList.add('active');
    if(vistaNombre === 'opiniones') botones[1].classList.add('active');
    if(vistaNombre === 'visitas') botones[2].classList.add('active');

    // E. Cargar datos específicos si la vista lo requiere
    if (vistaNombre === 'visitas' && typeof cargarVisitas === 'function') {
        cargarVisitas();
    }
    if (vistaNombre === 'opiniones' && typeof cargarOpiniones === 'function') {
        cargarOpiniones(); 
    }
}

// --- 3. RENDERIZADO DE INVENTARIO ---
function renderizarInventario(lista) {
    const listaContainer = document.getElementById('lista-admin');
    if (!listaContainer) return;
    
    listaContainer.innerHTML = '';

    if (!lista || lista.length === 0) {
        listaContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No hay productos encontrados.</p>';
        return;
    }

    const html = lista.map(item => {
        const esAgotado = item.estado === 'agotado';
        const statusText = esAgotado ? 'AGOTADO' : 'DISPONIBLE';
        const statusClass = esAgotado ? 'status-bad' : 'status-ok';
        const iconState = esAgotado ? 'toggle_off' : 'toggle_on';
        const colorStateBtn = esAgotado ? '#666' : 'var(--green-success)';
        const favColor = item.destacado ? 'var(--gold)' : '#444';
        const img = item.imagen_url || 'https://via.placeholder.com/60';

        return `
            <div class="inventory-item">
                <img src="${img}" class="item-thumb" alt="Imagen">
                
                <div class="item-meta">
                    <span class="item-title">
                        ${item.nombre} ${item.destacado ? '🌟' : ''}
                    </span>
                    <span class="item-price">$${item.precio}</span>
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

                    <button class="icon-btn btn-del" onclick="eliminarProducto(${item.id})" title="Eliminar">
                        <span class="material-icons">delete</span>
                    </button>
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

// --- 4. GENERAR CURIOSIDAD (Simulado/IA) ---
async function generarCuriosidad() {
    const nombre = document.getElementById('nombre').value;
    const campo = document.getElementById('curiosidad');
    const loader = document.getElementById('loader-ia');
    const btn = document.getElementById('btn-ia');

    if (!nombre) { 
        alert("Escribe el nombre del producto primero."); 
        return; 
    }

    btn.disabled = true; 
    loader.style.display = "inline-block"; 
    campo.value = "Generando dato curioso...";

    await new Promise(resolve => setTimeout(resolve, 800)); 

    const curiosidades = [
        `El '${nombre}' es perfecto para compartir en una noche especial.`,
        `Nuestra versión del '${nombre}' incluye un ingrediente secreto de la casa.`,
        `Recomendamos acompañar el '${nombre}' con una bebida cítrica.`,
        `Este plato es uno de los más solicitados por nuestros clientes habituales.`
    ];

    const indice = Math.floor(Math.random() * curiosidades.length);
    campo.value = curiosidades[indice];

    loader.style.display = "none"; 
    btn.disabled = false;
}

// --- 5. EDICIÓN DE PRODUCTOS ---
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
        btn.textContent = "Guardando..."; 
        btn.disabled = true;

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

                const { error: upErr } = await supabaseClient.storage
                    .from('imagenes')
                    .upload(nombreArchivo, archivo);
                
                if (upErr) throw upErr;

                const { data: urlData } = supabaseClient.storage
                    .from('imagenes')
                    .getPublicUrl(nombreArchivo);
                
                urlImagen = urlData.publicUrl;
            }

            const datos = {
                nombre, precio, categoria, descripcion, curiosidad, destacado
            };

            if (urlImagen) datos.imagen_url = urlImagen;
            else if (!idEdicion && !urlImagen) {
                // Si es nuevo y no hay imagen, usar placeholder o lanzar error
                datos.imagen_url = 'https://via.placeholder.com/300'; 
            }

            let errorDb;
            if (idEdicion) {
                const { error } = await supabaseClient
                    .from('productos')
                    .update(datos)
                    .eq('id', idEdicion);
                errorDb = error;
            } else {
                datos.estado = 'disponible';
                datos.activo = true;
                const { error } = await supabaseClient
                    .from('productos')
                    .insert([datos]);
                errorDb = error;
            }

            if (errorDb) throw errorDb;
            
            alert(idEdicion ? "¡Actualizado!" : "¡Creado!");
            cancelarEdicion();
            cargarAdmin();

        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            btn.textContent = textoOriginal; 
            btn.disabled = false;
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
        await supabaseClient.from('productos').update({ activo: false }).eq('id', id);
        cargarAdmin();
    }
}

// INICIALIZAR
document.addEventListener('DOMContentLoaded', checkAuth);