document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("sidebar-container");
    if (!container) return;

    const pathname = window.location.pathname;
    const paginaActual = pathname.substring(pathname.lastIndexOf("/") + 1) || "dashboard-empleado.html";
    const rol = (localStorage.getItem("userRole") || "").toUpperCase();
    const esCliente = rol === "ROLE_CLIENTE";

    const link = (href, icon, label) => `
        <a href="${href}" class="${paginaActual === href ? 'active' : ''}">
            <i class="bi ${icon}"></i> ${label}
        </a>`;

    const linksEmpleado = `
        ${link('dashboard-empleado.html', 'bi-speedometer2', 'Dashboard')}
        ${link('task.html',               'bi-list-task',    'Tareas')}
        ${link('muestras.html',           'bi-file-earmark-medical', 'Muestras')}
        ${link('clientes.html',           'bi-people',       'Clientes')}
        ${link('stock.html',              'bi-box-seam',     'Stock')}
        ${link('panel-tecnico.html',      'bi-gear-fill',    'Panel Técnico')}
        ${link('facturacion.html',        'bi-receipt',      'Facturación')}
        ${link('perfil.html',             'bi-person-circle','Perfil')}
    `;

    const linksCliente = `
        ${link('dashboard-cliente.html', 'bi-house', 'Mi portal')}
        ${link('perfil.html',            'bi-person-circle', 'Mi perfil')}
    `;

    container.innerHTML = `
        <div class="sidebar">
            <div class="sidebar-logo">
                <h2>CHEMICONSULT</h2>
                <p>Laboratorio de análisis</p>
            </div>

            ${esCliente ? linksCliente : linksEmpleado}

            <hr class="sidebar-divider"/>
            <div class="sidebar-bottom">
                <a href="#" id="logout-btn">
                    <i class="bi bi-box-arrow-right"></i> Cerrar sesión
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
});

