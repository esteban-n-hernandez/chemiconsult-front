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
let allEstudios = [];
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

function labelEstado(estado) {
    const map = {
        PENDIENTE: "Pendiente",
        EN_PROCESO: "En proceso",
        COMPLETO_SIN_INFORME: "Completo sin informe",
        DEMORADA: "Demorada",
        COMPLETO: "Completo",
    };
    return map[normalizarEstado(estado)] || (estado || "-");
}

function parseFecha(valor) {
    if (!valor || valor === "-") return null;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
        const [d, m, y] = valor.split("/");
        return new Date(y, m - 1, d);
    }
    const f = new Date(valor);
    return isNaN(f.getTime()) ? null : f;
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
let grafico = new Chart(document.getElementById("graficoEstados"), {
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
//  HELPER AUTENTICADO
// ════════════════════════════════
async function fetchDash(url, opts = {}) {
    const token = localStorage.getItem("token");
    const headers = { ...(opts.headers || {}), "Authorization": `Bearer ${token}` };
    const resp = await fetch(url, { ...opts, headers });
    if (resp.status === 401) window.location.href = "/login.html";
    return resp;
}

// ════════════════════════════════
//  MODAL ALTA MUESTRA (completo)
// ════════════════════════════════
const modalMuestra = document.getElementById("modalAltaMuestra");
const formMuestra  = document.getElementById("formAltaMuestra");

let destinosSeleccionadosDash   = new Set();
let parametrosPorDestinoCacheDash = new Map();
let todosLosParametrosCacheDash = [];
let clientesCargadosDash = false;
let matricesCargadasDash = false;

function abrirModalMuestra() {
    modalMuestra.classList.add("visible");
    document.getElementById("inputFecha").value = new Date().toISOString().slice(0, 10);
    document.getElementById("inputProtocolo").focus();
    if (!clientesCargadosDash) cargarClientesDash();
    if (!matricesCargadasDash) cargarMatricesDash();
}

function cerrarModalMuestra() {
    modalMuestra.classList.remove("visible");
    setTimeout(() => {
        formMuestra.reset();
        document.getElementById("parametrosLista").innerHTML = "";
        document.getElementById("parametrosVacio").style.display = "flex";
        document.getElementById("normativasContainer").innerHTML =
            '<span class="text-muted small">Seleccioná una matriz para ver las normativas aplicables...</span>';
        document.getElementById("checkSinNormativa").checked = false;
        document.getElementById("normativasContainer").classList.remove("disabled-panel");
        destinosSeleccionadosDash.clear();
        parametrosPorDestinoCacheDash.clear();
        cerrarBuscadorDash();
        document.querySelectorAll("#formAltaMuestra .field-error").forEach(el => el.style.display = "none");
    }, 250);
}

document.getElementById("modalClose").addEventListener("click", cerrarModalMuestra);
document.getElementById("btnCancelar").addEventListener("click", cerrarModalMuestra);
modalMuestra.addEventListener("click", e => { if (e.target === modalMuestra) cerrarModalMuestra(); });

async function cargarClientesDash() {
    const sel = document.getElementById("inputCliente");
    try {
        const r = await fetchDash(`${API_BASE}/api/clientes`);
        if (!r.ok) throw new Error();
        const clientes = await r.json();
        sel.innerHTML = '<option value="">Seleccioná un cliente...</option>';
        clientes.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.tipoCliente === "PERSONA_FISICA"
                ? `${c.nombre || ""} ${c.apellido || ""}`.trim()
                : (c.razonSocial || c.nombre || c.email);
            sel.appendChild(opt);
        });
        clientesCargadosDash = true;
    } catch { sel.innerHTML = '<option value="">Sin clientes disponibles</option>'; }
}

async function cargarMatricesDash() {
    const sel = document.getElementById("inputTipoMuestra");
    try {
        const r = await fetchDash(`${API_BASE}/api/matrices`);
        if (!r.ok) throw new Error();
        const matrices = await r.json();
        sel.innerHTML = '<option value="">Seleccioná una matriz...</option>';
        matrices.filter(m => m.activo).forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = m.nombre;
            sel.appendChild(opt);
        });
        matricesCargadasDash = true;
    } catch { console.warn("No se pudieron cargar matrices"); }
}

document.getElementById("inputTipoMuestra").addEventListener("change", async function () {
    const matrizId = this.value;
    const cont = document.getElementById("normativasContainer");
    destinosSeleccionadosDash.clear();
    parametrosPorDestinoCacheDash.clear();
    recalcularParametrosDash();
    if (document.getElementById("checkSinNormativa").checked) return;
    if (!matrizId) {
        cont.innerHTML = '<span class="text-muted small">Seleccioná una matriz para ver las normativas aplicables...</span>';
        return;
    }
    cont.innerHTML = '<span class="text-muted small">Cargando normativas...</span>';
    try {
        const r = await fetchDash(`${API_BASE}/api/resoluciones/por-matriz/${matrizId}`);
        if (!r.ok) throw new Error();
        const arbol = await r.json();
        if (!arbol.resoluciones || arbol.resoluciones.length === 0) {
            cont.innerHTML = '<span class="text-muted small">No hay normativas cargadas para esta matriz.</span>';
            return;
        }
        renderizarNormativasDash(arbol.resoluciones);
    } catch { cont.innerHTML = '<span class="text-danger small">Error al cargar las normativas.</span>'; }
});

