"use strict";

// ─────────────────────────────────────────────────────────
//  agenda.js — Calendario de muestreos agendados
// ─────────────────────────────────────────────────────────

const API_URL = `${API_BASE}/api`;

let calendar;
let muestreoEditandoId = null;
let clientesCache = [];
let sucursalesCache = {};
let usuariosCache = [];
let tipoFiltroActivo = '';

const COLORES = {
    PENDIENTE:  '#f59e0b',
    CONFIRMADO: '#5EA504',
    REALIZADO:  '#64748b',
    CANCELADO:  '#ef4444'
};

const TIPO_LABELS = {
    MUESTREO:       'Muestreo',
    COMPRA_INSUMOS: 'Compra de insumos',
    VENCIMIENTO:    'Vencimiento',
    OTRO:           'Otro',
    DOCUMENTACION:  'Vencimiento',
    VISITA_TECNICA: 'Vencimiento',
    ANALISIS:       'Muestreo'
};

// ── Auth helper ───────────────────────────────────────────
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...(options.headers || {}), 'Authorization': `Bearer ${token}` };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) { window.location.href = 'login.html'; return null; }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

// ── Inicialización ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    inicializarHeader();
    await Promise.all([cargarClientes(), cargarUsuarios()]);
    inicializarCalendario();
    document.getElementById('btn-nuevo')?.addEventListener('click', abrirNuevo);
});

// ── Calendario FullCalendar ───────────────────────────────
function inicializarCalendario() {
    const el = document.getElementById('calendario');
    calendar = new FullCalendar.Calendar(el, {
        locale: 'es',
        initialView: 'dayGridMonth',
        headerToolbar: {
            left:   'prev,next today',
            center: 'title',
            right:  ''
        },
        buttonText: { today: 'Hoy' },
        height: 'auto',
        events: cargarEventos,
        loading: (isLoading) => {
            document.getElementById('cal-loading-pill')?.classList.toggle('visible', isLoading);
        },
        eventClick: ({ event }) => abrirDetalle(event),
        dateClick:  ({ dateStr }) => abrirNuevoEnFecha(dateStr),
        eventDidMount: ({ event, el }) => { el.title = event.title; }
    });
    calendar.render();
}

