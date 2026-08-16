const API_URL = `${API_BASE}/api`;

let empleadosCache = [];

function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatFechaTabla(iso) {
    if (!iso) return '-';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

let TIPOS_ANALISIS = [];

async function cargarGruposInforme() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/grupos-informe`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        TIPOS_ANALISIS = data.map(g => ({ value: g.codigo, label: g.label }));
        const tipoOpts = TIPOS_ANALISIS.map(t =>
            `<option value="${t.value}">${t.label}</option>`
        ).join('');
        const paramTipoEl = document.getElementById('paramTipo');
        if (paramTipoEl) paramTipoEl.innerHTML = `<option value="">Sin clasificar</option>${tipoOpts}`;
        const metodoTipoEl = document.getElementById('metodoSelectTipo');
        if (metodoTipoEl) metodoTipoEl.innerHTML = `<option value="">— Grupo en informe —</option>${tipoOpts}`;
    } catch (e) {
        console.error('Error cargando grupos informe', e);
    }
}

function labelTipoAnalisis(tipo) {
    const found = TIPOS_ANALISIS.find(t => t.value === tipo);
    return tipo ? (found ? found.label : tipo) : '<span class="text-muted-pt">—</span>';
}

// ── Estado por tabla ──
const tablas = {
    resoluciones: {
        url: `${API_URL}/resoluciones`,
        tbodyId: 'tablaResolucionesBody',
        filtroId: 'filtroResoluciones',
        pagId:    'paginadorResoluciones',
        colSpan:  3,
        data: [], filtro: '', pagina: 1, porPagina: 10,
        renderFila: r => `<td>${r.nombre}</td><td>${r.descripcion || '-'}</td>`,
        textoVacio: 'No hay resoluciones registradas.',
        textoBuscar: r => `${r.nombre} ${r.descripcion || ''}`,
        renderAccionesExtra: r => `<button class="btn-accion-info" onclick="verParametros(${r.id})" title="Ver parámetros"><i class="bi bi-eye"></i></button>`,
        editUrl: id => `${API_URL}/resoluciones/${id}`,
        renderFilaEdit: r => `
            <td><input class="unidad-inline-input" id="ef-nombre" value="${esc(r.nombre)}" style="width:100%"></td>
            <td><input class="unidad-inline-input" id="ef-desc" value="${esc(r.descripcion || '')}" placeholder="Organismo emisor" style="width:100%"></td>`,
        buildPutBody: r => ({ nombre: document.getElementById('ef-nombre').value.trim(), descripcion: document.getElementById('ef-desc').value.trim() || null }),
    },
    parametros: {
        url: `${API_URL}/parametros`,
        tbodyId: 'tablaParametrosBody',
        filtroId: 'filtroParametros',
        pagId:    'paginadorParametros',
        colSpan:  4,
        data: [], filtro: '', pagina: 1, porPagina: 10,
        sortFn: (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
        renderFila: r => {
            const analista = r.responsable
                ? `<span class="badge-analista">${esc(r.responsable.username)}</span>`
                : '<span class="text-muted-pt">Sin asignar</span>';
            const tipoLabel = labelTipoAnalisis(r.tipoAnalisis);
            return `<td>${r.nombre}</td><td>${tipoLabel}</td><td>${analista}</td>`;
        },
        textoVacio: 'No hay parámetros cargados.',
        textoBuscar: r => `${r.nombre} ${r.responsable?.username || ''} ${r.tipoAnalisis || ''}`,
        renderAccionesExtra: r => `<button class="btn-accion-info" onclick="verMetodologias(${r.id}, '${esc(r.nombre)}')" title="Metodologías asociadas"><i class="bi bi-journal-bookmark"></i></button>`,
        editUrl: id => `${API_URL}/parametros/${id}`,
        renderFilaEdit: r => {
            const opts = empleadosCache.map(u =>
                `<option value="${u.id}" ${r.responsable?.id === u.id ? 'selected' : ''}>${esc(u.username)}</option>`
            ).join('');
            const tipoOpts = [{ value: '', label: 'Sin clasificar' }, ...TIPOS_ANALISIS]
                .map(o => `<option value="${o.value}" ${(r.tipoAnalisis || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('');
            return `
                <td><input class="unidad-inline-input" id="ef-nombre" value="${esc(r.nombre)}" style="width:100%"></td>
                <td>
                    <select id="ef-tipo" class="unidad-inline-input" style="width:100%">
                        ${tipoOpts}
                    </select>
                </td>
                <td>
                    <select id="ef-responsable" class="unidad-inline-input" style="width:100%">
                        <option value="">Sin asignar</option>
                        ${opts}
                    </select>
                </td>`;
        },
        buildPutBody: () => ({
            nombre:        document.getElementById('ef-nombre').value.trim(),
            tipoAnalisis:  document.getElementById('ef-tipo').value || null,
            responsableId: document.getElementById('ef-responsable').value
                           ? Number(document.getElementById('ef-responsable').value)
                           : null,
        }),
    },
    metodologias: {
        url: `${API_URL}/metodologias`,
        tbodyId: 'tablaMetodologiasBody',
        filtroId: 'filtroMetodologias',
        pagId:    'paginadorMetodologias',
        colSpan:  3,
        data: [], filtro: '', pagina: 1, porPagina: 10,
        renderFila: r => `<td>${r.nombre}</td><td>${r.descripcion || '-'}</td>`,
        textoVacio: 'No hay metodologías cargadas.',
        textoBuscar: r => `${r.nombre} ${r.descripcion || ''}`,
        editUrl: id => `${API_URL}/metodologias/${id}`,
        renderFilaEdit: r => `
            <td><input class="unidad-inline-input" id="ef-nombre" value="${esc(r.nombre)}" style="width:100%"></td>
            <td><input class="unidad-inline-input" id="ef-desc" value="${esc(r.descripcion || '')}" placeholder="Referencia bibliográfica" style="width:100%"></td>`,
        buildPutBody: r => ({ nombre: document.getElementById('ef-nombre').value.trim(), descripcion: document.getElementById('ef-desc').value.trim() || null }),
    },
    tiposmuestra: {
        url: `${API_URL}/tipos-muestra`,
        tbodyId: 'tablaTiposMuestraBody',
        filtroId: 'filtroTiposMuestra',
        pagId:    'paginadorTiposMuestra',
        colSpan:  3,
        data: [], filtro: '', pagina: 1, porPagina: 10,
        renderFila: r => `<td>${r.nombre}</td><td>${r.matriz?.nombre || '-'}</td>`,
        textoVacio: 'No hay tipos de muestra registrados.',
        textoBuscar: r => `${r.nombre} ${r.matriz?.nombre || ''}`,
        editUrl: id => `${API_URL}/tipos-muestra/${id}`,
        renderFilaEdit: r => `
            <td><input class="unidad-inline-input" id="ef-nombre" value="${esc(r.nombre)}" style="width:100%"></td>
            <td>${r.matriz?.nombre || '-'}</td>`,
        buildPutBody: r => ({ nombre: document.getElementById('ef-nombre').value.trim(), matrizId: r.matriz?.id || null }),
    },
    categoriasDoc: {
        url: `${API_URL}/categorias-documento`,
        tbodyId: 'tablaCategoriasDocBody',
        filtroId: 'filtroCategoriasDoc',
        pagId:    'paginadorCategoriasDoc',
        colSpan:  2,
        data: [], filtro: '', pagina: 1, porPagina: 10,
        renderFila: r => `<td>${r.nombre}</td>`,
        textoVacio: 'No hay categorías registradas.',
        textoBuscar: r => r.nombre,
        editUrl: id => `${API_URL}/categorias-documento/${id}`,
        renderFilaEdit: r => `
            <td><input class="unidad-inline-input" id="ef-nombre" value="${esc(r.nombre)}" style="width:100%"></td>`,
        buildPutBody: r => ({ nombre: document.getElementById('ef-nombre').value.trim() }),
    },
    gruposInforme: {
        url: `${API_URL}/grupos-informe`,
        tbodyId: 'tablaGruposInformeBody',
        filtroId: 'filtroGruposInforme',
        pagId:    'paginadorGruposInforme',
        colSpan:  4,
        data: [], filtro: '', pagina: 1, porPagina: 20,
        renderFila: r => `<td>${esc(r.label)}</td><td><code style="font-size:11px">${esc(r.codigo)}</code></td><td>${r.orden ?? 0}</td>`,
        textoVacio: 'No hay grupos definidos.',
        textoBuscar: r => `${r.label} ${r.codigo}`,
        editUrl: id => `${API_URL}/grupos-informe/${id}`,
        renderFilaEdit: r => `
            <td><input class="unidad-inline-input" id="ef-label" value="${esc(r.label)}" style="width:100%" placeholder="Nombre del grupo"></td>
            <td><input class="unidad-inline-input" id="ef-codigo" value="${esc(r.codigo)}" style="width:100%"></td>
            <td><input type="number" class="unidad-inline-input" id="ef-orden" value="${r.orden ?? 0}" style="width:60px" min="0"></td>`,
        buildPutBody: r => ({
            label:  document.getElementById('ef-label').value.trim(),
            codigo: document.getElementById('ef-codigo').value.trim().toUpperCase().replace(/\s+/g, '_'),
            orden:  parseInt(document.getElementById('ef-orden').value) || 0,
        }),
    },
    equipos: {
        url: `${API_URL}/equipos/todos`,
        tbodyId: 'tablaEquiposBody',
        filtroId: 'filtroEquipos',
        pagId:    'paginadorEquipos',
        colSpan:  7,
        data: [], filtro: '', pagina: 1, porPagina: 20,
        renderFila: r => `
            <td>${esc(r.nombre)}${r.activo ? '' : ' <span style="color:#aaa;font-size:11px">(inactivo)</span>'}</td>
            <td>${esc(r.marca || '-')}</td>
            <td>${esc(r.modelo || '-')}</td>
            <td>${esc(r.nroSerie || '-')}</td>
            <td>${esc(r.certificacion || '-')}</td>
            <td>${r.vencimiento ? formatFechaTabla(r.vencimiento) : '-'}</td>`,
        textoVacio: 'No hay equipos registrados.',
        textoBuscar: r => `${r.nombre} ${r.marca || ''} ${r.modelo || ''} ${r.nroSerie || ''} ${r.certificacion || ''}`,
        editUrl: id => `${API_URL}/equipos/${id}`,
        renderFilaEdit: r => `
            <td><input class="unidad-inline-input" id="ef-nombre" value="${esc(r.nombre)}" style="width:100%"></td>
            <td><input class="unidad-inline-input" id="ef-marca" value="${esc(r.marca || '')}" style="width:100%"></td>
            <td><input class="unidad-inline-input" id="ef-modelo" value="${esc(r.modelo || '')}" style="width:100%"></td>
            <td><input class="unidad-inline-input" id="ef-nroSerie" value="${esc(r.nroSerie || '')}" style="width:100%"></td>
            <td><input class="unidad-inline-input" id="ef-certificacion" value="${esc(r.certificacion || '')}" style="width:100%"></td>
            <td><input type="date" class="unidad-inline-input" id="ef-vencimiento" value="${r.vencimiento || ''}"></td>`,
        buildPutBody: r => ({
            nombre:        document.getElementById('ef-nombre').value.trim(),
            marca:         document.getElementById('ef-marca').value.trim() || null,
            modelo:        document.getElementById('ef-modelo').value.trim() || null,
            nroSerie:      document.getElementById('ef-nroSerie').value.trim() || null,
            certificacion: document.getElementById('ef-certificacion').value.trim() || null,
            vencimiento:   document.getElementById('ef-vencimiento').value || null,
            activo:        r.activo,
        }),
    },
};

