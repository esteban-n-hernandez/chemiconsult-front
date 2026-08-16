"use strict";

// ── Estado ───────────────────────────────────────────────────
let stockItems    = [];
let stockFiltrado = [];
let filtroNivel   = '';
let busquedaStock = '';
let editandoStockId = null;
let nivelStock    = 'MEDIO';

const NIVEL_CFG = {
    BAJO:  { cls: 'snivel-bajo',  lbl: 'Bajo',  bar: 'sbar-bajo'  },
    MEDIO: { cls: 'snivel-medio', lbl: 'Medio', bar: 'sbar-medio' },
    ALTO:  { cls: 'snivel-alto',  lbl: 'Alto',  bar: 'sbar-alto'  },
};

const NIVEL_ORDER = { BAJO: 0, MEDIO: 1, ALTO: 2 };

const CAT_LABEL = {
    REACTIVOS:         'Reactivos',
    SOLVENTES:         'Solventes',
    MATERIAL_MUESTREO: 'Muestreo',
    MATERIAL_VIDRIO:   'Vidrio',
    OTROS:             'Otros',
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('view-stock')) return;

    const role = (localStorage.getItem('userRole') || '').toUpperCase();
    const mods = JSON.parse(localStorage.getItem('userModulos') || '[]');
    if (role !== 'ROLE_IT' && !mods.includes('STOCK')) return;

    initHeader('stock-sub', 'stock-avatar');
    setupStockFilters();
    setupStockForm();
    document.getElementById('fab-stock')?.addEventListener('click', abrirNuevoStock);
    setupPullToRefresh(document.getElementById('stock-list'), cargarStock);

    await cargarStock();
});

// ── Data ─────────────────────────────────────────────────────
async function cargarStock() {
    mostrarLoadingStock(true);
    try {
        stockItems = await apiFetch(`${MOB_API}/stock`) || [];
        aplicarFiltrosStock();
    } catch {
        mobToast('Error cargando stock', 'error');
    } finally {
        mostrarLoadingStock(false);
    }
}

// ── Filtros ───────────────────────────────────────────────────
function setupStockFilters() {
    document.getElementById('stock-search')?.addEventListener('input', function () {
        busquedaStock = this.value.trim().toLowerCase();
        aplicarFiltrosStock();
    });

    document.getElementById('stock-filter-chips')?.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        document.querySelectorAll('#stock-filter-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        filtroNivel = chip.dataset.nivel || '';
        aplicarFiltrosStock();
    });
}

function aplicarFiltrosStock() {
    stockFiltrado = stockItems.filter(item => {
        const matchNivel = !filtroNivel || item.nivel === filtroNivel;
        const q = busquedaStock;
        const matchBusq = !q
            || (item.nombre        || '').toLowerCase().includes(q)
            || (item.identificacion || '').toLowerCase().includes(q)
            || (item.descripcion   || '').toLowerCase().includes(q)
            || (item.ubicacion     || '').toLowerCase().includes(q);
        return matchNivel && matchBusq;
    });

    stockFiltrado.sort((a, b) =>
        (NIVEL_ORDER[a.nivel] ?? 3) - (NIVEL_ORDER[b.nivel] ?? 3));

    actualizarSubStock();
    actualizarContadoresChipsStock();
    actualizarBadgeTab('stock', stockItems.filter(i => i.nivel === 'BAJO').length);
    renderStock();
}

function actualizarSubStock() {
    const el = document.getElementById('stock-sub');
    if (!el) return;
    const bajo  = stockItems.filter(i => i.nivel === 'BAJO').length;
    const total = stockItems.length;
    const rawName = localStorage.getItem('username') || localStorage.getItem('userEmail') || '';
    const firstName = rawName.includes('@')
        ? rawName.split('@')[0].split(/[\._\-]/)[0]
        : rawName.split(' ')[0];
    const hour = new Date().getHours();
    const saludo = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
    const base = firstName ? `${saludo}, ${firstName}` : saludo;
    const partes = [];
    if (total) partes.push(`${total} ítem${total !== 1 ? 's' : ''}`);
    if (bajo)  partes.push(`⚠ ${bajo} bajo stock`);
    el.textContent = partes.length ? `${base} · ${partes.join(' · ')}` : base;
}

