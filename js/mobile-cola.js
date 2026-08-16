"use strict";

// ── Estado ───────────────────────────────────────────────────
let colaItems = [];

const ESTADO_CFG = {
    PENDIENTE:   { lbl: 'Pendiente',   cls: 'ce-pendiente' },
    EN_PROCESO:  { lbl: 'En proceso',  cls: 'ce-proceso'   },
    DEMORADA:    { lbl: 'Demorada',    cls: 'ce-demorada'  },
    EN_REVISION: { lbl: 'En revisión', cls: 'ce-revision'  },
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('view-cola')) return;

    const role = (localStorage.getItem('userRole') || '').toUpperCase();
    if (role !== 'ROLE_EMPLEADO') return;

    // Mostrar el tab solo para empleados
    const tabBtn = document.getElementById('tab-cola');
    if (tabBtn) tabBtn.style.display = '';

    initHeader('cola-sub', 'cola-avatar');
    setupPullToRefresh(document.getElementById('cola-list'), cargarCola);
    cargarCola();
});

// ── Data ─────────────────────────────────────────────────────
async function cargarCola() {
    mostrarLoadingCola(true);
    try {
        colaItems = await apiFetch(`${MOB_API}/mi-cola`) || [];
        renderCola();
        actualizarBadgeTab('cola', colaItems.reduce((s, g) => s + g.totalPendientes, 0));
    } catch {
        mobToast('Error cargando cola de análisis', 'error');
    } finally {
        mostrarLoadingCola(false);
    }
}

// ── Render ────────────────────────────────────────────────────
function renderCola() {
    const list  = document.getElementById('cola-list');
    const empty = document.getElementById('cola-empty');
    list.querySelectorAll('.cola-group').forEach(c => c.remove());

    if (!colaItems.length) {
        empty.style.display = 'flex';
        return;
    }
    empty.style.display = 'none';

    const anchor = list.querySelector('.scroll-end');
    colaItems.forEach(grupo => list.insertBefore(crearGrupoCola(grupo), anchor));
}

function crearGrupoCola(grupo) {
    const wrap = document.createElement('div');
    wrap.className = 'cola-group';

    const unidad = grupo.unidad ? `<span class="cola-unidad">${escHtml(grupo.unidad)}</span>` : '';

    const filas = grupo.muestras.map(m => {
        const cfg    = ESTADO_CFG[m.estado] || { lbl: m.estado, cls: '' };
        const fecha  = m.fechaEntrega ? formatFechaCola(m.fechaEntrega) : '';
        const cliente = m.clienteNombre ? `<div class="cola-cliente">${escHtml(m.clienteNombre)}${m.puntoMuestreo ? ' · ' + escHtml(m.puntoMuestreo) : ''}</div>` : '';
        const fechaHtml = fecha ? `<div class="cola-fecha">${fecha}</div>` : '';
        return `
          <div class="cola-muestra">
            <div class="cola-muestra-body">
              <div class="cola-proto">#${escHtml(m.nroProtocolo)}</div>
              ${cliente}
              ${fechaHtml}
            </div>
            <span class="cola-estado ${cfg.cls}">${cfg.lbl}</span>
          </div>`;
    }).join('');

    wrap.innerHTML = `
      <div class="cola-header">
        <div class="cola-param-info">
          <span class="cola-param-name">${escHtml(grupo.parametroNombre)}</span>
          ${unidad}
        </div>
        <span class="cola-count">${grupo.totalPendientes}</span>
      </div>
      ${filas}`;

    return wrap;
}

// ── Helpers ───────────────────────────────────────────────────
function formatFechaCola(iso) {
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
}

function mostrarLoadingCola(show) {
    const list = document.getElementById('cola-list');
    if (!list) return;
    list.querySelectorAll('.skel-card').forEach(c => c.remove());
    if (show) {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < 3; i++) frag.appendChild(crearSkelCola());
        list.prepend(frag);
    }
    const old = document.getElementById('cola-loading');
    if (old) old.style.display = 'none';
}

function crearSkelCola() {
    const widths = [72, 80, 65];
    const w = widths[Math.floor(Math.random() * 3)];
    const d = document.createElement('div');
    d.className = 'skel-card';
    d.innerHTML = `
      <div style="padding:12px 14px;border-bottom:1px solid rgba(128,128,128,.08);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="sh" style="height:14px;border-radius:4px;width:${w}px"></div>
          <div class="sh" style="height:18px;border-radius:9px;width:28px"></div>
        </div>
      </div>
      <div style="padding:10px 14px;display:flex;flex-direction:column;gap:6px;">
        <div class="sh" style="height:11px;border-radius:4px;width:40%"></div>
        <div class="sh" style="height:10px;border-radius:4px;width:60%"></div>
      </div>`;
    return d;
}
