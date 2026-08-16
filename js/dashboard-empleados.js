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
        CANCELADO: "Cancelado",
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
    } else if (estado === "CANCELADO") {
        const canceladas = allEstudios.filter(
            (m) => normalizarEstado(m.estado) === "CANCELADO"
        );
        canceladas.sort((a, b) => {
            const fa = parseFecha(a.fechaAlta), fb = parseFecha(b.fechaAlta);
            if (!fa && !fb) return 0;
            if (!fa) return 1;
            if (!fb) return -1;
            return fb - fa;
        });
        filteredMuestras = canceladas.slice(0, 20);
    } else {
        filteredMuestras = allMuestras.filter(
            (m) => normalizarEstado(m.estado) === estado,
        );
    }

    currentPage = 1;
    renderPage();
}


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
        document.getElementById("grupoSucursal").style.display = "none";
        document.getElementById("inputSucursal").innerHTML = '';
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

document.getElementById("inputCliente").addEventListener("change", async function () {
    const clienteId = this.value;
    const grupoSucursal = document.getElementById("grupoSucursal");
    const selSucursal   = document.getElementById("inputSucursal");
    selSucursal.innerHTML = '<option value="">— casa central —</option>';
    grupoSucursal.style.display = "none";
    if (!clienteId) return;
    try {
        const r = await fetchDash(`${API_BASE}/api/clientes/${clienteId}/sucursales`);
        if (!r.ok) return;
        const sucursales = await r.json();
        if (sucursales.length === 0) return;
        sucursales.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = s.nombre + (s.localidad ? ` — ${s.localidad}` : "");
            selSucursal.appendChild(opt);
        });
        grupoSucursal.style.display = "block";
    } catch { /* sin sucursales */ }
});

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

async function cargarTiposMuestra(matrizId) {
    const select = document.getElementById("inputTipoMuestraEspecifica");
    select.innerHTML = '<option value="">— sin especificar —</option>';
    if (!matrizId) return;
    try {
        const r = await fetchDash(`${API_BASE}/api/tipos-muestra?matrizId=${matrizId}`);
        if (!r.ok) return;
        const tipos = await r.json();
        tipos.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.nombre;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Error cargando tipos de muestra:", err);
    }
}

document.getElementById("inputTipoMuestra").addEventListener("change", async function () {
    const matrizId = this.value;
    const cont = document.getElementById("normativasContainer");
    destinosSeleccionadosDash.clear();
    parametrosPorDestinoCacheDash.clear();
    recalcularParametrosDash();
    cargarTiposMuestra(matrizId);
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
    const matrizId  = document.getElementById("inputTipoMuestra").value;

    let ok = true;
    [
        [!protocolo, "errProtocolo"],
        [!fecha,     "errFecha"],
        [!clienteId, "errCliente"],
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
        sucursalId:           document.getElementById("inputSucursal").value ? parseInt(document.getElementById("inputSucursal").value) : null,
        puntoMuestreo:        document.getElementById("inputPuntoMuestreo").value.trim() || null,
        tipoMuestraId:        document.getElementById("inputTipoMuestraEspecifica").value
                                  ? parseInt(document.getElementById("inputTipoMuestraEspecifica").value)
                                  : null,
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

document.getElementById("btnAccionNuevaMuestra").addEventListener("click", () => {
    window.location.href = "muestras.html?nueva=1";
});

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

document.getElementById("btnAccionAltaTarea").addEventListener("click", () => {
    window.location.href = "task.html?nueva=1";
});

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

document.getElementById("btnAccionAltaStock").addEventListener("click", () => {
    window.location.href = "stock.html?nueva=1";
});

// Escape cierra cualquier modal activo
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modalMuestra.classList.contains("visible")) cerrarModalMuestra();
    if (modalTarea.classList.contains("visible"))   cerrarModalTarea();
    if (modalStock.classList.contains("visible"))   cerrarModalStock();
    if (modalAltaInforme && modalAltaInforme.classList.contains("visible"))       cerrarAltaInforme();
    if (modalCancelarMuestra && modalCancelarMuestra.classList.contains("visible")) cerrarModalCancelar();
});

// ── Toast ──
function mostrarToast(msg) {
    const toast = document.getElementById("toastConfirm");
    document.getElementById("toastMsg").textContent = msg;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 3500);
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
    badge.className = "";
    badge.innerHTML = badgeHTML(d.estado);

    document.getElementById("detalleProtocolo").textContent = d.nroProtocolo || "—";
    document.getElementById("detalleCliente").textContent = d.cliente || "—";
    document.getElementById("detalleMatriz").textContent = d.matrizNombre || "—";
    document.getElementById("detallePunto").textContent = d.puntoMuestreo || "—";
    document.getElementById("detalleTipoMuestra").textContent = d.tipoMuestraNombre || "—";
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
//  CANCELAR MUESTRA
// ════════════════════════════════
let _cancelarMuestraId = null;

const modalCancelarMuestra = document.getElementById("modalCancelarMuestra");
document.getElementById("modalCancelarClose").addEventListener("click", cerrarModalCancelar);
document.getElementById("btnCancelarCancelar").addEventListener("click", cerrarModalCancelar);
modalCancelarMuestra.addEventListener("click", e => { if (e.target === modalCancelarMuestra) cerrarModalCancelar(); });

function abrirModalCancelar(id, codigo) {
    _cancelarMuestraId = id;
    document.getElementById("modalCancelarMsg").textContent =
        `¿Cancelar la muestra ${codigo}? El registro se conserva con estado Cancelado.`;
    document.getElementById("inputMotivoCancelacionM").value = "";
    modalCancelarMuestra.classList.add("visible");
    setTimeout(() => document.getElementById("inputMotivoCancelacionM").focus(), 100);
}

function cerrarModalCancelar() {
    modalCancelarMuestra.classList.remove("visible");
    _cancelarMuestraId = null;
}