function actualizarContadoresChipsStock() {
    const counts = { BAJO: 0, MEDIO: 0, ALTO: 0 };
    stockItems.forEach(i => { if (i.nivel in counts) counts[i.nivel]++; });
    const total = stockItems.length;
    const labels = {
        '':     total          ? `Todos (${total})`          : 'Todos',
        'BAJO':  counts.BAJO   ? `⚠ Bajo ${counts.BAJO}`    : '⚠ Bajo',
        'MEDIO': counts.MEDIO  ? `~ Medio ${counts.MEDIO}`  : '~ Medio',
        'ALTO':  counts.ALTO   ? `✓ Alto ${counts.ALTO}`    : '✓ Alto',
    };
    document.querySelectorAll('#stock-filter-chips .chip').forEach(chip => {
        const n = chip.dataset.nivel;
        if (n in labels) chip.textContent = labels[n];
    });
}

// ── Render ────────────────────────────────────────────────────
function renderStock() {
    const list  = document.getElementById('stock-list');
    const empty = document.getElementById('stock-empty');
    list.querySelectorAll('.stock-card').forEach(c => c.remove());

    if (stockFiltrado.length === 0) {
        empty.style.display = 'flex';
        return;
    }
    empty.style.display = 'none';

    const anchor = list.querySelector('.scroll-end');
    stockFiltrado.forEach(item => list.insertBefore(crearCardStock(item), anchor));
}

function crearCardStock(item) {
    const card = document.createElement('div');
    card.className = 'stock-card';

    const nivelCfg = NIVEL_CFG[item.nivel] || NIVEL_CFG.MEDIO;
    const catLabel  = CAT_LABEL[item.categoria] || item.categoria;

    const meta = [];
    if (item.cantidadFrascos != null) meta.push(`${item.cantidadFrascos} frascos`);
    if (item.ubicacion) meta.push(item.ubicacion);

    card.innerHTML = `
      <div class="stock-inner" onclick="abrirEditarStock(${item.id})">
        <div class="sbar ${nivelCfg.bar}"></div>
        <div class="stock-body">
          <div class="stock-nombre">${escHtml(item.nombre)}</div>
          <div class="stock-badges">
            <span class="snivel-badge ${nivelCfg.cls}">${nivelCfg.lbl}</span>
            <span class="scat-badge">${escHtml(catLabel)}</span>
            ${item.identificacion ? `<span class="sid-badge">#${escHtml(item.identificacion)}</span>` : ''}
          </div>
          ${meta.length ? `<div class="stock-meta">${meta.map(escHtml).join(' · ')}</div>` : ''}
          ${item.descripcion ? `<div class="stock-desc">${escHtml(item.descripcion)}</div>` : ''}
        </div>
        <div class="stock-arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    `;
    return card;
}

// ── Abrir sheet nuevo / editar ────────────────────────────────
function abrirNuevoStock() {
    editandoStockId = null;
    document.getElementById('stock-form').reset();
    seleccionarNivelStock('MEDIO');
    document.getElementById('stock-sheet-title').textContent  = 'Nuevo ítem';
    document.getElementById('stock-submit-btn').textContent   = 'Agregar ítem';
    document.getElementById('stock-delete-btn').style.display = 'none';
    openSheet('stock-sheet');
    setTimeout(() => document.getElementById('sstock-nombre')?.focus(), 340);
}

function abrirEditarStock(id) {
    const item = stockItems.find(i => i.id === id);
    if (!item) return;
    editandoStockId = id;

    document.getElementById('stock-form').reset();
    document.getElementById('sstock-nombre').value      = item.nombre || '';
    document.getElementById('sstock-id').value          = item.identificacion || '';
    document.getElementById('sstock-categoria').value   = item.categoria || '';
    document.getElementById('sstock-cantidad').value    = item.cantidadFrascos != null ? item.cantidadFrascos : '';
    document.getElementById('sstock-ubicacion').value   = item.ubicacion || '';
    document.getElementById('sstock-descripcion').value = item.descripcion || '';
    document.getElementById('sstock-obs').value         = item.observaciones || '';
    seleccionarNivelStock(item.nivel || 'MEDIO');

    document.getElementById('stock-sheet-title').textContent  = 'Editar ítem';
    document.getElementById('stock-submit-btn').textContent   = 'Guardar cambios';
    document.getElementById('stock-delete-btn').style.display = 'flex';
    openSheet('stock-sheet');
}

