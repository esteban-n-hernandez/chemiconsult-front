const API_URL = `${API_BASE}/api/stock`;

const rol = (localStorage.getItem('userRole') || '').toUpperCase();
if (!localStorage.getItem('token') || rol === 'ROLE_CLIENTE') {
    window.location.href = 'login.html';
}

// ── Estado ──────────────────────────────────────────────────────────────────
let items = [];
let itemsFiltrados = [];
let itemEditandoId = null;
let itemEliminandoId = null;
let POR_PAGINA = 5;
let paginaActual = 1;

// ── DOM ──────────────────────────────────────────────────────────────────────
const tbody          = document.getElementById('tablaStockBody');
const sinResultados  = document.getElementById('sinResultados');
const infoPag        = document.getElementById('infoPaginacion');
const paginacionEl   = document.getElementById('paginacion');
const inputBusqueda  = document.getElementById('inputBusqueda');
const selectCategoria= document.getElementById('selectCategoria');
const selectNivel    = document.getElementById('selectNivel');

// Modal alta/edición
const modalStock     = document.getElementById('modalStock');
const modalTitulo    = document.getElementById('modalTitulo');
const formStock      = document.getElementById('formStock');
const inputNombre           = document.getElementById('inputNombre');
const inputCategoria        = document.getElementById('inputCategoria');
const inputDescripcion      = document.getElementById('inputDescripcion');
const inputIdentificacion   = document.getElementById('inputIdentificacion');
const inputCantidad         = document.getElementById('inputCantidad');
const inputUbicacion        = document.getElementById('inputUbicacion');
const inputObservaciones    = document.getElementById('inputObservaciones');
const errNombre      = document.getElementById('errNombre');
const errCategoria   = document.getElementById('errCategoria');
const errNivel       = document.getElementById('errNivel');

// Modal eliminar
const modalEliminar  = document.getElementById('modalEliminar');
const eliminarNombre = document.getElementById('eliminarItemNombre');

// Toast
const toast          = document.getElementById('toastConfirm');
const toastIcon      = document.getElementById('toastIcon');
const toastMsg       = document.getElementById('toastMsg');

// ── Fetch helpers ────────────────────────────────────────────────────────────
const headers = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

async function cargarItems() {
    try {
        const res = await fetch(API_URL, { headers: headers() });
        if (!res.ok) throw new Error();
        items = await res.json();
    } catch {
        items = [];
    }
    aplicarFiltros();
    actualizarKpis();
}

// ── KPIs ─────────────────────────────────────────────────────────────────────
function actualizarKpis() {
    document.getElementById('kpi-total').textContent = items.length;
    document.getElementById('kpi-medio').textContent = items.filter(i => i.nivel === 'MEDIO').length;
    document.getElementById('kpi-poco').textContent  = items.filter(i => i.nivel === 'BAJO').length;
}

// ── Filtros ──────────────────────────────────────────────────────────────────
function aplicarFiltros() {
    const texto    = inputBusqueda.value.trim().toLowerCase();
    const categoria= selectCategoria.value;
    const nivel    = selectNivel.value;

    itemsFiltrados = items.filter(item => {
        const coincideTexto = !texto ||
            item.nombre.toLowerCase().includes(texto) ||
            (item.descripcion || '').toLowerCase().includes(texto) ||
            (item.ubicacion || '').toLowerCase().includes(texto) ||
            (item.identificacion || '').toLowerCase().includes(texto);
        const coincideCategoria = !categoria || item.categoria === categoria;
        const coincideNivel     = !nivel     || item.nivel === nivel;
        return coincideTexto && coincideCategoria && coincideNivel;
    });

    paginaActual = 1;
    renderTabla();
}

inputBusqueda.addEventListener('input', aplicarFiltros);
selectCategoria.addEventListener('change', aplicarFiltros);
selectNivel.addEventListener('change', aplicarFiltros);

document.getElementById('selectPageSize')?.addEventListener('change', e => {
    POR_PAGINA = parseInt(e.target.value);
    paginaActual = 1;
    renderTabla();
});

