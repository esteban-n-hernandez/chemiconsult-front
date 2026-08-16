// ── Refresh silencioso ────────────────────────────────────────────────────────

let _refreshTimer = null;

function scheduleTokenRefresh(token) {
    if (_refreshTimer) clearTimeout(_refreshTimer);

    let payload;
    try {
        payload = JSON.parse(atob(token.split('.')[1]));
    } catch {
        return;
    }

    // Refrescar 5 minutos antes de que expire
    const msUntilRefresh = payload.exp * 1000 - Date.now() - 5 * 60 * 1000;

    if (msUntilRefresh <= 0) {
        doTokenRefresh();
    } else {
        _refreshTimer = setTimeout(doTokenRefresh, msUntilRefresh);
    }
}

async function doTokenRefresh() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.token);
            scheduleTokenRefresh(data.token);
        } else {
            // Token expirado — redirigir al login
            localStorage.clear();
            window.location.replace('login.html');
        }
    } catch {
        // Error de red: no cerrar sesión, intentar de nuevo en 1 minuto
        _refreshTimer = setTimeout(doTokenRefresh, 60 * 1000);
    }
}

// ── Guard de acceso ───────────────────────────────────────────────────────────

(function () {
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.replace('login.html');
        return;
    }

    const role   = (localStorage.getItem('userRole') || '').toUpperCase();
    const script = document.currentScript;

    // Chequeo de rol
    const rolesAttr = script && script.getAttribute('data-roles');
    if (rolesAttr) {
        const allowed = rolesAttr.split(',').map(r => r.trim().toUpperCase());
        if (!allowed.includes(role)) {
            window.location.replace('unauthorized.html');
            return;
        }
    }

    // Chequeo de módulo (IT siempre pasa; múltiples módulos separados por coma = OR)
    const moduloAttr = script && script.getAttribute('data-modulo');
    if (moduloAttr && role !== 'ROLE_IT') {
        const userModulos  = JSON.parse(localStorage.getItem('userModulos') || '[]');
        const requeridos   = moduloAttr.split(',').map(m => m.trim().toUpperCase());
        if (!requeridos.some(m => userModulos.includes(m))) {
            window.location.replace('unauthorized.html');
            return;
        }
    }

    scheduleTokenRefresh(token);
})();
