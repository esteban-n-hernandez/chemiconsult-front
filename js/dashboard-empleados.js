const API_URL = API_BASE;

// ── Guard: solo EMPLEADO e IT ──
const rol = (localStorage.getItem("userRole") || "").toUpperCase();
if (!localStorage.getItem("token") || rol === "ROLE_CLIENTE") {
    window.location.href = "login.html";
}

// ── Datos del usuario ──
const userEmail = localStorage.getItem("userEmail");
const userName = localStorage.getItem("userName");
const nombre = userName || userEmail || "Usuario";
const iniciales = nombre
    .split(" ")
    .map((p) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

// ── Header ──
document.getElementById("header-nombre").textContent = nombre;
document.getElementById("header-rol").textContent =
    rol === "ROLE_IT" ? "IT" : "Empleado";
document.getElementById("header-avatar").textContent = iniciales;

// ── Fecha ──
const hoy = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
});
document.getElementById("fecha-hoy").textContent =
    hoy.charAt(0).toUpperCase() + hoy.slice(1);


// ── Filtro de tabla y paginación ──
// Variables para paginar
let allMuestras = [];
let filteredMuestras = [];
let currentPage = 1;
const PER_PAGE = 10; // máximo por página
const ESTADOS_VISIBLES = new Set([
    "PENDIENTE",
    "EN_PROCESO",
    "DEMORADA",
    "COMPLETO_SIN_INFORME",
]);

function normalizarEstado(estado) {
    return (estado || "").toString().toUpperCase().replace(/\s+/g, "_");
}

function formatearFechaDMY(valor) {
    if (!valor || valor === "-") return "-";
    if (typeof valor === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(valor))
        return valor;
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;
    const dia = String(fecha.getDate()).padStart(2, "0");
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
}

function filtrarTabla(estado, btn) {
    document
        .querySelectorAll(".filtro-btn")
        .forEach((b) => b.classList.remove("active"));
    if (btn) btn.classList.add("active");

    if (estado === "todos") {
        filteredMuestras = [...allMuestras];
    } else {
        filteredMuestras = allMuestras.filter(
            (m) => normalizarEstado(m.estado) === estado,
        );
    }

    currentPage = 1;
    renderPage();
}

// ── Gráfico ──
new Chart(document.getElementById("graficoEstados"), {
    type: "doughnut",
    data: {
        labels: [
            "Pendiente",
            "En proceso",
            "Completo sin informe",
            "Demorada",
        ],
        datasets: [
            {
                data: [4, 6, 3, 2],
                backgroundColor: ["#fff3cd", "#cfe2ff", "#d1e7dd", "#f8d7da"],
                borderColor: ["#856404", "#0d6efd", "#146c43", "#842029"],
                borderWidth: 2,
                hoverOffset: 6,
            },
        ],
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
            legend: {display: false},
            tooltip: {
                callbacks: {
                    label: (ctx) => ` ${ctx.label}: ${ctx.parsed} muestras`,
                },
            },
        },
    },
});

// ════════════════════════════════
//  MODAL ALTA MUESTRA
// ════════════════════════════════

const modalOverlay = document.getElementById("modalAltaMuestra");
const formAlta = document.getElementById("formAltaMuestra");

// ── Abrir / cerrar ──
function abrirModal() {
    // Setear fecha de hoy por defecto
    document.getElementById("inputFecha").value = new Date()
        .toISOString()
        .split("T")[0];
    modalOverlay.classList.add("visible");
    document.getElementById("inputProtocolo").focus();
}

function cerrarModal() {
    modalOverlay.classList.remove("visible");
    setTimeout(() => {
        formAlta.reset();
        limpiarErrores();
        limpiarParametros();
    }, 250);
}

document
    .getElementById("modalClose")
    .addEventListener("click", cerrarModal);
document
    .getElementById("btnCancelar")
    .addEventListener("click", cerrarModal);

// Cerrar al click fuera del box
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) cerrarModal();
});

// Cerrar con Escape
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalOverlay.classList.contains("visible"))
        cerrarModal();
});

// ── Conectar botón "Nueva muestra" del dashboard ──
document.querySelectorAll(".btn-nueva-muestra").forEach((btn) => {
    btn.addEventListener("click", abrirModal);
});

// ── Parámetros ──
let parametros = [];

