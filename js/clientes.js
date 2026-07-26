const API_URL = `${API_BASE}/api/clientes`;
const TOKEN   = () => localStorage.getItem('token');

let todosLosClientes  = [];
let clientesFiltrados = [];
let paginaActual      = 1;
const ITEMS_POR_PAGINA = 10;

// ── NUEVO: variable que indica si estamos editando ──
let clienteEditandoId = null;

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    const rol = (localStorage.getItem('userRole') || '').toUpperCase();
    if (!localStorage.getItem('token') || rol === 'ROLE_CLIENTE') {
        window.location.href = 'login.html';
    }

    inicializarHeader();
    cargarClientes();
    initModalBaja();
    initModalReactivar();
    initModal();
    initForm();
    initModalAsignar();
    initModalSucursales();

    document.getElementById('inputBusqueda')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') buscarClientes();
    });
});

// ══════════════════════════════════════════
//  CARGAR Y RENDERIZAR
// ══════════════════════════════════════════
async function cargarClientes() {
    try {
        const res = await fetch(`${API_URL}/todos`, {
            headers: { 'Authorization': `Bearer ${TOKEN()}` }
        });
        if (!res.ok) throw new Error();
        todosLosClientes = await res.json();
        paginaActual     = 1;
        buscarClientes();
    } catch {
        mostrarToast('Error al cargar clientes', 'danger');
    }
}