document.getElementById("checkSinNormativa").addEventListener("change", function () {
    const cont = document.getElementById("normativasContainer");
    if (this.checked) {
        destinosSeleccionadosDash.clear();
        parametrosPorDestinoCacheDash.clear();
        cont.innerHTML = '<span class="text-muted small fst-italic">Normativa desactivada — agregá parámetros con el buscador individual.</span>';
        cont.classList.add("disabled-panel");
        recalcularParametrosDash();
    } else {
        cont.classList.remove("disabled-panel");
        const matrizId = document.getElementById("inputTipoMuestra").value;
        if (matrizId) document.getElementById("inputTipoMuestra").dispatchEvent(new Event("change"));
        else cont.innerHTML = '<span class="text-muted small">Seleccioná una matriz para ver las normativas aplicables...</span>';
    }
});

function renderizarNormativasDash(resoluciones) {
    const cont = document.getElementById("normativasContainer");
    cont.innerHTML = "";
    resoluciones.forEach(res => {
        const bloque = document.createElement("div");
        bloque.className = "normativa-bloque mb-2 pb-2 border-bottom";
        const titulo = document.createElement("div");
        titulo.className = "fw-semibold small mb-1";
        titulo.textContent = res.nombre;
        bloque.appendChild(titulo);
        const wrap = document.createElement("div");
        wrap.className = "d-flex flex-wrap gap-3";
        (res.destinos || []).forEach(destino => {
            parametrosPorDestinoCacheDash.set(destino.id, destino.parametros || []);
            const div = document.createElement("div");
            div.className = "form-check";
            div.innerHTML = `
                <input class="form-check-input check-destino-dash" type="checkbox"
                       id="chk-dest-${destino.id}" value="${destino.id}">
                <label class="form-check-label small" for="chk-dest-${destino.id}">${destino.nombre}</label>
            `;
            div.querySelector("input").addEventListener("change", ev => {
                if (ev.target.checked) destinosSeleccionadosDash.add(destino.id);
                else destinosSeleccionadosDash.delete(destino.id);
                recalcularParametrosDash();
            });
            wrap.appendChild(div);
        });
        bloque.appendChild(wrap);
        cont.appendChild(bloque);
    });
}

function recalcularParametrosDash() {
    const lista = document.getElementById("parametrosLista");
    const vacio = document.getElementById("parametrosVacio");
    const manuales = Array.from(lista.querySelectorAll(".parametro-item-row"))
        .filter(f => f.dataset.origen === "manual")
        .map(f => f.dataset.parametroId);
    lista.innerHTML = "";
    const unicos = new Map();
    destinosSeleccionadosDash.forEach(dId =>
        (parametrosPorDestinoCacheDash.get(dId) || []).forEach(p => unicos.set(p.id, p))
    );
    if (unicos.size === 0 && manuales.length === 0) { vacio.style.display = "flex"; return; }
    vacio.style.display = "none";
    unicos.forEach(p => agregarParametroDash(p, "norma"));
    manuales.forEach(id => {
        const p = todosLosParametrosCacheDash.find(x => String(x.id) === String(id));
        if (p && !unicos.has(p.id)) agregarParametroDash(p, "manual");
    });
}

function agregarParametroDash(parametro, origen = "manual") {
    const lista = document.getElementById("parametrosLista");
    document.getElementById("parametrosVacio").style.display = "none";
    if (lista.querySelector(`[data-parametro-id="${parametro.id}"]`)) return;
    const fila = document.createElement("div");
    fila.className = "parametro-item-row d-flex align-items-center justify-content-between p-2 mb-2 border rounded bg-light";
    fila.dataset.parametroId = parametro.id;
    fila.dataset.origen = origen;
    fila.innerHTML = `
        <div class="d-flex align-items-center" style="gap:12px">
            <input type="checkbox" class="form-check-input check-parametro"
                   value="${parametro.id}" id="chk-param-${parametro.id}" checked>
            <label for="chk-param-${parametro.id}" class="mb-0 fw-semibold" style="cursor:pointer">
                ${parametro.nombre}
                <span class="text-muted small">(${parametro.unidad || "—"})</span>
            </label>
        </div>
        <span class="badge bg-secondary" style="font-size:0.8rem">
            <i class="bi bi-gear me-1"></i>${parametro.metodologia?.nombre || "Sin metodología"}
        </span>
    `;
    lista.appendChild(fila);
}