async function cargarEventos(info, successCallback, failureCallback) {
    try {
        const start = info.startStr.substring(0, 19);
        const end   = info.endStr.substring(0, 19);
        const data  = await apiFetch(`${API_URL}/muestreos?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
        let eventos = (data || []).map(m => {
            const tipo = m.tipo || 'MUESTREO';
            const title = tipo === 'VENCIMIENTO' && m.documentacion
                ? m.documentacion
                : (tipo === 'MUESTREO' && m.clienteNombre)
                    ? m.clienteNombre
                    : (TIPO_LABELS[tipo] || 'Evento');
            return {
                id:    String(m.id),
                title,
                start: m.fechaHora,
                color: COLORES[m.estado] || '#5EA504',
                extendedProps: m
            };
        });
        if (tipoFiltroActivo) {
            eventos = eventos.filter(ev => (ev.extendedProps.tipo || 'MUESTREO') === tipoFiltroActivo);
        }
        successCallback(eventos);
    } catch (e) {
        console.error('Error cargando muestreos:', e);
        failureCallback(e);
    }
}

// ── Cambiar vista (toolbar custom) ───────────────────────
function cambiarVista(vista, btn) {
    calendar.changeView(vista);
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// ── Detalle de un evento ──────────────────────────────────
function abrirDetalle(event) {
    const m = event.extendedProps;

    const tipoEl = document.getElementById('detalle-tipo');
    if (tipoEl) tipoEl.textContent = TIPO_LABELS[m.tipo || 'MUESTREO'] || 'Muestreo';

    const esVencimiento = (m.tipo === 'VENCIMIENTO');
    const rowCliente  = document.getElementById('detalle-row-cliente');
    const rowSucursal = document.getElementById('detalle-row-sucursal');
    const rowDoc      = document.getElementById('detalle-row-documentacion');
    const rowDeQuien  = document.getElementById('detalle-row-dequien');
    if (rowCliente)  rowCliente.style.display  = esVencimiento ? 'none' : '';
    if (rowSucursal) rowSucursal.style.display = esVencimiento ? 'none' : '';
    if (rowDoc)      rowDoc.style.display      = esVencimiento ? '' : 'none';
    if (rowDeQuien)  rowDeQuien.style.display  = esVencimiento ? '' : 'none';
    const rowDireccion = document.getElementById('detalle-row-direccion');
    if (rowDireccion) rowDireccion.style.display = esVencimiento ? 'none' : '';

    document.getElementById('detalle-cliente').textContent       = m.clienteNombre || '—';
    document.getElementById('detalle-sucursal').textContent      = m.sucursalNombre || '—';
    document.getElementById('detalle-documentacion').textContent = m.documentacion || '—';
    document.getElementById('detalle-dequien').textContent       = m.deQuien || '—';
    document.getElementById('detalle-fecha').textContent          = formatearFecha(m.fechaHora);
    document.getElementById('detalle-responsable').textContent    = m.responsableNombre || 'Sin asignar';
    document.getElementById('detalle-direccion').textContent      = m.direccion || '—';
    document.getElementById('detalle-obs').textContent            = m.observaciones || '—';

    const badge = document.getElementById('detalle-estado');
    badge.textContent = labelEstado(m.estado);
    badge.className   = `estado-badge estado-${m.estado}`;

    document.getElementById('detalle-editar-btn').onclick   = () => { cerrarModal('detalleModal'); abrirFormulario(m); };
    document.getElementById('detalle-eliminar-btn').onclick = () => confirmarEliminar(m.id);

    renderBotonesEstado(m.id, m.estado);
    abrirModal('detalleModal');
}

function renderBotonesEstado(id, estadoActual) {
    const opciones = [
        { valor: 'PENDIENTE',  label: 'Marcar pendiente' },
        { valor: 'CONFIRMADO', label: 'Confirmar' },
        { valor: 'REALIZADO',  label: 'Marcar realizado' },
        { valor: 'CANCELADO',  label: 'Cancelar' }
    ];
    const container = document.getElementById('detalle-estados-btn');
    container.innerHTML = opciones
        .filter(o => o.valor !== estadoActual)
        .map(o => `
            <button class="btn btn-sm estado-badge estado-${o.valor} border-0"
                    onclick="cambiarEstado(${id}, '${o.valor}')">
                ${o.label}
            </button>`)
        .join('');
}

async function cambiarEstado(id, estado) {
    try {
        await apiFetch(`${API_URL}/muestreos/${id}/estado?estado=${estado}`, { method: 'PUT' });
        cerrarModal('detalleModal');
        calendar.refetchEvents();
        mostrarToast('Estado actualizado');
    } catch {
        mostrarToast('Error al actualizar estado', true);
    }
}

// ── Formulario crear / editar ─────────────────────────────
function abrirNuevoEnFecha(dateStr) {
    abrirFormulario({ fechaHora: dateStr.length === 10 ? dateStr + 'T09:00' : dateStr.substring(0, 16) });
}

function abrirNuevo() { abrirFormulario({}); }

function actualizarVisibilidadCliente(tipo) {
    const secCliente = document.getElementById('form-cliente-section');
    const secVenc    = document.getElementById('form-vencimiento-section');
    const secDonde   = document.getElementById('form-donde-section');
    if (secCliente) secCliente.style.display = tipo === 'MUESTREO' ? '' : 'none';
    if (secVenc)    secVenc.style.display    = tipo === 'VENCIMIENTO' ? '' : 'none';
    if (secDonde)   secDonde.style.display   = tipo === 'VENCIMIENTO' ? 'none' : '';
}

async function abrirFormulario(m = {}) {
    muestreoEditandoId = m.id || null;

    document.getElementById('formModalTitle').textContent = m.id ? 'Editar evento' : 'Nuevo evento';
    document.getElementById('form-fecha').value          = m.fechaHora ? m.fechaHora.substring(0, 16) : '';
    document.getElementById('form-direccion').value      = m.direccion || '';
    document.getElementById('form-obs').value            = m.observaciones || '';
    document.getElementById('form-documentacion').value  = m.documentacion || '';
    document.getElementById('form-dequien').value        = m.deQuien || '';
    const radioEstado = document.querySelector(`input[name="form-estado"][value="${m.estado || 'PENDIENTE'}"]`);
    if (radioEstado) radioEstado.checked = true;

    const tipoVal = m.tipo || 'MUESTREO';
    const radioTipo = document.querySelector(`input[name="form-tipo"][value="${tipoVal}"]`);
    if (radioTipo) radioTipo.checked = true;
    actualizarVisibilidadCliente(tipoVal);

    const selCliente = document.getElementById('form-cliente');
    selCliente.innerHTML = '<option value="">Seleccionar cliente…</option>'
        + clientesCache.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    selCliente.value = m.clienteId || '';

    const selResp = document.getElementById('form-responsable');
    selResp.innerHTML = '<option value="">Sin asignar</option>'
        + usuariosCache.map(u => `<option value="${u.id}">${u.username || u.email}</option>`).join('');
    selResp.value = m.responsableId || '';

    await actualizarSucursales(m.clienteId, m.sucursalId);
    abrirModal('formModal');
}

async function actualizarSucursales(clienteId, sucursalSeleccionada) {
    const sel = document.getElementById('form-sucursal');
    sel.innerHTML = '<option value="">Dirección principal del cliente</option>';
    if (!clienteId) return;

    try {
        let sucursales = sucursalesCache[clienteId];
        if (!sucursales) {
            sucursales = await apiFetch(`${API_URL}/clientes/${clienteId}/sucursales`);
            sucursalesCache[clienteId] = sucursales || [];
        }
        (sucursales || [])
            .filter(s => s.activo !== false)
            .forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.nombre + (s.localidad ? ` — ${s.localidad}` : '');
                sel.appendChild(opt);
            });
        if (sucursalSeleccionada) sel.value = sucursalSeleccionada;
    } catch { /* sin sucursales */ }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('form-cliente')?.addEventListener('change', async function () {
        await actualizarSucursales(this.value, null);
        const cliente = clientesCache.find(c => String(c.id) === String(this.value));
        document.getElementById('form-direccion').value = cliente
            ? [cliente.direccion, cliente.localidad].filter(Boolean).join(', ')
            : '';
    });

    document.getElementById('form-sucursal')?.addEventListener('change', function () {
        const clienteId  = document.getElementById('form-cliente').value;
        const sucursalId = this.value;
        if (!sucursalId) return;
        const suc = (sucursalesCache[clienteId] || []).find(s => String(s.id) === String(sucursalId));
        if (suc) {
            document.getElementById('form-direccion').value =
                [suc.direccion, suc.localidad].filter(Boolean).join(', ');
        }
    });

    document.querySelectorAll('input[name="form-tipo"]').forEach(radio => {
        radio.addEventListener('change', function () {
            actualizarVisibilidadCliente(this.value);
        });
    });

    document.getElementById('filtro-tipo')?.addEventListener('change', function () {
        tipoFiltroActivo = this.value;
        calendar.refetchEvents();
    });

    document.getElementById('muestreoForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tipoVal = document.querySelector('input[name="form-tipo"]:checked')?.value || 'MUESTREO';
        const clienteId = document.getElementById('form-cliente').value;
        if (tipoVal === 'MUESTREO' && !clienteId) { mostrarToast('Seleccioná un cliente', true); return; }
        if (tipoVal === 'VENCIMIENTO' && !document.getElementById('form-documentacion').value.trim()) {
            mostrarToast('Ingresá la documentación', true); return;
        }

        const fechaRaw = document.getElementById('form-fecha').value;
        if (!fechaRaw) { mostrarToast('Ingresá la fecha y hora', true); return; }

        const sucursalVal    = document.getElementById('form-sucursal').value;
        const responsableVal = document.getElementById('form-responsable').value;

        const to = {
            tipo:          tipoVal,
            clienteId:     tipoVal === 'MUESTREO' && clienteId ? Number(clienteId) : null,
            sucursalId:    tipoVal === 'MUESTREO' && sucursalVal ? Number(sucursalVal) : null,
            fechaHora:     fechaRaw.length === 16 ? fechaRaw + ':00' : fechaRaw,
            responsableId: responsableVal ? Number(responsableVal) : null,
            direccion:       tipoVal !== 'VENCIMIENTO' ? (document.getElementById('form-direccion').value || null) : null,
            observaciones:   document.getElementById('form-obs').value || null,
            documentacion:   tipoVal === 'VENCIMIENTO' ? (document.getElementById('form-documentacion').value.trim() || null) : null,
            deQuien:         tipoVal === 'VENCIMIENTO' ? (document.getElementById('form-dequien').value.trim() || null) : null,
            estado:          document.querySelector('input[name="form-estado"]:checked')?.value || 'PENDIENTE'
        };

        try {
            if (muestreoEditandoId) {
                await apiFetch(`${API_URL}/muestreos/${muestreoEditandoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(to)
                });
                mostrarToast('Muestreo actualizado');
            } else {
                await apiFetch(`${API_URL}/muestreos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(to)
                });
                mostrarToast('Muestreo agendado');
            }
            cerrarModal('formModal');
            calendar.refetchEvents();
        } catch (err) {
            mostrarToast(err.message || 'Error al guardar', true);
        }
    });
});

// ── Eliminar ──────────────────────────────────────────────
function confirmarEliminar(id) {
    cerrarModal('detalleModal');
    document.getElementById('confirmar-eliminar-btn').onclick = () => eliminarMuestreo(id);
    abrirModal('eliminarModal');
}

async function eliminarMuestreo(id) {
    try {
        await apiFetch(`${API_URL}/muestreos/${id}`, { method: 'DELETE' });
        cerrarModal('eliminarModal');
        calendar.refetchEvents();
        mostrarToast('Muestreo eliminado');
    } catch {
        mostrarToast('Error al eliminar', true);
    }
}

// ── Datos auxiliares ──────────────────────────────────────
async function cargarClientes() {
    try {
        const data = await apiFetch(`${API_URL}/clientes`);
        clientesCache = (data || [])
            .filter(c => c.activo !== false)
            .map(c => ({
                id:        c.id,
                nombre:    c.tipoCliente === 'EMPRESA'
                               ? (c.razonSocial || '')
                               : [c.nombre, c.apellido].filter(Boolean).join(' '),
                direccion: c.direccion,
                localidad: c.localidad
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    } catch { clientesCache = []; }
}

async function cargarUsuarios() {
    try {
        usuariosCache = await apiFetch(`${API_URL}/users/asignables`) || [];
    } catch { usuariosCache = []; }
}

// ── Utilidades ────────────────────────────────────────────
function formatearFecha(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-AR', {
        weekday: 'short', day: '2-digit', month: 'short',
        year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function labelEstado(e) {
    return { PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', REALIZADO: 'Realizado', CANCELADO: 'Cancelado' }[e] || e;
}

function abrirModal(id)  { bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show(); }
function cerrarModal(id) { bootstrap.Modal.getInstance(document.getElementById(id))?.hide(); }

function mostrarToast(msg, error = false) {
    const toast = document.getElementById('agendaToast');
    if (!toast) return;
    toast.querySelector('.toast-body').textContent = msg;
    toast.className = `toast align-items-center border-0 ${error ? 'bg-danger text-white' : 'bg-success text-white'}`;
    bootstrap.Toast.getOrCreateInstance(toast, { delay: 3000 }).show();
}
