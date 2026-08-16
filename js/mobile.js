"use strict";

// ── API base viene de config.js (API_BASE) ───────────────────
const MOB_API = `${API_BASE}/api`;

// ── Auth fetch ───────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
        ...opts,
        headers: { ...(opts.headers || {}), 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) { window.location.href = 'login.html'; return null; }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
}

// ── Header ───────────────────────────────────────────────────
function initHeader(subId, avatarId) {
    const rawName = localStorage.getItem('username') || localStorage.getItem('userEmail') || '';
    const firstName = rawName.includes('@')
        ? rawName.split('@')[0].split(/[\._\-]/)[0]
        : rawName.split(' ')[0];

    const hour = new Date().getHours();
    const saludo = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

    const elSub    = document.getElementById(subId);
    const elAvatar = document.getElementById(avatarId);
    if (elSub)    elSub.textContent    = firstName ? `${saludo}, ${firstName}` : saludo;
    if (elAvatar) elAvatar.textContent = getInitials(rawName);
}

// ── Toast ────────────────────────────────────────────────────
function mobToast(msg, type = 'ok') {
    const el = document.getElementById('mob-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `mob-toast show ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'mob-toast'; }, 3000);
}

// ── Tabs ─────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.tab-item').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.view').forEach(v =>
        v.classList.toggle('active', v.id === `view-${tab}`));
}

// ── Bottom sheet ─────────────────────────────────────────────
function openSheet(id) {
    document.getElementById(id).classList.add('open');
    document.getElementById('sheet-backdrop').classList.add('open');
}
function closeSheet(id) {
    document.getElementById(id).classList.remove('open');
    document.getElementById('sheet-backdrop').classList.remove('open');
}

// ── Utils ────────────────────────────────────────────────────
function getInitials(name) {
    if (!name) return '?';
    if (name.includes('@')) {
        const local = name.split('@')[0];
        const parts = local.split(/[\._\-]/);
        return (parts.length >= 2 ? parts[0][0] + parts[1][0] : local.substring(0, 2)).toUpperCase();
    }
    const parts = name.trim().split(' ');
    return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.substring(0, 2)).toUpperCase();
}

function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Badge en tabs ────────────────────────────────────────────
function actualizarBadgeTab(tab, count) {
    const btn = document.querySelector(`.tab-item[data-tab="${tab}"]`);
    if (!btn) return;
    btn.querySelector('.tab-badge')?.remove();
    if (count > 0) {
        const b = document.createElement('span');
        b.className = 'tab-badge';
        b.textContent = count > 99 ? '99+' : count;
        btn.appendChild(b);
    }
}

// ── Pull-to-refresh ──────────────────────────────────────────
function setupPullToRefresh(scrollEl, onRefresh) {
    if (!scrollEl) return;
    const THRESHOLD = 68;
    let startY = 0, startScroll = 0, ptrEl = null, refreshing = false;

    scrollEl.addEventListener('touchstart', e => {
        startY = e.touches[0].clientY;
        startScroll = scrollEl.scrollTop;
    }, { passive: true });

    scrollEl.addEventListener('touchmove', e => {
        if (refreshing || startScroll > 4) return;
        const dy = e.touches[0].clientY - startY;
        if (dy <= 0) { ptrEl?.remove(); ptrEl = null; return; }
        if (!ptrEl) {
            ptrEl = document.createElement('div');
            ptrEl.className = 'ptr-bar';
            scrollEl.prepend(ptrEl);
        }
        const pull  = Math.min(dy, THRESHOLD);
        const ready = pull >= THRESHOLD * 0.85;
        ptrEl.style.height  = (pull * 0.55) + 'px';
        ptrEl.style.opacity = (pull / THRESHOLD).toFixed(2);
        ptrEl.innerHTML = ready
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="18" x2="12" y2="6"/></svg> Soltar para actualizar'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="7 13 12 18 17 13"/><line x1="12" y1="6" x2="12" y2="18"/></svg> Actualizar';
    }, { passive: true });

    scrollEl.addEventListener('touchend', async e => {
        if (!ptrEl || refreshing) return;
        const dy = e.changedTouches[0].clientY - startY;
        if (dy >= THRESHOLD * 0.85 && startScroll <= 4) {
            refreshing = true;
            ptrEl.className = 'ptr-bar ptr-active';
            ptrEl.innerHTML = '<div class="ptr-spinner"></div>';
            await onRefresh().catch(() => {});
            ptrEl?.remove();
            refreshing = false;
        } else {
            ptrEl.remove();
        }
        ptrEl = null;
    });
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Ocultar tabs a los que el usuario no tiene acceso por módulo
    const role       = (localStorage.getItem('userRole') || '').toUpperCase();
    const userModulos = JSON.parse(localStorage.getItem('userModulos') || '[]');

    if (role !== 'ROLE_IT') {
        document.querySelectorAll('.tab-item[data-modulo]').forEach(btn => {
            if (!userModulos.includes(btn.dataset.modulo.toUpperCase())) {
                btn.style.display = 'none';
            }
        });
    }

    // Si la tab activa por defecto quedó oculta, activar la primera visible
    const activeBtn = document.querySelector('.tab-item.active');
    if (activeBtn && activeBtn.style.display === 'none') {
        const firstVisible = [...document.querySelectorAll('.tab-item')]
            .find(b => b.style.display !== 'none');
        if (firstVisible) switchTab(firstVisible.dataset.tab);
    }

    document.querySelectorAll('.tab-item').forEach(btn =>
        btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

    document.getElementById('sheet-backdrop')?.addEventListener('click', () => {
        document.querySelectorAll('.bottom-sheet.open')
            .forEach(s => s.classList.remove('open'));
        document.getElementById('sheet-backdrop').classList.remove('open');
    });

    // Avatar → perfil / cerrar sesión
    document.querySelectorAll('.header-avatar').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
            const rawName = localStorage.getItem('username') || localStorage.getItem('userEmail') || '';
            const email   = localStorage.getItem('userEmail') || '';
            document.getElementById('profile-avatar-big').textContent = getInitials(rawName);
            document.getElementById('profile-name').textContent  = rawName || '—';
            document.getElementById('profile-email').textContent = email || '—';
            openSheet('profile-sheet');
        });
    });

    document.getElementById('profile-sheet-close')?.addEventListener('click', () => closeSheet('profile-sheet'));

    document.getElementById('profile-logout-btn')?.addEventListener('click', () => {
        ['token', 'userEmail', 'userRole', 'userName', 'userId', 'userModulos', 'username'].forEach(k =>
            localStorage.removeItem(k));
        window.location.href = 'login.html';
    });
});
