// admin.js COMPLETO Y CORREGIDO

let inventarioGlobal = []; // Almacena los productos cargados para poder editarlos
let searchTimeout; // Para el debounce del buscador

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
        cargarAdmin();
    }
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}

// 2. CARGAR INVENTARIO (Ahora solo carga y llama a renderizar)
async function cargarAdmin() {
    const lista = document.getElementById('lista-admin');
    if (lista) lista.innerHTML = '<div style="text-align:center; padding:40px; color:#aaa;">⟳ Cargando inventario...</div>';

    // Traemos los productos activos
    let { data: productos, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('id', { ascending: false });

    if (error) { 
        alert("Error al cargar: " + error.message); 
        return; 
    }
    
    // Guardamos en variable global para usar al editar y buscar
    inventarioGlobal = productos || [];

    // Renderizamos la lista completa
    renderizarInventario(inventarioGlobal);

    // 3. AGREGAR LISTENER AL BUSCADOR
    const searchInput = document.getElementById('search-inventory');
    if (searchInput) {
        searchInput.addEventListener('input', buscarInventario);
    }

    if (typeof cargarOpiniones === "function") {
        cargarOpiniones();
    }
    
    // Inicializar carga de Visitas
    cargarVisitas();
}


/**
 * RENDERIZA EL INVENTARIO EN EL ADMIN PANEL
 * @param {Array} lista - Lista de productos a renderizar.
 */
function renderizarInventario(lista) {
    const listaContainer = document.getElementById('lista-admin');
    if (!listaContainer) return;
    
    listaContainer.innerHTML = '';

    if (!lista || lista.length === 0) {
        listaContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No hay productos que coincidan con la búsqueda.</p>';
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
                    <button class="icon-btn" onclick="prepararEdicion(${item.id})" title="Editar" style="color:#fff;">
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

/**
 * Función de búsqueda con 'debounce' (retraso para evitar llamadas excesivas)
 */
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
    }, 300); // Espera 300ms después de la última pulsación
}

// 3. GENERAR CURIOSIDAD CON IA (AHORA UN GENERADOR DE TEXTO BÁSICO LOCAL)

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
    campo.value = "Generando dato curioso simple...";

    // Simulamos la espera para dar una sensación de "carga"
    await new Promise(resolve => setTimeout(resolve, 800)); 

    // --- LÓGICA DE GENERADOR DE TEXTO BÁSICO ---
    const curiosidades = [
        `Sabías que el plato original de '${nombre}' se inventó en la época de la posguerra.`,
        `Este plato, el '${nombre}' tiene su origen en la región oriental del país.`,
        `La clave para el sabor único de '${nombre}' está en el reposo de su ingrediente principal.`,
        `Se dice que '${nombre}' era el plato favorito de un famoso escritor del siglo pasado.`,
        `El '${nombre}' es un clásico que se ha mantenido en nuestro menú desde el día uno.`,
        `Nuestro chef recomienda maridar el '${nombre}' con un vino tinto de la casa.`
    ];

    // Selecciona una curiosidad al azar
    const indice = Math.floor(Math.random() * curiosidades.length);
    campo.value = curiosidades[indice];
    // --- FIN LÓGICA BÁSICA ---


    loader.style.display = "none"; 
    btn.disabled = false;
}
// 4. FUNCIONES DE EDICIÓN (NUEVAS)
function prepararEdicion(id) {
    const producto = inventarioGlobal.find(p => p.id === id);
    if (!producto) return;

    // Llenar inputs
    document.getElementById('edit-id').value = producto.id;
    document.getElementById('nombre').value = producto.nombre;
    document.getElementById('precio').value = producto.precio;
    document.getElementById('categoria').value = producto.categoria;
    document.getElementById('descripcion').value = producto.descripcion || '';
    document.getElementById('curiosidad').value = producto.curiosidad || '';
    document.getElementById('destacado').checked = producto.destacado;

    // Ajustar UI
    document.getElementById('btn-submit').textContent = "ACTUALIZAR PRODUCTO";
    document.getElementById('btn-cancelar').style.display = "block";
    
    // Ir arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    document.getElementById('form-producto').reset();
    document.getElementById('edit-id').value = ""; // Limpiar ID
    
    document.getElementById('btn-submit').textContent = "GUARDAR PRODUCTO";
    document.getElementById('btn-cancelar').style.display = "none";
}