document.getElementById("btnAddParam").addEventListener("click", async function () {
    const cont = document.getElementById("buscadorIndividualContainer");
    cont.classList.remove("d-none");
    document.getElementById("inputBuscarParametroIndividual").focus();
    if (todosLosParametrosCacheDash.length === 0) {
        try {
            const r = await fetchDash(`${API_BASE}/api/parametros`);
            todosLosParametrosCacheDash = await r.json();
        } catch { console.warn("No se pudieron cargar parámetros"); }
    }
});

document.getElementById("btnCerrarBuscadorIndividual").addEventListener("click", cerrarBuscadorDash);

document.getElementById("inputBuscarParametroIndividual").addEventListener("input", function () {
    const term = this.value.toLowerCase().trim();
    const res = document.getElementById("resultadosBusquedaIndividual");
    res.innerHTML = "";
    if (!term) return;
    const filtrados = todosLosParametrosCacheDash.filter(p => p.nombre.toLowerCase().includes(term)).slice(0, 10);
    if (filtrados.length === 0) {
        res.innerHTML = `<div class="list-group-item text-muted small">Sin resultados</div>`;
        return;
    }
    filtrados.forEach(param => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "list-group-item list-group-item-action py-2";
        btn.innerHTML = `<strong>${param.nombre}</strong> <span class="text-muted small ms-1">(${param.unidad || "—"})</span>`;
        btn.addEventListener("click", () => {
            if (document.getElementById(`chk-param-${param.id}`)) {
                mostrarToast(`"${param.nombre}" ya está agregado.`);
                return;
            }
            agregarParametroDash(param, "manual");
            cerrarBuscadorDash();
        });
        res.appendChild(btn);
    });
});

function cerrarBuscadorDash() {
    document.getElementById("buscadorIndividualContainer").classList.add("d-none");
    document.getElementById("inputBuscarParametroIndividual").value = "";
    document.getElementById("resultadosBusquedaIndividual").innerHTML = "";
}

formMuestra.addEventListener("submit", async function (e) {
    e.preventDefault();
    const protocolo = document.getElementById("inputProtocolo").value.trim();
    const fecha     = document.getElementById("inputFecha").value;
    const clienteId = document.getElementById("inputCliente").value;
    const idMuestra = document.getElementById("inputIdMuestra").value.trim();
    const matrizId  = document.getElementById("inputTipoMuestra").value;

    let ok = true;
    [
        [!protocolo, "errProtocolo"],
        [!fecha,     "errFecha"],
        [!clienteId, "errCliente"],
        [!idMuestra, "errIdMuestra"],
        [!matrizId,  "errTipoMuestra"],
    ].forEach(([cond, errId]) => {
        const err = document.getElementById(errId);
        if (cond) { err.style.display = "block"; ok = false; }
        else err.style.display = "none";
    });
    if (!ok) return;

    const parametrosIds = Array.from(document.querySelectorAll(".check-parametro:checked")).map(cb => parseInt(cb.value));
    if (parametrosIds.length === 0) { mostrarToast("Seleccioná al menos un parámetro."); return; }

    const payload = {
        nroProtocolo:         protocolo,
        fechaIngreso:         fecha,
        fechaEntrega:         document.getElementById("inputFechaEntrega").value || null,
        clienteId:            parseInt(clienteId),
        idMuestra,
        puntoMuestreo:        document.getElementById("inputPuntoMuestreo").value.trim() || null,
        matrizId:             parseInt(matrizId),
        resolucionDestinoIds: Array.from(destinosSeleccionadosDash),
        observaciones:        document.getElementById("inputObservaciones").value.trim() || null,
        parametrosIds,
    };

    const btn = document.getElementById("btnGuardar");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Guardando...`;
    try {
        const r = await fetchDash(`${API_BASE}/api/estudios`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        mostrarToast("Muestra registrada correctamente.");
        cerrarModalMuestra();
        cargarEstudios();
    } catch (err) {
        mostrarToast(`Error: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-check-lg"></i> Guardar muestra`;
    }
});

document.getElementById("btnAccionNuevaMuestra").addEventListener("click", abrirModalMuestra);

// ════════════════════════════════
//  MODAL ALTA TAREA
// ════════════════════════════════
const modalTarea = document.getElementById("modalAltaTarea");
const formTarea  = document.getElementById("formAltaTarea");
let usuariosCacheDash   = [];
let usuariosCargadosDash = false;

function abrirModalTarea() {
    modalTarea.classList.add("visible");
    document.getElementById("tareaTitle").focus();
    if (!usuariosCargadosDash) cargarUsuariosDash();
}

function cerrarModalTarea() {
    modalTarea.classList.remove("visible");
    setTimeout(() => {
        formTarea.reset();
        document.getElementById("errTareaTitle").style.display = "none";
    }, 250);
}