document.getElementById("btnConfirmarCancelar").addEventListener("click", async function () {
    const id = _cancelarMuestraId;
    if (!id) return;
    const motivo = document.getElementById("inputMotivoCancelacionM").value.trim();
    this.disabled = true;
    this.innerHTML = `<i class="bi bi-hourglass-split"></i> Cancelando...`;

    try {
        const resp = await fetchDash(`${API_BASE}/api/estudios/${id}/cancelar`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ motivo }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        cerrarModalCancelar();
        mostrarToast("Muestra cancelada correctamente");
        await cargarEstudios();
    } catch (err) {
        console.error("Error cancelando muestra:", err);
        mostrarToast("Error al cancelar la muestra");
    } finally {
        this.disabled = false;
        this.innerHTML = `<i class="bi bi-x-circle"></i> Confirmar cancelación`;
    }
});

// ════════════════════════════════
//  ARCHIVOS DE MUESTRA
// ════════════════════════════════
let altaInformeAnalisisId = null;

const modalAltaInforme = document.getElementById("modalAltaInforme");
document.getElementById("altaInformeClose").addEventListener("click", cerrarAltaInforme);
document.getElementById("altaInformeCancelar").addEventListener("click", cerrarAltaInforme);
modalAltaInforme.addEventListener("click", e => { if (e.target === modalAltaInforme) cerrarAltaInforme(); });
document.getElementById("btnUploadAltaInforme").addEventListener("click", onUploadAltaInforme);

function abrirAltaInforme(id, protocolo) {
    altaInformeAnalisisId = id;
    document.getElementById("altaInformeTitulo").textContent = `Archivos — ${protocolo || id}`;
    document.getElementById("inputAltaInformePdf").value = "";
    const errEl = document.getElementById("altaInformeError");
    if (errEl) { errEl.textContent = ""; errEl.style.display = "none"; }
    modalAltaInforme.classList.add("visible");
    cargarListaArchivos(id);
}

function cerrarAltaInforme() {
    modalAltaInforme.classList.remove("visible");
    altaInformeAnalisisId = null;
}

