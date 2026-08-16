const API_URL = `${API_BASE}/api`;

document.addEventListener("DOMContentLoaded", () => {
    pintarFechaHoy();
    pintarHeaderUsuario();
    cargarDatosCuenta();
    cargarDatosEmpresa();
    vincularEventos();
});

// ============================================================
// Utilidades compartidas (mismo patrón que muestras.js)
// ============================================================
function pintarFechaHoy() {
    const el = document.getElementById("fecha-hoy");
    if (!el) return;
    const hoy = new Date();
    el.textContent = hoy.toLocaleDateString("es-AR", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
}

function pintarHeaderUsuario() {
    const nombre = localStorage.getItem("userName") || "Usuario";
    const rol = localStorage.getItem("userRole") || "";
    document.getElementById("header-nombre").textContent = nombre;
    document.getElementById("header-rol").textContent = formatearRol(rol);
    document.getElementById("header-avatar").textContent = obtenerIniciales(nombre);
}

function formatearRol(rol) {
    const limpio = (rol || "").replace("ROLE_", "");
    const mapa = { CLIENTE: "Cliente", EMPLEADO: "Empleado", ADMIN: "Administrador" };
    return mapa[limpio] || limpio || "—";
}

function obtenerIniciales(nombre) {
    if (!nombre) return "--";
    const partes = nombre.trim().split(/\s+/);
    return partes.length >= 2
        ? (partes[0][0] + partes[1][0]).toUpperCase()
        : nombre.substring(0, 2).toUpperCase();
}

function fetchConAuth(url, options = {}) {
    const token = localStorage.getItem("token");
    return fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });
}

function mostrarToast(mensaje, esError = false) {
    const toast = document.getElementById("toastConfirm");
    const msg = document.getElementById("toastMsg");
    msg.textContent = mensaje;
    toast.classList.toggle("toast-error", esError);
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 3500);
}

function limpiarErrores(formId) {
    document.querySelectorAll(`#${formId} .field-error`).forEach(el => el.classList.remove("visible"));
    document.querySelectorAll(`#${formId} .form-control-custom`).forEach(el => el.classList.remove("input-error"));
}

function marcarError(inputId, errorId) {
    document.getElementById(inputId)?.classList.add("input-error");
    document.getElementById(errorId)?.classList.add("visible");
}

// ============================================================
// Identidad del usuario logueado
// ============================================================
function obtenerUserIdLogueado() {
    const id = localStorage.getItem("userId");
    return id ? parseInt(id) : null;
}

