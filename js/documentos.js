"use strict";

const API_URL = `${API_BASE}/api/documentos`;

const rol = (localStorage.getItem('userRole') || '').toUpperCase();
if (!localStorage.getItem('token') || rol === 'ROLE_CLIENTE') {
    window.location.href = 'login.html';
}

// ── Estado ──────────────────────────────────────────────────────────────────
let documentos = [];
let documentosFiltrados = [];
let editandoId = null;
let eliminandoId = null;
let tsCategoria = null;
let _vistaId = null;
let _vistaNombre = null;
let _vistaBlobUrl = null;
let POR_PAGINA = 5;
let paginaActual = 1;

// ── DOM ──────────────────────────────────────────────────────────────────────
const tbody          = document.getElementById('tablaDocsBody');
const sinResultados  = document.getElementById('sinResultados');
const infoPag        = document.getElementById('infoPaginacion');
const paginacionEl   = document.getElementById('paginacion');
const inputBusqueda  = document.getElementById('inputBusqueda');
const selectCategoria = document.getElementById('selectCategoria');
const selectEstado    = document.getElementById('selectEstado');
const modalDoc        = document.getElementById('modalDoc');
const modalEliminar   = document.getElementById('modalEliminar');
const formDoc         = document.getElementById('formDoc');
const inputNombre     = document.getElementById('inputNombre');
const inputCategoria  = document.getElementById('inputCategoria');
const inputDescripcion = document.getElementById('inputDescripcion');
const inputVencimiento = document.getElementById('inputVencimiento');
const inputArchivo    = document.getElementById('inputArchivo');
const fileDropArea    = document.getElementById('fileDropArea');
const fileSelected    = document.getElementById('fileSelected');
const fileSelectedName = document.getElementById('fileSelectedName');
const grupoArchivo    = document.getElementById('grupoArchivo');
const toast           = document.getElementById('toastConfirm');
const toastIcon       = document.getElementById('toastIcon');
const toastMsg        = document.getElementById('toastMsg');

// ── Auth fetch ───────────────────────────────────────────────────────────────
function authHeaders() {
    return { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
}

async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    if (res.status === 401) { window.location.href = 'login.html'; return null; }
    return res;
}

// ── Cargar datos ─────────────────────────────────────────────────────────────
async function cargarDocumentos() {
    try {
        const res = await apiFetch(API_URL);
        if (!res || !res.ok) throw new Error();
        documentos = await res.json();
    } catch {
        documentos = [];
    }
    aplicarFiltros();
    actualizarKpis();
    popularFiltroCategoria();
}

// ── KPIs ─────────────────────────────────────────────────────────────────────
function actualizarKpis() {
    document.getElementById('kpi-total').textContent    = documentos.length;
    document.getElementById('kpi-vigentes').textContent = documentos.filter(d => d.estado === 'VIGENTE').length;
    document.getElementById('kpi-proximos').textContent = documentos.filter(d => d.estado === 'PROXIMO_VENCER').length;
    document.getElementById('kpi-vencidos').textContent = documentos.filter(d => d.estado === 'VENCIDO').length;
    mostrarAlertaVencimiento();
}

function mostrarAlertaVencimiento() {
    const proximos = documentos.filter(d => d.estado === 'PROXIMO_VENCER');
    const vencidos = documentos.filter(d => d.estado === 'VENCIDO');
    const alerta = document.getElementById('alertaVencimiento');
    const msg    = document.getElementById('alertaVencimientoMsg');

    if (proximos.length === 0 && vencidos.length === 0) {
        alerta.style.display = 'none';
        return;
    }

    const partes = [];
    if (vencidos.length > 0)
        partes.push(`${vencidos.length} documento${vencidos.length > 1 ? 's' : ''} vencido${vencidos.length > 1 ? 's' : ''}`);
    if (proximos.length > 0)
        partes.push(`${proximos.length} próximo${proximos.length > 1 ? 's' : ''} a vencer (≤ 15 días)`);

    msg.textContent = partes.join(' y ') + '. Revisá la lista para renovarlos.';
    alerta.style.display = 'flex';
}

function popularFiltroCategoria() {
    const visto = new Set();
    const cats = [];
    documentos.forEach(d => {
        if (d.categoriaId && !visto.has(d.categoriaId)) {
            visto.add(d.categoriaId);
            cats.push({ id: d.categoriaId, nombre: d.categoria || String(d.categoriaId) });
        }
    });
    cats.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const sel = document.getElementById('selectCategoria');
    const valorActual = sel.value;
    sel.innerHTML = '<option value="">Todas las categorías</option>';
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        opt.textContent = c.nombre;
        sel.appendChild(opt);
    });
    if (valorActual) sel.value = valorActual;
}