async function cargarListaArchivos(analisisId) {
    const contenedor = document.getElementById("listaArchivos");
    if (!contenedor) return;
    contenedor.innerHTML = `<span style="font-size:13px;color:#888;">Cargando...</span>`;
    try {
        const r = await fetchDash(`${API_BASE}/api/estudios/${analisisId}/archivos`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const docs = await r.json();
        if (!docs || docs.length === 0) {
            contenedor.innerHTML = `<span class="text-muted" style="font-size:13px;">Sin archivos todavía.</span>`;
            return;
        }
        contenedor.innerHTML = docs.map(d => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#f8f9fa;border-radius:6px;">
                <i class="bi bi-file-earmark-pdf" style="color:#ef4444;font-size:16px;flex-shrink:0;"></i>
                <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.nombre || d.id}</span>
                <button class="btn-accion" onclick="descargarArchivoModal(${analisisId},'${d.id}')" title="Descargar" style="width:28px;height:28px;"><i class="bi bi-download"></i></button>
                <button class="btn-accion btn-accion-rojo" onclick="eliminarArchivoModal(${analisisId},'${d.id}')" title="Eliminar" style="width:28px;height:28px;"><i class="bi bi-trash"></i></button>
            </div>`).join("");
    } catch (err) {
        contenedor.innerHTML = `<span style="font-size:13px;color:#ef4444;">Error al cargar archivos.</span>`;
        console.error("Error cargando archivos:", err);
    }
}

window.descargarArchivoModal = function(analisisId, docId) {
    const token = localStorage.getItem("token");
    fetch(`${API_BASE}/api/estudios/${analisisId}/archivos/${docId}`, {
        headers: token ? { Authorization: "Bearer " + token } : {},
    }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
    }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `documento_${docId}.pdf`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }).catch(err => {
        console.error("Error descargando archivo:", err);
        mostrarToast("Error al descargar el archivo.");
    });
};

window.eliminarArchivoModal = async function(analisisId, docId) {
    try {
        const r = await fetchDash(`${API_BASE}/api/estudios/${analisisId}/archivos/${docId}`, { method: "DELETE" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        mostrarToast("Archivo eliminado");
        await cargarListaArchivos(analisisId);
        await cargarEstudios();
    } catch (err) {
        console.error("Error eliminando archivo:", err);
        mostrarToast("Error al eliminar el archivo.");
    }
};

async function onUploadAltaInforme() {
    const input = document.getElementById("inputAltaInformePdf");
    const errEl = document.getElementById("altaInformeError");
    const btn = document.getElementById("btnUploadAltaInforme");
    if (!input.files || !input.files[0]) {
        errEl.textContent = "Seleccioná un archivo PDF.";
        errEl.style.display = "block";
        return;
    }
    errEl.style.display = "none";
    btn.disabled = true;
    btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Subiendo...`;
    try {
        const fd = new FormData();
        fd.append("file", input.files[0], input.files[0].name);
        const token = localStorage.getItem("token");
        const resp = await fetch(`${API_BASE}/api/estudios/${altaInformeAnalisisId}/documento`, {
            method: "POST",
            headers: token ? { Authorization: "Bearer " + token } : {},
            body: fd,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        mostrarToast("Archivo subido correctamente");
        input.value = "";
        await cargarListaArchivos(altaInformeAnalisisId);
        await cargarEstudios();
    } catch (err) {
        console.error("Error subiendo archivo:", err);
        errEl.textContent = "Error al subir el archivo.";
        errEl.style.display = "block";
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-upload me-1"></i> Subir archivo`;
    }
}

// ════════════════════════════════
//  GENERAR INFORME PDF
// ════════════════════════════════
async function generarInformeDesdeDash(id) {
    mostrarToast("Generando informe...");
    try {
        const token = localStorage.getItem("token");
        const resp = await fetch(`${API_BASE}/api/estudios/${id}/generar-informe`, {
            method: "POST",
            headers: token
                ? { Authorization: "Bearer " + token, "Content-Type": "application/json" }
                : { "Content-Type": "application/json" },
            body: JSON.stringify({ equipoIds: [] }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `informe_${id}.pdf`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        mostrarToast("Informe generado correctamente");
        await cargarEstudios();
    } catch (err) {
        console.error("Error generando informe:", err);
        mostrarToast("Error al generar el informe.");
    }
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

function badgeHTML(estado) {
    const e = normalizarEstado(estado || "");
    const classMap = {
        PENDIENTE:            "badge-pendiente",
        EN_PROCESO:           "badge-proceso",
        COMPLETO_SIN_INFORME: "badge-completo-sin-informe",
        DEMORADA:             "badge-demorada",
        COMPLETO:             "badge-informe",
        CANCELADO:            "badge-cancelado",
    };
    const cls = classMap[e] || "";
    const lbl = labelEstado(e);
    return `<span class="badge-estado ${cls}"><span class="badge-dot"></span>${lbl}</span>`;
}

function mostrarMuestras(estudios) {
    const mapped = Array.isArray(estudios)
        ? estudios.map((est) => ({
            id: est.id || est._id || est.codigo || est.protocolo || null,
            codigo: est.nroProtocolo || est.protocolo || est.codigo || est.id || "-",
            cliente: est.cliente || est.clienteNombre || est.customer || "-",
            tipo: est.tipoMuestraNombre || est.tipo || est.tipoAnalisis || est.tipo_de_analisis || "-",
            estado: est.estado || est.status || "-",
            tieneInforme: (est.estado || est.status || "").toString().toUpperCase() === "COMPLETO",
            fechaAlta: formatearFechaDMY(
                est.fechaIngreso || est.fechaAlta || est.fecha_alta ||
                est.fechaCreacion || est.fecha_creacion || est.createdDate ||
                est.createdAt || est.fechaDeAlta || "-",
            ),
            fecha: est.fechaEntrega || est.fecha_entrega || est.deliveryDate || est.fecha || "-",
        }))
        : [];

    // Dataset completo (incluye COMPLETO) para KPIs y alertas
    allEstudios = mapped;
    // Solo activas para la tabla
    allMuestras = mapped.filter((m) => ESTADOS_VISIBLES.has(normalizarEstado(m.estado)));
    allMuestras.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

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
    renderPage();
}

function actualizarKPIs() {
    const pendientes         = allEstudios.filter(m => normalizarEstado(m.estado) === "PENDIENTE").length;
    const enProceso          = allEstudios.filter(m => normalizarEstado(m.estado) === "EN_PROCESO").length;
    const demoradas          = allEstudios.filter(m => normalizarEstado(m.estado) === "DEMORADA").length;
    const completoSinInforme = allEstudios.filter(m => normalizarEstado(m.estado) === "COMPLETO_SIN_INFORME").length;
    const activas            = pendientes + enProceso + demoradas + completoSinInforme;

    const elActivas    = document.getElementById("hub-activas");
    const elDemoradas  = document.getElementById("hub-demoradas");
    const elSinInforme = document.getElementById("hub-sin-informe");

    if (elActivas)    elActivas.textContent = activas;
    if (elDemoradas)  elDemoradas.textContent = demoradas;
    if (elSinInforme) elSinInforme.textContent = completoSinInforme;

    _refreshActivePanel("muestras");

    renderHubMuestras();
    renderGraficoMes();
}

let _graficoOffset = 0; // 0 = mes actual, -1 = mes anterior, etc.

function renderGraficoMes() {
    const ahora = new Date();
    const target = new Date(ahora.getFullYear(), ahora.getMonth() + _graficoOffset, 1);
    const mes  = target.getMonth();
    const anio = target.getFullYear();

    const delMes = allEstudios.filter(m => {
        const f = parseFecha(m.fechaAlta);
        return f && f.getMonth() === mes && f.getFullYear() === anio;
    });

    const grupos = { "Pendientes": 0, "En proceso": 0, "OK": 0, "Canceladas": 0 };
    delMes.forEach(m => {
        const est = normalizarEstado(m.estado);
        if      (est === "PENDIENTE")                                                          grupos["Pendientes"]++;
        else if (est === "EN_PROCESO" || est === "DEMORADA" || est === "COMPLETO_SIN_INFORME") grupos["En proceso"]++;
        else if (est === "COMPLETO")                                                            grupos["OK"]++;
        else                                                                                    grupos["Canceladas"]++;
    });

    const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const elLabel = document.getElementById("graficoMesLabel");
    if (elLabel) elLabel.textContent = `${MESES[mes]} ${anio}`;

    const elTotal = document.getElementById("graficoTotal");
    if (elTotal) elTotal.textContent = delMes.length;

    // deshabilitar "siguiente" cuando ya estamos en el mes actual
    const btnSig = document.getElementById("btnGraficoSiguiente");
    if (btnSig) btnSig.disabled = _graficoOffset >= 0;

    const canvas = document.getElementById("graficoEstados");
    if (!canvas) return;

    const labels = Object.keys(grupos);
    const data   = Object.values(grupos);
    const colors = ["#f59e0b", "#3b82f6", "#5EA504", "#9ca3af"];

    if (window._graficoMes) {
        window._graficoMes.data.datasets[0].data = data;
        window._graficoMes.update();
        return;
    }

    window._graficoMes = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "68%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        boxWidth: 10,
                        padding: 10,
                        font: { size: 11 },
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue("--text-main").trim() || "#1a1a2e",
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed}`,
                    }
                }
            }
        }
    });
}

document.getElementById("btnGraficoAnterior")?.addEventListener("click", () => {
    _graficoOffset--;
    renderGraficoMes();
});
document.getElementById("btnGraficoSiguiente")?.addEventListener("click", () => {
    if (_graficoOffset >= 0) return;
    _graficoOffset++;
    renderGraficoMes();
});

function renderHubMuestras() {
    const body = document.getElementById("hubMuestrasBody");
    if (!body) return;

    const estadosActivos = new Set(["PENDIENTE", "EN_PROCESO", "DEMORADA", "COMPLETO_SIN_INFORME"]);
    const activas = allEstudios.filter(m => estadosActivos.has(normalizarEstado(m.estado)));

    if (activas.length === 0) {
        body.innerHTML = `<div class="mod-mini-empty"><i class="bi bi-check2-circle"></i> Sin muestras activas</div>`;
        return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const sorted = [...activas].sort((a, b) => {
        const aDem = normalizarEstado(a.estado) === "DEMORADA";
        const bDem = normalizarEstado(b.estado) === "DEMORADA";
        if (aDem && !bDem) return -1;
        if (!aDem && bDem) return 1;
        const fa = parseFecha(a.fecha), fb = parseFecha(b.fecha);
        if (fa && fb) return fa - fb;
        if (fa) return -1;
        if (fb) return 1;
        return 0;
    });

    body.innerHTML = sorted.slice(0, 3).map(m => {
        const estado = normalizarEstado(m.estado);
        let dotClass = "azul", badgeClass = "proc", badgeText = "En proceso";

        if (estado === "DEMORADA") {
            dotClass = "rojo"; badgeClass = "demo"; badgeText = "Demorada";
        } else if (estado === "PENDIENTE") {
            dotClass = "naranja";
            const f = parseFecha(m.fecha);
            if (f) {
                const dias = Math.ceil((f - hoy) / 86400000);
                if (dias < 0)      { badgeClass = "demo"; badgeText = `${Math.abs(dias)}d atrasada`; }
                else if (dias === 0){ badgeClass = "hoy";  badgeText = "Hoy"; }
                else if (dias === 1){ badgeClass = "pend"; badgeText = "Mañana"; }
                else               { badgeClass = "pend"; badgeText = `${dias}d`; }
            } else { badgeClass = "pend"; badgeText = "Pendiente"; }
        } else if (estado === "COMPLETO_SIN_INFORME") {
            dotClass = "gris"; badgeClass = "sin"; badgeText = "Sin informe";
        }

        return `<div class="mod-mini-row">
            <span class="mod-mini-dot ${dotClass}"></span>
            <span class="mod-mini-name">${m.cliente}</span>
            <span class="mod-mini-badge ${badgeClass}">${badgeText}</span>
        </div>`;
    }).join("");
}

// Datos para paneles expandibles
let agendaSemanaDatos   = [];
let agendaHoyDatos      = [];
let agendaTodosDatos    = [];
let stockBajosDatos     = [];
let stockMediosDatos    = [];
let stockAltosDatos     = [];
let tareasProgresoDatos = [];
let tareasTodoDatos     = [];
let tareasRevisionDatos = [];

async function cargarTareasKPI() {
    try {
        const r = await fetchDash(`${API_BASE}/api/task`);
        if (!r.ok) return;
        const tareas = await r.json();

        const todo       = tareas.filter(t => t.status === "TODO").length;
        const enProgreso = tareas.filter(t => t.status === "IN_PROGRESS").length;
        const enRevision = tareas.filter(t => t.status === "EN_REVISION").length;

        const elTodo     = document.getElementById("hub-tareas-todo");
        const elProgreso = document.getElementById("hub-tareas-progreso");
        const elRevision = document.getElementById("hub-tareas-revision");
        if (elTodo)     elTodo.textContent = todo;
        if (elProgreso) elProgreso.textContent = enProgreso;
        if (elRevision) elRevision.textContent = enRevision;

        tareasProgresoDatos = tareas.filter(t => t.status === "IN_PROGRESS");
        tareasTodoDatos     = tareas.filter(t => t.status === "TODO");
        tareasRevisionDatos = tareas.filter(t => t.status === "EN_REVISION");
        _refreshActivePanel("tareas");

        const body = document.getElementById("hubTareasBody");
        if (!body) return;

        const activas = tareas.filter(t => t.status !== "DONE" && t.status !== "COMPLETO");
        const sorted  = [...activas].sort((a, b) => {
            const order = { "IN_PROGRESS": 0, "EN_REVISION": 1, "TODO": 2 };
            return (order[a.status] ?? 3) - (order[b.status] ?? 3);
        });

        if (sorted.length === 0) {
            body.innerHTML = `<div class="mod-mini-empty"><i class="bi bi-check2-circle"></i> Sin tareas pendientes</div>`;
            return;
        }

        body.innerHTML = sorted.slice(0, 3).map(t => {
            let dotClass = "violeta", badgeClass = "pend", badgeText = "Pendiente";
            if (t.status === "IN_PROGRESS") { dotClass = "azul";    badgeClass = "proc"; badgeText = "En progreso"; }
            if (t.status === "EN_REVISION") { dotClass = "naranja"; badgeClass = "pend"; badgeText = "En revisión"; }
            const titulo = t.title || t.titulo || "—";
            return `<div class="mod-mini-row">
                <span class="mod-mini-dot ${dotClass}"></span>
                <span class="mod-mini-name">${titulo}</span>
                <span class="mod-mini-badge ${badgeClass}">${badgeText}</span>
            </div>`;
        }).join("");
    } catch { /* no bloquea el dashboard */ }
}

async function cargarStockKPI() {
    try {
        const r = await fetchDash(`${API_BASE}/api/stock`);
        if (!r.ok) return;
        const items = await r.json();

        const bajos  = items.filter(i => i.nivel === "BAJO");
        const medios = items.filter(i => i.nivel === "MEDIO");
        const altos  = items.filter(i => i.nivel === "ALTO");

        const elCritico = document.getElementById("hub-stock-critico");
        const elBajo    = document.getElementById("hub-stock-bajo");
        const elOk      = document.getElementById("hub-stock-ok");
        if (elCritico) elCritico.textContent = bajos.length;
        if (elBajo)    elBajo.textContent    = medios.length;
        if (elOk)      elOk.textContent      = altos.length;

        stockBajosDatos  = bajos;
        stockMediosDatos = medios;
        stockAltosDatos  = altos;
        _refreshActivePanel("stock");

        const body = document.getElementById("hubStockBody");
        if (!body) return;

        const alertas = [...bajos, ...medios].slice(0, 3);
        if (alertas.length === 0) {
            body.innerHTML = `<div class="mod-mini-empty"><i class="bi bi-check2-circle"></i> Stock sin alertas</div>`;
            return;
        }

        body.innerHTML = alertas.map(item => {
            const isBajo = item.nivel === "BAJO";
            return `<div class="mod-mini-row">
                <span class="mod-mini-dot ${isBajo ? "rojo" : "naranja"}"></span>
                <span class="mod-mini-name">${item.nombre}</span>
                <span class="mod-mini-badge ${isBajo ? "demo" : "pend"}">${isBajo ? "Crítico" : "Bajo"}</span>
            </div>`;
        }).join("");
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

            if (estadoNorm === "COMPLETO_SIN_INFORME" || estadoNorm === "COMPLETO") {
                acciones.push(
                    `<button class="btn-accion btn-accion-gris btn-archivos" data-id="${m.id}" data-codigo="${m.codigo}" title="Archivos"><i class="bi bi-paperclip"></i></button>`,
                );
            }

            if (estadoNorm === "COMPLETO_SIN_INFORME") {
                acciones.push(
                    `<button class="btn-accion btn-accion-verde btn-pdf" data-id="${m.id}" title="Generar informe PDF"><i class="bi bi-file-earmark-pdf"></i></button>`,
                );
            }

            if (estadoNorm !== "CANCELADO") {
                acciones.push(
                    `<button class="btn-accion btn-accion-rojo btn-eliminar" data-id="${m.id}" data-codigo="${m.codigo}" title="Cancelar muestra"><i class="bi bi-x-circle"></i></button>`,
                );
            }

            const row = `
                    <tr data-estado="${(m.estado || "").toString().toUpperCase()}" data-id="${m.id}">
                        <td><strong>${m.codigo}</strong></td>
                        <td>${m.cliente}</td>
                        <td>${m.tipo}</td>
                        <td>${badgeHTML(m.estado)}</td>
                        <td>${m.fechaAlta || "-"}</td>
                        <td>${m.fecha}</td>
                        <td class="acciones-celda">${acciones.join(" ")}</td>
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
    if (btnEliminar && btnEliminar.closest("#tablaMuestrasBody")) {
        const id = btnEliminar.getAttribute("data-id");
        const codigo = btnEliminar.getAttribute("data-codigo");
        if (id) abrirModalCancelar(id, codigo);
        return;
    }

    const btnVer = e.target.closest(".btn-ver");
    if (btnVer) {
        const id = btnVer.getAttribute("data-id");
        if (id) verResultado(id, btnVer);
        return;
    }

    const btnArchivos = e.target.closest(".btn-archivos");
    if (btnArchivos) {
        const id = btnArchivos.getAttribute("data-id");
        const codigo = btnArchivos.getAttribute("data-codigo");
        if (id) abrirAltaInforme(id, codigo);
        return;
    }

    const btnPdf = e.target.closest(".btn-pdf");
    if (btnPdf) {
        const id = btnPdf.getAttribute("data-id");
        if (id) generarInformeDesdeDash(id);
        return;
    }
});

async function cargarMustreosKPI() {
    try {
        const r = await fetchDash(`${API_BASE}/api/muestreos`);
        if (!r.ok) return;
        const muestreos = await r.json();

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const finSemana = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);

        const pendientes = muestreos.filter(m => m.estado === "PENDIENTE" || m.estado === "CONFIRMADO");

        function getFecha(m) {
            return parseFecha(m.fecha || m.fechaProgramada || m.fechaMuestreo || m.fechaInicio);
        }

        const estaSemana = pendientes.filter(m => {
            const f = getFecha(m);
            return f && f >= hoy && f <= finSemana;
        });
        const deHoy = pendientes.filter(m => {
            const f = getFecha(m);
            return f && f.toDateString() === hoy.toDateString();
        });

        const elSemana = document.getElementById("hub-muestreos-semana");
        const elHoy    = document.getElementById("hub-muestreos-hoy");
        const elTotal  = document.getElementById("hub-muestreos-total");
        if (elSemana) elSemana.textContent = estaSemana.length;
        if (elHoy)    elHoy.textContent    = deHoy.length;
        if (elTotal)  elTotal.textContent  = pendientes.length;

        agendaSemanaDatos = estaSemana;
        agendaHoyDatos    = deHoy;
        agendaTodosDatos  = pendientes;
        _refreshActivePanel("agenda");

        const body = document.getElementById("hubMustreosBody");
        if (!body) return;

        if (pendientes.length === 0) {
            body.innerHTML = `<div class="mod-mini-empty"><i class="bi bi-calendar-check"></i> Sin muestreos próximos</div>`;
            return;
        }

        const sorted = [...pendientes].sort((a, b) => {
            const fa = getFecha(a), fb = getFecha(b);
            if (!fa && !fb) return 0;
            if (!fa) return 1;
            if (!fb) return -1;
            return fa - fb;
        });

        body.innerHTML = sorted.slice(0, 3).map(m => {
            const f = getFecha(m);
            let dotClass = "azul", badgeClass = "hoy", badgeText = "—";
            if (f) {
                const dias = Math.ceil((f - hoy) / 86400000);
                if (dias === 0)       { dotClass = "azul";    badgeClass = "hoy";  badgeText = "Hoy"; }
                else if (dias === 1)  { dotClass = "naranja"; badgeClass = "pend"; badgeText = "Mañana"; }
                else if (dias > 1)   { dotClass = "verde";   badgeClass = "ok";   badgeText = formatearFechaDMY(f); }
                else                  { dotClass = "rojo";    badgeClass = "demo"; badgeText = "Vencido"; }
            }
            const cliente = m.cliente || m.clienteNombre || m.nombreCliente || "—";
            return `<div class="mod-mini-row">
                <span class="mod-mini-dot ${dotClass}"></span>
                <span class="mod-mini-name">${cliente}</span>
                <span class="mod-mini-badge ${badgeClass}">${badgeText}</span>
            </div>`;
        }).join("");
    } catch { /* no bloquea el dashboard */ }
}

// ════════════════════════════════
//  SISTEMA UNIFICADO DE PANELES KPI
// ════════════════════════════════

function _refreshActivePanel(cardKey) {
    const panelEl = document.getElementById(`panel-${cardKey}`);
    if (!panelEl || !panelEl.classList.contains("is-open")) return;
    const activeKpi = document.querySelector(`.mod-kpi-clickable[data-card="${cardKey}"].is-active`);
    if (activeKpi) {
        const contentEl = document.getElementById(`panel-${cardKey}-content`);
        if (contentEl) renderKpiPanel(cardKey, activeKpi.dataset.kpi, contentEl);
    }
}

function renderKpiPanel(cardKey, kpiKey, contentEl) {
    const renderers = {
        "muestras__activas":     renderMuestrasActivas,
        "muestras__demoradas":   renderMuestrasDemoradas,
        "muestras__sin-informe": renderMuestrasSinInforme,
        "agenda__semana":        renderAgendaSemana,
        "agenda__hoy":           renderAgendaHoy,
        "agenda__pendientes":    renderAgendaPendientes,
        "stock__critico":        renderStockCritico,
        "stock__bajo":           renderStockBajo,
        "stock__ok":             renderStockOk,
        "tareas__progreso":      renderTareasProgreso,
        "tareas__todo":          renderTareasTodo,
        "tareas__revision":      renderTareasRevision,
    };
    const fn = renderers[`${cardKey}__${kpiKey}`];
    if (fn) fn(contentEl);
}

// ── Muestras ──
function renderMuestrasActivas(el) {
    const ACTIVOS = new Set(["PENDIENTE", "EN_PROCESO", "DEMORADA", "COMPLETO_SIN_INFORME"]);
    const lista = allEstudios.filter(m => ACTIVOS.has(normalizarEstado(m.estado)));
    const dotCls = { PENDIENTE:"naranja", EN_PROCESO:"azul", DEMORADA:"rojo", COMPLETO_SIN_INFORME:"gris" };
    const bCls   = { PENDIENTE:"pend",    EN_PROCESO:"proc", DEMORADA:"demo", COMPLETO_SIN_INFORME:"sin"  };
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-droplet-fill"></i>${lista.length} activa${lista.length!==1?"s":""}</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-check2-circle me-1"></i>Sin muestras activas</div>`
            : lista.map(m => {
                const e = normalizarEstado(m.estado);
                return `<div class="mod-panel-item">
                    <span class="mod-mini-dot ${dotCls[e]||"gris"}"></span>
                    <span class="mod-mini-name">${m.cliente}</span>
                    <span class="mod-panel-sub">${m.codigo}</span>
                    <span class="mod-mini-badge ${bCls[e]||"pend"}" style="margin-left:auto">${labelEstado(e)}</span>
                </div>`;
            }).join(""));
}

function renderMuestrasDemoradas(el) {
    const lista = allEstudios.filter(m => normalizarEstado(m.estado) === "DEMORADA");
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-exclamation-circle-fill"></i>${lista.length} demorada${lista.length!==1?"s":""}</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-check2-circle me-1"></i>Sin muestras demoradas</div>`
            : lista.map(m => {
                const fE = parseFecha(m.fecha);
                let badge;
                if (fE) {
                    const dias = Math.ceil((hoy - fE) / 86400000);
                    badge = dias > 0 ? `${dias}d tarde` : "Hoy";
                } else {
                    const fA = parseFecha(m.fechaAlta);
                    badge = fA ? `${Math.ceil((hoy - fA) / 86400000)}d` : "—";
                }
                return `<div class="mod-panel-item">
                    <span class="mod-mini-dot rojo"></span>
                    <span class="mod-mini-name">${m.cliente}</span>
                    <span class="mod-panel-sub">${m.codigo}</span>
                    <span class="mod-mini-badge demo" style="margin-left:auto">${badge}</span>
                </div>`;
            }).join(""));
}

function renderMuestrasSinInforme(el) {
    const lista = allEstudios.filter(m => normalizarEstado(m.estado) === "COMPLETO_SIN_INFORME");
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-file-earmark-x"></i>${lista.length} sin informe</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-check2-circle me-1"></i>Sin muestras pendientes de informe</div>`
            : lista.map(m => `<div class="mod-panel-item">
                <span class="mod-mini-dot gris"></span>
                <span class="mod-mini-name">${m.cliente}</span>
                <span class="mod-panel-sub">${m.codigo}</span>
                <span class="mod-mini-badge sin" style="margin-left:auto">Sin informe</span>
            </div>`).join(""));
}

// ── Agenda ──
function _agendaItemHTML(m, hoy) {
    const TIPO_LBL = { MUESTREO:"Muestreo", COMPRA_INSUMOS:"Compra insumos", VENCIMIENTO:"Vencimiento", OTRO:"Otro" };
    const TIPO_DOT = { MUESTREO:"azul", COMPRA_INSUMOS:"naranja", VENCIMIENTO:"rojo", OTRO:"gris" };
    const tipo  = ((m.tipo || m.tipoEvento || "")).toUpperCase();
    const f     = parseFecha(m.fecha || m.fechaProgramada || m.fechaMuestreo || m.fechaInicio);
    const cli   = m.cliente || m.clienteNombre || m.nombreCliente || "";
    const nombre = cli || TIPO_LBL[tipo] || "Evento";
    const dias  = f ? Math.ceil((f - hoy) / 86400000) : null;
    const badge = dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : f ? formatearFechaDMY(f) : "—";
    const bCls  = dias === 0 ? "hoy" : (dias !== null && dias < 0) ? "demo" : "pend";
    return `<div class="mod-panel-item">
        <span class="mod-mini-dot ${TIPO_DOT[tipo]||"azul"}"></span>
        <span class="mod-mini-name">${nombre}</span>
        <span class="mod-panel-sub">${TIPO_LBL[tipo]||""}</span>
        <span class="mod-mini-badge ${bCls}" style="margin-left:auto">${badge}</span>
    </div>`;
}

function renderAgendaSemana(el) {
    const lista = agendaSemanaDatos;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-calendar-week-fill"></i>${lista.length} evento${lista.length!==1?"s":""} esta semana</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-calendar-check me-1"></i>Sin eventos esta semana</div>`
            : lista.map(m => _agendaItemHTML(m, hoy)).join(""));
}

function renderAgendaHoy(el) {
    const lista = agendaHoyDatos;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-calendar-day-fill"></i>${lista.length} evento${lista.length!==1?"s":""} hoy</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-calendar-check me-1"></i>Sin eventos hoy</div>`
            : lista.map(m => _agendaItemHTML(m, hoy)).join(""));
}

function renderAgendaPendientes(el) {
    const lista = agendaTodosDatos;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-calendar-fill"></i>${lista.length} pendiente${lista.length!==1?"s":""}</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-calendar-check me-1"></i>Sin eventos pendientes</div>`
            : lista.map(m => _agendaItemHTML(m, hoy)).join(""));
}

// ── Stock ──
function _stockItemHTML(i, dotCls, bCls, bText) {
    const cat = (i.categoria || "").replace(/_/g, " ").toLowerCase();
    return `<div class="mod-panel-item">
        <span class="mod-mini-dot ${dotCls}"></span>
        <span class="mod-mini-name">${i.nombre || "—"}</span>
        <span class="mod-panel-sub">${cat}</span>
        <span class="mod-mini-badge ${bCls}" style="margin-left:auto">${bText}</span>
    </div>`;
}

function renderStockCritico(el) {
    const lista = stockBajosDatos;
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-exclamation-triangle-fill"></i>${lista.length} ítem${lista.length!==1?"s":""} crítico${lista.length!==1?"s":""}</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-check2-circle me-1"></i>Sin ítems críticos</div>`
            : lista.map(i => _stockItemHTML(i, "rojo", "demo", "Crítico")).join(""));
}

function renderStockBajo(el) {
    const lista = stockMediosDatos;
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-box-seam"></i>${lista.length} ítem${lista.length!==1?"s":""} en nivel bajo</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-check2-circle me-1"></i>Sin ítems en nivel bajo</div>`
            : lista.map(i => _stockItemHTML(i, "naranja", "pend", "Bajo")).join(""));
}

function renderStockOk(el) {
    const lista = stockAltosDatos;
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-check-circle-fill"></i>${lista.length} ítem${lista.length!==1?"s":""} OK</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-check2-circle me-1"></i>Sin ítems en nivel OK</div>`
            : lista.map(i => _stockItemHTML(i, "verde", "ok", "OK")).join(""));
}

// ── Tareas ──
function _tareaItemHTML(t, dotCls, bCls, bText) {
    const asig = t.assignedTo || t.nombreAsignado || t.userName || "";
    return `<div class="mod-panel-item">
        <span class="mod-mini-dot ${dotCls}"></span>
        <span class="mod-mini-name">${t.title || t.titulo || "—"}</span>
        ${asig ? `<span class="mod-panel-sub">${asig}</span>` : ""}
        <span class="mod-mini-badge ${bCls}" style="margin-left:auto">${bText}</span>
    </div>`;
}

function renderTareasProgreso(el) {
    const lista = tareasProgresoDatos;
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-play-circle-fill"></i>${lista.length} en progreso</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-check2-circle me-1"></i>Sin tareas en progreso</div>`
            : lista.map(t => _tareaItemHTML(t, "azul", "proc", "En progreso")).join(""));
}