document.getElementById("modalTareaClose").addEventListener("click", cerrarModalTarea);
document.getElementById("btnCancelarTarea").addEventListener("click", cerrarModalTarea);
modalTarea.addEventListener("click", e => { if (e.target === modalTarea) cerrarModalTarea(); });

async function cargarUsuariosDash() {
    const sel = document.getElementById("tareaUserId");
    try {
        const r = await fetchDash(`${API_BASE}/api/users/asignables`);
        if (!r.ok) throw new Error();
        const users = await r.json();
        users.forEach(u => {
            const opt = document.createElement("option");
            opt.value = u.id;
            opt.textContent = u.nombreCompleto || u.nombre || u.email;
            sel.appendChild(opt);
        });
        usuariosCargadosDash = true;
    } catch { console.warn("No se pudieron cargar usuarios asignables"); }
}

formTarea.addEventListener("submit", async function (e) {
    e.preventDefault();
    const title = document.getElementById("tareaTitle").value.trim();
    const errTitle = document.getElementById("errTareaTitle");
    if (!title) { errTitle.style.display = "block"; return; }
    errTitle.style.display = "none";

    const payload = {
        title,
        description: document.getElementById("tareaDescription").value.trim() || null,
        userId:      parseInt(document.getElementById("tareaUserId").value) || null,
        status:      document.getElementById("tareaStatus").value,
    };

    const btn = document.getElementById("btnGuardarTarea");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Guardando...`;
    try {
        const r = await fetchDash(`${API_BASE}/api/task`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        mostrarToast("Tarea creada correctamente.");
        cerrarModalTarea();
    } catch (err) {
        mostrarToast(`Error: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-check-lg"></i> Guardar tarea`;
    }
});

document.getElementById("btnAccionAltaTarea").addEventListener("click", abrirModalTarea);

// ════════════════════════════════
//  MODAL ALTA STOCK
// ════════════════════════════════
const modalStock = document.getElementById("modalAltaStock");
const formStock  = document.getElementById("formAltaStock");

function abrirModalStock() {
    modalStock.classList.add("visible");
    document.getElementById("stockNombre").focus();
}

function cerrarModalStock() {
    modalStock.classList.remove("visible");
    setTimeout(() => {
        formStock.reset();
        ["errStockNombre", "errStockCategoria", "errStockNivel"].forEach(id => {
            document.getElementById(id).style.display = "none";
        });
    }, 250);
}

document.getElementById("modalStockClose").addEventListener("click", cerrarModalStock);
document.getElementById("btnCancelarStock").addEventListener("click", cerrarModalStock);
modalStock.addEventListener("click", e => { if (e.target === modalStock) cerrarModalStock(); });

formStock.addEventListener("submit", async function (e) {
    e.preventDefault();
    const nombre    = document.getElementById("stockNombre").value.trim();
    const categoria = document.getElementById("stockCategoria").value;
    const nivel     = document.querySelector('input[name="stockNivel"]:checked')?.value || "";
    let ok = true;
    if (!nombre)    { document.getElementById("errStockNombre").style.display = "block"; ok = false; }
    else              document.getElementById("errStockNombre").style.display = "none";
    if (!categoria) { document.getElementById("errStockCategoria").style.display = "block"; ok = false; }
    else              document.getElementById("errStockCategoria").style.display = "none";
    if (!nivel)     { document.getElementById("errStockNivel").style.display = "block"; ok = false; }
    else              document.getElementById("errStockNivel").style.display = "none";
    if (!ok) return;

    const payload = {
        nombre,
        categoria,
        descripcion:   document.getElementById("stockDescripcion").value.trim() || null,
        nivel,
        observaciones: document.getElementById("stockObservaciones").value.trim() || null,
    };

    const btn = document.getElementById("btnGuardarStock");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Guardando...`;
    try {
        const r = await fetchDash(`${API_BASE}/api/stock`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        mostrarToast("Ítem de stock registrado.");
        cerrarModalStock();
    } catch (err) {
        mostrarToast(`Error: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-check-lg"></i> Guardar ítem`;
    }
});

document.getElementById("btnAccionAltaStock").addEventListener("click", abrirModalStock);

// Escape cierra cualquier modal activo
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modalMuestra.classList.contains("visible")) cerrarModalMuestra();
    if (modalTarea.classList.contains("visible"))   cerrarModalTarea();
    if (modalStock.classList.contains("visible"))   cerrarModalStock();
});

// ── Toast ──
function mostrarToast(msg) {
    const toast = document.getElementById("toastConfirm");
    document.getElementById("toastMsg").textContent = msg;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 3500);
}

