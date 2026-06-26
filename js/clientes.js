const API_URL = 'http://localhost:8080/api/clientes';
const TOKEN   = () => localStorage.getItem('token');

let todosLosClientes  = [];
let clientesFiltrados = [];
let paginaActual      = 1;
const ITEMS_POR_PAGINA = 10;

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    // Guard
    const rol = (localStorage.getItem('userRole') || '').toUpperCase();
    if (!localStorage.getItem('token') || rol === 'ROLE_CLIENTE') {
        window.location.href = 'login.html';
    }

    cargarClientes();
    initModal();
    initForm();

    document.getElementById('logout-btn').addEventListener('click', () => {
        ['token', 'userEmail', 'userRole', 'userName'].forEach(k => localStorage.removeItem(k));
        window.location.href = 'login.html';
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
    const tbody        = document.getElementById('tablaClientes');
    const sinResult    = document.getElementById('sinResultados');
    const inicio       = (paginaActual - 1) * ITEMS_POR_PAGINA;
    const fin          = inicio + ITEMS_POR_PAGINA;
    const pagina       = clientesFiltrados.slice(inicio, fin);

    if (clientesFiltrados.length === 0) {
        tbody.innerHTML = '';
        sinResult.style.display = 'block';
        document.getElementById('infoPaginacion').textContent = 'Sin resultados';
        document.getElementById('paginacion').innerHTML      = '';
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
                    <button class="btn-accion" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    ${btnAsignar}
                    <button class="btn-accion danger" title="Desactivar"
                            onclick="desactivarCliente(${c.id})">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Info paginación
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

// Buscar al presionar Enter
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('inputBusqueda')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') buscarClientes();
    });
});

// ══════════════════════════════════════════
//  MODAL
// ══════════════════════════════════════════
function initModal() {
    const overlay = document.getElementById('modalAltaCliente');

    document.getElementById('btnNuevoCliente').addEventListener('click', abrirModal);
    document.getElementById('modalClose').addEventListener('click', cerrarModal);
    document.getElementById('btnCancelar').addEventListener('click', cerrarModal);

    // Cerrar al click fuera
    overlay.addEventListener('click', e => {
        if (e.target === overlay) cerrarModal();
    });

    // Cerrar con Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlay.classList.contains('visible')) cerrarModal();
    });
}

function abrirModal() {
    document.getElementById('modalAltaCliente').classList.add('visible');
    document.getElementById('nombre').focus();
}

function cerrarModal() {
    document.getElementById('modalAltaCliente').classList.remove('visible');
    setTimeout(limpiarFormulario, 250);
}

// ══════════════════════════════════════════
//  TOGGLE TIPO CLIENTE
// ══════════════════════════════════════════
function toggleTipo() {
    const tipo         = document.querySelector('input[name="tipoCliente"]:checked').value;
    const esEmpresa    = tipo === 'EMPRESA';

    document.getElementById('seccionPersona').style.display = esEmpresa ? 'none' : 'block';
    document.getElementById('seccionEmpresa').style.display = esEmpresa ? 'block' : 'none';
    document.getElementById('condicionIVAPersonaGroup').style.display = esEmpresa ? 'none' : 'block';

    // Estilo de los radio labels
    document.getElementById('labelPersona').classList.toggle('selected', !esEmpresa);
    document.getElementById('labelEmpresa').classList.toggle('selected', esEmpresa);
}

// ══════════════════════════════════════════
//  FORM — SUBMIT
// ══════════════════════════════════════════
function initForm() {
    document.getElementById('formAltaCliente').addEventListener('submit', async e => {
        e.preventDefault();
        await submitAltaCliente();
    });
}

async function submitAltaCliente() {
    const tipo = document.querySelector('input[name="tipoCliente"]:checked').value;
    limpiarErrores();

    // Armar body
    const body = {
        tipoCliente:  tipo,
        email:        document.getElementById('email').value.trim(),
        telefono:     document.getElementById('telefono').value.trim() || null,
        celular:      document.getElementById('celular').value.trim()  || null,
        direccion:    document.getElementById('direccion').value.trim()|| null,
        localidad:    document.getElementById('localidad').value.trim()|| null,
        provincia:    document.getElementById('provincia').value       || null,
    };

    if (tipo === 'PERSONA_FISICA') {
        body.nombre      = document.getElementById('nombre').value.trim();
        body.apellido    = document.getElementById('apellido').value.trim();
        body.dni         = document.getElementById('dni').value.trim()  || null;
        body.cuil        = document.getElementById('cuil').value.trim() || null;
        body.condicionIVA= document.getElementById('condicionIVAPersona').value || null;
    } else {
        body.razonSocial = document.getElementById('razonSocial').value.trim();
        body.cuit        = document.getElementById('cuit').value.trim();
        body.condicionIVA= document.getElementById('condicionIVAEmpresa').value || null;
    }

    // Validación
    let valido = true;
    if (!body.email) {
        mostrarError('errEmail'); valido = false;
    }
    if (tipo === 'PERSONA_FISICA') {
        if (!body.nombre)   { mostrarError('errNombre');   valido = false; }
        if (!body.apellido) { mostrarError('errApellido'); valido = false; }
    } else {
        if (!body.razonSocial) { mostrarError('errRazonSocial'); valido = false; }
        if (!body.cuit)        { mostrarError('errCuit');        valido = false; }
    }
    if (!valido) return;

    // Enviar
    const btn = document.getElementById('btnGuardar');
    btn.disabled     = true;
    btn.innerHTML    = `<i class="bi bi-hourglass-split"></i> Guardando...`;

    try {
        const res = await fetch(API_URL, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${TOKEN()}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(err || 'Error al crear cliente');
        }

        cerrarModal();
        await cargarClientes();
        mostrarToast('Cliente creado correctamente ✓', 'success');

    } catch (err) {
        mostrarToast(err.message || 'Error al crear cliente', 'danger');
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
    // Por ahora placeholder — después abre un modal dedicado
    mostrarToast('Próximamente: asignación de usuario', 'warning');
}

// ══════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════
function limpiarFormulario() {
    document.getElementById('formAltaCliente').reset();
    // Volver a persona física
    document.querySelector('input[value="PERSONA_FISICA"]').checked = true;
    toggleTipo();
    limpiarErrores();
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
    const iconMap = { success: 'bi-check-circle-fill', danger: 'bi-x-circle-fill', warning: 'bi-exclamation-circle-fill' };
    const toast   = document.getElementById('toastConfirm');
    const icon    = document.getElementById('toastIcon');

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
