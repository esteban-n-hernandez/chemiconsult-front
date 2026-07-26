const API_URL = `${API_BASE}/api`;
const POR_PAGINA = 10;

// ── Estado por tabla ──
const tablas = {
    resoluciones: {
        url: `${API_URL}/resoluciones`,
        tbodyId: 'tablaResolucionesBody',
        filtroId: 'filtroResoluciones',
        pagId:    'paginadorResoluciones',
        colSpan:  3,
        data: [], filtro: '', pagina: 1,
        renderFila: r => `<td>${r.nombre}</td><td>${r.descripcion || '-'}</td>`,
        textoVacio: 'No hay resoluciones registradas.',
        textoBuscar: r => `${r.nombre} ${r.descripcion || ''}`,
    },
    parametros: {
        url: `${API_URL}/parametros`,
        tbodyId: 'tablaParametrosBody',
        filtroId: 'filtroParametros',
        pagId:    'paginadorParametros',
        colSpan:  3,
        data: [], filtro: '', pagina: 1,
        renderFila: r => `<td>${r.nombre}</td><td>${r.unidad || '-'}</td>`,
        textoVacio: 'No hay parámetros cargados.',
        textoBuscar: r => `${r.nombre} ${r.unidad || ''}`,
    },
    metodologias: {
        url: `${API_URL}/metodologias`,
        tbodyId: 'tablaMetodologiasBody',
        filtroId: 'filtroMetodologias',
        pagId:    'paginadorMetodologias',
        colSpan:  4,
        data: [], filtro: '', pagina: 1,
        renderFila: r => `<td>${r.descripcion || '-'}</td><td>${r.nombre}</td><td>-</td>`,
        textoVacio: 'No hay metodologías cargadas.',
        textoBuscar: r => `${r.nombre} ${r.descripcion || ''}`,
    },
};

// ── Carga inicial ──
document.addEventListener('DOMContentLoaded', () => {
    Object.keys(tablas).forEach(nombre => {
        cargarTabla(nombre);
        document.getElementById(tablas[nombre].filtroId)
            .addEventListener('input', e => {
                tablas[nombre].filtro = e.target.value.toLowerCase().trim();
                tablas[nombre].pagina = 1;
                renderTabla(nombre);
            });
    });
});

async function cargarTabla(nombre) {
    const t = tablas[nombre];
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(t.url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        t.data = await res.json();
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

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
    if (t.pagina > totalPaginas) t.pagina = totalPaginas;

    const inicio = (t.pagina - 1) * POR_PAGINA;
    const pagina = filtrados.slice(inicio, inicio + POR_PAGINA);

    const tbody = document.getElementById(t.tbodyId);

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${t.colSpan}" class="text-center" style="padding:16px;color:#6c757d;">
            ${t.filtro ? 'Sin resultados para la búsqueda.' : t.textoVacio}
        </td></tr>`;
    } else {
        tbody.innerHTML = pagina.map(r => `
            <tr>
                ${t.renderFila(r)}
                <td>
                    <button class="btn-accion-danger" onclick="eliminar('${nombre}', ${r.id})" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>`).join('');
    }

    renderPaginador(nombre, filtrados.length, totalPaginas);
}

function renderPaginador(nombre, total, totalPaginas) {
    const t = tablas[nombre];
    const inicio = Math.min((t.pagina - 1) * POR_PAGINA + 1, total);
    const fin    = Math.min(t.pagina * POR_PAGINA, total);

    const infoTexto = total === 0
        ? 'Sin resultados'
        : `Mostrando ${inicio}–${fin} de ${total}`;

    document.getElementById(t.pagId).innerHTML = `
        <span class="pag-info">${infoTexto}</span>
        <div class="pag-controles">
            <button class="pag-btn" onclick="cambiarPagina('${nombre}', ${t.pagina - 1})"
                ${t.pagina <= 1 ? 'disabled' : ''}>‹ Anterior</button>
            <span class="pag-pagina">${t.pagina} / ${totalPaginas}</span>
            <button class="pag-btn" onclick="cambiarPagina('${nombre}', ${t.pagina + 1})"
                ${t.pagina >= totalPaginas ? 'disabled' : ''}>Siguiente ›</button>
        </div>`;
}

function cambiarPagina(nombre, nuevaPagina) {
    tablas[nombre].pagina = nuevaPagina;
    renderTabla(nombre);
}

// ── Formularios ──
document.addEventListener('DOMContentLoaded', () => {
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
});

// ── Eliminar ──
async function eliminar(nombre, id) {
    const labels = { resoluciones: 'resolución', parametros: 'parámetro', metodologias: 'metodología' };
    const ok = await UI.confirmar({ titulo: `¿Eliminar esta ${labels[nombre]}?`, subtexto: 'Esta acción no se puede deshacer.', textoConfirmar: 'Eliminar', tipo: 'danger' });
    if (!ok) return;

    const endpoints = {
        resoluciones: `${API_URL}/resoluciones/${id}`,
        parametros:   `${API_URL}/parametros/${id}`,
        metodologias: `${API_URL}/metodologias/${id}`,
    };

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(endpoints[nombre], {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cargarTabla(nombre);
    } catch (err) {
        console.error(`Error eliminando ${nombre}:`, err);
        mostrarToast('No se pudo eliminar el elemento.', 'danger');
    }
}