function generarAlertas() {
    const alertasBody = document.getElementById("alertasBody");
    if (!alertasBody) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const estadosActivos = new Set(["PENDIENTE", "EN_PROCESO", "DEMORADA", "COMPLETO_SIN_INFORME"]);

    // Ordenar activas con fecha por urgencia (más antiguas/próximas primero)
    const items = allEstudios
        .filter(m => estadosActivos.has(normalizarEstado(m.estado)))
        .map(m => ({ ...m, _fecha: parseFecha(m.fecha) }))
        .filter(m => m._fecha)
        .sort((a, b) => a._fecha - b._fecha)
        .reduce((acc, m) => {
            const dias = Math.ceil((m._fecha - hoy) / 86400000);
            if (dias > 7) return acc; // solo hasta 7 días adelante
            let color, etiqueta;
            if (dias < 0) {
                color = "rojo";
                etiqueta = `${Math.abs(dias)}d atrasada`;
            } else if (dias === 0) {
                color = "rojo";
                etiqueta = "Hoy";
            } else if (dias === 1) {
                color = "naranja";
                etiqueta = "Mañana";
            } else if (dias <= 3) {
                color = "naranja";
                etiqueta = `En ${dias} días`;
            } else {
                color = "azul";
                etiqueta = `En ${dias} días`;
            }
            acc.push({ color, etiqueta, m });
            return acc;
        }, []);

    // Sin fecha de entrega cargada: COMPLETO_SIN_INFORME pendientes de informe
    allEstudios
        .filter(m => normalizarEstado(m.estado) === "COMPLETO_SIN_INFORME" && !parseFecha(m.fecha))
        .slice(0, 2)
        .forEach(m => items.push({ color: "naranja", etiqueta: "Sin informe", m }));

    if (items.length === 0) {
        alertasBody.innerHTML = `
            <div class="alerta-vacio">
                <i class="bi bi-calendar-check"></i>
                Sin entregas próximas
            </div>`;
        return;
    }

    alertasBody.innerHTML = items.slice(0, 8).map(({ color, etiqueta, m }) => `
        <div class="alerta-item">
            <div class="alerta-dot ${color}"></div>
            <div class="alerta-texto">
                <p><strong>${m.codigo}</strong></p>
                <span>${m.cliente} · ${m.tipo}</span>
            </div>
            <span class="alerta-fecha ${color}">${etiqueta}</span>
        </div>
    `).join("");
}

