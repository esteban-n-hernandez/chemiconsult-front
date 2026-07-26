const API_URL = `${API_BASE}/api/users`;
const TOKEN   = () => localStorage.getItem('token');

let todosLosUsuarios  = [];
let usuariosFiltrados = [];
let paginaActual      = 1;
const ITEMS_POR_PAGINA = 10;

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    cargarUsuarios();
    initModalUsuario();
    initModalReset();
    initModalEliminar();

    document.getElementById('inputBusqueda')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') buscarUsuarios();
    });
});

// ══════════════════════════════════════════
//  CARGAR Y RENDERIZAR
// ══════════════════════════════════════════
async function cargarUsuarios() {
    try {
        const res = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${TOKEN()}` }
        });
        if (!res.ok) throw new Error();
        todosLosUsuarios = await res.json();
        paginaActual     = 1;
        buscarUsuarios();
    } catch {
        mostrarToast('Error al cargar usuarios', 'danger');
    }
}

function renderTabla() {
    const tbody     = document.getElementById('tablaUsuarios');
    const sinResult = document.getElementById('sinResultados');
    const inicio    = (paginaActual - 1) * ITEMS_POR_PAGINA;
    const fin       = inicio + ITEMS_POR_PAGINA;
    const pagina    = usuariosFiltrados.slice(inicio, fin);

    if (usuariosFiltrados.length === 0) {
        tbody.innerHTML = '';
        sinResult.style.display = 'block';
        document.getElementById('infoPaginacion').textContent = 'Sin resultados';
        document.getElementById('paginacion').innerHTML       = '';
        return;
    }

    sinResult.style.display = 'none';

    tbody.innerHTML = pagina.map((u, i) => {
        const rolBadge = u.rol === 'ROLE_IT'
            ? `<span class="badge-tipo badge-empresa"><i class="bi bi-shield-lock"></i> IT</span>`
            : `<span class="badge-tipo badge-persona"><i class="bi bi-person-workspace"></i> Empleado</span>`;

        return `
            <tr>
                <td>${inicio + i + 1}</td>
                <td><strong>${u.username ?? '—'}</strong></td>
                <td>${u.email ?? '—'}</td>
                <td>${rolBadge}</td>
                <td style="display:flex;gap:4px;flex-wrap:wrap;">
                    <button class="btn-accion" title="Editar" onclick="abrirModalEditar(${u.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-accion" title="Restablecer contraseña" onclick="abrirModalReset(${u.id})">
                        <i class="bi bi-key"></i>
                    </button>
                    <button class="btn-accion danger" title="Eliminar" onclick="abrirModalEliminar(${u.id})">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('infoPaginacion').textContent =
        `Mostrando ${inicio + 1}–${Math.min(fin, usuariosFiltrados.length)} de ${usuariosFiltrados.length} usuarios`;

    renderPaginacion();
}

function renderPaginacion() {
    const total = Math.ceil(usuariosFiltrados.length / ITEMS_POR_PAGINA);
    const ul    = document.getElementById('paginacion');
    ul.innerHTML = Array.from({ length: total }, (_, i) => i + 1).map(n => `
        <li class="${n === paginaActual ? 'active' : ''}">
            <button onclick="irAPagina(${n})">${n}</button>
        </li>
    `).join('');
}

function irAPagina(n) {
    paginaActual = n;
    renderTabla();
}

// ══════════════════════════════════════════
//  FILTROS
// ══════════════════════════════════════════
function buscarUsuarios() {
    const texto = document.getElementById('inputBusqueda').value.toLowerCase();
    const rol   = document.getElementById('selectRol').value;

    usuariosFiltrados = todosLosUsuarios.filter(u => {
        const matchTexto = !texto ||
            u.username?.toLowerCase().includes(texto) ||
            u.email?.toLowerCase().includes(texto);
        return matchTexto && (!rol || u.rol === rol);
    });

    paginaActual = 1;
    renderTabla();
}

function limpiarFiltros() {
    document.getElementById('inputBusqueda').value = '';
    document.getElementById('selectRol').value     = '';
    paginaActual = 1;
    buscarUsuarios();
}

// ══════════════════════════════════════════
//  MODAL NUEVO / EDITAR USUARIO
// ══════════════════════════════════════════
let usuarioEditandoId = null;

function initModalUsuario() {
    document.getElementById('btnNuevoUsuario').addEventListener('click', abrirModalNuevo);
    document.getElementById('modalUsuarioClose').addEventListener('click', cerrarModalUsuario);
    document.getElementById('btnCancelarUsuario').addEventListener('click', cerrarModalUsuario);
    document.getElementById('formUsuario').addEventListener('submit', e => {
        e.preventDefault();
        submitUsuario();
    });
    document.getElementById('modalUsuario').addEventListener('click', e => {
        if (e.target === document.getElementById('modalUsuario')) cerrarModalUsuario();
    });
}

function abrirModalNuevo() {
    usuarioEditandoId = null;
    document.getElementById('modalUsuarioTitulo').innerHTML = `<i class="bi bi-person-plus"></i> Nuevo usuario`;
    document.getElementById('formUsuario').reset();
    document.getElementById('grupoPasword').style.display        = '';
    document.getElementById('grupoConfirmarPassword').style.display = '';
    document.getElementById('btnGuardarUsuario').innerHTML = `<i class="bi bi-check-lg"></i> Guardar`;
    ocultarErrorServidor('usuarioErrorServidor');
    limpiarErroresUsuario();
    document.getElementById('modalUsuario').classList.add('visible');
    document.getElementById('uNombre').focus();
}

function abrirModalEditar(id) {
    const u = todosLosUsuarios.find(x => x.id === id);
    if (!u) return;

    usuarioEditandoId = id;
    document.getElementById('modalUsuarioTitulo').innerHTML = `<i class="bi bi-pencil"></i> Editar usuario`;
    document.getElementById('uNombre').value = u.username ?? '';
    document.getElementById('uEmail').value  = u.email    ?? '';
    document.getElementById('uRol').value    = u.rol      ?? 'ROLE_EMPLEADO';

    // En edición no se cambia la contraseña desde acá
    document.getElementById('grupoPasword').style.display           = 'none';
    document.getElementById('grupoConfirmarPassword').style.display = 'none';

    ocultarErrorServidor('usuarioErrorServidor');
    limpiarErroresUsuario();
    document.getElementById('modalUsuario').classList.add('visible');
    document.getElementById('uNombre').focus();
}

function cerrarModalUsuario() {
    document.getElementById('modalUsuario').classList.remove('visible');
    usuarioEditandoId = null;
}

async function submitUsuario() {
    limpiarErroresUsuario();
    ocultarErrorServidor('usuarioErrorServidor');

    const nombre   = document.getElementById('uNombre').value.trim();
    const email    = document.getElementById('uEmail').value.trim();
    const rol      = document.getElementById('uRol').value;
    const esNuevo  = usuarioEditandoId === null;

    let valido = true;
    if (!nombre) { mostrarErrorCampo('errUNombre', 'uNombre'); valido = false; }
    if (!email)  { mostrarErrorCampo('errUEmail',  'uEmail');  valido = false; }

    if (esNuevo) {
        const pwd  = document.getElementById('uPassword').value;
        const pwd2 = document.getElementById('uPasswordConfirmar').value;
        if (!pwd || pwd.length < 6) { mostrarErrorCampo('errUPassword', 'uPassword'); valido = false; }
        if (pwd !== pwd2)           { mostrarErrorCampo('errUPasswordConfirmar', 'uPasswordConfirmar'); valido = false; }
    }
    if (!valido) return;

    const btn = document.getElementById('btnGuardarUsuario');
    btn.disabled  = true;
    btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Guardando...`;

    try {
        let res;
        if (esNuevo) {
            res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN()}` },
                body: JSON.stringify({
                    username: nombre,
                    email,
                    password: document.getElementById('uPassword').value,
                    rol
                })
            });
        } else {
            res = await fetch(`${API_URL}/${usuarioEditandoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN()}` },
                body: JSON.stringify({ username: nombre, email })
            });
        }

        if (!res.ok) {
            const err = await res.text();
            mostrarErrorServidor('usuarioErrorServidor', err || 'No se pudo guardar el usuario');
            return;
        }

        cerrarModalUsuario();
        await cargarUsuarios();
        mostrarToast(esNuevo ? 'Usuario creado correctamente ✓' : 'Usuario actualizado ✓', 'success');

    } catch {
        mostrarErrorServidor('usuarioErrorServidor', 'Error de conexión. Intentá nuevamente.');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = `<i class="bi bi-check-lg"></i> Guardar`;
    }
}