// ── Filtros ──────────────────────────────────────────────────────────────────
function aplicarFiltros() {
    const texto     = inputBusqueda.value.trim().toLowerCase();
    const categoria = selectCategoria.value;
    const estado    = selectEstado.value;

    documentosFiltrados = documentos.filter(d => {
        const coincideTexto = !texto ||
            (d.nombre || '').toLowerCase().includes(texto) ||
            (d.descripcion || '').toLowerCase().includes(texto) ||
            (d.nombreArchivo || '').toLowerCase().includes(texto);
        const coincideCategoria = !categoria || String(d.categoriaId) === categoria;
        const coincideEstado    = !estado    || d.estado === estado;
        return coincideTexto && coincideCategoria && coincideEstado;
    });

    paginaActual = 1;
    renderTabla();
}

inputBusqueda.addEventListener('input', aplicarFiltros);
selectCategoria.addEventListener('change', aplicarFiltros);
selectEstado.addEventListener('change', aplicarFiltros);

document.getElementById('selectPageSize')?.addEventListener('change', e => {
    POR_PAGINA = parseInt(e.target.value);
    paginaActual = 1;
    renderTabla();
});

// ── Tabla ────────────────────────────────────────────────────────────────────

const ESTADO_LABEL = {
    VIGENTE:        'Vigente',
    PROXIMO_VENCER: 'Próximo a vencer',
    VENCIDO:        'Vencido'
};

const ESTADO_ICON = {
    VIGENTE:        'bi-shield-check',
    PROXIMO_VENCER: 'bi-clock-history',
    VENCIDO:        'bi-exclamation-circle'
};