// ════════════════════════════════
//  VER DETALLE
// ════════════════════════════════
async function verDetalle(id) {
    const token = localStorage.getItem("token");
    try {
        const resp = await fetch(`${API_BASE}/api/estudios/${id}/detalle`, {
            headers: token ? { Authorization: "Bearer " + token } : {},
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const d = await resp.json();
        poblarModalDetalle(d);
        document.getElementById("modalDetalle").classList.add("visible");
    } catch (err) {
        console.error("Error cargando detalle:", err);
        mostrarToast("Error al cargar el detalle");
    }
}

function poblarModalDetalle(d) {
    const badge = document.getElementById("detalleEstadoBadge");
    badge.className = badgeClassParaEstado(d.estado);
    badge.textContent = labelEstado(d.estado);

    document.getElementById("detalleProtocolo").textContent = d.nroProtocolo || "—";
    document.getElementById("detalleIdMuestra").textContent = d.idMuestra || "—";
    document.getElementById("detalleCliente").textContent = d.cliente || "—";
    document.getElementById("detalleMatriz").textContent = d.matrizNombre || "—";
    document.getElementById("detallePunto").textContent = d.puntoMuestreo || "—";
    document.getElementById("detalleFechaIngreso").textContent = formatearFechaDMY(d.fechaIngreso) || "—";
    document.getElementById("detalleFechaEntrega").textContent = formatearFechaDMY(d.fechaEntrega) || "—";
    document.getElementById("detalleObservaciones").textContent = d.observaciones || "Sin observaciones";

    const paramEl = document.getElementById("detalleParametros");
    if (d.parametros && d.parametros.length > 0) {
        paramEl.innerHTML = d.parametros.map(p =>
            `<span class="detalle-tag detalle-tag-verde">${p.nombre}${p.unidad ? ` (${p.unidad})` : ""}</span>`
        ).join("");
    } else {
        paramEl.innerHTML = `<span style="color:var(--color-text-tertiary);font-size:13px">Sin parámetros</span>`;
    }

    const resSection = document.getElementById("detalleResolucionesSection");
    const resEl = document.getElementById("detalleResoluciones");
    if (d.resolucionesAplicadas && d.resolucionesAplicadas.length > 0) {
        resSection.style.display = "";
        resEl.innerHTML = d.resolucionesAplicadas.map(r =>
            `<span class="detalle-tag detalle-tag-azul">${r}</span>`
        ).join("");
    } else {
        resSection.style.display = "none";
    }
}

const modalDetalle = document.getElementById("modalDetalle");
document.getElementById("modalDetalleClose").addEventListener("click", () => modalDetalle.classList.remove("visible"));
document.getElementById("btnDetalleClose").addEventListener("click", () => modalDetalle.classList.remove("visible"));
modalDetalle.addEventListener("click", e => { if (e.target === modalDetalle) modalDetalle.classList.remove("visible"); });

// ════════════════════════════════
//  AVANZAR ESTADO
// ════════════════════════════════
const SIGUIENTE_ESTADO = {
    PENDIENTE: "EN_PROCESO",
    EN_PROCESO: "COMPLETO_SIN_INFORME",
    DEMORADA: "EN_PROCESO",
};

async function avanzarEstado(id, estadoActual, btn) {
    const siguiente = SIGUIENTE_ESTADO[estadoActual];
    if (!siguiente) return;

    const token = localStorage.getItem("token");
    const originalHtml = btn ? btn.innerHTML : null;
    if (btn) { btn.disabled = true; btn.innerHTML = `<i class="bi bi-hourglass-split"></i>`; }

    try {
        const resp = await fetch(`${API_BASE}/api/estudios/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: "Bearer " + token } : {}),
            },
            body: JSON.stringify({ estado: siguiente }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        mostrarToast(`Estado actualizado: ${labelEstado(siguiente)}`);
        await cargarEstudios();
    } catch (err) {
        console.error("Error avanzando estado:", err);
        mostrarToast("Error al actualizar el estado");
        if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
    }
}

// ════════════════════════════════
//  ELIMINAR
// ════════════════════════════════
const modalEliminar = document.getElementById("modalEliminar");
document.getElementById("modalEliminarClose").addEventListener("click", () => modalEliminar.classList.remove("visible"));
document.getElementById("btnCancelarEliminar").addEventListener("click", () => modalEliminar.classList.remove("visible"));
modalEliminar.addEventListener("click", e => { if (e.target === modalEliminar) modalEliminar.classList.remove("visible"); });

function pedirConfirmacionEliminar(id, codigo) {
    document.getElementById("modalEliminarMsg").textContent =
        `¿Estás seguro de que querés eliminar la muestra ${codigo}? Esta acción no se puede deshacer.`;
    document.getElementById("btnConfirmarEliminar").dataset.id = id;
    modalEliminar.classList.add("visible");
}

document.getElementById("btnConfirmarEliminar").addEventListener("click", async function () {
    const id = this.dataset.id;
    const token = localStorage.getItem("token");
    this.disabled = true;
    this.innerHTML = `<i class="bi bi-hourglass-split"></i> Eliminando...`;

    try {
        const resp = await fetch(`${API_BASE}/api/estudios/${id}`, {
            method: "DELETE",
            headers: token ? { Authorization: "Bearer " + token } : {},
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        modalEliminar.classList.remove("visible");
        mostrarToast("Muestra eliminada correctamente");
        await cargarEstudios();
    } catch (err) {
        console.error("Error eliminando muestra:", err);
        mostrarToast("Error al eliminar la muestra");
    } finally {
        this.disabled = false;
        this.innerHTML = `<i class="bi bi-trash3"></i> Eliminar`;
    }
});

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
    const mapped = Array.isArray(estudios)
        ? estudios.map((est) => ({
            id: est.id || est._id || est.codigo || est.protocolo || null,
            codigo: est.protocolo || est.codigo || est.id || "-",
            cliente: est.cliente || est.clienteNombre || est.customer || "-",
            tipo: est.tipo || est.tipoAnalisis || est.tipo_de_analisis || "-",
            estado: est.estado || est.status || "-",
            tieneInforme: (est.estado || est.status || "").toString().toUpperCase() === "COMPLETO",
            fechaAlta: formatearFechaDMY(
                est.fechaAlta || est.fecha_alta || est.fechaCreacion ||
                est.fecha_creacion || est.createdDate || est.createdAt ||
                est.fechaDeAlta || "-",
            ),
            fecha: est.fechaEntrega || est.fecha_entrega || est.deliveryDate || est.fecha || "-",
        }))
        : [];

    // Dataset completo (incluye COMPLETO) para KPIs y alertas
    allEstudios = mapped;
    // Solo activas para la tabla
    allMuestras = mapped.filter((m) => ESTADOS_VISIBLES.has(normalizarEstado(m.estado)));

    const demoTotal = parseInt(localStorage.getItem("demoTotal") || "0");
    if (demoTotal > allMuestras.length) {
        const clones = [];
        let idx = 0;
        while (allMuestras.length + clones.length < demoTotal) {
            const source = allMuestras[idx % allMuestras.length] || {
                codigo: `DEM-${idx + 1}`, cliente: "Demo", tipo: "—",
                estado: "PENDIENTE", fechaAlta: "-", fecha: "-",
            };
            const clone = Object.assign({}, source);
            clone.codigo = `${clone.codigo}-D${idx + 1}`;
            clones.push(clone);
            idx++;
            if (idx > 1000) break;
        }
        allMuestras = allMuestras.concat(clones);
    }

    filteredMuestras = [...allMuestras];
    currentPage = 1;
    actualizarKPIs();
    generarAlertas();
    renderPage();
}

function actualizarKPIs() {
    const pendientes        = allEstudios.filter(m => normalizarEstado(m.estado) === "PENDIENTE").length;
    const enProceso         = allEstudios.filter(m => normalizarEstado(m.estado) === "EN_PROCESO").length;
    const demoradas         = allEstudios.filter(m => normalizarEstado(m.estado) === "DEMORADA").length;
    const completoSinInforme= allEstudios.filter(m => normalizarEstado(m.estado) === "COMPLETO_SIN_INFORME").length;
    const activas           = pendientes + enProceso + demoradas + completoSinInforme;

    const hoy     = new Date();
    const en7dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
    const vencenProximo = allEstudios.filter(m => {
        if (normalizarEstado(m.estado) === "COMPLETO") return false;
        const f = parseFecha(m.fecha);
        return f && f >= hoy && f <= en7dias;
    }).length;

    const elMuestras    = document.getElementById("kpi-muestras-activas");
    const elMuestrasSub = document.getElementById("kpi-muestras-sub");
    const elDemoradas   = document.getElementById("kpi-demoradas");
    const elDemoradasSub= document.getElementById("kpi-demoradas-sub");

    if (elMuestras) elMuestras.textContent = activas;
    if (elMuestrasSub) {
        elMuestrasSub.innerHTML = vencenProximo > 0
            ? `<i class="bi bi-clock"></i> ${vencenProximo} vencen esta semana`
            : `<i class="bi bi-check2"></i> Sin vencimientos próximos`;
    }
    if (elDemoradas) elDemoradas.textContent = demoradas;
    if (elDemoradasSub) {
        elDemoradasSub.innerHTML = demoradas > 0
            ? `<i class="bi bi-arrow-right"></i> <a href="muestras.html">Ver muestras</a>`
            : `<i class="bi bi-check2"></i> Sin demoradas`;
    }

    if (grafico) {
        grafico.data.datasets[0].data = [pendientes, enProceso, completoSinInforme, demoradas];
        grafico.update();
    }
}

async function cargarTareasKPI() {
    try {
        const r = await fetchDash(`${API_BASE}/api/task`);
        if (!r.ok) return;
        const tareas = await r.json();
        const todo       = tareas.filter(t => t.status === "TODO").length;
        const enProgreso = tareas.filter(t => t.status === "IN_PROGRESS").length;

        const el    = document.getElementById("kpi-tareas");
        const elSub = document.getElementById("kpi-tareas-sub");
        if (el) el.textContent = todo;
        if (elSub) {
            elSub.innerHTML = enProgreso > 0
                ? `<i class="bi bi-arrow-right-circle"></i> ${enProgreso} en progreso`
                : `<i class="bi bi-check2"></i> Ninguna en progreso`;
        }
    } catch { /* no bloquea el dashboard */ }
}

async function cargarStockKPI() {
    try {
        const r = await fetchDash(`${API_BASE}/api/stock`);
        if (!r.ok) return;
        const items = await r.json();
        const bajos = items.filter(i => i.nivel === "BAJO").length;

        const el    = document.getElementById("kpi-stock");
        const elSub = document.getElementById("kpi-stock-sub");
        if (el) el.textContent = bajos;
        if (elSub) {
            elSub.innerHTML = bajos > 0
                ? `<i class="bi bi-exclamation-triangle"></i> ${bajos} items con nivel bajo`
                : `<i class="bi bi-check2"></i> Stock sin alertas`;
        }
    } catch { /* no bloquea el dashboard */ }
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
            const estadoNorm = normalizarEstado(m.estado);

            acciones.push(
                `<button class="btn-accion btn-detalle" data-id="${m.id}" title="Ver detalles"><i class="bi bi-eye"></i></button>`,
            );

            const AVANZAR_MAP = {
                PENDIENTE: { label: "Iniciar análisis", icono: "bi-play-circle" },
                EN_PROCESO: { label: "Marcar completo", icono: "bi-check2-circle" },
                DEMORADA: { label: "Reactivar", icono: "bi-arrow-counterclockwise" },
            };
            if (AVANZAR_MAP[estadoNorm]) {
                const av = AVANZAR_MAP[estadoNorm];
                acciones.push(
                    `<button class="btn-accion btn-avanzar" data-id="${m.id}" data-estado="${estadoNorm}" title="${av.label}"><i class="bi ${av.icono}"></i></button>`,
                );
            }

            acciones.push(
                `<button class="btn-accion btn-subir" data-id="${m.id}" title="Subir informe"><i class="bi bi-upload"></i></button>`,
            );

            acciones.push(
                `<button class="btn-accion btn-eliminar" data-id="${m.id}" data-codigo="${m.codigo}" title="Eliminar"><i class="bi bi-trash3"></i></button>`,
            );

            const row = `
                    <tr data-estado="${(m.estado || "").toString().toUpperCase()}" data-id="${m.id}">
                        <td><span class="cod-badge">${m.codigo}</span></td>
                        <td>${m.cliente}</td>
                        <td>${m.tipo}</td>
                        <td><span class="${badgeClass}">${labelEstado(m.estado)}</span></td>
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
        mostrarToast("Error al subir el archivo.", 'danger');
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
        mostrarToast("Error al abrir el resultado.", 'danger');
    } finally {
        if (triggerBtn) {
            triggerBtn.disabled = false;
            if (originalHtml) triggerBtn.innerHTML = originalHtml;
        }
    }
}

// Delegación de clicks en los botones de la tabla
document.addEventListener("click", function (e) {
    const btnDetalle = e.target.closest(".btn-detalle");
    if (btnDetalle) {
        const id = btnDetalle.getAttribute("data-id");
        if (id) verDetalle(id);
        return;
    }

    const btnAvanzar = e.target.closest(".btn-avanzar");
    if (btnAvanzar) {
        const id = btnAvanzar.getAttribute("data-id");
        const estado = btnAvanzar.getAttribute("data-estado");
        if (id && estado) avanzarEstado(id, estado, btnAvanzar);
        return;
    }

    const btnEliminar = e.target.closest(".btn-eliminar");
    if (btnEliminar) {
        const id = btnEliminar.getAttribute("data-id");
        const codigo = btnEliminar.getAttribute("data-codigo");
        if (id) pedirConfirmacionEliminar(id, codigo);
        return;
    }

    const btnVer = e.target.closest(".btn-ver");
    if (btnVer) {
        const id = btnVer.getAttribute("data-id");
        if (id) verResultado(id, btnVer);
        return;
    }

    const btnSubir = e.target.closest(".btn-subir");
    if (btnSubir) {
        const id = btnSubir.getAttribute("data-id");
        if (id) startUploadForId(id, btnSubir);
    }
});

// Cargar al iniciar
cargarEstudios();
cargarTareasKPI();
cargarStockKPI();

// ════════════════════════════════
//  PANEL VISIBILITY MANAGER
// ════════════════════════════════
const DP_KEY = "chemiconsult_hidden_panels";

const DP_META = {
    // paneles
    alertas:       { type: "panel", icon: "bi-calendar-check",  label: "Próximas entregas" },
    acciones:      { type: "panel", icon: "bi-lightning-charge", label: "Acciones rápidas" },
    grafico:       { type: "panel", icon: "bi-pie-chart",        label: "Distribución" },
    // KPI cards
    muestras:      { type: "kpi",   icon: "bi-flask",            label: "Muestras activas" },
    tareas:        { type: "kpi",   icon: "bi-list-check",       label: "Tareas pendientes" },
    stock:         { type: "kpi",   icon: "bi-box-seam",         label: "Stock bajo" },
    demoradas:     { type: "kpi",   icon: "bi-clock-history",    label: "Demoradas" },
};

function dpLoad() {
    try { return JSON.parse(localStorage.getItem(DP_KEY) || "[]"); }
    catch { return []; }
}

function dpSave(hidden) {
    localStorage.setItem(DP_KEY, JSON.stringify(hidden));
}

function dpRender() {
    const hidden = dpLoad();
    const bar = document.getElementById("dpRestoreBar");
    if (!bar) return;

    Object.keys(DP_META).forEach(id => {
        const meta = DP_META[id];
        const sel = meta.type === "kpi"
            ? `.kpi-card[data-kpi="${id}"]`
            : `[data-panel="${id}"]`;
        const el = document.querySelector(sel);
        if (el) el.classList.toggle("dp-hidden", hidden.includes(id));
    });

    if (hidden.length === 0) {
        bar.style.display = "none";
        bar.innerHTML = "";
        return;
    }

    bar.style.display = "flex";
    bar.innerHTML =
        `<span class="dp-restore-bar-label">Ocultos:</span>` +
        hidden.map(id => {
            const m = DP_META[id];
            if (!m) return "";
            return `<button class="dp-restore-chip" data-restore="${id}">
                        <i class="bi ${m.icon}"></i>${m.label}
                        <i class="bi bi-eye" style="font-size:11px;opacity:.7"></i>
                    </button>`;
        }).join("");

    bar.querySelectorAll("[data-restore]").forEach(btn =>
        btn.addEventListener("click", () => {
            dpSave(dpLoad().filter(id => id !== btn.dataset.restore));
            dpRender();
        })
    );
}

document.querySelectorAll(".dp-toggle").forEach(btn =>
    btn.addEventListener("click", () => {
        const id = btn.dataset.panel;
        const hidden = dpLoad();
        if (!hidden.includes(id)) hidden.push(id);
        dpSave(hidden);
        dpRender();
    })
);

document.querySelectorAll(".dp-kpi-close").forEach(btn =>
    btn.addEventListener("click", () => {
        const id = btn.dataset.kpi;
        const hidden = dpLoad();
        if (!hidden.includes(id)) hidden.push(id);
        dpSave(hidden);
        dpRender();
    })
);

dpRender();