// ── Carga inicial ──
document.addEventListener('DOMContentLoaded', async () => {
    inicializarHeader();
    await cargarGruposInforme();
    Object.keys(tablas).forEach(nombre => {
        cargarTabla(nombre);
        document.getElementById(tablas[nombre].filtroId)
            .addEventListener('input', e => {
                tablas[nombre].filtro = e.target.value.toLowerCase().trim();
                tablas[nombre].pagina = 1;
                renderTabla(nombre);
            });
    });
    cargarNumeradores();
});

// ── Numeradores ──
async function cargarNumeradores() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/numeradores`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderNumeradores(data);
    } catch {
        document.getElementById('tablaNumeradoresBody').innerHTML =
            `<tr><td colspan="2" class="text-center text-danger" style="padding:16px;">Error al cargar los numeradores.</td></tr>`;
    }
}

function renderNumeradores(data) {
    document.getElementById('tablaNumeradoresBody').innerHTML = data.length === 0
        ? `<tr><td colspan="2" class="text-center" style="padding:16px;color:#6c757d;">Sin numeradores registrados.</td></tr>`
        : data.map(n => `
            <tr>
                <td><code style="font-size:13px;">${n.nombre}</code></td>
                <td>
                    <input type="number" class="unidad-inline-input" value="${n.valor}" min="0"
                           title="Presioná Enter o hacé clic fuera para guardar"
                           onblur="guardarNumerador(${n.id}, this)"
                           onkeydown="if(event.key==='Enter') this.blur();">
                </td>
            </tr>`).join('');
}

async function guardarNumerador(id, input) {
    const valor = parseInt(input.value, 10);
    if (isNaN(valor) || valor < 0) {
        input.classList.add('campo-error');
        setTimeout(() => input.classList.remove('campo-error'), 1500);
        return;
    }
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/numeradores/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ valor })
        });
        if (!res.ok) throw new Error();
        mostrarToast('Numerador actualizado correctamente.');
    } catch {
        mostrarToast('No se pudo actualizar el numerador.', 'danger');
    }
}

async function cargarTabla(nombre) {
    const t = tablas[nombre];
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(t.url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        t.data = await res.json();
        if (t.sortFn) t.data.sort(t.sortFn);
        renderTabla(nombre);
    } catch (err) {
        console.error(`Error cargando ${nombre}:`, err);
        document.getElementById(t.tbodyId).innerHTML =
            `<tr><td colspan="${t.colSpan}" class="text-center text-danger">Error al cargar los datos</td></tr>`;
    }
}

function renderTabla(nombre) {
    const t = tablas[nombre];

    const filtrados = t.filtro
        ? t.data.filter(r => t.textoBuscar(r).toLowerCase().includes(t.filtro))
        : t.data;

    const pp = t.porPagina || 10;
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / pp));
    if (t.pagina > totalPaginas) t.pagina = totalPaginas;

    const inicio = (t.pagina - 1) * pp;
    const pagina = filtrados.slice(inicio, inicio + pp);

    const tbody = document.getElementById(t.tbodyId);

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${t.colSpan}" class="text-center" style="padding:16px;color:#6c757d;">
            ${t.filtro ? 'Sin resultados para la búsqueda.' : t.textoVacio}
        </td></tr>`;
    } else {
        tbody.innerHTML = pagina.map(r => `
            <tr data-id="${r.id}">
                ${t.renderFila(r)}
                <td>
                    <div class="tabla-acciones">
                        ${t.renderAccionesExtra ? t.renderAccionesExtra(r) : ''}
                        ${t.editUrl ? `<button class="btn-accion-info" onclick="iniciarEdicion('${nombre}', ${r.id})" title="Editar"><i class="bi bi-pencil"></i></button>` : ''}
                        <button class="btn-accion-danger" onclick="eliminar('${nombre}', ${r.id})" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`).join('');
    }

    renderPaginador(nombre, filtrados.length, totalPaginas);
}

