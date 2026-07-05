const API_URL = 'http://localhost:8080/api/clientes';
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

    cargarClientes();
    initModalBaja();
    initModal();
    initForm();

    document.getElementById('logout-btn').addEventListener('click', () => {
        ['token', 'userEmail', 'userRole', 'userName'].forEach(k => localStorage.removeItem(k));
        window.location.href = 'login.html';
    });

    document.getElementById('inputBusqueda')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') buscarClientes();
    });
});

// ══════════════════════════════════════════
//  CARGAR Y RENDERIZAR
// ══════════════════════════════════════════
async function cargarClientes() {
    try {
        const res = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${TOKEN()}` }
        });
        if (!res.ok) throw new Error();
        todosLosClientes  = await res.json();
        clientesFiltrados = [...todosLosClientes];
        paginaActual      = 1;
        renderTabla();
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

        const btnAsignar = !c.user
            ? `<button class="btn-accion" title="Asignar usuario" onclick="asignarUsuario(${c.id})">
                   <i class="bi bi-person-plus"></i>
               </button>`
            : '';

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
                    ${btnAsignar}
                   <button class="btn-accion danger" title="Desactivar"
        onclick="abrirModalBaja(${c.id})">   
    <i class="bi bi-trash3"></i>
</button>
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
    const texto = document.getElementById('inputBusqueda').value.toLowerCase();
    const tipo  = document.getElementById('selectTipo').value;

    clientesFiltrados = todosLosClientes.filter(c => {
        const nombre = c.tipoCliente === 'EMPRESA'
            ? c.razonSocial?.toLowerCase()
            : `${c.nombre} ${c.apellido}`.toLowerCase();

        const matchTexto = !texto ||
            nombre?.includes(texto) ||
            c.email?.toLowerCase().includes(texto) ||
            c.cuit?.includes(texto) ||
            c.dni?.includes(texto);

        return matchTexto && (!tipo || c.tipoCliente === tipo);
    });

    paginaActual = 1;
    renderTabla();
}

function limpiarFiltros() {
    document.getElementById('inputBusqueda').value = '';
    document.getElementById('selectTipo').value    = '';
    clientesFiltrados = [...todosLosClientes];
    paginaActual = 1;
    renderTabla();
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

        cerrarModal();
        await cargarClientes();
        mostrarToast(
            esEdicion ? 'Cliente actualizado correctamente ✓' : 'Cliente creado correctamente ✓',
            'success'
        );

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
    if (!confirm('¿Desactivar este cliente?')) return;
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

async function asignarUsuario(id) {
    mostrarToast('Próximamente: asignación de usuario', 'warning');
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