// ── Tabla ────────────────────────────────────────────────────────────────────
const CATEGORIA_LABEL = {
    REACTIVOS: 'Reactivos', SOLVENTES: 'Solventes',
    MATERIAL_MUESTREO: 'Material Muestreo', MATERIAL_VIDRIO: 'Material Vidrio', OTROS: 'Otros'
};

const NIVEL_BADGE = {
    ALTO:  '<span class="badge-nivel badge-alto">Alto</span>',
    MEDIO: '<span class="badge-nivel badge-medio">Medio</span>',
    BAJO:  '<span class="badge-nivel badge-poco">Bajo</span>',
};

function renderTabla() {
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const pagina = itemsFiltrados.slice(inicio, inicio + POR_PAGINA);

    sinResultados.style.display = itemsFiltrados.length === 0 ? 'block' : 'none';
    document.querySelector('.tabla-stock').style.display = itemsFiltrados.length === 0 ? 'none' : '';

    tbody.innerHTML = pagina.map(item => `
        <tr>
            <td class="item-nombre">${item.nombre}</td>
            <td class="text-center item-id">${item.identificacion || '—'}</td>
            <td class="item-descripcion">${item.descripcion || '—'}</td>
            <td><span class="cat-badge">${CATEGORIA_LABEL[item.categoria] || item.categoria}</span></td>
            <td>${NIVEL_BADGE[item.nivel] || item.nivel}</td>
            <td class="text-center">${item.cantidadFrascos != null ? item.cantidadFrascos : '—'}</td>
            <td class="item-ubicacion">${item.ubicacion || '—'}</td>
            <td class="item-obs" title="${item.observaciones || ''}">${item.observaciones || '—'}</td>
            <td>
                <div class="acciones-cell">
                    <button class="btn-accion" onclick="abrirEdicion(${item.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-accion danger" onclick="abrirEliminar(${item.id}, '${item.nombre.replace(/'/g,"\\'")}')\" title="Eliminar">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    const total = itemsFiltrados.length;
    const fin   = Math.min(inicio + POR_PAGINA, total);
    infoPag.textContent = total === 0
        ? 'Sin resultados'
        : `Mostrando ${inicio + 1}–${fin} de ${total} ítems`;

    renderPaginacion();
}

function renderPaginacion() {
    const total = Math.ceil(itemsFiltrados.length / POR_PAGINA);
    paginacionEl.innerHTML = '';
    if (total <= 1) return;

    const mkBtn = (label, onClick, disabled, active) => {
        const b = document.createElement('button');
        b.className = 'pag-btn' + (disabled ? ' pag-btn-disabled' : '') + (active ? ' pag-btn-active' : '');
        b.innerHTML = label;
        b.disabled  = disabled;
        if (!disabled && !active) b.addEventListener('click', onClick);
        return b;
    };

    paginacionEl.appendChild(mkBtn('<i class="bi bi-chevron-left"></i>', () => { paginaActual--; renderTabla(); }, paginaActual === 1, false));
    for (let p = 1; p <= total; p++) {
        paginacionEl.appendChild(mkBtn(p, () => { paginaActual = p; renderTabla(); }, false, p === paginaActual));
    }
    paginacionEl.appendChild(mkBtn('<i class="bi bi-chevron-right"></i>', () => { paginaActual++; renderTabla(); }, paginaActual === total, false));
}

// ── Modal alta / edición ─────────────────────────────────────────────────────
function abrirModal() {
    limpiarFormulario();
    itemEditandoId = null;
    modalTitulo.textContent = 'Nuevo ítem';
    abrirOverlay(modalStock);
}

function abrirEdicion(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    itemEditandoId = id;
    modalTitulo.textContent = 'Editar ítem';
    inputNombre.value = item.nombre;
    inputCategoria.value = item.categoria;
    inputDescripcion.value = item.descripcion || '';
    inputIdentificacion.value = item.identificacion || '';
    inputCantidad.value = item.cantidadFrascos != null ? item.cantidadFrascos : '';
    inputUbicacion.value = item.ubicacion || '';
    inputObservaciones.value = item.observaciones || '';
    const radio = formStock.querySelector(`input[name="nivel"][value="${item.nivel}"]`);
    if (radio) radio.checked = true;
    abrirOverlay(modalStock);
}

function limpiarFormulario() {
    formStock.reset();
    [errNombre, errCategoria, errNivel].forEach(e => e.classList.remove('visible'));
    [inputNombre, inputCategoria].forEach(el => el.classList.remove('error'));
}

formStock.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validar()) return;

    const nivelSeleccionado = formStock.querySelector('input[name="nivel"]:checked')?.value;
    const payload = {
        nombre:          inputNombre.value.trim(),
        categoria:       inputCategoria.value,
        descripcion:     inputDescripcion.value.trim() || null,
        nivel:           nivelSeleccionado,
        observaciones:   inputObservaciones.value.trim() || null,
        identificacion:  inputIdentificacion.value.trim() || null,
        cantidadFrascos: inputCantidad.value !== '' ? parseInt(inputCantidad.value) : null,
        ubicacion:       inputUbicacion.value.trim() || null,
    };

    const url    = itemEditandoId ? `${API_URL}/${itemEditandoId}` : API_URL;
    const method = itemEditandoId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(payload) });
        if (!res.ok) throw new Error();
        cerrarOverlay(modalStock);
        mostrarToast(itemEditandoId ? 'Ítem actualizado' : 'Ítem registrado', 'success');
        await cargarItems();
    } catch {
        mostrarToast('Error al guardar el ítem', 'error');
    }
});

function validar() {
    let ok = true;
    const nivelSeleccionado = formStock.querySelector('input[name="nivel"]:checked');

    if (!inputNombre.value.trim()) {
        inputNombre.classList.add('error');
        errNombre.classList.add('visible');
        ok = false;
    } else {
        inputNombre.classList.remove('error');
        errNombre.classList.remove('visible');
    }

    if (!inputCategoria.value) {
        inputCategoria.classList.add('error');
        errCategoria.classList.add('visible');
        ok = false;
    } else {
        inputCategoria.classList.remove('error');
        errCategoria.classList.remove('visible');
    }

    if (!nivelSeleccionado) {
        errNivel.classList.add('visible');
        ok = false;
    } else {
        errNivel.classList.remove('visible');
    }

    return ok;
}

// ── Modal eliminar ───────────────────────────────────────────────────────────
function abrirEliminar(id, nombre) {
    itemEliminandoId = id;
    eliminarNombre.textContent = nombre;
    abrirOverlay(modalEliminar);
}

document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_URL}/${itemEliminandoId}`, {
            method: 'DELETE', headers: headers()
        });
        if (!res.ok) throw new Error();
        cerrarOverlay(modalEliminar);
        mostrarToast('Ítem eliminado', 'success');
        await cargarItems();
    } catch {
        mostrarToast('Error al eliminar el ítem', 'error');
    }
});

