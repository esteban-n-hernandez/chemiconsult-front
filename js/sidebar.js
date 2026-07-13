document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("sidebar-container");
    if (!container) return;

    // Detectamos en qué página estamos parado leyendo la URL
    const pathname = window.location.pathname;
    const paginaActual = pathname.substring(pathname.lastIndexOf("/") + 1) || "dashboard-empleado.html";

    // Inyectamos el HTML exacto de tu Sidebar con tu diseño premium
    container.innerHTML = `
        <div class="sidebar">
            <div class="sidebar-logo">
                <h2>CHEMICONSULT</h2>
                <p>Laboratorio de análisis</p>
            </div>

            <a href="dashboard-empleado.html" class="${paginaActual === 'dashboard-empleado.html' ? 'active' : ''}">
                <i class="bi bi-speedometer2"></i> Dashboard
            </a>

            <a href="task.html" class="${paginaActual === 'task.html' ? 'active' : ''}"> 
                <i class="bi bi-list-task"></i> Tareas
            </a>

            <a href="perfil.html" class="${paginaActual === 'perfil.html' ? 'active' : ''}">
                <i class="bi bi-person-circle"></i> Perfil
            </a>

            <a href="muestras.html" class="${paginaActual === 'muestras.html' ? 'active' : ''}">
                <i class="bi bi-file-earmark-medical"></i> Muestras
            </a>

            <a href="panel-tecnico.html" class="${paginaActual === 'panel-tecnico.html' ? 'active' : ''}">
                <i class="bi bi-gear-fill"></i> Panel Técnico
            </a>

            <a href="clientes.html" class="${paginaActual === 'clientes.html' ? 'active' : ''}">
                <i class="bi bi-people"></i> Clientes
            </a>
            
            <a href="facturacion.html" class="${paginaActual === 'facturacion.html' ? 'active' : ''}">
                <i class="bi bi-receipt"></i> Facturación
            </a>

            <hr class="sidebar-divider"/>

            <div class="sidebar-bottom">
                <a href="#" id="logout-btn">
                    <i class="bi bi-box-arrow-right"></i> Cerrar sesión
                </a>
            </div>
        </div>
    `;

    // Configurar el comportamiento del botón de Logout (lo centralizamos acá)
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            ["token", "userEmail", "userRole", "userName"].forEach((k) =>
                localStorage.removeItem(k)
            );
            window.location.href = "login.html";
        });
    }
});