function renderParametros() {
    const lista = document.getElementById("parametrosLista");
    const vacio = document.getElementById("parametrosVacio");

    if (parametros.length === 0) {
        lista.innerHTML = "";
        vacio.style.display = "block";
        return;
    }

    vacio.style.display = "none";
    lista.innerHTML = parametros
        .map(
            (p, i) => `
        <div class="parametro-item" data-index="${i}">
            <input
                type="text"
                class="form-control-custom"
                value="${p}"
                placeholder="Ej: pH, Turbidez, Coliformes..."
                oninput="parametros[${i}] = this.value"
            >
            <button type="button" class="btn-remove-param" onclick="eliminarParametro(${i})">
                <i class="bi bi-trash3"></i>
            </button>
        </div>
    `,
        )
        .join("");
}

function eliminarParametro(index) {
    parametros.splice(index, 1);
    renderParametros();
}

function limpiarParametros() {
    parametros = [];
    renderParametros();
}

document.getElementById("btnAddParam").addEventListener("click", () => {
    parametros.push("");
    renderParametros();
    // Focus en el último input agregado
    const inputs = document.querySelectorAll(".parametro-item input");
    if (inputs.length) inputs[inputs.length - 1].focus();
});

// ── Validación ──
function validarCampo(inputId, errorId, condicion) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (condicion) {
        input.classList.add("error");
        error.classList.add("visible");
        return false;
    }
    input.classList.remove("error");
    error.classList.remove("visible");
    return true;
}

function limpiarErrores() {
    [
        "inputProtocolo",
        "inputFecha",
        "inputCliente",
        "inputIdMuestra",
        "inputTipo",
    ].forEach((id) => {
        document.getElementById(id)?.classList.remove("error");
    });
    [
        "errProtocolo",
        "errFecha",
        "errCliente",
        "errIdMuestra",
        "errTipo",
    ].forEach((id) => {
        document.getElementById(id)?.classList.remove("visible");
    });
}

// Limpiar error al escribir
[
    "inputProtocolo",
    "inputFecha",
    "inputCliente",
    "inputIdMuestra",
    "inputTipo",
].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", function () {
        this.classList.remove("error");
        const errId = "err" + id.replace("input", "");
        document.getElementById(errId)?.classList.remove("visible");
    });
});

// ── Submit ──
formAlta.addEventListener("submit", async function (e) {
    e.preventDefault();

    const protocolo = document
        .getElementById("inputProtocolo")
        .value.trim();
    const fecha = document.getElementById("inputFecha").value;
    const cliente = document.getElementById("inputCliente").value.trim();
    const idMuestra = document
        .getElementById("inputIdMuestra")
        .value.trim();
    const tipo = document.getElementById("inputTipo").value;
    const observaciones = document
        .getElementById("inputObservaciones")
        .value.trim();

    // Validar
    const v1 = validarCampo("inputProtocolo", "errProtocolo", !protocolo);
    const v2 = validarCampo("inputFecha", "errFecha", !fecha);
    const v3 = validarCampo("inputCliente", "errCliente", !cliente);
    const v4 = validarCampo("inputIdMuestra", "errIdMuestra", !idMuestra);
    const v5 = validarCampo("inputTipo", "errTipo", !tipo);

    if (!v1 || !v2 || !v3 || !v4 || !v5) return;

    // Obtener userId del token JWT
    const token = localStorage.getItem("token");
    let userId = 0;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        userId = payload.userID || 0;
    } catch (e) {
        console.error("Error extrayendo userId del token:", e);
    }

    // Armar payload según formato del backend
    const payload = {
        id: 0,
        tipo: tipo,
        estado: "PENDIENTE",
        archivo: [],
        archivoUrl: "",
        userId: userId,
        userMail: userEmail || "",
        protocolo: protocolo,
        cliente: cliente,
        idMuestra: idMuestra,
        fecha: fecha,
        observaciones: observaciones,
        parametros: parametros.filter((p) => p.trim() !== ""),
    };

    console.log("📦 Payload a enviar:", payload);

    const btnGuardar = document.getElementById("btnGuardar");
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<i class="bi bi-hourglass-split"></i> Guardando...`;

    try {
        const response = await fetch(`${API_BASE}/api/estudios`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorData}`);
        }

        const data = await response.json();
        console.log("✅ Muestra creada:", data);

        cerrarModal();
        mostrarToast(`Muestra ${protocolo} registrada correctamente`);
        
        // Recargar la tabla de estudios
        cargarEstudios();
    } catch (error) {
        console.error("Error creando muestra:", error);
        mostrarToast(`❌ Error: ${error.message}`);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `<i class="bi bi-check-lg"></i> Guardar muestra`;
    }
});