// ══════════════════════════════════════════
//  MODAL RESET CONTRASEÑA
// ══════════════════════════════════════════
let usuarioResetId = null;

function initModalReset() {
    document.getElementById('modalResetClose').addEventListener('click', cerrarModalReset);
    document.getElementById('btnCancelarReset').addEventListener('click', cerrarModalReset);
    document.getElementById('formReset').addEventListener('submit', e => {
        e.preventDefault();
        confirmarReset();
    });
    document.getElementById('modalResetPassword').addEventListener('click', e => {
        if (e.target === document.getElementById('modalResetPassword')) cerrarModalReset();
    });
}

function abrirModalReset(id) {
    const u = todosLosUsuarios.find(x => x.id === id);
    if (!u) return;

    usuarioResetId = id;
    document.getElementById('resetUsuarioNombre').textContent = u.username ?? u.email;
    document.getElementById('resetPassword').value = '';
    document.getElementById('resetPasswordConfirmar').value = '';
    limpiarErroresReset();
    ocultarErrorServidor('resetErrorServidor');
    document.getElementById('modalResetPassword').classList.add('visible');
    document.getElementById('resetPassword').focus();
}

function cerrarModalReset() {
    document.getElementById('modalResetPassword').classList.remove('visible');
    usuarioResetId = null;
}