function formatearFecha(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function renderTabla() {
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const pagina = documentosFiltrados.slice(inicio, inicio + POR_PAGINA);

    sinResultados.style.display = documentosFiltrados.length === 0 ? 'block' : 'none';
    document.querySelector('.tabla-docs').style.display = documentosFiltrados.length === 0 ? 'none' : '';

    tbody.innerHTML = pagina.map(d => `
        <tr>
            <td>
                <div class="doc-nombre">${d.nombre}</div>
                ${d.descripcion ? `<div class="doc-desc">${d.descripcion}</div>` : ''}
            </td>
            <td><span class="cat-badge">${d.categoria || '—'}</span></td>
            <td>${formatearFecha(d.fechaVencimiento)}</td>
            <td>
                <span class="estado-badge estado-${d.estado}">
                    <i class="bi ${ESTADO_ICON[d.estado] || 'bi-circle'}"></i>
                    ${ESTADO_LABEL[d.estado] || d.estado}
                </span>
            </td>
            <td>${formatearFecha(d.createdDate)}</td>
            <td>
                <div class="acciones-cell">
                    <button class="btn-accion" onclick="abrirVista(${d.id}, '${(d.nombreArchivo || 'documento').replace(/'/g, "\\'")}')" title="Ver documento">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn-accion download" onclick="descargarDocumento(${d.id}, '${(d.nombreArchivo || 'documento').replace(/'/g, "\\'")}')" title="Descargar">
                        <i class="bi bi-download"></i>
                    </button>
                    <button class="btn-accion" onclick="abrirEdicion(${d.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-accion danger" onclick="abrirEliminar(${d.id}, '${(d.nombre || '').replace(/'/g, "\\'")}')" title="Eliminar">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    const total = documentosFiltrados.length;
    const fin   = Math.min(inicio + POR_PAGINA, total);
    infoPag.textContent = total === 0
        ? 'Sin resultados'
        : `Mostrando ${inicio + 1}–${fin} de ${total} documentos`;

    renderPaginacion();
}

function renderPaginacion() {
    const total = Math.ceil(documentosFiltrados.length / POR_PAGINA);
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

// ── Descarga ─────────────────────────────────────────────────────────────────
async function descargarDocumento(id, nombreArchivo) {
    try {
        const res = await apiFetch(`${API_URL}/${id}/archivo`);
        if (!res || !res.ok) throw new Error();
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = nombreArchivo;
        a.click();
        URL.revokeObjectURL(url);
    } catch {
        mostrarToast('Error al descargar el archivo', 'error');
    }
}

// ── Modal alta ────────────────────────────────────────────────────────────────
function abrirModalAlta() {
    editandoId = null;
    document.getElementById('modalDocTitulo').textContent = 'Subir documento';
    limpiarFormulario();
    grupoArchivo.style.display = '';
    abrirOverlay(modalDoc);
}

function abrirEdicion(id) {
    const doc = documentos.find(d => d.id === id);
    if (!doc) return;
    editandoId = id;
    document.getElementById('modalDocTitulo').textContent = 'Editar documento';
    inputNombre.value      = doc.nombre;
    if (tsCategoria) {
        if (doc.categoriaId) tsCategoria.setValue(String(doc.categoriaId), true);
        else tsCategoria.clear(true);
    }
    inputDescripcion.value = doc.descripcion || '';
    inputVencimiento.value = doc.fechaVencimiento || '';
    grupoArchivo.style.display = 'none';
    limpiarErrores();
    abrirOverlay(modalDoc);
}

function limpiarFormulario() {
    formDoc.reset();
    if (tsCategoria) tsCategoria.clear(true);
    resetFileInput();
    limpiarErrores();
}

function limpiarErrores() {
    ['errNombre', 'errCategoria', 'errArchivo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('visible');
    });
    inputNombre.classList.remove('error');
}

// ── File input ────────────────────────────────────────────────────────────────
function resetFileInput() {
    inputArchivo.value = '';
    fileSelected.style.display  = 'none';
    fileDropArea.style.display  = '';
}

inputArchivo.addEventListener('change', () => {
    const file = inputArchivo.files[0];
    if (!file) { resetFileInput(); return; }
    fileDropArea.style.display    = 'none';
    fileSelected.style.display    = 'flex';
    fileSelectedName.textContent  = file.name;
});

document.getElementById('fileClear').addEventListener('click', () => resetFileInput());

fileDropArea.addEventListener('dragover', e => { e.preventDefault(); fileDropArea.classList.add('drag-over'); });
fileDropArea.addEventListener('dragleave', () => fileDropArea.classList.remove('drag-over'));
fileDropArea.addEventListener('drop', e => {
    e.preventDefault();
    fileDropArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        inputArchivo.files = dt.files;
        inputArchivo.dispatchEvent(new Event('change'));
    }
});

// ── Submit ────────────────────────────────────────────────────────────────────
formDoc.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validar()) return;

    const btnGuardar = document.getElementById('btnDocGuardar');
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';

    try {
        if (editandoId) {
            await guardarEdicion();
        } else {
            await guardarAlta();
        }
        cerrarOverlay(modalDoc);
        await cargarDocumentos();
        mostrarToast(editandoId ? 'Documento actualizado' : 'Documento subido', 'success');
    } catch {
        mostrarToast('Error al guardar el documento', 'error');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = '<i class="bi bi-check-lg"></i> Guardar';
    }
});

async function guardarAlta() {
    const fd = new FormData();
    fd.append('nombre', inputNombre.value.trim());
    fd.append('descripcion', inputDescripcion.value.trim());
    if (tsCategoria && tsCategoria.getValue()) fd.append('categoriaId', tsCategoria.getValue());
    if (inputVencimiento.value) fd.append('fechaVencimiento', inputVencimiento.value);
    fd.append('file', inputArchivo.files[0]);

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: fd
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function guardarEdicion() {
    const catVal = tsCategoria ? tsCategoria.getValue() : null;
    const payload = {
        nombre:           inputNombre.value.trim(),
        descripcion:      inputDescripcion.value.trim() || null,
        categoriaId:      catVal ? Number(catVal) : null,
        fechaVencimiento: inputVencimiento.value || null
    };
    const res = await apiFetch(`${API_URL}/${editandoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res || !res.ok) throw new Error(`HTTP ${res.status}`);
}

function validar() {
    let ok = true;
    limpiarErrores();

    if (!inputNombre.value.trim()) {
        inputNombre.classList.add('error');
        document.getElementById('errNombre').classList.add('visible');
        ok = false;
    }
    if (!tsCategoria || !tsCategoria.getValue()) {
        document.getElementById('errCategoria').classList.add('visible');
        ok = false;
    }
    if (!editandoId && (!inputArchivo.files || inputArchivo.files.length === 0)) {
        document.getElementById('errArchivo').classList.add('visible');
        ok = false;
    }
    return ok;
}

// ── Eliminar ──────────────────────────────────────────────────────────────────
function abrirEliminar(id, nombre) {
    eliminandoId = id;
    document.getElementById('eliminarDocNombre').textContent = nombre;
    abrirOverlay(modalEliminar);
}

document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
    try {
        const res = await apiFetch(`${API_URL}/${eliminandoId}`, { method: 'DELETE' });
        if (!res || !res.ok) throw new Error();
        cerrarOverlay(modalEliminar);
        mostrarToast('Documento eliminado', 'success');
        await cargarDocumentos();
    } catch {
        mostrarToast('Error al eliminar el documento', 'error');
    }
});

// ── Helpers overlay ───────────────────────────────────────────────────────────
function abrirOverlay(el)  { el.classList.add('visible'); }
function cerrarOverlay(el) { el.classList.remove('visible'); }