function renderPaginador(nombre, total, totalPaginas) {
    const t = tablas[nombre];
    const pp = t.porPagina || 10;
    const inicio = Math.min((t.pagina - 1) * pp + 1, total);
    const fin    = Math.min(t.pagina * pp, total);

    const infoTexto = total === 0
        ? 'Sin resultados'
        : `Mostrando ${inicio}–${fin} de ${total}`;

    const opcionesPP = [5, 10, 15].map(v =>
        `<option value="${v}" ${pp === v ? 'selected' : ''}>${v}</option>`
    ).join('');

    document.getElementById(t.pagId).innerHTML = `
        <span class="pag-info">${infoTexto}</span>
        <div class="pag-controles">
            <label class="pag-pp-label">Por página:
                <select class="pag-pp-select" onchange="cambiarPorPagina('${nombre}', this.value)">
                    ${opcionesPP}
                </select>
            </label>
            <button class="pag-btn" onclick="cambiarPagina('${nombre}', ${t.pagina - 1})"
                ${t.pagina <= 1 ? 'disabled' : ''}>‹ Anterior</button>
            <span class="pag-pagina">${t.pagina} / ${totalPaginas}</span>
            <button class="pag-btn" onclick="cambiarPagina('${nombre}', ${t.pagina + 1})"
                ${t.pagina >= totalPaginas ? 'disabled' : ''}>Siguiente ›</button>
        </div>`;
}

function cambiarPorPagina(nombre, valor) {
    tablas[nombre].porPagina = parseInt(valor, 10);
    tablas[nombre].pagina = 1;
    renderTabla(nombre);
}

