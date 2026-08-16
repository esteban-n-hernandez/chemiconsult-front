"use strict";

// ── Estado ───────────────────────────────────────────────────
let agendaEvents   = [];
let clientesCache  = [];
let sucursalesCache = {};
let agendaDate     = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
let editandoAgendaId = null;
let tipoActual     = 'MUESTREO';

const ESTADO_SEQ = ['PENDIENTE', 'CONFIRMADO', 'REALIZADO', 'CANCELADO'];

const ESTADO_CFG = {
    PENDIENTE:  { cls: 'ag-pendiente',  lbl: 'Pendiente'  },
    CONFIRMADO: { cls: 'ag-confirmado', lbl: 'Confirmado' },
    REALIZADO:  { cls: 'ag-realizado',  lbl: 'Realizado'  },
    CANCELADO:  { cls: 'ag-cancelado',  lbl: 'Cancelado'  },
};

const TIPO_CFG = {
    MUESTREO:       { emoji: '💧', label: 'Muestreo',          cls: 'ag-tipo-azul'    },
    COMPRA_INSUMOS: { emoji: '🛒', label: 'Compra de insumos',  cls: 'ag-tipo-naranja' },
    VENCIMIENTO:    { emoji: '⏰', label: 'Vencimiento',         cls: 'ag-tipo-rojo'   },
    OTRO:           { emoji: '✏️',  label: 'Otro',               cls: 'ag-tipo-violeta' },
};

const OBS_CFG = {
    MUESTREO:       { label: 'Observaciones',   badge: 'opt',  ph: 'Notas del muestreo…'                },
    COMPRA_INSUMOS: { label: '¿Qué se compra?', badge: 'req',  ph: 'Descripción de los insumos…'        },
    VENCIMIENTO:    { label: 'Notas',           badge: 'opt',  ph: 'Notas adicionales…'                 },
    OTRO:           { label: 'Descripción',     badge: 'req',  ph: 'Describí el evento…'               },
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('view-agenda')) return;

    const role = (localStorage.getItem('userRole') || '').toUpperCase();
    const mods = JSON.parse(localStorage.getItem('userModulos') || '[]');
    if (role !== 'ROLE_IT' && !mods.includes('AGENDA')) return;

    initHeader('agenda-sub', 'agenda-avatar');
    actualizarBarraFecha();
    setupDateNav();
    await cargarClientesAgenda();
    setupAgendaForm();
    document.getElementById('fab-agenda')?.addEventListener('click', abrirNuevoEvento);

    await cargarEventosDia();
});

// ── Navegación de fecha ───────────────────────────────────────
function setupDateNav() {
    document.getElementById('agenda-prev')?.addEventListener('click', () => moverFecha(-1));
    document.getElementById('agenda-next')?.addEventListener('click', () => moverFecha(+1));
    document.getElementById('agenda-hoy-btn')?.addEventListener('click', irAHoy);
}

function moverFecha(delta) {
    agendaDate.setDate(agendaDate.getDate() + delta);
    actualizarBarraFecha();
    cargarEventosDia();
}

function irAHoy() {
    agendaDate = new Date(); agendaDate.setHours(0,0,0,0);
    actualizarBarraFecha();
    cargarEventosDia();
}

function actualizarBarraFecha() {
    const hoy  = new Date(); hoy.setHours(0,0,0,0);
    const diff = Math.round((agendaDate - hoy) / 86400000);

    let etiqueta;
    if      (diff ===  0) etiqueta = 'Hoy';
    else if (diff ===  1) etiqueta = 'Mañana';
    else if (diff === -1) etiqueta = 'Ayer';
    else                  etiqueta = agendaDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

    const full = agendaDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const el = document.getElementById('agenda-fecha-label');
    if (el) el.textContent = etiqueta;
    const elFull = document.getElementById('agenda-fecha-full');
    if (elFull) elFull.textContent = full.charAt(0).toUpperCase() + full.slice(1);

    const btn = document.getElementById('agenda-hoy-btn');
    if (btn) btn.style.display = diff === 0 ? 'none' : '';
}