document.getElementById('btnNuevoDoc').addEventListener('click', abrirModalAlta);
document.getElementById('modalDocClose').addEventListener('click', () => cerrarOverlay(modalDoc));
document.getElementById('btnDocCancelar').addEventListener('click', () => cerrarOverlay(modalDoc));
document.getElementById('modalEliminarClose').addEventListener('click', () => cerrarOverlay(modalEliminar));
document.getElementById('btnCancelarEliminar').addEventListener('click', () => cerrarOverlay(modalEliminar));

document.getElementById('modalVistaClose').addEventListener('click', cerrarVista);
document.getElementById('btnVistaDescargar').addEventListener('click', () => {
    if (_vistaId && _vistaNombre) descargarDocumento(_vistaId, _vistaNombre);
});

[modalDoc, modalEliminar, document.getElementById('modalVista')].forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target !== overlay) return;
        if (overlay.id === 'modalVista') cerrarVista();
        else cerrarOverlay(overlay);
    });
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function mostrarToast(msg, tipo = 'success') {
    toastMsg.textContent = msg;
    toast.className = `toast-confirm visible ${tipo}`;
    toastIcon.className = tipo === 'success' ? 'bi bi-check-circle-fill' : 'bi bi-x-circle-fill';
    setTimeout(() => toast.classList.remove('visible'), 3000);
}

// ── Vista previa ─────────────────────────────────────────────────────────────
async function abrirVista(id, nombreArchivo) {
    _vistaId     = id;
    _vistaNombre = nombreArchivo;

    const modal = document.getElementById('modalVista');
    const body  = document.getElementById('modalVistaBody');
    document.getElementById('modalVistaNombre').textContent = nombreArchivo;

    body.innerHTML = `<div class="preview-loading"><i class="bi bi-hourglass-split"></i> Cargando...</div>`;
    abrirOverlay(modal);

    // liberar blob anterior si quedó abierto
    if (_vistaBlobUrl) { URL.revokeObjectURL(_vistaBlobUrl); _vistaBlobUrl = null; }

    try {
        const res = await apiFetch(`${API_URL}/${id}/archivo`);
        if (!res || !res.ok) throw new Error();
        const rawBlob = await res.blob();

        const ext = (nombreArchivo || '').split('.').pop().toLowerCase();

        const MIME = {
            pdf:  'application/pdf',
            png:  'image/png',
            jpg:  'image/jpeg',
            jpeg: 'image/jpeg',
            gif:  'image/gif',
            webp: 'image/webp',
            bmp:  'image/bmp',
        };
        const mime = MIME[ext];
        const blob = mime ? new Blob([rawBlob], { type: mime }) : rawBlob;
        _vistaBlobUrl = URL.createObjectURL(blob);

        if (ext === 'pdf') {
            body.innerHTML = `<iframe class="preview-iframe" src="${_vistaBlobUrl}"></iframe>`;
        } else if (MIME[ext] && ext !== 'pdf') {
            body.innerHTML = `<img class="preview-img" src="${_vistaBlobUrl}" alt="${nombreArchivo}">`;
        } else {
            body.innerHTML = `
                <div class="preview-unsupported">
                    <i class="bi bi-file-earmark-text"></i>
                    <p>No se puede previsualizar este tipo de archivo.<br>
                    <span style="font-size:12px;">Descargalo para abrirlo.</span></p>
                </div>`;
        }
    } catch {
        body.innerHTML = `
            <div class="preview-unsupported">
                <i class="bi bi-x-circle" style="color:#dc2626;"></i>
                <p>Error al cargar el documento.</p>
            </div>`;
    }
}

function cerrarVista() {
    cerrarOverlay(document.getElementById('modalVista'));
    if (_vistaBlobUrl) { URL.revokeObjectURL(_vistaBlobUrl); _vistaBlobUrl = null; }
    document.getElementById('modalVistaBody').innerHTML = '';
}

// ── Tom Select categoría ──────────────────────────────────────────────────────
async function inicializarTomSelectCategoria() {
    const res = await apiFetch(`${API_BASE}/api/categorias-documento`);
    const cats = (res && res.ok) ? await res.json() : [];

    tsCategoria = new TomSelect('#inputCategoria', {
        valueField: 'id',
        labelField: 'nombre',
        searchField: 'nombre',
        options: cats.map(c => ({ id: String(c.id), nombre: c.nombre })),
        placeholder: 'Buscar o crear categoría...',
        create: function(input, callback) {
            apiFetch(`${API_BASE}/api/categorias-documento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: input })
            }).then(r => r.json())
              .then(cat => callback({ id: String(cat.id), nombre: cat.nombre }));
        },
        dropdownParent: 'body',
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
inicializarHeader();
inicializarTomSelectCategoria();
cargarDocumentos();