function cambiarPagina(nombre, nuevaPagina) {
    tablas[nombre].pagina = nuevaPagina;
    renderTabla(nombre);
}

// ── Formularios ──
async function cargarEmpleados() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) return;
        const todos = await res.json();
        empleadosCache = todos.filter(u => u.rol === 'ROLE_EMPLEADO' || u.rol === 'ROLE_IT');
        const sel = document.getElementById('paramAnalista');
        if (sel) {
            sel.innerHTML = '<option value="">Sin asignar</option>' +
                empleadosCache.map(u => `<option value="${u.id}">${esc(u.username)}</option>`).join('');
        }
    } catch (err) {
        console.error('Error cargando empleados:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarMatrices();
    cargarEmpleados();

    document.getElementById('formParametro').addEventListener('submit', async e => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const respVal = document.getElementById('paramAnalista').value;
        const tipoVal = document.getElementById('paramTipo').value;
        const body = {
            nombre:        document.getElementById('paramNombre').value.trim(),
            tipoAnalisis:  tipoVal || null,
            responsableId: respVal ? Number(respVal) : null,
        };
        try {
            const res = await fetch(`${API_URL}/parametros`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            e.target.reset();
            cargarTabla('parametros');
        } catch (err) {
            console.error('Error guardando parámetro:', err);
            mostrarToast('No se pudo guardar el parámetro.', 'danger');
        }
    });

    document.getElementById('formResolucion').addEventListener('submit', async e => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const body = {
            nombre:      document.getElementById('resNombre').value.trim(),
            descripcion: document.getElementById('resOrganismo').value.trim(),
            matrizId:    Number(document.getElementById('resMatriz').value),
        };
        try {
            const res = await fetch(`${API_URL}/resoluciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            e.target.reset();
            cargarTabla('resoluciones');
        } catch (err) {
            console.error('Error guardando resolución:', err);
            mostrarToast('No se pudo guardar la resolución.', 'danger');
        }
    });

    document.getElementById('formTipoMuestra').addEventListener('submit', async e => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const body = {
            nombre:   document.getElementById('tmNombre').value.trim(),
            matrizId: Number(document.getElementById('tmMatriz').value),
        };
        try {
            const res = await fetch(`${API_URL}/tipos-muestra`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            e.target.reset();
            cargarTabla('tiposmuestra');
        } catch (err) {
            console.error('Error guardando tipo de muestra:', err);
            mostrarToast('No se pudo guardar el tipo de muestra.', 'danger');
        }
    });

    document.getElementById('formMetodologia').addEventListener('submit', async e => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const body = {
            nombre:      document.getElementById('metNombre').value.trim(),
            descripcion: document.getElementById('metReferencia').value.trim(),
        };
        try {
            const res = await fetch(`${API_URL}/metodologias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            e.target.reset();
            cargarTabla('metodologias');
        } catch (err) {
            console.error('Error guardando metodología:', err);
            mostrarToast('No se pudo guardar la metodología.', 'danger');
        }
    });

    document.getElementById('formCategoriaDoc').addEventListener('submit', async e => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const nombre = document.getElementById('catDocNombre').value.trim();
        try {
            const res = await fetch(`${API_URL}/categorias-documento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ nombre }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            e.target.reset();
            cargarTabla('categoriasDoc');
            mostrarToast('Categoría guardada.');
        } catch (err) {
            console.error('Error guardando categoría:', err);
            mostrarToast('No se pudo guardar la categoría.', 'danger');
        }
    });

    document.getElementById('formGrupoInforme').addEventListener('submit', async e => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const label = document.getElementById('grupoLabel').value.trim();
        const codigoRaw = document.getElementById('grupoCodigo').value.trim();
        const codigo = codigoRaw
            || label.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        const orden = parseInt(document.getElementById('grupoOrden').value) || 0;
        try {
            const res = await fetch(`${API_URL}/grupos-informe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ label, codigo, orden }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            e.target.reset();
            document.getElementById('grupoOrden').value = '0';
            await cargarGruposInforme();
            cargarTabla('gruposInforme');
            mostrarToast('Grupo guardado.');
        } catch (err) {
            console.error('Error guardando grupo:', err);
            mostrarToast('No se pudo guardar el grupo.', 'danger');
        }
    });

    document.getElementById('formEquipo').addEventListener('submit', async e => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const body = {
            nombre:        document.getElementById('equipoNombre').value.trim(),
            marca:         document.getElementById('equipoMarca').value.trim() || null,
            modelo:        document.getElementById('equipoModelo').value.trim() || null,
            nroSerie:      document.getElementById('equipoNroSerie').value.trim() || null,
            certificacion: document.getElementById('equipoCertificacion').value.trim() || null,
            vencimiento:   document.getElementById('equipoVencimiento').value || null,
        };
        try {
            const res = await fetch(`${API_URL}/equipos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            e.target.reset();
            cargarTabla('equipos');
            mostrarToast('Equipo guardado.');
        } catch (err) {
            console.error('Error guardando equipo:', err);
            mostrarToast('No se pudo guardar el equipo.', 'danger');
        }
    });
});

async function cargarMatrices() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/matrices`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const matrices = await res.json();
        ['resMatriz', 'tmMatriz'].forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            matrices.filter(m => m.activo).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.nombre;
                select.appendChild(opt);
            });
        });

        // También poblar el select del modal de metodologías
        const selMetodo = document.getElementById('metodoSelectMatriz');
        if (selMetodo) {
            matrices.filter(m => m.activo).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.nombre;
                selMetodo.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Error cargando matrices:', err);
    }
}

// ── Editor de parámetros de resolución ──
let _currentResolucionId = null;
let _currentDetalle = null;

