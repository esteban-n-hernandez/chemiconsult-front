(function () {
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.replace('login.html');
        return;
    }

    const rolesAttr = document.currentScript && document.currentScript.getAttribute('data-roles');
    if (rolesAttr) {
        const allowed = rolesAttr.split(',').map(r => r.trim().toUpperCase());
        const role = (localStorage.getItem('userRole') || '').toUpperCase();
        if (!allowed.includes(role)) {
            window.location.replace('unauthorized.html');
        }
    }
})();
