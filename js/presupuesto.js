"use strict";

// ── Header ──
const rol    = (localStorage.getItem("userRole") || "").toUpperCase();
const nombre = localStorage.getItem("userName") || localStorage.getItem("userEmail") || "Usuario";
const iniciales = nombre.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase();
document.getElementById("header-nombre").textContent = nombre;
document.getElementById("header-rol").textContent    = rol === "ROLE_IT" ? "IT" : "Empleado";
document.getElementById("header-avatar").textContent = iniciales;

const hoy = new Date().toLocaleDateString("es-AR", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
document.getElementById("fecha-hoy").textContent = hoy.charAt(0).toUpperCase() + hoy.slice(1);

// ── Fetch autenticado ──
async function apiFetch(url, opts = {}) {
    const token = localStorage.getItem("token");
    const res = await fetch(url, {
        ...opts,
        headers: { ...(opts.headers || {}), "Authorization": `Bearer ${token}` },
    });
    if (res.status === 401) { window.location.href = "login.html"; }
    return res;
}

// ── Toast ──
function toast(msg, type = "success") {
    const el  = document.getElementById("toastPres");
    const ico = el.querySelector("i");
    document.getElementById("toastPresMsg").textContent = msg;
    ico.className = type === "error"
        ? "bi bi-x-circle-fill danger"
        : "bi bi-check-circle-fill success";
    el.classList.add("visible");
    setTimeout(() => el.classList.remove("visible"), 3500);
}

// ── Helpers ──
function formatPrecio(val) {
    if (!val && val !== 0) return "$0";
    return "$" + Number(val).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function parsePrecio(str) {
    // Strip $ y cualquier char no numérico excepto coma (separador decimal ARS)
    const clean = String(str).replace(/[^\d,]/g, "").replace(",", ".");
    return parseFloat(clean) || 0;
}

function formatFecha(isoStr) {
    if (!isoStr) return "-";
    const [y, m, d] = isoStr.split("-");
    return `${d}/${m}/${y}`;
}

function esc(str) {
    return String(str || "").replace(/[&<>"']/g, c =>
        ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":`&#39;` }[c]));
}

function truncar(s, n) {
    return s && s.length > n ? s.substring(0, n) + "…" : s;
}

// ================================================================
// MODAL: NUEVO PRESUPUESTO (2 pasos)
// ================================================================

let npItemCount  = 0;
let npStepActual = 1;

// ── Clientes ──
let clientesLista   = [];
let clientesCargados = false;

async function cargarClientes() {
    if (clientesCargados) return;
    try {
        const res = await apiFetch(`${API_BASE}/api/clientes`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        clientesLista = data.map(c => ({
            label: c.tipoCliente === "PERSONA_FISICA"
                ? `${c.nombre || ""} ${c.apellido || ""}`.trim()
                : (c.razonSocial || c.nombre || c.email || ""),
        })).filter(c => c.label);
        clientesCargados = true;
    } catch { /* silencioso — el usuario igual puede escribir libre */ }
}

// ── Combobox cliente ──
const npClienteInput = document.getElementById("npInputCliente");
const npClienteDrop  = document.getElementById("npClienteDrop");

function mostrarClienteDrop(lista) {
    if (!lista.length) { npClienteDrop.style.display = "none"; return; }
    npClienteDrop.innerHTML = lista.map(c =>
        `<div class="np-cliente-item">${esc(c.label)}</div>`
    ).join("");
    npClienteDrop.style.display = "block";
    npClienteDrop.querySelectorAll(".np-cliente-item").forEach((el, i) => {
        el.addEventListener("mousedown", e => {
            e.preventDefault();
            npClienteInput.value = lista[i].label;
            npClienteDrop.style.display = "none";
        });
    });
}

npClienteInput.addEventListener("input", () => {
    const q = npClienteInput.value.trim().toLowerCase();
    if (!q) { npClienteDrop.style.display = "none"; return; }
    mostrarClienteDrop(clientesLista.filter(c => c.label.toLowerCase().includes(q)).slice(0, 8));
});

npClienteInput.addEventListener("focus", () => {
    const q = npClienteInput.value.trim().toLowerCase();
    if (!q) mostrarClienteDrop(clientesLista.slice(0, 8));
});

npClienteInput.addEventListener("blur", () => {
    setTimeout(() => { npClienteDrop.style.display = "none"; }, 150);
});

// ── Abrir / Cerrar modal ──
function abrirModalNuevo() {
    resetModalNuevo();
    cargarClientes();
    document.getElementById("modalNuevoPres").classList.add("visible");
    cargarPreviewNumero();
}

async function cargarPreviewNumero() {
    const input = document.getElementById("npInputNumero");
    input.placeholder = "cargando...";
    try {
        const res  = await apiFetch("/api/numeradores/preview/NUMERO_PRESUPUESTO");
        const data = await res.json();
        input.placeholder = String(data.siguiente).padStart(7, "0");
    } catch {
        input.placeholder = "auto";
    }
}

function cerrarModalNuevo() {
    document.getElementById("modalNuevoPres").classList.remove("visible");
}

function resetModalNuevo() {
    // Datos
    document.getElementById("npInputNumero").value    = "";
    document.getElementById("npInputFecha").value     = new Date().toISOString().slice(0, 10);
    document.getElementById("npInputCliente").value   = "";
    document.getElementById("npInputSolicitado").value = "";
    // Ítems
    document.getElementById("npItemsBody").innerHTML = "";
    document.getElementById("npPresEmpty").style.display = "flex";
    document.getElementById("npTotalGeneral").textContent = "$0";
    npItemCount = 0;
    // Volver al paso 1
    irAStep(1);
}

// ── Navegación entre pasos ──
function irAStep(paso) {
    npStepActual = paso;

    const step1Body = document.getElementById("npStep1Body");
    const step2Body = document.getElementById("npStep2Body");
    const btnCancelar  = document.getElementById("npBtnCancelar");
    const btnVolver    = document.getElementById("npBtnVolver");
    const btnSiguiente = document.getElementById("npBtnSiguiente");
    const btnGenerar   = document.getElementById("npBtnGenerar");
    const ind1 = document.getElementById("npStep1Ind");
    const ind2 = document.getElementById("npStep2Ind");

    if (paso === 1) {
        step1Body.style.display = "";
        step2Body.style.display = "none";
        btnCancelar.style.display  = "";
        btnVolver.style.display    = "none";
        btnSiguiente.style.display = "";
        btnGenerar.style.display   = "none";
        ind1.className = "np-step-item np-step-active";
        ind2.className = "np-step-item";
    } else {
        step1Body.style.display = "none";
        step2Body.style.display = "";
        btnCancelar.style.display  = "none";
        btnVolver.style.display    = "";
        btnSiguiente.style.display = "none";
        btnGenerar.style.display   = "";
        ind1.className = "np-step-item np-step-done";
        ind2.className = "np-step-item np-step-active";
        // Agregar ítem inicial si la tabla está vacía
        if (!document.getElementById("npItemsBody").querySelector("tr")) {
            npAgregarItem();
        }
    }
}

function validarStep1() {
    const cliente = document.getElementById("npInputCliente").value;
    const fecha   = document.getElementById("npInputFecha").value;
    if (!cliente.trim()) { toast("Ingresá el nombre del cliente.", "error"); return false; }
    if (!fecha)   { toast("Ingresá una fecha.", "error"); return false; }
    return true;
}

document.getElementById("btnNuevoPres").addEventListener("click", abrirModalNuevo);
document.getElementById("btnCerrarNuevoPres").addEventListener("click", cerrarModalNuevo);
document.getElementById("modalNuevoPres").addEventListener("click", e => {
    if (e.target === document.getElementById("modalNuevoPres")) cerrarModalNuevo();
});
document.getElementById("npBtnCancelar").addEventListener("click", cerrarModalNuevo);
document.getElementById("npBtnVolver").addEventListener("click",   () => irAStep(1));
document.getElementById("npBtnSiguiente").addEventListener("click", () => {
    if (validarStep1()) irAStep(2);
});

// ── Ítems ──
function npAgregarItem(data = {}) {
    const id = ++npItemCount;
    document.getElementById("npPresEmpty").style.display = "none";

    const tr = document.createElement("tr");
    tr.dataset.id = id;
    tr.innerHTML = `
        <td><input class="pres-cell-input" data-field="matriz"
                   value="${esc(data.matriz || "")}" placeholder="Ej: Efluente"/></td>
        <td><textarea class="pres-cell-textarea" data-field="determinacion"
                      rows="2" placeholder="Lista de parámetros...">${esc(data.determinacion || "")}</textarea></td>
        <td><input class="pres-cell-input pres-cell-money" data-field="precioUnitario"
                   type="text" value="${data.precioUnitario || ""}" placeholder="0"/></td>
        <td><input class="pres-cell-input pres-cell-cant" data-field="cantidadMuestras"
                   type="number" min="1" value="${data.cantidadMuestras || 1}"/></td>
        <td><input class="pres-cell-input pres-cell-money pres-cell-total" data-field="total"
                   type="text" value="${data.total || ""}" placeholder="0" readonly/></td>
        <td><button class="btn-del-item" data-id="${id}" title="Eliminar ítem">
                <i class="bi bi-trash"></i>
            </button></td>`;

    const precioInput = tr.querySelector('[data-field="precioUnitario"]');
    const cantInput   = tr.querySelector('[data-field="cantidadMuestras"]');
    const totalInput  = tr.querySelector('[data-field="total"]');

    function recalcular() {
        const precio   = parsePrecio(precioInput.value);
        const cantidad = parseInt(cantInput.value) || 0;
        totalInput.value = (precio && cantidad) ? formatPrecio(precio * cantidad) : "";
        npActualizarTotal();
    }

    precioInput.addEventListener("input", recalcular);
    cantInput.addEventListener("input",   recalcular);
    if (data.precioUnitario && data.cantidadMuestras) recalcular();

    document.getElementById("npItemsBody").appendChild(tr);
    npActualizarTotal();
}

function npActualizarTotal() {
    let total = 0;
    document.querySelectorAll("#npItemsBody [data-field='total']").forEach(inp => {
        total += parsePrecio(inp.value);
    });
    document.getElementById("npTotalGeneral").textContent = formatPrecio(total);
}

document.getElementById("npItemsBody").addEventListener("click", e => {
    const btn = e.target.closest(".btn-del-item");
    if (!btn) return;
    btn.closest("tr").remove();
    npActualizarTotal();
    if (!document.getElementById("npItemsBody").querySelector("tr")) {
        document.getElementById("npPresEmpty").style.display = "flex";
    }
});

document.getElementById("npBtnAgregarItem").addEventListener("click", () => npAgregarItem());

// ── Generar y guardar ──
document.getElementById("npBtnGenerar").addEventListener("click", async () => {
    const filas = document.querySelectorAll("#npItemsBody tr");
    if (filas.length === 0) { toast("Agregá al menos un ítem.", "error"); return; }

    const cliente = { razonSocial: document.getElementById("npInputCliente").value.trim() };

    const items = Array.from(filas).map(tr => ({
        matriz:           tr.querySelector('[data-field="matriz"]').value.trim()        || null,
        determinacion:    tr.querySelector('[data-field="determinacion"]').value.trim() || null,
        precioUnitario:   parsePrecio(tr.querySelector('[data-field="precioUnitario"]').value) || 0,
        cantidadMuestras: parseInt(tr.querySelector('[data-field="cantidadMuestras"]').value)  || 1,
        total:            parsePrecio(tr.querySelector('[data-field="total"]').value)   || 0,
    }));

    const payload = {
        numeroPresupuesto: parseInt(document.getElementById("npInputNumero").value) || null,
        cliente,
        solicitadoPor: document.getElementById("npInputSolicitado").value.trim() || null,
        fecha:         document.getElementById("npInputFecha").value || null,
        items,
    };

    const btn = document.getElementById("npBtnGenerar");
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generando...';

    try {
        const res = await apiFetch(`${API_BASE}/api/presupuesto/generar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const { id, numero } = await res.json();

        cerrarModalNuevo();
        toast("Presupuesto guardado. Descargando PDF...");
        cargarHistorial();

        await descargarPdf(id, numero);
    } catch (err) {
        console.error(err);
        toast("Error al generar el presupuesto.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Guardar y generar PDF';
    }
});

// ================================================================
// HISTORIAL
// ================================================================

let historialData = [];
let filtroEstado  = "";
let POR_PAGINA    = 5;
let paginaActual  = 1;

const infoPag    = document.getElementById("infoPaginacion");
const pagControls = document.getElementById("paginacion");

// ── Alerta: pendientes demorados ──

const DIAS_ALERTA = 15;
let alertaColapsada = false;

function diasDesde(isoStr) {
    if (!isoStr) return 0;
    const [y, m, d] = isoStr.split("-").map(Number);
    const fecha = new Date(y, m - 1, d);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.floor((hoy - fecha) / 86400000);
}

function renderAlertaPendientes() {
    const panel     = document.getElementById("alertaPendientes");
    const titulo    = document.getElementById("alertaTitulo");
    const body      = document.getElementById("alertaBody");
    const toggle    = document.getElementById("alertaToggle");

    const demorados = historialData.filter(
        p => p.estado === "PENDIENTE" && diasDesde(p.fecha) >= DIAS_ALERTA
    ).sort((a, b) => diasDesde(b.fecha) - diasDesde(a.fecha)); // más viejos primero

    if (demorados.length === 0) { panel.style.display = "none"; return; }

    panel.style.display = "block";
    titulo.textContent = demorados.length === 1
        ? "1 presupuesto pendiente hace más de 15 días"
        : `${demorados.length} presupuestos pendientes hace más de 15 días`;

    body.style.display = alertaColapsada ? "none" : "";
    toggle.querySelector("i").className = alertaColapsada ? "bi bi-chevron-down" : "bi bi-chevron-up";

    body.innerHTML = demorados.map(p => {
        const dias = diasDesde(p.fecha);
        const nro  = `N°${String(p.numero).padStart(7, "0")}`;
        return `
        <div class="pres-alerta-row">
            <span class="pres-alerta-nro">${nro}</span>
            <span class="pres-alerta-cliente">${esc(p.clienteNombre || "-")}</span>
            <span class="pres-alerta-dias">hace ${dias} días</span>
            <div class="pres-alerta-acciones">
                <button class="btn-accion btn-pdf" title="Descargar PDF"
                    onclick="descargarPdf(${p.id}, ${p.numero})">
                    <i class="bi bi-file-earmark-pdf"></i>
                </button>
                <button class="btn-accion btn-accion-verde hist-action-estado"
                    title="Cambiar estado" data-id="${p.id}" onclick="toggleEstadoDrop(this)">
                    <i class="bi bi-arrow-left-right"></i>
                </button>
            </div>
        </div>`;
    }).join("");
}

document.getElementById("alertaToggle").addEventListener("click", () => {
    alertaColapsada = !alertaColapsada;
    renderAlertaPendientes();
});

async function cargarHistorial() {
    try {
        const res = await apiFetch(`${API_BASE}/api/presupuesto`);
        if (!res.ok) throw new Error();
        historialData = await res.json();
        renderHistorial();
    } catch {
        document.getElementById("histBody").innerHTML =
            `<tr><td colspan="7" class="hist-loading" style="color:var(--rojo)">Error al cargar el historial.</td></tr>`;
    }
}

function renderHistorial() {
    const data = filtroEstado
        ? historialData.filter(p => p.estado === filtroEstado)
        : historialData;

    const tbody  = document.getElementById("histBody");
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const pagina = data.slice(inicio, inicio + POR_PAGINA);

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="hist-loading">Sin presupuestos${filtroEstado ? " en este estado" : ""}.</td></tr>`;
        if (infoPag) infoPag.textContent = "Sin resultados";
        if (pagControls) pagControls.innerHTML = "";
        return;
    }

    tbody.innerHTML = pagina.map(p => `
        <tr class="${p.estado === "PENDIENTE" ? "hist-row-pendiente" : ""}">
            <td><strong>N°${String(p.numero).padStart(7, "0")}</strong></td>
            <td>${formatFecha(p.fecha)}</td>
            <td>${esc(p.clienteNombre || "-")}</td>
            <td>${esc(p.solicitadoPor || "-")}</td>
            <td style="font-weight:600; font-variant-numeric:tabular-nums;">${formatPrecio(p.totalGeneral)}</td>
            <td>
                <span class="hist-badge hist-badge-${p.estado.toLowerCase()}">${labelEstado(p.estado)}</span>
            </td>
            <td>
                <div class="acciones-celda">
                    <button class="btn-accion btn-pdf" title="Descargar PDF" onclick="descargarPdf(${p.id}, ${p.numero})">
                        <i class="bi bi-file-earmark-pdf"></i>
                    </button>
                    <button class="btn-accion btn-accion-verde hist-action-estado" title="Cambiar estado"
                        data-id="${p.id}" onclick="toggleEstadoDrop(this)">
                        <i class="bi bi-arrow-left-right"></i>
                    </button>
                    <button class="btn-accion btn-accion-rojo" title="Eliminar"
                        onclick="confirmarEliminar(${p.id}, ${p.numero})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    const fin = Math.min(inicio + POR_PAGINA, data.length);
    if (infoPag) infoPag.textContent = `Mostrando ${inicio + 1}–${fin} de ${data.length} presupuestos`;
    renderPaginacionPres(data.length);
    renderAlertaPendientes();
}

function renderPaginacionPres(totalItems) {
    if (!pagControls) return;
    const total = Math.ceil(totalItems / POR_PAGINA);
    pagControls.innerHTML = '';
    if (total <= 1) return;

    const mkBtn = (label, onClick, disabled, active) => {
        const b = document.createElement('button');
        b.className = 'pag-btn' + (disabled ? ' pag-btn-disabled' : '') + (active ? ' pag-btn-active' : '');
        b.innerHTML = label;
        b.disabled  = disabled;
        if (!disabled && !active) b.addEventListener('click', onClick);
        return b;
    };

    pagControls.appendChild(mkBtn('<i class="bi bi-chevron-left"></i>', () => { paginaActual--; renderHistorial(); }, paginaActual === 1, false));
    for (let p = 1; p <= total; p++) {
        pagControls.appendChild(mkBtn(p, () => { paginaActual = p; renderHistorial(); }, false, p === paginaActual));
    }
    pagControls.appendChild(mkBtn('<i class="bi bi-chevron-right"></i>', () => { paginaActual++; renderHistorial(); }, paginaActual === total, false));
}

function labelEstado(e) {
    return e === "PENDIENTE" ? "Pendiente" : e === "ACEPTADO" ? "Aceptado" : "Rechazado";
}

document.querySelectorAll(".hist-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".hist-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        filtroEstado = btn.dataset.estado;
        paginaActual = 1;
        renderHistorial();
    });
});

document.getElementById("selectPageSize")?.addEventListener("change", e => {
    POR_PAGINA   = parseInt(e.target.value);
    paginaActual = 1;
    renderHistorial();
});

document.getElementById("btnRefreshHistorial").addEventListener("click", cargarHistorial);

// ── Descargar PDF desde historial ──
async function descargarPdf(id, numero) {
    try {
        const res = await apiFetch(`${API_BASE}/api/presupuesto/${id}/pdf`);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = `Presupuesto-${String(numero).padStart(7, "0")}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
        toast("Error al descargar el PDF.", "error");
    }
}

// ── Eliminar ──
async function confirmarEliminar(id, numero) {
    const nroStr = `N°${String(numero).padStart(7, "0")}`;
    if (!confirm(`¿Eliminás el presupuesto ${nroStr}? Esta acción no se puede deshacer.`)) return;
    try {
        const res = await apiFetch(`${API_BASE}/api/presupuesto/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        toast(`Presupuesto ${nroStr} eliminado.`);
        cargarHistorial();
    } catch {
        toast("Error al eliminar el presupuesto.", "error");
    }
}

// ================================================================
// DROPDOWN INLINE: CAMBIAR ESTADO
// ================================================================

let dropPresupuestoId = null;

function toggleEstadoDrop(btn) {
    const drop = document.getElementById("estadoDrop");
    const mismoId = dropPresupuestoId === Number(btn.dataset.id);

    cerrarEstadoDrop();
    if (mismoId) return;

    dropPresupuestoId = Number(btn.dataset.id);
    const rect = btn.getBoundingClientRect();
    drop.style.top  = (rect.bottom + window.scrollY + 6) + "px";
    drop.style.left = rect.left + "px";
    drop.style.display = "flex";

    // Corregir si se sale por la derecha
    requestAnimationFrame(() => {
        const dRect = drop.getBoundingClientRect();
        if (dRect.right > window.innerWidth - 8) {
            drop.style.left = (rect.right - dRect.width) + "px";
        }
    });
}

function cerrarEstadoDrop() {
    document.getElementById("estadoDrop").style.display = "none";
    dropPresupuestoId = null;
}

document.addEventListener("click", e => {
    if (!e.target.closest("#estadoDrop") && !e.target.closest(".hist-action-estado")) {
        cerrarEstadoDrop();
    }
});

document.getElementById("estadoDrop").addEventListener("click", async e => {
    const opt = e.target.closest(".estado-drop-opt");
    if (!opt || !dropPresupuestoId) return;

    const nuevoEstado = opt.dataset.estado;
    const id = dropPresupuestoId;
    cerrarEstadoDrop();

    try {
        const res = await apiFetch(`${API_BASE}/api/presupuesto/${id}/estado`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: nuevoEstado, fechaRespuesta: null, observaciones: null }),
        });
        if (!res.ok) throw new Error();
        toast(`Estado actualizado a "${labelEstado(nuevoEstado)}".`);
        cargarHistorial();
    } catch {
        toast("Error al actualizar el estado.", "error");
    }
});

// ── Init ──
cargarHistorial();