async function verParametros(id) {
    _currentResolucionId = id;
    const overlay = document.getElementById('paramsOverlay');
    const titulo  = document.getElementById('paramsModalTitulo');
    const cuerpo  = document.getElementById('paramsModalCuerpo');

    titulo.textContent = 'Cargando...';
    cuerpo.innerHTML   = '<p class="params-loading">Cargando parámetros...</p>';
    overlay.classList.add('visible');

    await _cargarYRenderModalParams();
}

async function _cargarYRenderModalParams() {
    const token = localStorage.getItem('token');
    const cuerpo = document.getElementById('paramsModalCuerpo');
    try {
        const [resDetalle, resParams] = await Promise.all([
            fetch(`${API_URL}/resoluciones/${_currentResolucionId}/detalle`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/parametros`, { headers: { 'Authorization': `Bearer ${token}` } }),
        ]);
        if (!resDetalle.ok || !resParams.ok) throw new Error('Error HTTP');
        const [detalle, todosLosParams] = await Promise.all([resDetalle.json(), resParams.json()]);
        _currentDetalle = detalle;

        document.getElementById('paramsModalTitulo').textContent = detalle.nombre;
        _renderEditorParams(detalle, todosLosParams);
    } catch (err) {
        console.error('Error cargando parámetros:', err);
        cuerpo.innerHTML = '<p class="params-error">Error al cargar los datos.</p>';
    }
}

function _renderEditorParams(detalle, todosLosParams) {
    const cuerpo = document.getElementById('paramsModalCuerpo');
    const destinos = detalle.destinos || [];

    const crearDestinoHtml = `
        <div class="destino-crear-form">
            <input type="text" id="nuevoDestinoNombre" class="unidad-inline-input"
                   placeholder="Nombre del destino (ej: Colectora Cloacal)">
            <button type="button" class="btn-guardar-custom" onclick="crearDestino()">
                <i class="bi bi-plus-circle"></i> Agregar destino
            </button>
        </div>`;

    if (destinos.length === 0) {
        cuerpo.innerHTML = crearDestinoHtml +
            `<p class="params-vacio" style="padding:2rem 0;">No hay destinos configurados. Agreguá el primero.</p>`;
        return;
    }

    const destinosSections = destinos.map(d => {
        const includedIds = new Set((d.parametros || []).map(p => p.id));
        const excluded = todosLosParams
            .filter(p => !includedIds.has(p.id))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

        const filasIncluidos = (d.parametros || []).length > 0
            ? [...(d.parametros || [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(p => {
                const opcionesTipo = TIPOS_ANALISIS.map(t =>
                    `<option value="${t.value}" ${p.tipoAnalisis === t.value ? 'selected' : ''}>${t.label}</option>`
                ).join('');
                return `
                <tr>
                    <td>${esc(p.nombre)}</td>
                    <td>
                        <input type="text" class="unidad-inline-input" value="${esc(p.unidad || '')}"
                               placeholder="sin unidad"
                               onblur="actualizarUnidadParamDestino(${d.id}, ${p.id}, this.value)"
                               onkeydown="if(event.key==='Enter'){this.blur();}">
                    </td>
                    <td>${formatearLimite(p)}</td>
                    <td>
                        <select class="form-control-custom" style="font-size:12px;padding:4px 8px;min-width:140px;"
                                onchange="actualizarTipoParamDestino(${d.id}, ${p.id}, this.value)">
                            <option value="">— Sin grupo —</option>
                            ${opcionesTipo}
                        </select>
                    </td>
                    <td>
                        <div class="tabla-acciones">
                            <button class="btn-accion-info" onclick="abrirEditorLimite(${d.id}, ${p.id})" title="Editar límite">
                                <i class="bi bi-sliders"></i>
                            </button>
                            <button class="btn-accion-danger" onclick="quitarParamDeDestino(${d.id}, ${p.id})" title="Quitar">
                                <i class="bi bi-dash-circle"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            }).join('')
            : `<tr><td colspan="5" class="params-vacio">Sin parámetros configurados.</td></tr>`;

        const filasExcluidos = excluded.length > 0
            ? excluded.map(p => `
                <tr data-nombre-excluido="${p.nombre.toLowerCase()}" data-destino-excluido="${d.id}">
                    <td>${esc(p.nombre)}</td>
                    <td><input type="text" id="unidadInput_${d.id}_${p.id}" class="unidad-inline-input" placeholder="ej: mg/L"></td>
                    <td>
                        <button class="btn-accion-info" onclick="agregarParamADestino(${d.id}, ${p.id})" title="Agregar">
                            <i class="bi bi-plus-circle"></i>
                        </button>
                    </td>
                </tr>`).join('')
            : `<tr><td colspan="3" class="params-vacio">Todos los parámetros están incluidos.</td></tr>`;

        return `
            <div class="destino-section">
                <div class="destino-section-header" onclick="toggleDestinoSection(this)">
                    <div class="destino-header-left">
                        <i class="bi bi-chevron-down destino-toggle-icon"></i>
                        <span class="destino-nombre">${esc(d.nombre)}</span>
                    </div>
                    <button class="btn-accion-danger" onclick="event.stopPropagation();eliminarDestino(${d.id})" title="Eliminar destino">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <div class="destino-section-body">
                    <div class="params-section-label">Parámetros (${(d.parametros || []).length})</div>
                    <table class="tabla-config">
                        <thead><tr><th>Parámetro</th><th style="white-space:nowrap;min-width:62px">Unidad</th><th>Límite</th><th>Grupo en informe</th><th></th></tr></thead>
                        <tbody>${filasIncluidos}</tbody>
                    </table>
                    <details class="destino-agregar-params">
                        <summary>Agregar parámetros a este destino (${excluded.length} disponibles)</summary>
                        <input type="text" class="tabla-filtro params-buscador" placeholder="Buscar..."
                               oninput="filtrarParamsExcluidosDestino(this, ${d.id})">
                        <table class="tabla-config">
                            <thead><tr><th>Parámetro</th><th style="white-space:nowrap;min-width:62px">Unidad</th><th></th></tr></thead>
                            <tbody>${filasExcluidos}</tbody>
                        </table>
                    </details>
                </div>
            </div>`;
    }).join('');

    cuerpo.innerHTML = crearDestinoHtml + destinosSections;
}