async function confirmarReset() {
    limpiarErroresReset();
    ocultarErrorServidor('resetErrorServidor');

    const pwd  = document.getElementById('resetPassword').value;
    const pwd2 = document.getElementById('resetPasswordConfirmar').value;

    let valido = true;
    if (!pwd || pwd.length < 6) { mostrarErrorCampo('errResetPassword', 'resetPassword'); valido = false; }
    if (pwd !== pwd2)           { mostrarErrorCampo('errResetPasswordConfirmar', 'resetPasswordConfirmar'); valido = false; }
    if (!valido) return;

    const btn = document.getElementById('btnConfirmarReset');
    btn.disabled  = true;
    btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Restableciendo...`;

    try {
        const res = await fetch(`${API_URL}/${usuarioResetId}/reset-password`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN()}` },
            body: JSON.stringify({ passwordNueva: pwd })
        });

        if (!res.ok) {
            const err = await res.text();
            mostrarErrorServidor('resetErrorServidor', err || 'No se pudo restablecer la contraseña');
            return;
        }

        cerrarModalReset();
        mostrarToast('Contraseña restablecida correctamente ✓', 'success');

    } catch {
        mostrarErrorServidor('resetErrorServidor', 'Error de conexión. Intentá nuevamente.');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = `<i class="bi bi-key"></i> Restablecer`;
    }
}

// ══════════════════════════════════════════
//  MODAL ELIMINAR USUARIO
// ══════════════════════════════════════════
let usuarioEliminarId = null;

function initModalEliminar() {
    document.getElementById('modalEliminarClose').addEventListener('click', cerrarModalEliminar);
    document.getElementById('btnCancelarEliminar').addEventListener('click', cerrarModalEliminar);
    document.getElementById('btnConfirmarEliminar').addEventListener('click', confirmarEliminar);
    document.getElementById('modalEliminarUsuario').addEventListener('click', e => {
        if (e.target === document.getElementById('modalEliminarUsuario')) cerrarModalEliminar();
    });
}

function abrirModalEliminar(id) {
    const u = todosLosUsuarios.find(x => x.id === id);
    if (!u) return;

    usuarioEliminarId = id;
    document.getElementById('eliminarUsuarioNombre').textContent = u.username ?? u.email;
    document.getElementById('modalEliminarUsuario').classList.add('visible');
}

function cerrarModalEliminar() {
    document.getElementById('modalEliminarUsuario').classList.remove('visible');
    usuarioEliminarId = null;
}

async function confirmarEliminar() {
    if (!usuarioEliminarId) return;

    const btn = document.getElementById('btnConfirmarEliminar');
    btn.disabled  = true;
    btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Eliminando...`;

    try {
        const res = await fetch(`${API_URL}/${usuarioEliminarId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${TOKEN()}` }
        });
        if (!res.ok) throw new Error();

        cerrarModalEliminar();
        await cargarUsuarios();
        mostrarToast('Usuario eliminado', 'success');

    } catch {
        mostrarToast('Error al eliminar usuario', 'danger');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = `<i class="bi bi-person-x"></i> Eliminar`;
    }
}

// ══════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════
function mostrarErrorCampo(errId, inputId) {
    document.getElementById(errId)?.classList.add('visible');
    document.getElementById(inputId)?.classList.add('error');
}

function limpiarErroresUsuario() {
    ['errUNombre', 'errUEmail', 'errUPassword', 'errUPasswordConfirmar'].forEach(id =>
        document.getElementById(id)?.classList.remove('visible')
    );
    ['uNombre', 'uEmail', 'uPassword', 'uPasswordConfirmar'].forEach(id =>
        document.getElementById(id)?.classList.remove('error')
    );
}

function limpiarErroresReset() {
    ['errResetPassword', 'errResetPasswordConfirmar'].forEach(id =>
        document.getElementById(id)?.classList.remove('visible')
    );
    ['resetPassword', 'resetPasswordConfirmar'].forEach(id =>
        document.getElementById(id)?.classList.remove('error')
    );
}

function mostrarErrorServidor(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent   = msg;
    el.style.display = 'block';
}

function ocultarErrorServidor(elId) {
    const el = document.getElementById(elId);
    if (el) el.style.display = 'none';
}

function mostrarToast(msg, tipo = 'success') {
    const iconMap = {
        success: 'bi-check-circle-fill',
        danger:  'bi-x-circle-fill',
        warning: 'bi-exclamation-circle-fill'
    };
    const toast = document.getElementById('toastConfirm');
    const icon  = document.getElementById('toastIcon');
    icon.className = `bi ${iconMap[tipo] || iconMap.success} ${tipo}`;
    document.getElementById('toastMsg').textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3500);
}