// ── Toast ──
function mostrarToast(msg) {
    const toast = document.getElementById("toastConfirm");
    document.getElementById("toastMsg").textContent = msg;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 3500);
}

async function cargarEstudios() {
    const tablaBody = document.getElementById("tablaMuestrasBody");
    if (!tablaBody) return;
    tablaBody.innerHTML = `<tr><td colspan="7" class="text-center">Cargando muestras...</td></tr>`;
    const token = localStorage.getItem("token");

    try {
        const resp = await fetch(`${API_BASE}/api/estudios/all`, {
            method: "GET",
            headers: token ? {Authorization: "Bearer " + token} : {},
        });

        if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            throw new Error(`HTTP ${resp.status} ${resp.statusText} - ${txt}`);
        }

        const estudios = await resp.json();
        mostrarMuestras(estudios || []);
    } catch (err) {
        console.error("Error cargando estudios:", err);
        tablaBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger">
                        Error al cargar muestras.
                    </td>
                </tr>`;
    }
}

function badgeClassParaEstado(estado) {
    if (!estado) return "badge-estado badge-pendiente";
    const e = normalizarEstado(estado);
    switch (e) {
        case "DEMORADA":
            return "badge-estado badge-demorada";
        case "EN_PROCESO":
            return "badge-estado badge-proceso";
        case "COMPLETO_SIN_INFORME":
            return "badge-estado badge-completo-sin-informe";
        case "PENDIENTE":
            return "badge-estado badge-pendiente";
        default:
            return "badge-estado";
    }
}

function mostrarMuestras(estudios) {
    console.log("📊 Muestras recibidas del backend:", estudios);
    // Normalizar y almacenar en memoria para paginación
    allMuestras = Array.isArray(estudios)
        ? estudios
            .map((est) => ({
                id: est.id || est._id || est.codigo || est.protocolo || null,
                codigo: est.protocolo || est.codigo || est.id || "-",
                cliente:
                    est.cliente || est.clienteNombre || est.customer || "-",
                tipo:
                    est.tipo || est.tipoAnalisis || est.tipo_de_analisis || "-",
                estado: est.estado || est.status || "-",
                tieneInforme: (est.estado || est.status || "").toString().toUpperCase() === "COMPLETO",
                fechaAlta: formatearFechaDMY(
                    est.fechaAlta ||
                    est.fecha_alta ||
                    est.fechaCreacion ||
                    est.fecha_creacion ||
                    est.createdDate ||
                    est.createdAt ||
                    est.fechaDeAlta ||
                    "-",
                ),
                fecha:
                    est.fechaEntrega ||
                    est.fecha_entrega ||
                    est.deliveryDate ||
                    est.fecha ||
                    "-",
            }))
            .filter((m) => ESTADOS_VISIBLES.has(normalizarEstado(m.estado)))
        : [];

    // Si se desea mostrar un total fijo para demostración, poner en localStorage.demoTotal = '40'
    const demoTotal = parseInt(localStorage.getItem("demoTotal") || "0");
    if (demoTotal > allMuestras.length) {
        // clonar registros hasta alcanzar demoTotal (solo para UI demo)
        const clones = [];
        let idx = 0;
        while (allMuestras.length + clones.length < demoTotal) {
            const source = allMuestras[idx % allMuestras.length] || {
                codigo: `DEM-${idx + 1}`,
                cliente: "Demo",
                tipo: "—",
                estado: "PENDIENTE",
                fechaAlta: "-",
                fecha: "-",
            };
            const clone = Object.assign({}, source);
            clone.codigo = `${clone.codigo}-D${idx + 1}`;
            clones.push(clone);
            idx++;
            // safety break
            if (idx > 1000) break;
        }
        allMuestras = allMuestras.concat(clones);
    }
    filteredMuestras = [...allMuestras];
    currentPage = 1;
    actualizarKPIs();
    renderPage();
}

function actualizarKPIs() {
    // Calcular KPIs desde allMuestras (todos los registros)
    const totalMuestras = allMuestras.length;
    const pendientes = allMuestras.filter(m => normalizarEstado(m.estado) === "PENDIENTE").length;
    const demoradas = allMuestras.filter(m => normalizarEstado(m.estado) === "DEMORADA").length;
    const informesEmitidos = allMuestras.filter(m => m.tieneInforme).length;

    // Actualizar elementos en el DOM
    const elKpiMuestras = document.getElementById("kpi-muestras-activas");
    const elKpiPendientes = document.getElementById("kpi-pendientes");
    const elKpiDemoradas = document.getElementById("kpi-demoradas");
    const elKpiInformes = document.getElementById("kpi-informes-emitidos");

    if (elKpiMuestras) elKpiMuestras.textContent = totalMuestras;
    if (elKpiPendientes) elKpiPendientes.textContent = pendientes;
    if (elKpiDemoradas) elKpiDemoradas.textContent = demoradas;
    if (elKpiInformes) elKpiInformes.textContent = informesEmitidos;
}

function renderPage() {
    const tablaBody = document.getElementById("tablaMuestrasBody");
    const pagInfo = document.getElementById("pagInfoEmpleado");
    const pagControls = document.getElementById("pagControlsEmpleado");
    if (!tablaBody || !pagInfo || !pagControls) return;

    const total = filteredMuestras.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PER_PAGE;
    const end = Math.min(start + PER_PAGE, total);

    tablaBody.innerHTML = "";
    if (total === 0) {
        tablaBody.innerHTML = `<tr><td colspan="7" class="text-center">No hay muestras disponibles</td></tr>`;
    } else {
        filteredMuestras.slice(start, end).forEach((m) => {
            const badgeClass = badgeClassParaEstado(m.estado);
            const acciones = [];
            // Solo mostrar botón "Ver" si realmente hay informe disponible
            if (m.tieneInforme) {
                acciones.push(
                    `<button class="btn-accion btn-ver" data-id="${m.id}" title="Ver"><i class="bi bi-eye"></i></button>`,
                );
            }
            acciones.push(
                `<button class="btn-accion btn-subir" data-id="${m.id}" title="Subir informe"><i class="bi bi-upload"></i></button>`,
            );

            const row = `
                    <tr data-estado="${(m.estado || "").toString().toUpperCase()}" data-id="${m.id}">
                        <td><span class="cod-badge">${m.codigo}</span></td>
                        <td>${m.cliente}</td>
                        <td>${m.tipo}</td>
                        <td><span class="${badgeClass}">${m.estado}</span></td>
                        <td>${m.fechaAlta || "-"}</td>
                        <td>${m.fecha}</td>
                        <td>${acciones.join(" ")}</td>
                    </tr>`;

            tablaBody.innerHTML += row;
        });
    }

    // Actualizar info
    pagInfo.textContent =
        total === 0
            ? "Mostrando 0 de 0"
            : `Mostrando ${start + 1}–${end} de ${total}`;

    // Render controls
    pagControls.innerHTML = "";
    const prev = document.createElement("button");
    prev.className = "btn btn-sm btn-outline-secondary me-1";
    prev.disabled = currentPage === 1;
    prev.innerHTML = "&laquo;";
    prev.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage();
        }
    });
    pagControls.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
        const b = document.createElement("button");
        b.className =
            "btn btn-sm me-1" +
            (i === currentPage ? " btn-primary" : " btn-outline-secondary");
        b.textContent = i;
        b.addEventListener("click", () => {
            currentPage = i;
            renderPage();
        });
        pagControls.appendChild(b);
    }

    const next = document.createElement("button");
    next.className = "btn btn-sm btn-outline-secondary";
    next.disabled = currentPage === totalPages;
    next.innerHTML = "&raquo;";
    next.addEventListener("click", () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderPage();
        }
    });
    pagControls.appendChild(next);
}

// ── Upload de PDF (file input global y handlers) ──
// Creamos un input file oculto que reutilizaremos
const globalFileInput = document.createElement("input");
globalFileInput.type = "file";
globalFileInput.accept = "application/pdf";
globalFileInput.style.display = "none";
document.body.appendChild(globalFileInput);

// Cuando el usuario seleccione un archivo, iniciamos el upload
globalFileInput.addEventListener("change", async function (e) {
    const file = this.files && this.files[0];
    const targetId = this.dataset.targetId;
    const triggerBtnSelector = this.dataset.triggerBtnSelector;
    let triggerBtn = null;
    if (triggerBtnSelector)
        triggerBtn = document.querySelector(triggerBtnSelector);
    if (!file || !targetId) return;
    try {
        await subirDocumento(targetId, file, triggerBtn);
    } finally {
        // limpiar el input para permitir seleccionar el mismo archivo otra vez
        this.value = "";
        delete this.dataset.targetId;
        delete this.dataset.triggerBtnSelector;
    }
});

// Función que dispara el file picker para un id dado
function startUploadForId(id, triggerBtn) {
    globalFileInput.dataset.targetId = id;
    if (triggerBtn && triggerBtn instanceof Element) {
        const attr =
            "data-upload-trigger-" + Math.random().toString(36).slice(2, 9);
        triggerBtn.setAttribute(attr, "1");
        globalFileInput.dataset.triggerBtnSelector = "[" + attr + "]";
    }
    globalFileInput.click();
}

// Subir documento usando fetch + FormData
async function subirDocumento(id, file, triggerBtn) {
    const token = localStorage.getItem("token");

    let originalHtml;
    if (triggerBtn) {
        originalHtml = triggerBtn.innerHTML;
        triggerBtn.disabled = true;
        triggerBtn.innerHTML = `<i class="bi bi-hourglass-split"></i>`;
    }

    try {
        const fd = new FormData();
        fd.append("file", file, file.name);

        const resp = await fetch(`${API_BASE}/api/estudios/${id}/documento`, {
            method: "POST",
            headers: token ? {Authorization: "Bearer " + token} : {},
            body: fd,
        });

        if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            throw new Error(`HTTP ${resp.status} ${resp.statusText} ${txt}`);
        }

        mostrarToast("Archivo subido correctamente");
        await cargarEstudios();
    } catch (err) {
        console.error("Error subiendo documento:", err);
        alert("Error subiendo el archivo: " + (err.message || err));
    } finally {
        if (triggerBtn) {
            triggerBtn.disabled = false;
            if (originalHtml) triggerBtn.innerHTML = originalHtml;
        }
    }
}

async function verResultado(id, triggerBtn) {
    const token = localStorage.getItem("token");
    let resultadoWindow = null;

    let originalHtml;
    if (triggerBtn) {
        originalHtml = triggerBtn.innerHTML;
        triggerBtn.disabled = true;
        triggerBtn.innerHTML = `<i class="bi bi-hourglass-split"></i>`;
    }

    try {
        resultadoWindow = window.open("", "_blank");

        const resp = await fetch(`${API_BASE}/api/estudios/${id}/resultado`, {
            method: "GET",
            headers: token ? {Authorization: "Bearer " + token} : {},
        });

        if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            throw new Error(`HTTP ${resp.status} ${resp.statusText} ${txt}`);
        }

        const blob = await resp.blob();
        if (!blob || blob.size === 0) throw new Error("El resultado está vacío");

        const blobUrl = URL.createObjectURL(blob);
        if (resultadoWindow) {
            resultadoWindow.location.href = blobUrl;
        } else {
            window.open(blobUrl, "_blank");
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
        if (resultadoWindow && !resultadoWindow.closed) resultadoWindow.close();
        console.error("Error obteniendo resultado:", err);
        alert("Error abriendo resultado: " + (err.message || err));
    } finally {
        if (triggerBtn) {
            triggerBtn.disabled = false;
            if (originalHtml) triggerBtn.innerHTML = originalHtml;
        }
    }
}

// Delegación de clicks en botones de subir (se aplica después de renderizado)
document.addEventListener("click", function (e) {
    const btnVer = e.target.closest(".btn-ver");
    if (btnVer) {
        const id = btnVer.getAttribute("data-id");
        if (!id) return alert("ID de muestra desconocido");
        verResultado(id, btnVer);
        return;
    }

    const btnSubir = e.target.closest(".btn-subir");
    if (!btnSubir) return;
    const id = btnSubir.getAttribute("data-id");
    if (!id) return alert("ID de muestra desconocido");
    startUploadForId(id, btnSubir);
});

// Cargar al iniciar
cargarEstudios();