function renderTabla() {
    const tbody     = document.getElementById('tablaClientes');
    const sinResult = document.getElementById('sinResultados');
    const inicio    = (paginaActual - 1) * ITEMS_POR_PAGINA;
    const fin       = inicio + ITEMS_POR_PAGINA;
    const pagina    = clientesFiltrados.slice(inicio, fin);

    if (clientesFiltrados.length === 0) {
        tbody.innerHTML = '';
        sinResult.style.display = 'block';
        document.getElementById('infoPaginacion').textContent = 'Sin resultados';
        document.getElementById('paginacion').innerHTML       = '';
        return;
    }

    sinResult.style.display = 'none';

    tbody.innerHTML = pagina.map((c, i) => {
        const nombre = c.tipoCliente === 'EMPRESA'
            ? c.razonSocial
            : `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim();

        const tipoBadge = c.tipoCliente === 'EMPRESA'
            ? `<span class="badge-tipo badge-empresa"><i class="bi bi-building"></i> Empresa</span>`
            : `<span class="badge-tipo badge-persona"><i class="bi bi-person"></i> Persona</span>`;

        const usuarioBadge = c.user
            ? `<span class="badge-usuario-ok"><i class="bi bi-check-circle"></i> Asignado</span>`
            : `<span class="badge-sin-usuario"><i class="bi bi-dash-circle"></i> Sin usuario</span>`;

        const estadoBadge = c.activo
            ? `<span class="badge-activo">Activo</span>`
            : `<span class="badge-inactivo">Inactivo</span>`;

        const btnAsignar = !c.user && c.activo
            ? `<button class="btn-accion" title="Asignar usuario" onclick="asignarUsuario(${c.id})">
                   <i class="bi bi-person-plus"></i>
               </button>`
            : '';

        const btnEstado = c.activo
            ? `<button class="btn-accion danger" title="Desactivar" onclick="abrirModalBaja(${c.id})">
                   <i class="bi bi-person-dash"></i>
               </button>`
            : `<button class="btn-accion" title="Reactivar" style="color:#198754;border-color:#198754;" onclick="abrirModalReactivar(${c.id})">
                   <i class="bi bi-person-check"></i>
               </button>`;

        return `
            <tr>
                <td>${inicio + i + 1}</td>
                <td>${tipoBadge}</td>
                <td><strong>${nombre}</strong></td>
                <td>${c.email}</td>
                <td>${c.telefono || c.celular || '<span style="color:#adb5bd">—</span>'}</td>
                <td><small>${formatCondicionIVA(c.condicionIVA)}</small></td>
                <td>${usuarioBadge}</td>
                <td>${estadoBadge}</td>
                <td style="display:flex;gap:4px;flex-wrap:wrap;">
                    <button class="btn-accion" title="Editar"
                            onclick="abrirModalEditar(${c.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-accion" title="Sucursales y contactos"
                            onclick="abrirModalSucursales(${c.id})">
                        <i class="bi bi-geo-alt"></i>
                    </button>
                    ${btnAsignar}
                    ${btnEstado}
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('infoPaginacion').textContent =
        `Mostrando ${inicio + 1}–${Math.min(fin, clientesFiltrados.length)} de ${clientesFiltrados.length} clientes`;

    renderPaginacion();
}

function renderPaginacion() {
    const total = Math.ceil(clientesFiltrados.length / ITEMS_POR_PAGINA);
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
function buscarClientes() {
    const texto  = document.getElementById('inputBusqueda').value.toLowerCase();
    const tipo   = document.getElementById('selectTipo').value;
    const estado = document.getElementById('selectEstado').value;

    clientesFiltrados = todosLosClientes.filter(c => {
        const nombre = c.tipoCliente === 'EMPRESA'
            ? c.razonSocial?.toLowerCase()
            : `${c.nombre} ${c.apellido}`.toLowerCase();

        const matchTexto = !texto ||
            nombre?.includes(texto) ||
            c.email?.toLowerCase().includes(texto) ||
            c.cuit?.includes(texto) ||
            c.dni?.includes(texto);

        const matchEstado = estado === 'todos' ||
            (estado === 'inactivos' ? !c.activo : c.activo);

        return matchTexto && (!tipo || c.tipoCliente === tipo) && matchEstado;
    });

    paginaActual = 1;
    renderTabla();
}

function limpiarFiltros() {
    document.getElementById('inputBusqueda').value = '';
    document.getElementById('selectTipo').value    = '';
    document.getElementById('selectEstado').value  = 'activos';
    paginaActual = 1;
    buscarClientes();
}

// ══════════════════════════════════════════
//  MODAL
// ══════════════════════════════════════════
function initModal() {
    const overlay = document.getElementById('modalAltaCliente');

    document.getElementById('btnNuevoCliente').addEventListener('click', abrirModalAlta);
    document.getElementById('modalClose').addEventListener('click', cerrarModal);
    document.getElementById('btnCancelar').addEventListener('click', cerrarModal);

    overlay.addEventListener('click', e => {
        if (e.target === overlay) cerrarModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlay.classList.contains('visible')) cerrarModal();
        if (e.key === 'Escape' && document.getElementById('modalAsignarUsuario').classList.contains('visible')) {
            cerrarModalAsignar();
        }
    });
}

// ── NUEVO: abrir en modo ALTA ──
function abrirModalAlta() {
    clienteEditandoId = null;

    // Título e ícono
    document.querySelector('#modalAltaCliente .modal-header h5').innerHTML =
        `<i class="bi bi-person-plus"></i> Nuevo Cliente`;

    // Habilitar tipo de cliente (en edición se bloquea)
    document.querySelectorAll('input[name="tipoCliente"]').forEach(r => r.disabled = false);
    document.getElementById('labelPersona').style.opacity = '1';
    document.getElementById('labelEmpresa').style.opacity = '1';

    limpiarFormulario();
    document.getElementById('modalAltaCliente').classList.add('visible');
    document.getElementById('nombre').focus();
}

// ── NUEVO: abrir en modo EDITAR ──
function abrirModalEditar(id) {
    const cliente = todosLosClientes.find(c => c.id === id);
    if (!cliente) return;

    // Cambiar título
    document.querySelector('#modalAltaCliente .modal-header h5').innerHTML =
        `<i class="bi bi-pencil"></i> Editar Cliente`;

    // Limpiar primero
    limpiarFormulario();
    clienteEditandoId = id;

    // Setear tipo (y bloquearlo — no se puede cambiar el tipo en edición)
    const esPF = cliente.tipoCliente === 'PERSONA_FISICA';
    document.querySelector(`input[value="${cliente.tipoCliente}"]`).checked = true;
    document.querySelectorAll('input[name="tipoCliente"]').forEach(r => r.disabled = true);
    document.getElementById('labelPersona').style.opacity = esPF ? '1' : '0.4';
    document.getElementById('labelEmpresa').style.opacity = esPF ? '0.4' : '1';
    toggleTipo();

    // Poblar campos según tipo
    if (esPF) {
        document.getElementById('nombre').value    = cliente.nombre    ?? '';
        document.getElementById('apellido').value  = cliente.apellido  ?? '';
        document.getElementById('dni').value       = cliente.dni       ?? '';
        document.getElementById('cuil').value      = cliente.cuil      ?? '';
        document.getElementById('condicionIVAPersona').value = cliente.condicionIVA ?? '';
    } else {
        document.getElementById('razonSocial').value = cliente.razonSocial ?? '';
        document.getElementById('cuit').value        = cliente.cuit        ?? '';
        document.getElementById('condicionIVAEmpresa').value = cliente.condicionIVA ?? '';
    }

    // Campos comunes
    document.getElementById('email').value     = cliente.email     ?? '';
    document.getElementById('telefono').value  = cliente.telefono  ?? '';
    document.getElementById('celular').value   = cliente.celular   ?? '';
    document.getElementById('direccion').value = cliente.direccion ?? '';
    document.getElementById('localidad').value = cliente.localidad ?? '';
    document.getElementById('provincia').value = cliente.provincia ?? '';

    document.getElementById('modalAltaCliente').classList.add('visible');
}

function cerrarModal() {
    document.getElementById('modalAltaCliente').classList.remove('visible');
    setTimeout(limpiarFormulario, 250);
}

// ══════════════════════════════════════════
//  TOGGLE TIPO CLIENTE
// ══════════════════════════════════════════
function toggleTipo() {
    const tipo      = document.querySelector('input[name="tipoCliente"]:checked').value;
    const esEmpresa = tipo === 'EMPRESA';

    document.getElementById('seccionPersona').style.display        = esEmpresa ? 'none'  : 'block';
    document.getElementById('seccionEmpresa').style.display        = esEmpresa ? 'block' : 'none';
    document.getElementById('condicionIVAPersonaGroup').style.display = esEmpresa ? 'none' : 'block';

    document.getElementById('labelPersona').classList.toggle('selected', !esEmpresa);
    document.getElementById('labelEmpresa').classList.toggle('selected',  esEmpresa);
}

// ══════════════════════════════════════════
//  FORM — SUBMIT (ALTA o EDICIÓN)
// ══════════════════════════════════════════
function initForm() {
    document.getElementById('formAltaCliente').addEventListener('submit', async e => {
        e.preventDefault();
        await submitCliente();
    });
}

async function submitCliente() {
    const tipo = document.querySelector('input[name="tipoCliente"]:checked').value;
    limpiarErrores();

    const body = {
        tipoCliente:  tipo,
        email:        document.getElementById('email').value.trim(),
        telefono:     document.getElementById('telefono').value.trim()  || null,
        celular:      document.getElementById('celular').value.trim()   || null,
        direccion:    document.getElementById('direccion').value.trim() || null,
        localidad:    document.getElementById('localidad').value.trim() || null,
        provincia:    document.getElementById('provincia').value        || null,
    };

    if (tipo === 'PERSONA_FISICA') {
        body.nombre       = document.getElementById('nombre').value.trim();
        body.apellido     = document.getElementById('apellido').value.trim();
        body.dni          = document.getElementById('dni').value.trim()   || null;
        body.cuil         = document.getElementById('cuil').value.trim()  || null;
        body.condicionIVA = document.getElementById('condicionIVAPersona').value || null;
    } else {
        body.razonSocial  = document.getElementById('razonSocial').value.trim();
        body.cuit         = document.getElementById('cuit').value.trim();
        body.condicionIVA = document.getElementById('condicionIVAEmpresa').value || null;
    }

    // Validación
    let valido = true;
    if (!body.email) { mostrarError('errEmail'); valido = false; }
    if (tipo === 'PERSONA_FISICA') {
        if (!body.nombre)      { mostrarError('errNombre');      valido = false; }
        if (!body.apellido)    { mostrarError('errApellido');    valido = false; }
    } else {
        if (!body.razonSocial) { mostrarError('errRazonSocial'); valido = false; }
        if (!body.cuit)        { mostrarError('errCuit');        valido = false; }
    }
    if (!valido) return;

    // ── NUEVO: decidir si es POST o PUT ──
    const esEdicion = clienteEditandoId !== null;
    const url       = esEdicion ? `${API_URL}/${clienteEditandoId}` : API_URL;
    const method    = esEdicion ? 'PUT' : 'POST';

    const btn = document.getElementById('btnGuardar');
    btn.disabled  = true;
    btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Guardando...`;

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${TOKEN()}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(err || 'Error al guardar cliente');
        }

        const clienteGuardado = await res.json();

        cerrarModal();
        await cargarClientes();

        if (esEdicion) {
            mostrarToast('Cliente actualizado correctamente ✓', 'success');
        } else {
            mostrarToast('Cliente creado ✓ — agregá sus sucursales a continuación', 'success');
            // Encadena el segundo paso del alta: sucursales del cliente recién creado.
            // Pequeño delay para que se vea el toast antes de abrir el siguiente modal.
            setTimeout(() => abrirModalSucursales(clienteGuardado.id), 400);
        }

    } catch (err) {
        mostrarToast(err.message || 'Error al guardar cliente', 'danger');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = `<i class="bi bi-check-lg"></i> Guardar Cliente`;
    }
}

// ══════════════════════════════════════════
//  ACCIONES
// ══════════════════════════════════════════
async function desactivarCliente(id) {
    const ok = await UI.confirmar({ titulo: '¿Desactivar este cliente?', subtexto: 'El cliente dejará de ser visible en el sistema.', textoConfirmar: 'Desactivar', tipo: 'warning' });
    if (!ok) return;
    try {
        const res = await fetch(`${API_URL}/${id}/desactivar`, {
            method:  'PATCH',
            headers: { 'Authorization': `Bearer ${TOKEN()}` }
        });
        if (!res.ok) throw new Error();
        await cargarClientes();
        mostrarToast('Cliente desactivado', 'success');
    } catch {
        mostrarToast('Error al desactivar cliente', 'danger');
    }
}

// ══════════════════════════════════════════
//  MODAL ASIGNAR USUARIO
// ══════════════════════════════════════════
let clienteAsignandoId = null;

function initModalAsignar() {
    document.getElementById('modalAsignarClose').addEventListener('click', cerrarModalAsignar);
    document.getElementById('btnCancelarAsignar').addEventListener('click', cerrarModalAsignar);
    document.getElementById('formAsignarUsuario').addEventListener('submit', e => {
        e.preventDefault();
        confirmarAsignarUsuario();
    });

    document.getElementById('modalAsignarUsuario').addEventListener('click', e => {
        if (e.target === document.getElementById('modalAsignarUsuario')) cerrarModalAsignar();
    });

    // Limpia el error de "no coinciden" apenas se vuelve a tipear
    document.getElementById('asignarPasswordConfirmar').addEventListener('input', () => {
        document.getElementById('asignarPasswordConfirmar').classList.remove('error');
        document.getElementById('errAsignarPasswordConfirmar').classList.remove('visible');
    });
}

function asignarUsuario(id) {
    const cliente = todosLosClientes.find(c => c.id === id);
    if (!cliente) return;

    clienteAsignandoId = id;

    const nombre = cliente.tipoCliente === 'EMPRESA'
        ? cliente.razonSocial
        : `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim();

    document.getElementById('asignarClienteNombre').textContent = nombre;

    document.getElementById('asignarPassword').value = '';
    document.getElementById('asignarPasswordConfirmar').value = '';
    ocultarErrorServidorAsignar();
    limpiarErroresAsignar();

    document.getElementById('modalAsignarUsuario').classList.add('visible');
    document.getElementById('asignarPassword').focus();
}

function cerrarModalAsignar() {
    document.getElementById('modalAsignarUsuario').classList.remove('visible');
    clienteAsignandoId = null;
}

async function confirmarAsignarUsuario() {
    limpiarErroresAsignar();
    ocultarErrorServidorAsignar();

    const password  = document.getElementById('asignarPassword').value;
    const confirmar = document.getElementById('asignarPasswordConfirmar').value;

    let valido = true;
    if (!password || password.length < 6) {
        mostrarErrorAsignar('errAsignarPassword', 'asignarPassword');
        valido = false;
    }
    if (password !== confirmar) {
        mostrarErrorAsignar('errAsignarPasswordConfirmar', 'asignarPasswordConfirmar');
        valido = false;
    }
    if (!valido) return;

    const btn = document.getElementById('btnConfirmarAsignar');
    btn.disabled = true;
    btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Creando...`;

    try {
        const res = await fetch(`${API_URL}/${clienteAsignandoId}/asignar-usuario`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN()}`
            },
            body: JSON.stringify({ password })
        });

        if (!res.ok) {
            const err = await res.text();
            // Errores esperables del backend: username ya en uso, cliente ya tiene usuario
            mostrarErrorServidorAsignar(err || 'No se pudo crear el acceso');
            return;
        }

        cerrarModalAsignar();
        await cargarClientes();
        mostrarToast('Acceso al sistema creado correctamente ✓', 'success');

    } catch {
        mostrarErrorServidorAsignar('No se pudo conectar con el servidor. Intentá nuevamente.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-check-lg"></i> Crear acceso`;
    }
}