// ── Nivel pills ───────────────────────────────────────────────
function seleccionarNivelStock(nivel) {
    nivelStock = nivel;
    ['ALTO', 'MEDIO', 'BAJO'].forEach(n => {
        document.getElementById(`snivel-${n}`)?.classList.toggle('active', n === nivel);
    });
}

// ── Formulario ────────────────────────────────────────────────
function setupStockForm() {
    document.getElementById('stock-sheet-cancel')?.addEventListener('click', () =>
        closeSheet('stock-sheet'));

    document.getElementById('stock-form')?.addEventListener('submit', async e => {
        e.preventDefault();

        const nombre    = document.getElementById('sstock-nombre').value.trim();
        const categoria = document.getElementById('sstock-categoria').value;
        if (!nombre)    { mobToast('El nombre es requerido', 'error'); return; }
        if (!categoria) { mobToast('Seleccioná una categoría', 'error'); return; }
        if (!nivelStock){ mobToast('Seleccioná un nivel de stock', 'error'); return; }

        const cantRaw = document.getElementById('sstock-cantidad').value;
        const payload = {
            nombre,
            categoria,
            nivel:           nivelStock,
            identificacion:  document.getElementById('sstock-id').value.trim() || null,
            cantidadFrascos: cantRaw !== '' ? parseInt(cantRaw, 10) : null,
            ubicacion:       document.getElementById('sstock-ubicacion').value.trim() || null,
            descripcion:     document.getElementById('sstock-descripcion').value.trim() || null,
            observaciones:   document.getElementById('sstock-obs').value.trim() || null,
        };

        const btn = document.getElementById('stock-submit-btn');
        btn.disabled = true;
        try {
            if (editandoStockId) {
                await apiFetch(`${MOB_API}/stock/${editandoStockId}`, {
                    method:  'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(payload),
                });
                mobToast('Ítem actualizado');
            } else {
                await apiFetch(`${MOB_API}/stock`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(payload),
                });
                mobToast('Ítem agregado');
            }
            closeSheet('stock-sheet');
            await cargarStock();
        } catch (err) {
            mobToast(err.message || 'Error al guardar', 'error');
        } finally {
            btn.disabled = false;
        }
    });

    document.getElementById('stock-delete-btn')?.addEventListener('click', async () => {
        if (!editandoStockId) return;
        if (!confirm('¿Eliminar este ítem? No se puede deshacer.')) return;
        try {
            await apiFetch(`${MOB_API}/stock/${editandoStockId}`, { method: 'DELETE' });
            stockItems = stockItems.filter(i => i.id !== editandoStockId);
            closeSheet('stock-sheet');
            aplicarFiltrosStock();
            mobToast('Ítem eliminado');
        } catch {
            mobToast('Error al eliminar', 'error');
        }
    });
}

// ── Skeleton loading ──────────────────────────────────────────
function mostrarLoadingStock(show) {
    const list = document.getElementById('stock-list');
    if (!list) return;
    list.querySelectorAll('.skel-card').forEach(c => c.remove());
    if (show) {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < 3; i++) frag.appendChild(crearSkelStock());
        list.prepend(frag);
    }
    const old = document.getElementById('stock-loading');
    if (old) old.style.display = 'none';
}

function crearSkelStock() {
    const widths = [[68,5],[76,6],[82,4]];
    const [w1, b2] = widths[Math.floor(Math.random() * 3)];
    const d = document.createElement('div');
    d.className = 'skel-card';
    d.innerHTML = `
      <div style="display:flex;padding:12px 12px 12px 0;align-items:stretch">
        <div class="sh" style="width:4px;flex-shrink:0;margin-right:10px;border-radius:0"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px">
          <div class="sh" style="height:13px;border-radius:4px;width:${w1}%"></div>
          <div style="display:flex;gap:5px">
            <div class="sh" style="height:18px;border-radius:10px;width:44px"></div>
            <div class="sh" style="height:18px;border-radius:10px;width:6${b2}px"></div>
          </div>
          <div class="sh" style="height:9px;border-radius:4px;width:44%"></div>
        </div>
        <div class="sh" style="width:14px;height:14px;border-radius:3px;flex-shrink:0;margin-left:10px;align-self:center"></div>
      </div>`;
    return d;
}