// ── Helpers overlay ──────────────────────────────────────────────────────────
function abrirOverlay(el)  { el.classList.add('visible'); }
function cerrarOverlay(el) { el.classList.remove('visible'); }

document.getElementById('btnNuevoItem').addEventListener('click', abrirModal);
document.getElementById('modalClose').addEventListener('click', () => cerrarOverlay(modalStock));
document.getElementById('btnCancelar').addEventListener('click', () => cerrarOverlay(modalStock));
document.getElementById('modalEliminarClose').addEventListener('click', () => cerrarOverlay(modalEliminar));
document.getElementById('btnCancelarEliminar').addEventListener('click', () => cerrarOverlay(modalEliminar));

[modalStock, modalEliminar].forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarOverlay(overlay); });
});

// ── Toast ────────────────────────────────────────────────────────────────────
function mostrarToast(msg, tipo = 'success') {
    toastMsg.textContent = msg;
    toast.className = `toast-confirm visible ${tipo}`;
    toastIcon.className = tipo === 'success' ? 'bi bi-check-circle-fill' : 'bi bi-x-circle-fill';
    setTimeout(() => toast.classList.remove('visible'), 3000);
}

// ── Init ─────────────────────────────────────────────────────────────────────
inicializarHeader();
cargarItems().then(() => {
    if (new URLSearchParams(location.search).get('nueva') === '1') {
        abrirModal();
    }
});
