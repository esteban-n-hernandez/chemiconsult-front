// Aplicar tema lo antes posible para evitar flash (default: claro)
(function () {
    const saved = localStorage.getItem('chemiconsult_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
})();

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("sidebar-container");
    if (!container) return;

    // Widget de mensajería — solo para empleados/IT, no para clientes
    const rolActual = (localStorage.getItem("userRole") || "").toUpperCase();
    if (rolActual !== "ROLE_CLIENTE" && !document.getElementById("chatFab")) {
        const chatScript = document.createElement("script");
        chatScript.src = "js/chat.js";
        document.body.appendChild(chatScript);
    }

    if (!document.querySelector('link[href*="bootstrap-icons"]')) {
        const biLink = document.createElement("link");
        biLink.rel = "stylesheet";
        biLink.href = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css";
        document.head.appendChild(biLink);
    }

    const pathname = window.location.pathname;
    const paginaActual = pathname.substring(pathname.lastIndexOf("/") + 1) || "dashboard-empleado.html";
    const rol = (localStorage.getItem("userRole") || "").toUpperCase();
    const esCliente = rol === "ROLE_CLIENTE";
    const esIT = rol === "ROLE_IT";

    const userModulos = esIT
        ? null  // IT ve todo — no filtraT
        : JSON.parse(localStorage.getItem("userModulos") || "[]");

    const puedeVer = (modulo) => esIT || (userModulos && userModulos.includes(modulo));

    const SIDEBAR_ORDER_KEY = "chemiconsult_sidebar_order";

    const link = (href, icon, label) => `
        <a href="${href}" class="${paginaActual === href ? 'active' : ''}" title="${label}">
            <i class="bi ${icon}"></i><span class="sidebar-label"> ${label}</span>
        </a>`;

    // Links reordenables (Dashboard excluido — siempre primero)
    const ALL_LINKS = [
        { key: 'AGENDA',        href: 'agenda.html',        icon: 'bi-calendar-check',       label: 'Agenda' },
        { key: 'CLIENTES',      href: 'clientes.html',      icon: 'bi-people',               label: 'Clientes' },
        { key: 'DOCUMENTOS',    href: 'documentos.html',    icon: 'bi-folder2-open',         label: 'Documentación' },
        { key: 'FACTURACION',   href: 'facturacion.html',   icon: 'bi-receipt',              label: 'Facturación' },
        { key: 'MUESTRAS',      href: 'muestras.html',      icon: 'bi-file-earmark-medical', label: 'Muestras' },
        { key: 'PANEL_TECNICO', href: 'panel-tecnico.html', icon: 'bi-gear-fill',            label: 'Panel Técnico' },
        { key: 'COLA_ANALISIS', href: 'cola-analisis.html', icon: 'bi-collection',           label: 'Parámetros a Analizar' },
        { key: 'PRESUPUESTO',   href: 'presupuesto.html',   icon: 'bi-file-earmark-text',    label: 'Presupuestos' },
        { key: 'STOCK',         href: 'stock.html',         icon: 'bi-box-seam',             label: 'Stock' },
        { key: 'TAREAS',        href: 'task.html',          icon: 'bi-list-task',            label: 'Tareas' },
        { key: 'USUARIOS',      href: 'usuarios.html',      icon: 'bi-shield-lock',          label: 'Usuarios' },
    ];

    const savedOrder = JSON.parse(localStorage.getItem(SIDEBAR_ORDER_KEY) || 'null');
    if (savedOrder && Array.isArray(savedOrder)) {
        ALL_LINKS.sort((a, b) => {
            const ia = savedOrder.indexOf(a.key);
            const ib = savedOrder.indexOf(b.key);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });
    }

    const orderedLinksHtml = ALL_LINKS
        .filter(l => puedeVer(l.key))
        .map(l => `<a href="${l.href}" class="${paginaActual === l.href ? 'active' : ''}" title="${l.label}" data-key="${l.key}" draggable="true">
            <i class="bi ${l.icon}"></i><span class="sidebar-label"> ${l.label}</span>
        </a>`)
        .join('');

    const linksEmpleado = `
        ${puedeVer('DASHBOARD') ? link('dashboard-empleado.html', 'bi-speedometer2', 'Dashboard') : ''}
        ${orderedLinksHtml}
    `;

    const linksCliente = `
        ${link('dashboard-cliente.html', 'bi-house', 'Mi portal')}
    `;

    container.innerHTML = `
        <div class="sidebar">
            <div class="sidebar-logo">
                <h2>CHEMICONSULT</h2>
                <p>Laboratorio de análisis</p>
            </div>

            <nav class="sidebar-nav">
                ${esCliente ? linksCliente : linksEmpleado}
            </nav>

            <div class="sidebar-bottom">
                <hr class="sidebar-divider"/>
                <button class="sidebar-collapse-btn" id="themeToggle" title="Cambiar tema">
                    <i class="bi bi-moon"></i>
                    <span class="sidebar-label"> Modo oscuro</span>
                </button>
                <button class="sidebar-collapse-btn" id="sidebarToggle" title="Ocultar">
                    <i class="bi bi-chevron-left"></i>
                    <span class="sidebar-label"> Ocultar</span>
                </button>
                ${link('perfil.html', 'bi-person-circle', 'Perfil')}
                <a href="#" id="logout-btn" title="Cerrar sesión">
                    <i class="bi bi-box-arrow-right"></i><span class="sidebar-label"> Cerrar sesión</span>
                </a>
            </div>
        </div>
    `;

    // ── Drag & drop reorder ──────────────────────────────────────
    if (!esCliente) {
        const nav = container.querySelector('.sidebar-nav');
        let dragSrc = null;

        nav.querySelectorAll('a[draggable="true"]').forEach(el => {
            el.addEventListener('dragstart', e => {
                dragSrc = el;
                el.classList.add('sidebar-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            el.addEventListener('dragend', () => {
                dragSrc = null;
                nav.querySelectorAll('a').forEach(a => a.classList.remove('sidebar-dragging', 'sidebar-drag-over'));
                // Guardar orden nuevo
                const order = [...nav.querySelectorAll('a[data-key]')].map(a => a.dataset.key);
                localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(order));
            });
            el.addEventListener('dragover', e => {
                e.preventDefault();
                if (dragSrc && el !== dragSrc) {
                    nav.querySelectorAll('a').forEach(a => a.classList.remove('sidebar-drag-over'));
                    el.classList.add('sidebar-drag-over');
                }
            });
            el.addEventListener('dragleave', () => el.classList.remove('sidebar-drag-over'));
            el.addEventListener('drop', e => {
                e.preventDefault();
                e.stopPropagation();
                if (dragSrc && dragSrc !== el) {
                    const items = [...nav.querySelectorAll('a')];
                    const srcIdx = items.indexOf(dragSrc);
                    const dstIdx = items.indexOf(el);
                    if (srcIdx < dstIdx) el.after(dragSrc);
                    else el.before(dragSrc);
                }
                el.classList.remove('sidebar-drag-over');
            });
        });
    }

    document.getElementById("logout-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        ["token", "userEmail", "userRole", "userName", "userId", "userModulos"].forEach((k) =>
            localStorage.removeItem(k)
        );
        window.location.href = "login.html";
    });

    const THEME_KEY = "chemiconsult_theme";
    const SIDEBAR_KEY = "chemiconsult_sidebar_collapsed";

    function getEffectiveTheme() {
        return localStorage.getItem(THEME_KEY) || 'light';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
        const btn = document.getElementById('themeToggle');
        if (!btn) return;
        const icon = btn.querySelector('i');
        const label = btn.querySelector('.sidebar-label');
        const isDark = theme === 'dark';
        if (icon) icon.className = `bi ${isDark ? 'bi-sun' : 'bi-moon'}`;
        if (label) label.textContent = isDark ? ' Modo claro' : ' Modo oscuro';
        btn.title = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    }

    document.getElementById('themeToggle')?.addEventListener('click', () => {
        const current = getEffectiveTheme();
        applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    applyTheme(getEffectiveTheme());

    function applySidebarCollapse() {
        const collapsed = localStorage.getItem(SIDEBAR_KEY) === "1";
        const sidebar = document.querySelector(".sidebar");
        const btn = document.getElementById("sidebarToggle");
        if (!sidebar || !btn) return;
        sidebar.classList.toggle("collapsed", collapsed);
        const icon = btn.querySelector("i");
        const label = btn.querySelector(".sidebar-label");
        if (icon) icon.className = `bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`;
        if (label) label.textContent = collapsed ? " Expandir" : " Ocultar";
        btn.title = collapsed ? "Expandir sidebar" : "Ocultar sidebar";
    }

    document.getElementById("sidebarToggle")?.addEventListener("click", () => {
        const current = localStorage.getItem(SIDEBAR_KEY) === "1";
        localStorage.setItem(SIDEBAR_KEY, current ? "0" : "1");
        applySidebarCollapse();
    });

    applySidebarCollapse();
});

function inicializarHeader() {
    const nombre = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Usuario';
    const rol = (localStorage.getItem('userRole') || '').toUpperCase();
    const iniciales = nombre.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
    const hoy = new Date().toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const el = id => document.getElementById(id);
    if (el('header-nombre')) el('header-nombre').textContent = nombre;
    if (el('header-rol')) el('header-rol').textContent = rol === 'ROLE_IT' ? 'IT' : 'Empleado';
    if (el('header-avatar')) el('header-avatar').textContent = iniciales;
    if (el('fecha-hoy')) el('fecha-hoy').textContent = hoy.charAt(0).toUpperCase() + hoy.slice(1);

}

