const API_URL = 'http://localhost:8080/api/clientes';
const TOKEN = localStorage.getItem('token');

let todosLosClientes = [];
let clientesFiltrados = [];
let paginaActual = 1;
const ITEMS_POR_PAGINA = 10;

// ── Al cargar la página ──
document.addEventListener('DOMContentLoaded', () => {
    cargarClientes();
});

// ── Cargar todos los clientes ──
async function cargarClientes() {
    try {
        const res = await fetch(`${API_URL}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });

        if (!res.ok) throw new Error('Error al obtener clientes');

        todosLosClientes = await res.json();
        clientesFiltrados = [...todosLosClientes];
        renderTabla();
    } catch (err) {
        mostrarToast('Error al cargar clientes', 'danger');
    }
}

// ── Render tabla con paginación ──
function renderTabla() {
    const tbody = document.getElementById('tablaClientes');
    const sinResultados = document.getElementById('sinResultados');

    const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA;
    const fin = inicio + ITEMS_POR_PAGINA;
    const pagina = clientesFiltrados.slice(inicio, fin);

    if (clientesFiltrados.length === 0) {
        tbody.innerHTML = '';
        sinResultados.classList.remove('d-none');
        document.getElementById('infoPaginacion').textContent = 'Sin resultados';
        document.getElementById('paginacion').innerHTML = '';
        return;
    }

    sinResultados.classList.add('d-none');

    tbody.innerHTML = pagina.map((c, i) => `
        <tr>
            <td>${inicio + i + 1}</td>
            <td>
                <span class="badge ${c.tipoCliente === 'EMPRESA' ? 'bg-primary' : 'bg-success'}">
                    ${c.tipoCliente === 'EMPRESA' ? 'Empresa' : 'Persona'}
                </span>
            </td>
            <td>${c.tipoCliente === 'EMPRESA' ? c.razonSocial : `${c.nombre} ${c.apellido}`}</td>
            <td>${c.email}</td>
            <td>${c.telefono || c.celular || '-'}</td>
            <td><small>${formatCondicionIVA(c.condicionIVA)}</small></td>
            <td>
                ${c.user
        ? `<span class="badge bg-success"><i class="bi bi-check-circle"></i> Asignado</span>`
        : `<span class="badge bg-secondary">Sin usuario</span>`}
            </td>
            <td>
                ${c.activo
        ? `<span class="badge bg-success">Activo</span>`
        : `<span class="badge bg-danger">Inactivo</span>`}
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>
                ${!c.user ? `
                <button class="btn btn-sm btn-outline-success me-1" title="Asignar usuario">
                    <i class="bi bi-person-plus"></i>
                </button>` : ''}
                <button class="btn btn-sm btn-outline-danger" title="Desactivar"
                        onclick="desactivarCliente(${c.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Info paginación
    document.getElementById('infoPaginacion').textContent =
        `Mostrando ${inicio + 1}–${Math.min(fin, clientesFiltrados.length)} de ${clientesFiltrados.length} clientes`;

    renderPaginacion();
}

// ── Paginador ──
function renderPaginacion() {
    const totalPaginas = Math.ceil(clientesFiltrados.length / ITEMS_POR_PAGINA);
    const ul = document.getElementById('paginacion');

    ul.innerHTML = '';

    for (let i = 1; i <= totalPaginas; i++) {
        ul.innerHTML += `
            <li class="page-item ${i === paginaActual ? 'active' : ''}">
                <button class="page-link" onclick="irAPagina(${i})">${i}</button>
            </li>
        `;
    }
}

function irAPagina(n) {
    paginaActual = n;
    renderTabla();
}

// ── Filtros ──
function buscarClientes() {
    const texto = document.getElementById('inputBusqueda').value.toLowerCase();
    const tipo = document.getElementById('selectTipo').value;

    clientesFiltrados = todosLosClientes.filter(c => {
        const nombre = c.tipoCliente === 'EMPRESA'
            ? c.razonSocial?.toLowerCase()
            : `${c.nombre} ${c.apellido}`.toLowerCase();

        const matchTexto = !texto ||
            nombre?.includes(texto) ||
            c.email?.toLowerCase().includes(texto) ||
            c.cuit?.includes(texto) ||
            c.dni?.includes(texto);

        const matchTipo = !tipo || c.tipoCliente === tipo;

        return matchTexto && matchTipo;
    });

    paginaActual = 1;
    renderTabla();
}

function limpiarFiltros() {
    document.getElementById('inputBusqueda').value = '';
    document.getElementById('selectTipo').value = '';
    clientesFiltrados = [...todosLosClientes];
    paginaActual = 1;
    renderTabla();
}

// ── Toggle tipo cliente en el modal ──
function toggleTipoCliente() {
    const tipo = document.querySelector('input[name="tipoCliente"]:checked').value;
    document.getElementById('seccionPersona').classList.toggle('d-none', tipo === 'EMPRESA');
    document.getElementById('seccionEmpresa').classList.toggle('d-none', tipo !== 'EMPRESA');
}

// ── Submit alta cliente ──
async function submitAltaCliente() {
    const tipo = document.querySelector('input[name="tipoCliente"]:checked').value;

    const body = {
        tipoCliente: tipo,
        email: document.getElementById('email').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        celular: document.getElementById('celular').value.trim(),
        direccion: document.getElementById('direccion').value.trim(),
        localidad: document.getElementById('localidad').value.trim(),
        provincia: document.getElementById('provincia').value || null,
        condicionIVA: document.getElementById('condicionIVA').value || null,
    };

    if (tipo === 'PERSONA_FISICA') {
        body.nombre = document.getElementById('nombre').value.trim();
        body.apellido = document.getElementById('apellido').value.trim();
        body.dni = document.getElementById('dni').value.trim();
        body.cuil = document.getElementById('cuil').value.trim();
    } else {
        body.razonSocial = document.getElementById('razonSocial').value.trim();
        body.cuit = document.getElementById('cuit').value.trim();
    }

    // Validación básica
    if (!body.email) {
        mostrarToast('El email es obligatorio', 'warning');
        return;
    }
    if (tipo === 'PERSONA_FISICA' && (!body.nombre || !body.apellido)) {
        mostrarToast('Nombre y apellido son obligatorios', 'warning');
        return;
    }
    if (tipo === 'EMPRESA' && !body.razonSocial) {
        mostrarToast('La razón social es obligatoria', 'warning');
        return;
    }

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(err);
        }

        // Cerrar modal y recargar
        bootstrap.Modal.getInstance(document.getElementById('modalAltaCliente')).hide();
        limpiarFormulario();
        await cargarClientes();
        mostrarToast('Cliente creado correctamente', 'success');

    } catch (err) {
        mostrarToast(err.message || 'Error al crear cliente', 'danger');
    }
}