function toggleDestinoSection(header) {
    header.closest('.destino-section').classList.toggle('collapsed');
}

function filtrarParamsExcluidosDestino(input, destinoId) {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll(`tr[data-destino-excluido="${destinoId}"]`).forEach(tr => {
        tr.style.display = !q || tr.dataset.nombreExcluido.includes(q) ? '' : 'none';
    });
}

async function crearDestino() {
    const nombre = (document.getElementById('nuevoDestinoNombre')?.value || '').trim();
    if (!nombre) { mostrarToast('Ingresá un nombre para el destino.', 'danger'); return; }
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/resoluciones/${_currentResolucionId}/destinos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ nombre }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await _cargarYRenderModalParams();
    } catch {
        mostrarToast('No se pudo crear el destino.', 'danger');
    }
}

async function eliminarDestino(destinoId) {
    const ok = await UI.confirmar({
        titulo: '¿Eliminar este destino?',
        subtexto: 'Se eliminarán también sus parámetros configurados.',
        textoConfirmar: 'Eliminar',
        tipo: 'danger',
    });
    if (!ok) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/resoluciones/${_currentResolucionId}/destinos/${destinoId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        await _cargarYRenderModalParams();
    } catch {
        mostrarToast('No se pudo eliminar el destino.', 'danger');
    }
}

async function agregarParamADestino(destinoId, parametroId) {
    const unidad = (document.getElementById(`unidadInput_${destinoId}_${parametroId}`)?.value || '').trim();
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/resoluciones/${_currentResolucionId}/destinos/${destinoId}/parametros/${parametroId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ unidad: unidad || null }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await _cargarYRenderModalParams();
    } catch {
        mostrarToast('No se pudo agregar el parámetro.', 'danger');
    }
}

async function actualizarUnidadParamDestino(destinoId, parametroId, unidad) {
    const token = localStorage.getItem('token');
    try {
        await fetch(`${API_URL}/resoluciones/${_currentResolucionId}/destinos/${destinoId}/parametros/${parametroId}/unidad`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ unidad: unidad.trim() || null }),
        });
    } catch {
        mostrarToast('No se pudo actualizar la unidad.', 'danger');
    }
}

async function quitarParamDeDestino(destinoId, parametroId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/resoluciones/${_currentResolucionId}/destinos/${destinoId}/parametros/${parametroId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        mostrarToast('Parámetro quitado del destino.', 'success');
        await _cargarYRenderModalParams();
    } catch {
        mostrarToast('No se pudo quitar el parámetro.', 'danger');
    }
}

function formatearLimite(p) {
    if (!p.tipoLimite) return p.limiteTexto || '-';
    if (p.tipoLimite === 'RANGO')    return `${p.valorMinimo ?? '?'} – ${p.valorMaximo ?? '?'}`;
    if (p.tipoLimite === 'MAX')      return `≤ ${p.valorMaximo}`;
    if (p.tipoLimite === 'MIN')      return `≥ ${p.valorMinimo}`;
    if (p.tipoLimite === 'TEXTO')    return p.limiteTexto || '-';
    if (p.tipoLimite === 'AUSENCIA') return 'Ausencia';
    if (p.tipoLimite === 'NE')       return 'No exigido';
    if (p.tipoLimite === 'NL')       return '—';
    return '-';
}

// ── Editor de límite de parámetro ──
function abrirEditorLimite(destinoId, parametroId) {
    const destino = (_currentDetalle?.destinos || []).find(d => d.id === destinoId);
    const p = destino ? (destino.parametros || []).find(x => x.id === parametroId) : null;
    if (!p) return;

    document.getElementById('limiteDestinoId').value         = destinoId;
    document.getElementById('limiteParamId').value           = parametroId;
    document.getElementById('limiteModalTitulo').textContent = `Límite — ${p.nombre} (${esc(destino.nombre)})`;
    document.getElementById('limiteTipo').value              = p.tipoLimite || 'NE';
    document.getElementById('limiteMin').value               = p.valorMinimo ?? '';
    document.getElementById('limiteMax').value               = p.valorMaximo ?? '';
    document.getElementById('limiteTextoInput').value        = p.limiteTexto || '';
    onTipoLimiteCambio();
    document.getElementById('limiteOverlay').classList.add('visible');
}

function onTipoLimiteCambio() {
    const tipo = document.getElementById('limiteTipo').value;
    document.getElementById('limiteGrupoMax').style.display   = ['MAX', 'RANGO'].includes(tipo) ? '' : 'none';
    document.getElementById('limiteGrupoMin').style.display   = ['MIN', 'RANGO'].includes(tipo) ? '' : 'none';
    document.getElementById('limiteGrupoTexto').style.display = tipo === 'TEXTO' ? '' : 'none';
}

