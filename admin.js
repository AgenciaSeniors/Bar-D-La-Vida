// admin.js COMPLETO Y CORREGIDO

let inventarioGlobal = []; // Almacena los productos cargados para poder editarlos

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

// 2. CARGAR INVENTARIO
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
    
    // Guardamos en variable global para usar al editar
    inventarioGlobal = productos || [];

    if (!productos || productos.length === 0) {
        if (lista) lista.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">El inventario está vacío.<br><small>Añade tu primer producto a la izquierda.</small></p>';
        return;
    }

    const html = productos.map(item => {
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

    if (lista) lista.innerHTML = html;

    if (typeof cargarOpiniones === "function") {
        cargarOpiniones();
    }
}

// 3. GENERAR CURIOSIDAD CON IA (CORREGIDO)
// admin.js - VERSIÓN CON CLAVE EN BASE DE DATOS

// admin.js - VERSIÓN "EL CAMBIAZO" (Usa Groq pero lee la variable vieja)

async function generarCuriosidad() {
    const nombre = document.getElementById('nombre').value;
    const campo = document.getElementById('curiosidad');
    const loader = document.getElementById('loader-ia');
    const btn = document.getElementById('btn-ia');

    if (!nombre) { alert("Escribe el nombre del producto primero."); return; }

    btn.disabled = true; 
    loader.style.display = "inline-block"; 
    campo.value = "Pensando una curiosidad..."; // Mensaje de carga

    try {
        // 1. RECUPERAR LA CLAVE (Usamos el nombre antiguo 'gemini_api_key' para no cambiar la BD)
        let API_KEY = '';
        
        // Intenta leer de Supabase (Método Seguro)
        const { data: secretos } = await supabaseClient
            .from('secretos')
            .select('valor')
            .eq('nombre', 'gemini_api_key') // <--- AQUÍ: Buscamos la fila vieja
            .single();
            
        if(secretos) API_KEY = secretos.valor;
        
        // Si no la encuentra, lanza error
        if(!API_KEY) throw new Error("No encontré la clave en la base de datos.");

        // 2. CONFIGURACIÓN DE GROQ (Llama 3)
        // Aunque la variable se llame 'gemini', la usamos aquí con Groq
        const URL = "https://api.groq.com/openai/v1/chat/completions";
        
        const prompt = `Escribe un dato curioso muy breve (máximo 20 palabras) y divertido sobre: "${nombre}". Tono gastronómico y alegre.`;

        // 3. PETICIÓN A GROQ
        const res = await fetch(URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}` // Aquí entra la clave de Groq
            },
            body: JSON.stringify({
                model: "llama3-8b-8192", // Modelo rápido, bueno y gratis
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7
            })
        });

        const data = await res.json();

        if (data.error) {
            console.error("Error Groq:", data.error);
            campo.value = "Error: " + data.error.message;
        } else {
            // Groq devuelve la respuesta en esta ruta:
            campo.value = data.choices[0].message.content;
        }

    } catch (e) {
        console.error(e);
        campo.value = "Error de conexión o clave inválida.";
    } finally {
        loader.style.display = "none"; 
        btn.disabled = false;
    }
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

    // 4. Activar el botón correspondiente (Truco visual)
    // Buscamos el botón que contiene el texto o ícono correcto y le ponemos 'active'
    // O más fácil: pasamos el evento 'this' en el onclick, pero por ahora lo haremos simple:
    const botones = document.querySelectorAll('.tab-btn');
    if(vistaNombre === 'inventario') botones[0].classList.add('active');
    if(vistaNombre === 'opiniones') botones[1].classList.add('active');
}