// ============================================================
// 1. Cargar datos de cuenta (GET /api/users/{id})
// ============================================================
async function cargarDatosCuenta() {
    const userId = obtenerUserIdLogueado();
    const loading = document.getElementById("perfilLoading");
    const form = document.getElementById("formDatosCuenta");

    if (!userId) {
        loading.innerHTML = '<span class="text-danger">No se pudo identificar al usuario logueado. Iniciá sesión nuevamente.</span>';
        return;
    }

    try {
        const response = await fetchConAuth(`${API_URL}/users/${userId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const user = await response.json();

        document.getElementById("inputUsername").value = user.username || "";
        document.getElementById("inputEmail").value = user.email || "";
        document.getElementById("inputRol").value = formatearRol(user.rol);

        const esCliente = (localStorage.getItem("userRole") || "").toUpperCase() === "ROLE_CLIENTE";
        if (esCliente) document.getElementById("rolFormGroup").style.display = "none";

        loading.classList.add("d-none");
        form.classList.remove("d-none");

    } catch (error) {
        console.error("Error al cargar datos de cuenta:", error);
        loading.innerHTML = '<span class="text-danger">No se pudieron cargar los datos. Intentá nuevamente.</span>';
    }
}

// ============================================================
// 2. Guardar datos de cuenta (PUT /api/users/{id})
// ============================================================
async function onSubmitDatosCuenta(e) {
    e.preventDefault();
    limpiarErrores("formDatosCuenta");

    const userId = obtenerUserIdLogueado();
    const username = document.getElementById("inputUsername").value.trim();
    const email = document.getElementById("inputEmail").value.trim();

    let valido = true;
    if (!username) {
        marcarError("inputUsername", "errUsername");
        valido = false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        marcarError("inputEmail", "errEmail");
        valido = false;
    }
    if (!valido) return;

    const btn = document.getElementById("btnGuardarDatos");
    btn.disabled = true;

    try {
        const response = await fetchConAuth(`${API_URL}/users/${userId}`, {
            method: "PUT",
            body: JSON.stringify({ username, email })
        });

        if (!response.ok) {
            const msg = await response.json().then(d => d.message).catch(() => null) || `HTTP ${response.status}`;
            throw new Error(msg);
        }

        // Actualiza el nombre mostrado en el header/sidebar sin recargar la página
        localStorage.setItem("userName", username);
        pintarHeaderUsuario();

        mostrarToast("Datos actualizados correctamente");

    } catch (error) {
        console.error("Error al guardar datos de cuenta:", error);
        mostrarToast(error.message || "No se pudieron guardar los cambios", true);
    } finally {
        btn.disabled = false;
    }
}

// ============================================================
// 3. Cambiar contraseña (PUT /api/users/{id}/password)
// ============================================================
async function onSubmitPassword(e) {
    e.preventDefault();
    limpiarErrores("formPassword");
    ocultarErrorServidor();

    const userId = obtenerUserIdLogueado();
    const actual = document.getElementById("inputPasswordActual").value;
    const nueva = document.getElementById("inputPasswordNueva").value;
    const confirmar = document.getElementById("inputPasswordConfirmar").value;

    let valido = true;
    if (!actual) {
        marcarError("inputPasswordActual", "errPasswordActual");
        valido = false;
    }
    if (!nueva || nueva.length < 6) {
        marcarError("inputPasswordNueva", "errPasswordNueva");
        valido = false;
    }
    if (nueva !== confirmar) {
        marcarError("inputPasswordConfirmar", "errPasswordConfirmar");
        valido = false;
    }
    if (!valido) return;

    const btn = document.getElementById("btnCambiarPassword");
    btn.disabled = true;

    try {
        const response = await fetchConAuth(`${API_URL}/users/${userId}/password`, {
            method: "PUT",
            body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva })
        });

        if (!response.ok) {
            const msg = await response.json().then(d => d.message).catch(() => null) || "No se pudo cambiar la contraseña";
            mostrarErrorServidor(msg);
            return;
        }

        document.getElementById("formPassword").reset();
        mostrarToast("Contraseña actualizada correctamente");

    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        mostrarErrorServidor("No se pudo conectar con el servidor. Intentá nuevamente.");
    } finally {
        btn.disabled = false;
    }
}

function mostrarErrorServidor(mensaje) {
    const box = document.getElementById("passwordErrorServidor");
    box.textContent = mensaje;
    box.classList.remove("d-none");
}

function ocultarErrorServidor() {
    document.getElementById("passwordErrorServidor").classList.add("d-none");
}

// ============================================================
// 4. Panel Mi empresa (solo ROLE_CLIENTE)
// ============================================================
async function cargarDatosEmpresa() {
    const esCliente = (localStorage.getItem("userRole") || "").toUpperCase() === "ROLE_CLIENTE";
    if (!esCliente) return;

    document.getElementById("panelMiEmpresa").classList.remove("d-none");

    try {
        const response = await fetchConAuth(`${API_URL}/clientes/mi-cliente`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const c = await response.json();

        const nombre = c.tipoCliente === "EMPRESA"
            ? (c.razonSocial || "—")
            : [c.nombre, c.apellido].filter(Boolean).join(" ") || "—";

        document.getElementById("empNombre").textContent   = nombre;
        document.getElementById("empCuit").textContent     = c.cuit || c.dni || "—";
        document.getElementById("empTelefono").textContent = c.celular || c.telefono || "—";
        document.getElementById("empEmail").textContent    = c.email || "—";
        document.getElementById("empDireccion").textContent = c.direccion || "—";
        document.getElementById("empLocalidad").textContent = [c.localidad, c.provincia]
            .filter(Boolean).join(", ") || "—";

        document.getElementById("empresaLoading").classList.add("d-none");
        document.getElementById("empresaData").classList.remove("d-none");

    } catch (error) {
        console.error("Error al cargar datos de empresa:", error);
        document.getElementById("empresaLoading").innerHTML =
            '<span class="text-danger">No se pudieron cargar los datos de la empresa.</span>';
    }
}

// ============================================================
// Eventos
// ============================================================
function vincularEventos() {
    document.getElementById("formDatosCuenta").addEventListener("submit", onSubmitDatosCuenta);
    document.getElementById("formPassword").addEventListener("submit", onSubmitPassword);

    // Limpia el error de "no coinciden" apenas el usuario vuelve a tipear
    document.getElementById("inputPasswordConfirmar").addEventListener("input", () => {
        document.getElementById("inputPasswordConfirmar").classList.remove("input-error");
        document.getElementById("errPasswordConfirmar").classList.remove("visible");
    });
}