async function guardarLimiteParam() {
    const destinoId   = document.getElementById('limiteDestinoId').value;
    const parametroId = document.getElementById('limiteParamId').value;
    const tipoLimite  = document.getElementById('limiteTipo').value;
    const minVal      = document.getElementById('limiteMin').value;
    const maxVal      = document.getElementById('limiteMax').value;
    const valorMinimo = minVal !== '' ? minVal.trim() : null;
    const valorMaximo = maxVal !== '' ? maxVal.trim() : null;
    const limiteTexto = document.getElementById('limiteTextoInput').value.trim() || null;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(
            `${API_URL}/resoluciones/${_currentResolucionId}/destinos/${destinoId}/parametros/${parametroId}/limite`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tipoLimite, valorMinimo, valorMaximo, limiteTexto }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        document.getElementById('limiteOverlay').classList.remove('visible');
        mostrarToast('Límite actualizado.', 'success');
        await _cargarYRenderModalParams();
    } catch (err) {
        console.error('Error guardando límite:', err);
        mostrarToast('No se pudo guardar el límite.', 'danger');
    }
}

function cerrarLimiteOverlay(event) {
    if (event.target === event.currentTarget) {
        event.currentTarget.classList.remove('visible');
    }
}

function cerrarModalParams(event) {
    if (event.target === event.currentTarget) {
        event.currentTarget.classList.remove('visible');
    }
}

// ── Edición inline ──
function iniciarEdicion(tablaNombre, id) {
    const t = tablas[tablaNombre];
    if (!t.editUrl) return;
    const r = t.data.find(x => x.id === id);
    if (!r) return;

    const tr = document.querySelector(`#${t.tbodyId} tr[data-id="${id}"]`);
    if (!tr) return;

    tr.innerHTML = `
        ${t.renderFilaEdit(r)}
        <td>
            <div class="tabla-acciones">
                <button class="btn-accion-success" onclick="guardarEdicionFila('${tablaNombre}', ${id})" title="Guardar">
                    <i class="bi bi-check-lg"></i>
                </button>
                <button class="btn-accion-muted" onclick="renderTabla('${tablaNombre}')" title="Cancelar">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        </td>`;

    const primer = tr.querySelector('input');
    if (primer) { primer.focus(); primer.select(); }

    tr.querySelector('input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') guardarEdicionFila(tablaNombre, id);
        if (e.key === 'Escape') renderTabla(tablaNombre);
    });
}