// 5. GUARDAR O ACTUALIZAR PRODUCTO
const form = document.getElementById('form-producto');
if(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('btn-submit');
        const textoOriginal = btn.textContent;
        btn.textContent = "Procesando..."; 
        btn.disabled = true;

        try {
            // Recoger datos
            const idEdicion = document.getElementById('edit-id').value;
            const nombre = document.getElementById('nombre').value;
            const precio = document.getElementById('precio').value;
            const categoria = document.getElementById('categoria').value;
            const descripcion = document.getElementById('descripcion').value;
            const curiosidad = document.getElementById('curiosidad').value;
            const destacado = document.getElementById('destacado').checked;
            const fileInput = document.getElementById('imagen-file');

            let urlImagen = null;

            // --- Lógica de Imagen ---
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
            } else {
                // Si es nuevo, la imagen es obligatoria
                if (!idEdicion) throw new Error("Debes subir una imagen para un producto nuevo.");
            }

            // Datos base
            const datos = {
                nombre, 
                precio, 
                categoria, 
                descripcion, 
                curiosidad, 
                destacado
            };

            // Solo actualizamos imagen si subieron una nueva
            if (urlImagen) {
                datos.imagen_url = urlImagen;
            }

            let errorDb;

            if (idEdicion) {
                // --- UPDATE (Editar) ---
                const { error } = await supabaseClient
                    .from('productos')
                    .update(datos)
                    .eq('id', idEdicion);
                errorDb = error;
            } else {
                // --- INSERT (Crear) ---
                datos.estado = 'disponible';
                datos.activo = true;
                const { error } = await supabaseClient
                    .from('productos')
                    .insert([datos]);
                errorDb = error;
            }

            if (errorDb) throw errorDb;
            
            alert(idEdicion ? "¡Producto actualizado!" : "¡Producto creado!");
            cancelarEdicion(); // Resetea form y botones
            cargarAdmin(); // Recarga lista

        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            btn.textContent = textoOriginal; 
            btn.disabled = false;
        }
    });
}

// 6. ACCIONES RÁPIDAS (Switch, Estrella, Borrar)
async function toggleDestacado(id, valorActual) {
    await supabaseClient.from('productos').update({ destacado: !valorActual }).eq('id', id);
    cargarAdmin();
}

async function toggleEstado(id, estadoActual) {
    const nuevoEstado = estadoActual === 'disponible' ? 'agotado' : 'disponible';
    const { error } = await supabaseClient.from('productos').update({ estado: nuevoEstado }).eq('id', id);
    if(error) alert("Error: " + error.message);
    else cargarAdmin();
}

async function eliminarProducto(id) {
    if(confirm("¿Estás seguro de eliminar este producto?")) {
        await supabaseClient.from('productos').update({ activo: false }).eq('id', id);
        cargarAdmin();
    }
}

// 7. FUNCIONES DE VISITAS (NUEVAS)

// Calcula la fecha de inicio para el filtro (ej. 01 del mes actual)
function getFechaFiltro(tipo) {
    const now = new Date();
    let start;

    switch (tipo) {
        case 'dia':
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'mes':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'anual':
            start = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            return null;
    }
    // Formato ISO para Supabase (YYYY-MM-DDTHH:MM:SS)
    return start.toISOString(); 
}

async function cargarVisitas() {
    const elements = {
        hoy: document.getElementById('stat-hoy'),
        mes: document.getElementById('stat-mes'),
        anual: document.getElementById('stat-anual'),
        total: document.getElementById('stat-total-visitas')
    };

    // Poner loaders
    Object.values(elements).forEach(el => {
        if(el) el.textContent = '...';
    });

    try {
        // 1. Total Histórico
        const { count: totalCount, error: totalError } = await supabaseClient
            .from('visitas')
            .select('*', { count: 'exact', head: true });

        if (totalError) throw totalError;
        if(elements.total) elements.total.textContent = totalCount;

        // 2. Visitas Hoy
        const startDia = getFechaFiltro('dia');
        // DEBUG: Muestra la cadena de tiempo que se usa para filtrar
        console.log("Filtro Hoy (>=):", startDia); 
        const { count: diaCount, error: diaError } = await supabaseClient
            .from('visitas')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startDia);

        if (diaError) throw diaError;
        if(elements.hoy) elements.hoy.textContent = diaCount;
        
        // 3. Visitas Mes
        const startMes = getFechaFiltro('mes');
        const { count: mesCount, error: mesError } = await supabaseClient
            .from('visitas')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startMes);

        if (mesError) throw mesError;
        if(elements.mes) elements.mes.textContent = mesCount;

        // 4. Visitas Año
        const startAnual = getFechaFiltro('anual');
        const { count: anualCount, error: anualError } = await supabaseClient
            .from('visitas')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startAnual);

        if (anualError) throw anualError;
        if(elements.anual) elements.anual.textContent = anualCount;

    } catch (e) {
        console.error("Error al cargar estadísticas de visitas:", e.message);
        Object.values(elements).forEach(el => {
            if(el) el.textContent = 'Error';
        });
    }
}


// Inicializar
document.addEventListener('DOMContentLoaded', checkAuth);

// --- SISTEMA DE PESTAÑAS ---
function cambiarVista(vistaNombre) {
    // 1. Ocultar todas las secciones
    document.querySelectorAll('.vista-seccion').forEach(el => el.style.display = 'none');
    
    // 2. Quitar clase 'active' de todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // 3. Mostrar la seleccionada
    const vista = document.getElementById(`vista-${vistaNombre}`);
    if(vista) vista.style.display = 'block';
    
    // Si la vista es 'visitas', recargamos por si acaso
    if (vistaNombre === 'visitas') {
        cargarVisitas();
    }

    // 4. Activar el botón correspondiente (Truco visual)
    const botones = document.querySelectorAll('.tab-btn');
    if(vistaNombre === 'inventario') botones[0].classList.add('active');
    if(vistaNombre === 'opiniones') botones[1].classList.add('active');
    if(vistaNombre === 'visitas') botones[2].classList.add('active'); // Nuevo
}