function mostrarErrorAsignar(errId, inputId) {
    document.getElementById(errId)?.classList.add('visible');
    document.getElementById(inputId)?.classList.add('error');
}

function limpiarErroresAsignar() {
    ['errAsignarPassword', 'errAsignarPasswordConfirmar'].forEach(id =>
        document.getElementById(id)?.classList.remove('visible')
    );
    ['asignarPassword', 'asignarPasswordConfirmar'].forEach(id =>
        document.getElementById(id)?.classList.remove('error')
    );
}

function mostrarErrorServidorAsignar(mensaje) {
    const box = document.getElementById('asignarErrorServidor');
    box.textContent = mensaje;
    box.style.display = 'block';
}

function ocultarErrorServidorAsignar() {
    document.getElementById('asignarErrorServidor').style.display = 'none';
}

// ══════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════
function limpiarFormulario() {
    document.getElementById('formAltaCliente').reset();
    document.querySelector('input[value="PERSONA_FISICA"]').checked = true;
    document.querySelectorAll('input[name="tipoCliente"]').forEach(r => r.disabled = false);
    document.getElementById('labelPersona').style.opacity = '1';
    document.getElementById('labelEmpresa').style.opacity = '1';
    toggleTipo();
    limpiarErrores();
    clienteEditandoId = null;
}

