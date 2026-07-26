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
    const esIT      = rol === "ROLE_IT";

    const link = (href, icon, label) => `
        <a href="${href}" class="${paginaActual === href ? 'active' : ''}" title="${label}">
            <i class="bi ${icon}"></i><span class="sidebar-label"> ${label}</span>
        </a>`;

    const linksEmpleado = `
        ${link('dashboard-empleado.html', 'bi-speedometer2',          'Dashboard')}
        ${link('task.html',               'bi-list-task',              'Tareas')}
        ${link('muestras.html',           'bi-file-earmark-medical',   'Muestras')}
        ${link('clientes.html',           'bi-people',                 'Clientes')}
        ${link('stock.html',              'bi-box-seam',               'Stock')}
        ${link('panel-tecnico.html',      'bi-gear-fill',              'Panel Técnico')}
        ${link('facturacion.html',        'bi-receipt',                'Facturación')}
        ${esIT ? link('usuarios.html',    'bi-shield-lock',            'Usuarios') : ''}
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
                <button class="sidebar-collapse-btn" id="sidebarToggle" title="Colapsar">
                    <i class="bi bi-chevron-left"></i>
                    <span class="sidebar-label"> Colapsar</span>
                </button>
                ${link('perfil.html', 'bi-person-circle', 'Perfil')}
                <a href="#" id="logout-btn" title="Cerrar sesión">
                    <i class="bi bi-box-arrow-right"></i><span class="sidebar-label"> Cerrar sesión</span>
                </a>
            </div>
        </div>
    `;

    document.getElementById("logout-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        ["token", "userEmail", "userRole", "userName"].forEach((k) =>
            localStorage.removeItem(k)
        );
        window.location.href = "login.html";
    });

    const SIDEBAR_KEY = "chemiconsult_sidebar_collapsed";

    function applySidebarCollapse() {
        const collapsed = localStorage.getItem(SIDEBAR_KEY) === "1";
        const sidebar = document.querySelector(".sidebar");
        const btn = document.getElementById("sidebarToggle");
        if (!sidebar || !btn) return;
        sidebar.classList.toggle("collapsed", collapsed);
        const icon = btn.querySelector("i");
        const label = btn.querySelector(".sidebar-label");
        if (icon) icon.className = `bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`;
        if (label) label.textContent = collapsed ? " Expandir" : " Colapsar";
        btn.title = collapsed ? "Expandir sidebar" : "Colapsar sidebar";
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
    const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const el = id => document.getElementById(id);
    if (el('header-nombre')) el('header-nombre').textContent = nombre;
    if (el('header-rol'))    el('header-rol').textContent    = rol === 'ROLE_IT' ? 'IT' : 'Empleado';
    if (el('header-avatar')) el('header-avatar').textContent = iniciales;
    if (el('fecha-hoy'))     el('fecha-hoy').textContent     = hoy.charAt(0).toUpperCase() + hoy.slice(1);
}