async function guardarEdicionFila(tablaNombre, id) {
    const t = tablas[tablaNombre];
    const r = t.data.find(x => x.id === id);
    if (!r) return;

    const body = t.buildPutBody(r);
    if (!(body.nombre ?? body.label ?? body.codigo)?.trim()) {
        mostrarToast('El nombre no puede estar vacío.', 'danger');
        return;
    }

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(t.editUrl(id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        mostrarToast('Guardado correctamente.');
        cargarTabla(tablaNombre);
        if (tablaNombre === 'gruposInforme') await cargarGruposInforme();
    } catch (err) {
        console.error('Error guardando edición:', err);
        mostrarToast('No se pudo guardar.', 'danger');
    }
}

// ── Eliminar ──
async function eliminar(nombre, id) {
    const labels = {
        resoluciones:  'resolución',
        parametros:    'parámetro',
        metodologias:  'metodología',
        tiposmuestra:  'tipo de muestra',
        categoriasDoc: 'categoría',
        gruposInforme: 'grupo de informe',
    };
    const ok = await UI.confirmar({ titulo: `¿Eliminar esta ${labels[nombre] || 'entrada'}?`, subtexto: 'Esta acción no se puede deshacer.', textoConfirmar: 'Eliminar', tipo: 'danger' });
    if (!ok) return;

    const endpoints = {
        resoluciones:  `${API_URL}/resoluciones/${id}`,
        parametros:    `${API_URL}/parametros/${id}`,
        metodologias:  `${API_URL}/metodologias/${id}`,
        tiposmuestra:  `${API_URL}/tipos-muestra/${id}`,
        categoriasDoc: `${API_URL}/categorias-documento/${id}`,
        gruposInforme: `${API_URL}/grupos-informe/${id}`,
        equipos: `${API_URL}/equipos/${id}`,
    };

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(endpoints[nombre], {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cargarTabla(nombre);
        if (nombre === 'gruposInforme') await cargarGruposInforme();
    } catch (err) {
        console.error(`Error eliminando ${nombre}:`, err);
        mostrarToast('No se pudo eliminar el elemento.', 'danger');
    }
}

// ── Metodologías de un parámetro ─────────────────────────────────────────────

let _metodoParamId   = null;
let _metodologiasList = [];  // cache para el select

async function verMetodologias(parametroId, parametroNombre) {
    _metodoParamId = parametroId;
    document.getElementById('metodoModalTitulo').textContent = `Metodologías — ${parametroNombre}`;
    document.getElementById('metodoTbody').innerHTML = '<tr><td colspan="3" style="padding:12px;color:#888">Cargando…</td></tr>';
    document.getElementById('metodoSearchInput').value = '';
    document.getElementById('metodoSelectMetod').value = '';
    document.getElementById('metodoComboDrop').style.display = 'none';
    document.getElementById('metodoOverlay').classList.add('visible');

    await Promise.all([
        _cargarMetodologiasDelParam(),
        _poblarSelectMetodologias(),
    ]);
}

async function _cargarMetodologiasDelParam() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/parametros/${_metodoParamId}/metodologias`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const lista = await res.json();
        _renderMetodoTabla(lista);
    } catch {
        document.getElementById('metodoTbody').innerHTML =
            '<tr><td colspan="3" style="color:var(--rojo,red);padding:12px">Error al cargar.</td></tr>';
    }
}

function _renderMetodoTabla(lista) {
    const tbody = document.getElementById('metodoTbody');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:12px;color:#888;text-align:center">Sin metodologías asociadas.</td></tr>';
        return;
    }
    tbody.innerHTML = lista.map(pm => {
        const opciones = TIPOS_ANALISIS.map(t =>
            `<option value="${t.value}" ${pm.tipoAnalisis === t.value ? 'selected' : ''}>${t.label}</option>`
        ).join('');
        return `
        <tr>
            <td>${esc(pm.metodologia?.nombre || '—')}</td>
            <td>${pm.matriz ? esc(pm.matriz.nombre) : '<span style="color:#aaa;font-style:italic">Cualquier matriz</span>'}</td>
            <td>
                <select class="form-control-custom metodo-tipo-select" style="font-size:12px;padding:4px 8px;"
                        onchange="actualizarTipoMetodologia(${pm.id}, this.value)">
                    <option value="">— Sin grupo —</option>
                    ${opciones}
                </select>
            </td>
            <td>
                <div class="tabla-acciones">
                    <button class="btn-accion-danger" onclick="quitarMetodologia(${pm.id})" title="Quitar">
                        <i class="bi bi-dash-circle"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function _poblarSelectMetodologias() {
    const token = localStorage.getItem('token');
    try {
        if (_metodologiasList.length === 0) {
            const res = await fetch(`${API_URL}/metodologias`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) return;
            _metodologiasList = (await res.json()).sort((a, b) =>
                a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
        }
        _initMetodoCombo();
    } catch {
        // silencioso
    }
}

function _renderComboDrop(query) {
    const input = document.getElementById('metodoSearchInput');
    const drop  = document.getElementById('metodoComboDrop');
    const q = query.toLowerCase();
    const filtrados = q ? _metodologiasList.filter(m => m.nombre.toLowerCase().includes(q)) : _metodologiasList;
    if (filtrados.length === 0) {
        drop.innerHTML = '<div class="metodo-combo-item metodo-combo-empty">Sin resultados</div>';
    } else {
        drop.innerHTML = filtrados.map(m =>
            `<div class="metodo-combo-item" data-id="${m.id}" data-nombre="${esc(m.nombre)}">${esc(m.nombre)}</div>`
        ).join('');
        drop.querySelectorAll('.metodo-combo-item').forEach(item => {
            item.addEventListener('mousedown', e => {
                e.preventDefault();
                document.getElementById('metodoSelectMetod').value = item.dataset.id;
                document.getElementById('metodoSearchInput').value = item.dataset.nombre;
                drop.style.display = 'none';
            });
        });
    }
    // Posicionar con fixed para escapar del overflow del modal
    const rect = input.getBoundingClientRect();
    drop.style.top   = (rect.bottom + 2) + 'px';
    drop.style.left  = rect.left + 'px';
    drop.style.width = rect.width + 'px';
    drop.style.display = 'block';
}

function _initMetodoCombo() {
    const input = document.getElementById('metodoSearchInput');
    const clone = input.cloneNode(true);
    input.parentNode.replaceChild(clone, input);

    clone.addEventListener('input', e => {
        document.getElementById('metodoSelectMetod').value = '';
        _renderComboDrop(e.target.value.trim());
    });
    clone.addEventListener('focus', () => _renderComboDrop(clone.value.trim()));
    clone.addEventListener('blur', () => {
        setTimeout(() => { document.getElementById('metodoComboDrop').style.display = 'none'; }, 150);
    });
}

async function agregarMetodologia() {
    const metodologiaId = document.getElementById('metodoSelectMetod').value;
    if (!metodologiaId) { mostrarToast('Seleccioná una metodología.', 'danger'); return; }

    const matrizVal = document.getElementById('metodoSelectMatriz').value;
    const tipoVal   = document.getElementById('metodoSelectTipo').value;
    const body = {
        metodologiaId: Number(metodologiaId),
        matrizId:      matrizVal ? Number(matrizVal) : null,
        tipoAnalisis:  tipoVal   || null,
    };

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/parametros/${_metodoParamId}/metodologias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.text();
            mostrarToast(err || 'No se pudo agregar la metodología.', 'danger');
            return;
        }
        mostrarToast('Metodología agregada.', 'success');
        document.getElementById('metodoSearchInput').value = '';
        document.getElementById('metodoSelectMetod').value = '';
        document.getElementById('metodoSelectMatriz').value = '';
        document.getElementById('metodoSelectTipo').value = '';
        await _cargarMetodologiasDelParam();
    } catch {
        mostrarToast('Error de conexión.', 'danger');
    }
}

async function actualizarTipoParamDestino(destinoId, parametroId, tipoAnalisis) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/resoluciones/${_currentResolucionId}/destinos/${destinoId}/parametros/${parametroId}/tipo-analisis`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tipoAnalisis: tipoAnalisis || null }),
        });
        if (!res.ok) { mostrarToast('No se pudo actualizar el grupo.', 'danger'); return; }
        mostrarToast('Grupo actualizado.', 'success');
    } catch {
        mostrarToast('Error de conexión.', 'danger');
    }
}

async function actualizarTipoMetodologia(pmId, tipoAnalisis) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/parametros/${_metodoParamId}/metodologias/${pmId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tipoAnalisis: tipoAnalisis || null }),
        });
        if (!res.ok) { mostrarToast('No se pudo actualizar el grupo.', 'danger'); return; }
        mostrarToast('Grupo actualizado.', 'success');
    } catch {
        mostrarToast('Error de conexión.', 'danger');
    }
}

async function quitarMetodologia(pmId) {
    const ok = await UI.confirmar({
        titulo: '¿Quitar esta metodología?',
        subtexto: 'Se eliminará la asociación, no la metodología en sí.',
        textoConfirmar: 'Quitar',
        tipo: 'danger',
    });
    if (!ok) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/parametros/${_metodoParamId}/metodologias/${pmId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        mostrarToast('Metodología quitada.', 'success');
        await _cargarMetodologiasDelParam();
    } catch {
        mostrarToast('No se pudo quitar la metodología.', 'danger');
    }
}

function cerrarMetodoOverlay(event) {
    if (event.target === event.currentTarget) {
        event.currentTarget.classList.remove('visible');
    }
}