// ── Datos ─────────────────────────────────────────────────────
async function cargarEventosDia() {
    mostrarLoadingAgenda(true);
    const start = `${fechaISO(agendaDate)}T00:00:00`;
    const end   = `${fechaISO(agendaDate)}T23:59:59`;
    try {
        const data = await apiFetch(`${MOB_API}/muestreos?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
        agendaEvents = (data || []).sort((a, b) => {
            if (!a.fechaHora) return 1;
            if (!b.fechaHora) return -1;
            return a.fechaHora.localeCompare(b.fechaHora);
        });
        renderEventos();
    } catch {
        mobToast('Error cargando agenda', 'error');
    } finally {
        mostrarLoadingAgenda(false);
    }
}

async function cargarClientesAgenda() {
    try {
        const data = await apiFetch(`${MOB_API}/clientes`) || [];
        clientesCache = data
            .filter(c => c.activo !== false)
            .map(c => ({
                id:     c.id,
                nombre: c.tipoCliente === 'EMPRESA'
                    ? (c.razonSocial || '')
                    : [c.nombre, c.apellido].filter(Boolean).join(' '),
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

        const sel = document.getElementById('ag-cliente-sel');
        if (!sel) return;
        clientesCache.forEach(c => sel.appendChild(new Option(c.nombre, c.id)));
    } catch { /* sin clientes */ }
}

async function cargarSucursalesAgenda(clienteId, preseleccion) {
    const sel = document.getElementById('ag-sucursal-sel');
    if (!sel) return;
    sel.innerHTML = '<option value="">Dirección principal</option>';
    if (!clienteId) return;
    try {
        let suc = sucursalesCache[clienteId];
        if (!suc) {
            suc = await apiFetch(`${MOB_API}/clientes/${clienteId}/sucursales`) || [];
            sucursalesCache[clienteId] = suc;
        }
        suc.filter(s => s.activo !== false).forEach(s => {
            const lbl = s.nombre + (s.localidad ? ` — ${s.localidad}` : '');
            sel.appendChild(new Option(lbl, s.id));
        });
        if (preseleccion) sel.value = preseleccion;
    } catch { /* sin sucursales */ }
}

// ── Render ────────────────────────────────────────────────────
function renderEventos() {
    const list  = document.getElementById('agenda-list');
    const empty = document.getElementById('agenda-empty');
    list.querySelectorAll('.agenda-card').forEach(c => c.remove());

    if (agendaEvents.length === 0) {
        empty.style.display = 'flex';
        return;
    }
    empty.style.display = 'none';

    const anchor = list.querySelector('.scroll-end');
    agendaEvents.forEach(ev => list.insertBefore(crearCardEvento(ev), anchor));
}

function crearCardEvento(ev) {
    const card = document.createElement('div');
    card.className = 'agenda-card';
    card.dataset.id = ev.id;

    const tipo     = ev.tipo || 'MUESTREO';
    const tipoCfg  = TIPO_CFG[tipo] || TIPO_CFG.MUESTREO;
    const estadoCfg = ESTADO_CFG[ev.estado] || ESTADO_CFG.PENDIENTE;
    const hora     = ev.fechaHora ? ev.fechaHora.substring(11, 16) : '—:——';

    let titulo;
    if (tipo === 'MUESTREO')       titulo = ev.clienteNombre || 'Muestreo';
    else if (tipo === 'VENCIMIENTO') titulo = ev.documentacion || 'Vencimiento';
    else                            titulo = ev.observaciones || tipoCfg.label;

    let sub = '';
    if (tipo === 'MUESTREO' && ev.sucursalNombre)    sub = ev.sucursalNombre;
    else if (tipo === 'VENCIMIENTO' && ev.deQuien)   sub = `De: ${ev.deQuien}`;
    else if (tipo === 'MUESTREO' && ev.direccion)    sub = ev.direccion;

    card.innerHTML = `
      <div class="ag-main" onclick="abrirDetalleEvento(${ev.id})">
        <div class="ag-timecol">
          <span class="ag-hora">${hora}</span>
        </div>
        <div class="ag-stripe ${estadoCfg.cls}"></div>
        <div class="ag-body">
          <div class="ag-titulo">${escHtml(titulo)}</div>
          <span class="ag-tipo-badge ${tipoCfg.cls}">${tipoCfg.emoji} ${tipoCfg.label}</span>
          ${sub ? `<div class="ag-sub"><svg width="9" height="11" viewBox="0 0 9 11" fill="currentColor"><path d="M4.5 0A4 4 0 0 0 .5 4c0 3 4 7 4 7s4-4 4-7A4 4 0 0 0 4.5 0zm0 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>${escHtml(sub)}</div>` : ''}
        </div>
        <button class="ag-estado-btn ${estadoCfg.cls}"
                onclick="avanzarEstadoEvento(event,${ev.id})">
          ${estadoCfg.lbl}
        </button>
      </div>
    `;
    return card;
}

// ── Cambio de estado ──────────────────────────────────────────
async function avanzarEstadoEvento(e, id) {
    e.stopPropagation();
    const ev = agendaEvents.find(a => a.id === id);
    if (!ev) return;
    const idx = ESTADO_SEQ.indexOf(ev.estado);
    const sig = ESTADO_SEQ[(idx + 1) % ESTADO_SEQ.length];
    try {
        await apiFetch(`${MOB_API}/muestreos/${id}/estado?estado=${encodeURIComponent(sig)}`, { method: 'PUT' });
        ev.estado = sig;
        renderEventos();
        mobToast('Estado actualizado');
    } catch {
        mobToast('Error al actualizar estado', 'error');
    }
}

// ── Abrir sheet nuevo / editar ────────────────────────────────
function abrirNuevoEvento() {
    editandoAgendaId = null;
    tipoActual = 'MUESTREO';
    seleccionarTipoAgenda('MUESTREO');

    document.getElementById('ag-cliente-sel').value = '';
    document.getElementById('ag-sucursal-sel').innerHTML = '<option value="">Dirección principal</option>';
    document.getElementById('ag-doc-input').value    = '';
    document.getElementById('ag-dequien-input').value = '';
    document.getElementById('ag-fecha-input').value  = fechaISO(agendaDate);
    document.getElementById('ag-hora-input').value   = '09:00';
    document.getElementById('ag-obs-input').value    = '';

    document.getElementById('ag-sheet-title').textContent     = 'Nuevo evento';
    document.getElementById('ag-submit-btn').textContent      = 'Agendar';
    document.getElementById('ag-delete-btn').style.display    = 'none';
    openSheet('agenda-sheet');
}

function abrirDetalleEvento(id) {
    const ev = agendaEvents.find(a => a.id === id);
    if (!ev) return;
    editandoAgendaId = id;

    const tipo = ev.tipo || 'MUESTREO';
    tipoActual = tipo;
    seleccionarTipoAgenda(tipo);

    document.getElementById('ag-cliente-sel').value  = ev.clienteId || '';
    document.getElementById('ag-doc-input').value    = ev.documentacion || '';
    document.getElementById('ag-dequien-input').value = ev.deQuien || '';
    document.getElementById('ag-fecha-input').value  = ev.fechaHora ? ev.fechaHora.substring(0, 10) : '';
    document.getElementById('ag-hora-input').value   = ev.fechaHora ? ev.fechaHora.substring(11, 16) : '';
    document.getElementById('ag-obs-input').value    = ev.observaciones || '';

    if (ev.clienteId) {
        cargarSucursalesAgenda(ev.clienteId, ev.sucursalId);
    } else {
        document.getElementById('ag-sucursal-sel').innerHTML = '<option value="">Dirección principal</option>';
    }

    document.getElementById('ag-sheet-title').textContent     = 'Editar evento';
    document.getElementById('ag-submit-btn').textContent      = 'Guardar cambios';
    document.getElementById('ag-delete-btn').style.display    = 'flex';
    openSheet('agenda-sheet');
}

// ── Selector de tipo ──────────────────────────────────────────
function seleccionarTipoAgenda(tipo) {
    tipoActual = tipo;

    ['MUESTREO', 'COMPRA_INSUMOS', 'VENCIMIENTO', 'OTRO'].forEach(t => {
        document.getElementById(`ag-tipo-${t}`)?.classList.toggle('active', t === tipo);
    });

    document.getElementById('ag-section-muestreo').style.display    = tipo === 'MUESTREO'    ? 'flex' : 'none';
    document.getElementById('ag-section-vencimiento').style.display = tipo === 'VENCIMIENTO' ? 'flex' : 'none';

    const cfg = OBS_CFG[tipo] || OBS_CFG.MUESTREO;
    const obsLabel = document.getElementById('ag-obs-label');
    if (obsLabel) obsLabel.innerHTML = `${cfg.label} <span class="${cfg.badge}">${cfg.badge === 'req' ? '*' : 'opcional'}</span>`;
    const obsInput = document.getElementById('ag-obs-input');
    if (obsInput) obsInput.placeholder = cfg.ph;
}

// ── Formulario ────────────────────────────────────────────────
function setupAgendaForm() {
    document.getElementById('ag-cliente-sel')?.addEventListener('change', function () {
        cargarSucursalesAgenda(this.value, null);
    });

    document.getElementById('ag-sheet-cancel')?.addEventListener('click', () => closeSheet('agenda-sheet'));

    document.getElementById('ag-form')?.addEventListener('submit', async e => {
        e.preventDefault();

        const tipo  = tipoActual;
        const fecha = document.getElementById('ag-fecha-input').value;
        const hora  = document.getElementById('ag-hora-input').value || '00:00';
        const obs   = document.getElementById('ag-obs-input').value.trim();

        if (tipo === 'MUESTREO' && !document.getElementById('ag-cliente-sel').value) {
            mobToast('Seleccioná un cliente', 'error'); return;
        }
        if (tipo === 'VENCIMIENTO' && !document.getElementById('ag-doc-input').value.trim()) {
            mobToast('Ingresá la documentación', 'error'); return;
        }
        if ((tipo === 'COMPRA_INSUMOS' || tipo === 'OTRO') && !obs) {
            mobToast('Ingresá una descripción', 'error'); return;
        }
        if (!fecha) { mobToast('La fecha es requerida', 'error'); return; }

        const clienteId  = document.getElementById('ag-cliente-sel').value;
        const sucursalId = document.getElementById('ag-sucursal-sel')?.value;

        const payload = {
            tipo,
            clienteId:    tipo === 'MUESTREO' && clienteId  ? Number(clienteId)  : null,
            sucursalId:   tipo === 'MUESTREO' && sucursalId ? Number(sucursalId) : null,
            documentacion: tipo === 'VENCIMIENTO' ? (document.getElementById('ag-doc-input').value.trim() || null) : null,
            deQuien:       tipo === 'VENCIMIENTO' ? (document.getElementById('ag-dequien-input').value.trim() || null) : null,
            fechaHora:    `${fecha}T${hora}:00`,
            observaciones: obs || null,
            estado: editandoAgendaId
                ? (agendaEvents.find(a => a.id === editandoAgendaId)?.estado || 'PENDIENTE')
                : 'PENDIENTE',
        };

        const btn = document.getElementById('ag-submit-btn');
        btn.disabled = true;
        try {
            if (editandoAgendaId) {
                await apiFetch(`${MOB_API}/muestreos/${editandoAgendaId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                mobToast('Evento actualizado');
            } else {
                await apiFetch(`${MOB_API}/muestreos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                mobToast('Evento agendado');
            }
            closeSheet('agenda-sheet');
            await cargarEventosDia();
        } catch (err) {
            mobToast(err.message || 'Error al guardar', 'error');
        } finally {
            btn.disabled = false;
        }
    });

    document.getElementById('ag-delete-btn')?.addEventListener('click', async () => {
        if (!editandoAgendaId) return;
        if (!confirm('¿Eliminar este evento? No se puede deshacer.')) return;
        try {
            await apiFetch(`${MOB_API}/muestreos/${editandoAgendaId}`, { method: 'DELETE' });
            agendaEvents = agendaEvents.filter(a => a.id !== editandoAgendaId);
            closeSheet('agenda-sheet');
            renderEventos();
            mobToast('Evento eliminado');
        } catch {
            mobToast('Error al eliminar', 'error');
        }
    });
}

// ── Helpers ───────────────────────────────────────────────────
function fechaISO(d) {
    return d.toLocaleDateString('sv-SE'); // yyyy-MM-dd
}

function mostrarLoadingAgenda(show) {
    const list = document.getElementById('agenda-list');
    if (!list) return;
    list.querySelectorAll('.skel-card').forEach(c => c.remove());
    if (show) {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < 3; i++) frag.appendChild(crearSkelAgenda());
        list.prepend(frag);
    }
    const old = document.getElementById('agenda-loading');
    if (old) old.style.display = 'none';
}

function crearSkelAgenda() {
    const widths = [[70,38],[78,50],[84,42]];
    const [w1, w2] = widths[Math.floor(Math.random() * 3)];
    const d = document.createElement('div');
    d.className = 'skel-card';
    d.style.margin = '0 14px 10px';
    d.innerHTML = `
      <div style="display:flex;align-items:stretch;padding:12px">
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;width:36px;flex-shrink:0;margin-right:8px">
          <div class="sh" style="height:11px;width:28px;border-radius:3px"></div>
          <div class="sh" style="height:9px;width:20px;border-radius:3px;margin-top:2px"></div>
        </div>
        <div class="sh" style="width:3px;border-radius:0;flex-shrink:0;margin-right:10px"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:7px">
          <div class="sh" style="height:12px;border-radius:4px;width:${w1}%"></div>
          <div class="sh" style="height:9px;border-radius:4px;width:${w2}%"></div>
        </div>
        <div class="sh" style="height:22px;border-radius:11px;width:68px;flex-shrink:0;margin-left:8px;align-self:center"></div>
      </div>`;
    return d;
}