function mostrarError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('visible');
}

function limpiarErrores() {
    document.querySelectorAll('.field-error').forEach(el => el.classList.remove('visible'));
    document.querySelectorAll('.form-control-custom').forEach(el => el.classList.remove('error'));
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

function formatCondicionIVA(val) {
    const map = {
        RESPONSABLE_INSCRIPTO: 'Resp. Inscripto',
        MONOTRIBUTISTA:        'Monotributista',
        EXENTO:                'Exento',
        CONSUMIDOR_FINAL:      'Cons. Final',
        NO_RESPONSABLE:        'No Responsable'
    };
    return map[val] || '—';
}

// ══════════════════════════════════════════
//  MODAL CONFIRMAR REACTIVAR
// ══════════════════════════════════════════
let clienteReactivandoId = null;

function initModalReactivar() {
    document.getElementById('modalReactivarClose').addEventListener('click', cerrarModalReactivar);
    document.getElementById('btnCancelarReactivar').addEventListener('click', cerrarModalReactivar);
    document.getElementById('btnConfirmarReactivar').addEventListener('click', confirmarReactivar);

    document.getElementById('modalConfirmarReactivar').addEventListener('click', e => {
        if (e.target === document.getElementById('modalConfirmarReactivar')) cerrarModalReactivar();
    });
}

function abrirModalReactivar(id) {
    const cliente = todosLosClientes.find(c => c.id === id);
    if (!cliente) return;

    clienteReactivandoId = id;

    const nombre = cliente.tipoCliente === 'EMPRESA'
        ? cliente.razonSocial
        : `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim();

    document.getElementById('reactivarClienteNombre').textContent = nombre;
    document.getElementById('modalConfirmarReactivar').classList.add('visible');
}

function cerrarModalReactivar() {
    document.getElementById('modalConfirmarReactivar').classList.remove('visible');
    clienteReactivandoId = null;
}

async function confirmarReactivar() {
    if (!clienteReactivandoId) return;

    const btn = document.getElementById('btnConfirmarReactivar');
    btn.disabled  = true;
    btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Reactivando...`;

    try {
        const res = await fetch(`${API_URL}/${clienteReactivandoId}/reactivar`, {
            method:  'PATCH',
            headers: { 'Authorization': `Bearer ${TOKEN()}` }
        });
        if (!res.ok) throw new Error();

        cerrarModalReactivar();
        await cargarClientes();
        mostrarToast('Cliente reactivado correctamente', 'success');

    } catch {
        mostrarToast('Error al reactivar cliente', 'danger');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = `<i class="bi bi-person-check"></i> Reactivar`;
    }
}

// ══════════════════════════════════════════
//  MODAL CONFIRMAR BAJA
// ══════════════════════════════════════════

// ── NUEVO: variable para el id a desactivar ──
let clienteDesactivandoId = null;

function initModalBaja() {
    document.getElementById('modalConfirmarClose').addEventListener('click', cerrarModalBaja);
    document.getElementById('btnCancelarBaja').addEventListener('click', cerrarModalBaja);
    document.getElementById('btnConfirmarBaja').addEventListener('click', confirmarBaja);

    document.getElementById('modalConfirmarBaja').addEventListener('click', e => {
        if (e.target === document.getElementById('modalConfirmarBaja')) cerrarModalBaja();
    });
}

function abrirModalBaja(id) {
    const cliente = todosLosClientes.find(c => c.id === id);
    if (!cliente) return;

    clienteDesactivandoId = id;

    const nombre = cliente.tipoCliente === 'EMPRESA'
        ? cliente.razonSocial
        : `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim();

    document.getElementById('bajaClienteNombre').textContent = nombre;
    document.getElementById('modalConfirmarBaja').classList.add('visible');
}

function cerrarModalBaja() {
    document.getElementById('modalConfirmarBaja').classList.remove('visible');
    clienteDesactivandoId = null;
}

async function confirmarBaja() {
    if (!clienteDesactivandoId) return;

    const btn = document.getElementById('btnConfirmarBaja');
    btn.disabled  = true;
    btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Desactivando...`;

    try {
        const res = await fetch(`${API_URL}/${clienteDesactivandoId}/desactivar`, {
            method:  'PATCH',
            headers: { 'Authorization': `Bearer ${TOKEN()}` }
        });
        if (!res.ok) throw new Error();

        cerrarModalBaja();
        await cargarClientes();
        mostrarToast('Cliente desactivado correctamente', 'success');

    } catch {
        mostrarToast('Error al desactivar cliente', 'danger');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = `<i class="bi bi-person-dash"></i> Desactivar`;
    }
}

// ══════════════════════════════════════════
//  MODAL SUCURSALES Y CONTACTOS
// ══════════════════════════════════════════
const SUCURSALES_URL = `${API_BASE}/api/clientes`; // /{clienteId}/sucursales, /sucursales, /sucursales/{id}
const CONTACTOS_URL  = `${API_BASE}/api/clientes`; // /{clienteId}/contactos, /contactos, /contactos/{id}

let clienteSucursalesId = null;   // cliente actualmente abierto en el modal
let sucursalesDelCliente = [];
let contactosDelCliente  = [];
let sucursalEditandoId   = null;
let contactoEditandoId   = null;

function initModalSucursales() {
    document.getElementById('modalSucursalesClose').addEventListener('click', cerrarModalSucursales);
    document.getElementById('btnCerrarSucursalesModal').addEventListener('click', cerrarModalSucursales);

    document.getElementById('modalSucursales').addEventListener('click', e => {
        if (e.target === document.getElementById('modalSucursales')) cerrarModalSucursales();
    });

    // Sucursales
    document.getElementById('btnNuevaSucursal').addEventListener('click', () => abrirFormSucursal(null));
    document.getElementById('btnCancelarSucursal').addEventListener('click', cerrarFormSucursal);
    document.getElementById('btnGuardarSucursal').addEventListener('click', guardarSucursal);

    // Contactos
    document.getElementById('btnNuevoContacto').addEventListener('click', () => abrirFormContacto(null));
    document.getElementById('btnCancelarContacto').addEventListener('click', cerrarFormContacto);
    document.getElementById('btnGuardarContacto').addEventListener('click', guardarContacto);
}

async function abrirModalSucursales(clienteId) {
    const cliente = todosLosClientes.find(c => c.id === clienteId);
    if (!cliente) return;

    clienteSucursalesId = clienteId;

    const nombre = cliente.tipoCliente === 'EMPRESA'
        ? cliente.razonSocial
        : `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim();
    document.getElementById('sucursalesClienteNombre').textContent = nombre;

    cerrarFormSucursal();
    cerrarFormContacto();

    document.getElementById('modalSucursales').classList.add('visible');

    await Promise.all([cargarSucursales(), cargarContactos()]);
}

function cerrarModalSucursales() {
    document.getElementById('modalSucursales').classList.remove('visible');
    clienteSucursalesId = null;
}

// ── Sucursales: cargar y renderizar ──
async function cargarSucursales() {
    try {
        const res = await fetch(`${SUCURSALES_URL}/${clienteSucursalesId}/sucursales`, {
            headers: { 'Authorization': `Bearer ${TOKEN()}` }
        });
        if (!res.ok) throw new Error();
        sucursalesDelCliente = await res.json();
        renderSucursales();
    } catch {
        mostrarToast('Error al cargar sucursales', 'danger');
    }
}

function renderSucursales() {
    const cont = document.getElementById('listaSucursales');
    const sinDatos = document.getElementById('sinSucursales');

    if (sucursalesDelCliente.length === 0) {
        cont.innerHTML = '';
        sinDatos.style.display = 'block';
        return;
    }
    sinDatos.style.display = 'none';

    cont.innerHTML = sucursalesDelCliente.map(s => `
        <div class="item-card">
            <div class="item-card-info">
                <strong>${s.nombre}</strong>
                <span class="item-card-sub">
                    ${[s.direccion, s.localidad, formatProvincia(s.provincia)].filter(Boolean).join(' · ') || 'Sin dirección cargada'}
                </span>
            </div>
            <div class="item-card-acciones">
                <button class="btn-accion" title="Editar" onclick="abrirFormSucursal(${s.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn-accion danger" title="Desactivar" onclick="desactivarSucursal(${s.id})">
                    <i class="bi bi-trash3"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function abrirFormSucursal(id) {
    sucursalEditandoId = id;
    const card = document.getElementById('formSucursalCard');
    const titulo = document.getElementById('formSucursalTitulo');

    limpiarErroresSucursal();

    if (id) {
        const s = sucursalesDelCliente.find(x => x.id === id);
        if (!s) return;
        titulo.textContent = 'Editar sucursal';
        document.getElementById('sucursalNombre').value = s.nombre || '';
        document.getElementById('sucursalDireccion').value = s.direccion || '';
        document.getElementById('sucursalLocalidad').value = s.localidad || '';
        document.getElementById('sucursalProvincia').value = s.provincia || '';
    } else {
        titulo.textContent = 'Nueva sucursal';
        document.getElementById('sucursalNombre').value = '';
        document.getElementById('sucursalDireccion').value = '';
        document.getElementById('sucursalLocalidad').value = '';
        document.getElementById('sucursalProvincia').value = '';
    }

    card.classList.remove('d-none');
    document.getElementById('sucursalNombre').focus();
}

function cerrarFormSucursal() {
    document.getElementById('formSucursalCard').classList.add('d-none');
    sucursalEditandoId = null;
    limpiarErroresSucursal();
}

function limpiarErroresSucursal() {
    document.getElementById('errSucursalNombre')?.classList.remove('visible');
    document.getElementById('sucursalNombre')?.classList.remove('error');
}

async function guardarSucursal() {
    limpiarErroresSucursal();

    const nombre = document.getElementById('sucursalNombre').value.trim();
    if (!nombre) {
        document.getElementById('errSucursalNombre').classList.add('visible');
        document.getElementById('sucursalNombre').classList.add('error');
        return;
    }

    const body = {
        clienteId: clienteSucursalesId,
        nombre,
        direccion: document.getElementById('sucursalDireccion').value.trim() || null,
        localidad: document.getElementById('sucursalLocalidad').value.trim() || null,
        provincia: document.getElementById('sucursalProvincia').value || null,
    };

    const esEdicion = sucursalEditandoId !== null;
    const url = esEdicion
        ? `${SUCURSALES_URL}/sucursales/${sucursalEditandoId}`
        : `${SUCURSALES_URL}/sucursales`;
    const method = esEdicion ? 'PUT' : 'POST';

    const btn = document.getElementById('btnGuardarSucursal');
    btn.disabled = true;

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN()}`
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(await res.text());

        cerrarFormSucursal();
        await cargarSucursales();
        // Los checkboxes de contacto dependen de la lista de sucursales — se refrescan
        // automáticamente la próxima vez que se abra un form de contacto.
        mostrarToast(esEdicion ? 'Sucursal actualizada ✓' : 'Sucursal creada ✓', 'success');

    } catch (err) {
        mostrarToast(err.message || 'Error al guardar la sucursal', 'danger');
    } finally {
        btn.disabled = false;
    }
}

async function desactivarSucursal(id) {
    const ok = await UI.confirmar({ titulo: '¿Desactivar esta sucursal?', subtexto: 'Las muestras ya cargadas no se ven afectadas.', textoConfirmar: 'Desactivar', tipo: 'warning' });
    if (!ok) return;
    try {
        const res = await fetch(`${SUCURSALES_URL}/sucursales/${id}/desactivar`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${TOKEN()}` }
        });
        if (!res.ok) throw new Error();
        await cargarSucursales();
        mostrarToast('Sucursal desactivada', 'success');
    } catch {
        mostrarToast('Error al desactivar la sucursal', 'danger');
    }
}