function renderTareasTodo(el) {
    const lista = tareasTodoDatos;
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-list-check"></i>${lista.length} pendiente${lista.length!==1?"s":""}</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-check2-circle me-1"></i>Sin tareas pendientes</div>`
            : lista.map(t => _tareaItemHTML(t, "naranja", "pend", "Pendiente")).join(""));
}

function renderTareasRevision(el) {
    const lista = tareasRevisionDatos;
    el.innerHTML =
        `<div class="mod-panel-header"><i class="bi bi-eye-fill"></i>${lista.length} en revisión</div>` +
        (lista.length === 0
            ? `<div class="mod-mini-empty"><i class="bi bi-check2-circle me-1"></i>Sin tareas en revisión</div>`
            : lista.map(t => _tareaItemHTML(t, "violeta", "pend", "En revisión")).join(""));
}

// ── Panel de KPI: se abre al hacer hover sobre el número ──
document.querySelectorAll(".mod-kpi-clickable").forEach(kpiEl => {
    kpiEl.addEventListener("mouseenter", function () {
        const cardKey   = this.dataset.card;
        const kpiKey    = this.dataset.kpi;
        const panelEl   = document.getElementById(`panel-${cardKey}`);
        const contentEl = document.getElementById(`panel-${cardKey}-content`);
        if (!panelEl || !contentEl) return;

        document.querySelectorAll(`.mod-kpi-clickable[data-card="${cardKey}"]`)
            .forEach(k => k.classList.remove("is-active"));
        this.classList.add("is-active");
        renderKpiPanel(cardKey, kpiKey, contentEl);
        panelEl.classList.add("is-open");
    });
});

// Cierra el panel cuando el mouse sale de la tarjeta completa
document.querySelectorAll(".mod-card").forEach(cardEl => {
    cardEl.addEventListener("mouseleave", function () {
        const kpis = this.querySelectorAll(".mod-kpi-clickable");
        if (kpis.length === 0) return;
        const cardKey = kpis[0].dataset.card;
        const panelEl = document.getElementById(`panel-${cardKey}`);
        if (panelEl) panelEl.classList.remove("is-open");
        kpis.forEach(k => k.classList.remove("is-active"));
    });
});

// ════════════════════════════════
//  MI COLA DE ANÁLISIS
// ════════════════════════════════
(function initColaDash() {
    if (rol !== 'ROLE_EMPLEADO') return;

    const panel  = document.getElementById('colaDashPanel');
    const body   = document.getElementById('colaDashBody');
    const grid   = document.getElementById('colaDashGrid');
    const empty  = document.getElementById('colaDashEmpty');
    const badge  = document.getElementById('colaDashBadge');
    const toggle = document.getElementById('colaDashToggle');
    const refresh = document.getElementById('colaDashRefresh');

    if (!panel) return;
    panel.style.display = '';

    let collapsed = false;

    toggle.addEventListener('click', () => {
        collapsed = !collapsed;
        body.classList.toggle('collapsed', collapsed);
        toggle.classList.toggle('collapsed', collapsed);
        document.getElementById('colaDashToggleLabel').textContent = collapsed ? 'Mostrar' : 'Ocultar';
    });

    refresh.addEventListener('click', () => cargarMiCola());

    window.cargarMiCola = async function cargarMiCola() {
        mostrarSkelCola();
        try {
            const r = await fetchDash(`${API_BASE}/api/mi-cola`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const grupos = await r.json();
            renderColaDash(grupos);
        } catch (err) {
            console.error('Error cargando mi cola:', err);
            grid.innerHTML = '';
            empty.style.display = 'flex';
            empty.innerHTML = '<i class="bi bi-exclamation-circle"></i> Error al cargar la cola de análisis';
        }
    };

    function mostrarSkelCola() {
        grid.innerHTML = '';
        empty.style.display = 'none';
        const wrap = document.createElement('div');
        wrap.className = 'cola-skel-wrap';
        for (let i = 0; i < 4; i++) {
            const item = document.createElement('div');
            item.className = 'cola-skel-item';
            item.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div class="sh" style="height:13px;border-radius:4px;width:70px"></div>
                    <div class="sh" style="height:22px;width:22px;border-radius:50%"></div>
                </div>
                <div class="sh" style="height:34px;border-radius:7px;width:100%"></div>
                <div class="sh" style="height:34px;border-radius:7px;width:100%"></div>`;
            wrap.appendChild(item);
        }
        grid.appendChild(wrap);
    }

    function renderColaDash(grupos) {
        grid.innerHTML = '';
        const total = grupos.reduce((s, g) => s + g.totalPendientes, 0);
        badge.textContent = `${total} pendiente${total !== 1 ? 's' : ''}`;

        if (!grupos.length) {
            empty.style.display = 'flex';
            empty.innerHTML = '<i class="bi bi-check2-circle"></i> Sin análisis pendientes en tu cola';
            return;
        }
        empty.style.display = 'none';

        const ESTADO_CFG = {
            PENDIENTE:   { lbl: 'Pendiente',   cls: 'ce-pendiente' },
            EN_PROCESO:  { lbl: 'En proceso',  cls: 'ce-proceso'   },
            DEMORADA:    { lbl: 'Demorada',     cls: 'ce-demorada'  },
            EN_REVISION: { lbl: 'En revisión',  cls: 'ce-revision'  },
        };

        grupos.forEach(grupo => {
            const card = document.createElement('div');
            card.className = 'cola-param-card';

            const unidadHtml = grupo.unidad
                ? `<div class="cola-param-unit">${esc(grupo.unidad)}</div>` : '';

            const MAX_VISIBLE = 3;
            const visibles = grupo.muestras.slice(0, MAX_VISIBLE);
            const resto    = grupo.muestras.length - MAX_VISIBLE;

            const filas = visibles.map(m => {
                const cfg = ESTADO_CFG[m.estado] || { lbl: m.estado, cls: '' };
                return `<div class="cola-sample-row">
                    <div>
                        <div class="cola-sample-proto">#${esc(m.nroProtocolo)}</div>
                        <div class="cola-sample-client">${esc(m.clienteNombre || '')}</div>
                    </div>
                    <span class="cola-muestra-chip ${cfg.cls}">${cfg.lbl}</span>
                </div>`;
            }).join('');

            const masHtml = resto > 0
                ? `<div class="cola-dash-mas">+${resto} más</div>` : '';

            card.innerHTML = `
                <div class="cola-param-head">
                    <div>
                        <div class="cola-param-name">${esc(grupo.parametroNombre)}</div>
                        ${unidadHtml}
                    </div>
                    <div class="cola-count-circle">${grupo.totalPendientes}</div>
                </div>
                <div class="cola-sample-list">${filas}</div>
                ${masHtml}`;

            grid.appendChild(card);
        });
    }

    function esc(str) {
        return String(str || '').replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    cargarMiCola();
})();

// Cargar al iniciar
cargarEstudios();
cargarTareasKPI();
cargarStockKPI();
cargarMustreosKPI();