// ── Desactivar cliente ──
async function desactivarCliente(id) {
    if (!confirm('¿Desactivar este cliente?')) return;

    try {
        const res = await fetch(`${API_URL}/${id}/desactivar`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });

        if (!res.ok) throw new Error();

        await cargarClientes();
        mostrarToast('Cliente desactivado', 'success');
    } catch {
        mostrarToast('Error al desactivar cliente', 'danger');
    }
}

// ── Limpiar formulario ──
function limpiarFormulario() {
    document.getElementById('formAltaCliente').reset();
    document.getElementById('seccionPersona').classList.remove('d-none');
    document.getElementById('seccionEmpresa').classList.add('d-none');
}

// ── Toast ──
function mostrarToast(msg, tipo = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    toast.className = `toast align-items-center text-white border-0 bg-${tipo}`;
    toastMsg.textContent = msg;
    new bootstrap.Toast(toast, { delay: 3000 }).show();
}

// ── Helpers ──
function formatCondicionIVA(val) {
    const map = {
        RESPONSABLE_INSCRIPTO: 'Resp. Inscripto',
        MONOTRIBUTISTA: 'Monotributista',
        EXENTO: 'Exento',
        CONSUMIDOR_FINAL: 'Cons. Final',
        NO_RESPONSABLE: 'No Responsable'
    };
    return map[val] || '-';
}