// ── Contactos: cargar y renderizar ──
async function cargarContactos() {
    try {
        const res = await fetch(`${CONTACTOS_URL}/${clienteSucursalesId}/contactos`, {
            headers: { 'Authorization': `Bearer ${TOKEN()}` }
        });
        if (!res.ok) throw new Error();
        contactosDelCliente = await res.json();
        renderContactos();
    } catch {
        mostrarToast('Error al cargar contactos', 'danger');
    }
}

function renderContactos() {
    const cont = document.getElementById('listaContactos');
    const sinDatos = document.getElementById('sinContactos');

    if (contactosDelCliente.length === 0) {
        cont.innerHTML = '';
        sinDatos.style.display = 'block';
        return;
    }
    sinDatos.style.display = 'none';

    cont.innerHTML = contactosDelCliente.map(c => {
        const sucursalesNombres = (c.sucursalIds || [])
            .map(sid => sucursalesDelCliente.find(s => s.id === sid)?.nombre)
            .filter(Boolean);

        const chipsSucursales = sucursalesNombres.length > 0
            ? sucursalesNombres.map(n => `<span class="chip-sucursal">${n}</span>`).join('')
            : '<span class="item-card-sub">Sin sucursales asignadas</span>';

        return `
            <div class="item-card">
                <div class="item-card-info">
                    <strong>${c.nombre}</strong>
                    <span class="item-card-sub">${[c.email, c.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
                    <div class="chips-container">${chipsSucursales}</div>
                </div>
                <div class="item-card-acciones">
                    <button class="btn-accion" title="Editar" onclick="abrirFormContacto(${c.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-accion danger" title="Desactivar" onclick="desactivarContacto(${c.id})">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function abrirFormContacto(id) {
    contactoEditandoId = id;
    const card = document.getElementById('formContactoCard');
    const titulo = document.getElementById('formContactoTitulo');

    limpiarErroresContacto();

    // Arma los checkboxes de sucursales SIEMPRE fresco (por si se agregó una sucursal recién)
    const checksCont = document.getElementById('contactoSucursalesCheckboxes');
    if (sucursalesDelCliente.length === 0) {
        checksCont.innerHTML = '<span class="item-card-sub">Cargá al menos una sucursal primero.</span>';
    } else {
        const seleccionadas = id
            ? (contactosDelCliente.find(c => c.id === id)?.sucursalIds || [])
            : [];

        checksCont.innerHTML = sucursalesDelCliente.map(s => `
            <label class="checkbox-sucursal-item">
                <input type="checkbox" value="${s.id}" ${seleccionadas.includes(s.id) ? 'checked' : ''}>
                ${s.nombre}
            </label>
        `).join('');
    }

    if (id) {
        const c = contactosDelCliente.find(x => x.id === id);
        if (!c) return;
        titulo.textContent = 'Editar contacto';
        document.getElementById('contactoNombre').value = c.nombre || '';
        document.getElementById('contactoEmail').value = c.email || '';
        document.getElementById('contactoTelefono').value = c.telefono || '';
    } else {
        titulo.textContent = 'Nuevo contacto';
        document.getElementById('contactoNombre').value = '';
        document.getElementById('contactoEmail').value = '';
        document.getElementById('contactoTelefono').value = '';
    }

    card.classList.remove('d-none');
    document.getElementById('contactoNombre').focus();
}

function cerrarFormContacto() {
    document.getElementById('formContactoCard').classList.add('d-none');
    contactoEditandoId = null;
    limpiarErroresContacto();
}

function limpiarErroresContacto() {
    document.getElementById('errContactoNombre')?.classList.remove('visible');
    document.getElementById('contactoNombre')?.classList.remove('error');
}

async function guardarContacto() {
    limpiarErroresContacto();

    const nombre = document.getElementById('contactoNombre').value.trim();
    if (!nombre) {
        document.getElementById('errContactoNombre').classList.add('visible');
        document.getElementById('contactoNombre').classList.add('error');
        return;
    }

    const sucursalIds = Array.from(
        document.querySelectorAll('#contactoSucursalesCheckboxes input[type="checkbox"]:checked')
    ).map(cb => parseInt(cb.value));

    const body = {
        clienteId: clienteSucursalesId,
        nombre,
        email: document.getElementById('contactoEmail').value.trim() || null,
        telefono: document.getElementById('contactoTelefono').value.trim() || null,
        sucursalIds
    };

    const esEdicion = contactoEditandoId !== null;
    const url = esEdicion
        ? `${CONTACTOS_URL}/contactos/${contactoEditandoId}`
        : `${CONTACTOS_URL}/contactos`;
    const method = esEdicion ? 'PUT' : 'POST';

    const btn = document.getElementById('btnGuardarContacto');
    btn.disabled = true;

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN()}`
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(await res.text());

        cerrarFormContacto();
        await cargarContactos();
        mostrarToast(esEdicion ? 'Contacto actualizado ✓' : 'Contacto creado ✓', 'success');

    } catch (err) {
        mostrarToast(err.message || 'Error al guardar el contacto', 'danger');
    } finally {
        btn.disabled = false;
    }
}

async function desactivarContacto(id) {
    const ok = await UI.confirmar({ titulo: '¿Desactivar este contacto?', subtexto: 'Dejará de recibir avisos de todas las sucursales.', textoConfirmar: 'Desactivar', tipo: 'warning' });
    if (!ok) return;
    try {
        const res = await fetch(`${CONTACTOS_URL}/contactos/${id}/desactivar`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${TOKEN()}` }
        });
        if (!res.ok) throw new Error();
        await cargarContactos();
        mostrarToast('Contacto desactivado', 'success');
    } catch {
        mostrarToast('Error al desactivar el contacto', 'danger');
    }
}

function formatProvincia(val) {
    if (!val) return '';
    return val.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}