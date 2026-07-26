// js/muestras.js
"use strict";

const API_URL = `${API_BASE}/api`;

// FIX: endpoint real ya disponible con datos cargados (matriz Líquida) — mock desactivado.
// Volver a true solo si necesitás developear sin backend levantado.
const USAR_MOCK_NORMATIVAS = false;

// FIX: endpoint real ya disponible — mock desactivado.
// Volver a true solo si necesitás developear sin backend levantado.
const USAR_MOCK_DETALLE = false;

// Cache de parámetros para el buscador individual (evita llamadas repetidas a la API)
let todosLosParametrosCache = [];

// Estado de selección de destinos (Set de IDs de ResolucionDestino tildados)
let destinosSeleccionados = new Set();

// Cache de parámetros por destino (para poder recalcular la lista al tildar/destildar)
// Map<destinoId, ParametroNormaTO[]>
let parametrosPorDestinoCache = new Map();

// ============================================================
// MOCK: árbol Matriz → Resoluciones → Destinos → Parámetros
// Simula la respuesta real de GET /api/resoluciones/por-matriz/{matrizId}
// ============================================================
function mockArbolPorMatriz(matrizId) {
    // Simula matriz "Líquida" (id=1) con Res 336/06, Res 283/19, CAA, Ley 19587
    if (String(matrizId) === "1") {
        return {
            matrizId: 1,
            matrizNombre: "Líquida",
            resoluciones: [
                {
                    id: 1,
                    nombre: "Res 336/06",
                    tieneDestino: true,
                    destinos: [
                        {
                            id: 1, nombre: "Colectora cloacal",
                            parametros: [
                                { id: 101, nombre: "Aluminio", unidad: "mg/l", tipoLimite: "MAX", valorMaximo: 5.0, metodologia: { nombre: "St. Methods 3113 B" } },
                                { id: 102, nombre: "Arsénico", unidad: "mg/l", tipoLimite: "MAX", valorMaximo: 0.5, metodologia: { nombre: "St. Methods 3113 B" } },
                                { id: 103, nombre: "pH", unidad: "UpH", tipoLimite: "RANGO", valorMinimo: 7.0, valorMaximo: 10, metodologia: { nombre: "St. Methods 4500-H+ B" } }
                            ]
                        },
                        {
                            id: 2, nombre: "Cond. pluvial o cuerpo de agua superficial",
                            parametros: [
                                { id: 101, nombre: "Aluminio", unidad: "mg/l", tipoLimite: "MAX", valorMaximo: 2.0, metodologia: { nombre: "St. Methods 3113 B" } },
                                { id: 104, nombre: "Cadmio", unidad: "mg/l", tipoLimite: "MAX", valorMaximo: 0.1, metodologia: { nombre: "St. Methods 3111 B" } }
                            ]
                        },
                        {
                            id: 3, nombre: "Absorción por el suelo",
                            parametros: [
                                { id: 104, nombre: "Cadmio", unidad: "mg/l", tipoLimite: "TEXTO", limiteTexto: "Ausente", metodologia: { nombre: "St. Methods 3111 B" } }
                            ]
                        }
                    ]
                },
                {
                    id: 2,
                    nombre: "Res 283/19",
                    tieneDestino: true,
                    destinos: [
                        {
                            id: 4, nombre: "Colectora cloacal",
                            parametros: [
                                { id: 102, nombre: "Arsénico", unidad: "mg/l", tipoLimite: "MAX", valorMaximo: 0.5, metodologia: { nombre: "St. Methods 3113 B" } }
                            ]
                        },
                        {
                            id: 5, nombre: "Cond. pluvial o cuerpo de agua superficial",
                            parametros: [
                                { id: 102, nombre: "Arsénico", unidad: "mg/l", tipoLimite: "MAX", valorMaximo: 0.5, metodologia: { nombre: "St. Methods 3113 B" } }
                            ]
                        },
                        {
                            id: 6, nombre: "Absorción por el suelo",
                            parametros: [
                                { id: 102, nombre: "Arsénico", unidad: "mg/l", tipoLimite: "MAX", valorMaximo: 0.1, metodologia: { nombre: "St. Methods 3113 B" } }
                            ]
                        }
                    ]
                },
                {
                    id: 3,
                    nombre: "CAA",
                    tieneDestino: false,
                    destinos: [
                        {
                            id: 7, nombre: "Único",
                            parametros: [
                                { id: 105, nombre: "Boro", unidad: "mg/l", tipoLimite: "MAX", valorMaximo: 2.40, metodologia: { nombre: "St. Methods 4500 B B" } }
                            ]
                        }
                    ]
                },
                {
                    id: 4,
                    nombre: "Ley 19587 - Decreto 351/79",
                    tieneDestino: false,
                    destinos: [
                        {
                            id: 8, nombre: "Único",
                            parametros: [
                                { id: 103, nombre: "pH", unidad: "UpH", tipoLimite: "RANGO", valorMinimo: 6.5, valorMaximo: 8.5, metodologia: { nombre: "St. Methods 4500-H+ B" } }
                            ]
                        }
                    ]
                }
            ]
        };
    }
    // Otras matrices: sin normativas cargadas todavía en el mock
    return { matrizId: Number(matrizId), matrizNombre: "—", resoluciones: [] };
}

// ============================================================
// MOCK: detalle de una muestra (AnalisisDetalleTO)
// Simula GET /api/estudios/{id}/detalle — incluye un parámetro con
// límites en paralelo de dos destinos distintos (caso real que nos contaron).
// ============================================================
function mockDetalleMuestra(id) {
    return {
        id: Number(id),
        nroProtocolo: "CHQ-2026-014",
        idMuestra: "M-001",
        estado: "EN_PROCESO",
        cliente: "Industrias del Sur S.A.",
        userId: 12,
        puntoMuestreo: "Salida planta - pileta norte",
        fechaIngreso: "2026-07-10",
        fechaEntrega: "2026-07-17",
        observaciones: "Cliente solicita evaluar ambos destinos posibles hasta confirmar vuelco.",
        archivoUrl: null,
        tipoMuestraNombre: "Efluente industrial",
        matrizNombre: "Líquida",
        resolucionesAplicadas: [
            "Res 336/06 - Colectora cloacal",
            "Res 336/06 - Cond. pluvial o cuerpo de agua superficial"
        ],
        parametros: [
            {
                id: 102,
                nombre: "Arsénico",
                unidad: "mg/l",
                metodologiaNombre: "St. Methods 3113 B",
                valorResultado: "0,32",
                observacion: null,
                limites: [
                    {
                        origenNombre: "Res 336/06 - Colectora cloacal",
                        tipoLimite: "MAX",
                        limiteMin: null,
                        limiteMax: 0.5,
                        limiteTexto: null,
                        cumple: true
                    },
                    {
                        origenNombre: "Res 336/06 - Cond. pluvial o cuerpo de agua superficial",
                        tipoLimite: "MAX",
                        limiteMin: null,
                        limiteMax: 0.5,
                        limiteTexto: null,
                        cumple: true
                    }
                ]
            },
            {
                id: 103,
                nombre: "pH",
                unidad: "UpH",
                metodologiaNombre: "St. Methods 4500-H+ B",
                valorResultado: "8,1",
                observacion: null,
                limites: [
                    {
                        origenNombre: "Res 336/06 - Colectora cloacal",
                        tipoLimite: "RANGO",
                        limiteMin: 7.0,
                        limiteMax: 10.0,
                        limiteTexto: null,
                        cumple: true
                    },
                    {
                        origenNombre: "Res 336/06 - Cond. pluvial o cuerpo de agua superficial",
                        tipoLimite: "RANGO",
                        limiteMin: 6.5,
                        limiteMax: 10.0,
                        limiteTexto: null,
                        cumple: true
                    }
                ]
            },
            {
                id: 101,
                nombre: "Aluminio",
                unidad: "mg/l",
                metodologiaNombre: "St. Methods 3113 B",
                valorResultado: null,
                observacion: "Pendiente de ensayo",
                limites: [
                    {
                        origenNombre: "Res 336/06 - Colectora cloacal",
                        tipoLimite: "MAX",
                        limiteMin: null,
                        limiteMax: 5.0,
                        limiteTexto: null,
                        cumple: null
                    }
                ]
            }
        ]
    };
}

// Estado de la tabla: filtro activo y página actual
let estadoActivo = "todos";
let paginaActual = 0;
const ITEMS_POR_PAGINA = 20;

// Snapshot de todas las muestras cargadas (para filtrar/buscar en cliente)
let todasLasMuestras = [];

// ID del análisis abierto actualmente en el modal de detalle (para guardar resultados)
let detalleAnalisisId = null;


// ============================================================
// 2. VINCULACIÓN DE EVENTOS (centralizada, sin inline en HTML)
// ============================================================
function vincularEventos() {

    // — Modal —
    document.getElementById("btnAbrirModal").addEventListener("click", abrirModal);
    document.getElementById("btnCancelar").addEventListener("click", cerrarModal);
    document.getElementById("modalClose").addEventListener("click", cerrarModal);

    // Cerrar haciendo clic en el fondo oscuro
    document.getElementById("modalAltaMuestra").addEventListener("click", (e) => {
        if (e.target === document.getElementById("modalAltaMuestra")) cerrarModal();
    });

    // — Modal de detalle (solo lectura) —
    document.getElementById("btnCerrarDetalle").addEventListener("click", cerrarModalDetalle);
    document.getElementById("modalDetalleClose").addEventListener("click", cerrarModalDetalle);
    document.getElementById("modalDetalleMuestra").addEventListener("click", (e) => {
        if (e.target === document.getElementById("modalDetalleMuestra")) cerrarModalDetalle();
    });

    // Cerrar con Escape (cualquiera de los dos modales)
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            cerrarModal();
            cerrarModalDetalle();
        }
    });

    // — Selectores dependientes —
    document.getElementById("inputTipoMuestra").addEventListener("change", onCambioMatriz);
    document.getElementById("checkSinNormativa").addEventListener("change", onToggleSinNormativa);

    // — Buscador individual de parámetros —
    document.getElementById("btnAddParam").addEventListener("click", abrirBuscadorIndividual);
    document.getElementById("btnCerrarBuscadorIndividual").addEventListener("click", cerrarPanelBuscador);
    document.getElementById("inputBuscarParametroIndividual").addEventListener("input", onBuscarParametroIndividual);

    // — Submit del formulario —
    document.getElementById("formAltaMuestra").addEventListener("submit", onSubmitMuestra);

    // — Filtros de estado (delegación desde el contenedor) —
    document.querySelector(".filtros").addEventListener("click", (e) => {
        const btn = e.target.closest(".filtro-btn");
        if (!btn) return;
        document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        estadoActivo = btn.dataset.estado;
        paginaActual = 0;
        aplicarFiltrosYBusqueda();
    });

    // — Búsqueda por texto —
    document.getElementById("inputBuscarCodigo").addEventListener("input", aplicarFiltrosYBusqueda);
    document.getElementById("inputBuscarCliente").addEventListener("input", aplicarFiltrosYBusqueda);

    // — Guardar resultados de parámetros —
    document.getElementById("btnGuardarResultados").addEventListener("click", onGuardarResultados);

    // — Generar informe PDF —
    document.getElementById("btnGenerarInforme").addEventListener("click", onGenerarInforme);

    // Live re-evaluation of cumple badges as user types a result
    document.getElementById("detalleParametros").addEventListener("input", e => {
        if (!e.target.classList.contains("param-resultado-input")) return;
        e.target.closest(".param-card").querySelectorAll(".badge-cumple[data-tipo]").forEach(badge => {
            actualizarBadge(badge, e.target.value);
        });
    });
}


function abrirModal() {
    document.getElementById("modalAltaMuestra").classList.add("visible");
    document.getElementById("inputProtocolo").focus();
    document.getElementById("inputFecha").value = new Date().toISOString().slice(0, 10);
}

function cerrarModal() {
    document.getElementById("modalAltaMuestra").classList.remove("visible");
    document.getElementById("formAltaMuestra").reset();
    document.getElementById("parametrosLista").innerHTML = "";
    document.getElementById("parametrosVacio").style.display = "flex";
    document.getElementById("normativasContainer").innerHTML =
        '<span class="text-muted small">Seleccioná una matriz para ver las normativas aplicables...</span>';
    document.getElementById("checkSinNormativa").checked = false;
    document.getElementById("normativasContainer").classList.remove("disabled-panel");
    destinosSeleccionados.clear();
    parametrosPorDestinoCache.clear();
    cerrarPanelBuscador();
    limpiarErrores();
}


// ============================================================
// 4. CARGA DE DATOS INICIALES
// ============================================================

// FIX: usa /api/clientes (ClienteDE), no /api/users — un cliente puede no tener
// usuario asignado todavía, y el nombre a mostrar depende de tipoCliente.
async function cargarClientes() {
    const select = document.getElementById("inputCliente");
    try {
        const response = await fetchConAuth(`${API_URL}/clientes`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const clientes = await response.json();
        select.innerHTML = '<option value="">Seleccioná un cliente...</option>';
        clientes.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            const nombreMostrado = c.tipoCliente === "PERSONA_FISICA"
                ? `${c.nombre || ""} ${c.apellido || ""}`.trim()
                : (c.razonSocial || c.nombre || c.email);
            opt.textContent = nombreMostrado || c.email;
            select.appendChild(opt);
        });
    } catch (error) {
        console.warn("No se pudieron cargar clientes:", error);
        // No rompe — el select queda funcional aunque vacío
        select.innerHTML = '<option value="">Sin clientes disponibles</option>';
    }
}

async function cargarMatrices() {
    const select = document.getElementById("inputTipoMuestra");
    try {
        const response = await fetchConAuth(`${API_URL}/matrices`);
        const matrices = await response.json();

        select.innerHTML = '<option value="">Seleccioná una matriz...</option>';
        matrices
            .filter(m => m.activo)
            .forEach(m => {
                const opt = document.createElement("option");
                opt.value = m.id;
                opt.textContent = m.nombre;
                select.appendChild(opt);
            });
    } catch (error) {
        console.error("Error al cargar matrices:", error);
    }
}

async function cargarMuestrasActivas() {
    const tbody = document.getElementById("tablaMuestrasBody");
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">Cargando...</td></tr>`;
    try {
        const response = await fetchConAuth(`${API_URL}/estudios/all`);
        todasLasMuestras = await response.json();
        aplicarFiltrosYBusqueda();
    } catch (error) {
        console.error("Error al cargar muestras:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger">
                    Error al cargar la cola de trabajo
                </td>
            </tr>`;
    }
}


// ============================================================
// 5. SELECTORES DEPENDIENTES: Matriz → Normativas (múltiple) → Parámetros
// ============================================================

// Trae el árbol completo Matriz → Resoluciones → Destinos → Parámetros.
// Usa el mock local mientras el endpoint real no está disponible (ver flag USAR_MOCK_NORMATIVAS).
async function obtenerArbolPorMatriz(matrizId) {
    if (USAR_MOCK_NORMATIVAS) {
        return mockArbolPorMatriz(matrizId);
    }
    const response = await fetchConAuth(`${API_URL}/resoluciones/por-matriz/${matrizId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

async function onCambioMatriz(e) {
    const matrizId = e.target.value;
    const contenedor = document.getElementById("normativasContainer");

    // Reset total: cambiar de matriz invalida las normativas y parámetros elegidos
    destinosSeleccionados.clear();
    parametrosPorDestinoCache.clear();
    contenedor.innerHTML = "";
    recalcularParametrosSeleccionados();

    // Si tildaron "sin normativa", no tiene sentido ir a buscar el árbol
    if (document.getElementById("checkSinNormativa").checked) {
        return;
    }

    if (!matrizId) {
        contenedor.innerHTML = '<span class="text-muted small">Seleccioná una matriz para ver las normativas aplicables...</span>';
        return;
    }

    contenedor.innerHTML = '<span class="text-muted small">Cargando normativas...</span>';

    try {
        const arbol = await obtenerArbolPorMatriz(matrizId);

        if (!arbol.resoluciones || arbol.resoluciones.length === 0) {
            contenedor.innerHTML = '<span class="text-muted small">No hay normativas cargadas para esta matriz todavía.</span>';
            return;
        }

        renderizarNormativas(arbol.resoluciones);

    } catch (error) {
        console.error("Error al cargar normativas de la matriz:", error);
        contenedor.innerHTML = '<span class="text-danger small">Error al cargar las normativas.</span>';
    }
}

// Al tildar "No aplica ninguna normativa": oculta y deshabilita el bloque de destinos,
// limpia cualquier destino tildado (y sus parámetros derivados), dejando solo el buscador individual.
function onToggleSinNormativa(e) {
    const contenedor = document.getElementById("normativasContainer");
    const sinNormativa = e.target.checked;

    if (sinNormativa) {
        destinosSeleccionados.clear();
        parametrosPorDestinoCache.clear();
        contenedor.innerHTML = '<span class="text-muted small fst-italic">Normativa desactivada para esta muestra — agregá parámetros con el buscador individual.</span>';
        contenedor.classList.add("disabled-panel");
        recalcularParametrosSeleccionados();
    } else {
        contenedor.classList.remove("disabled-panel");
        // Volvemos a pedir el árbol si ya había una matriz elegida
        const matrizId = document.getElementById("inputTipoMuestra").value;
        if (matrizId) {
            onCambioMatriz({ target: { value: matrizId } });
        } else {
            contenedor.innerHTML = '<span class="text-muted small">Seleccioná una matriz para ver las normativas aplicables...</span>';
        }
    }
}

// Pinta, por cada Resolución, sus Destinos como checkboxes (o "Único" si tieneDestino=false)
function renderizarNormativas(resoluciones) {
    const contenedor = document.getElementById("normativasContainer");
    contenedor.innerHTML = "";

    resoluciones.forEach(res => {
        const bloque = document.createElement("div");
        bloque.className = "normativa-bloque mb-2 pb-2 border-bottom";

        const titulo = document.createElement("div");
        titulo.className = "fw-semibold small mb-1";
        titulo.textContent = res.nombre;
        bloque.appendChild(titulo);

        const destinosWrap = document.createElement("div");
        destinosWrap.className = "d-flex flex-wrap gap-3";

        (res.destinos || []).forEach(destino => {
            // Guardamos los parámetros de este destino para poder recalcular al tildar/destildar
            parametrosPorDestinoCache.set(destino.id, destino.parametros || []);

            const wrapper = document.createElement("div");
            wrapper.className = "form-check";

            const checkboxId = `check-destino-${destino.id}`;
            wrapper.innerHTML = `
                <input class="form-check-input check-destino" type="checkbox"
                       id="${checkboxId}" value="${destino.id}">
                <label class="form-check-label small" for="${checkboxId}">
                    ${destino.nombre}
                </label>
            `;

            wrapper.querySelector("input").addEventListener("change", (ev) => {
                if (ev.target.checked) {
                    destinosSeleccionados.add(destino.id);
                } else {
                    destinosSeleccionados.delete(destino.id);
                }
                recalcularParametrosSeleccionados();
            });

            destinosWrap.appendChild(wrapper);
        });

        bloque.appendChild(destinosWrap);
        contenedor.appendChild(bloque);
    });
}

// Recalcula la lista de parámetros a partir de todos los destinos tildados,
// evitando duplicados cuando el mismo parámetro aparece en más de un destino.
function recalcularParametrosSeleccionados() {
    const contenedorLista = document.getElementById("parametrosLista");
    const panelVacio = document.getElementById("parametrosVacio");

    // Conservamos los parámetros agregados a mano (buscador individual) que no vinieron de un destino
    const idsManuales = Array.from(contenedorLista.querySelectorAll(".parametro-item-row"))
        .filter(fila => fila.dataset.origen === "manual")
        .map(fila => fila.dataset.parametroId);

    contenedorLista.innerHTML = "";

    const parametrosUnicos = new Map(); // id -> parametro

    destinosSeleccionados.forEach(destinoId => {
        const parametros = parametrosPorDestinoCache.get(destinoId) || [];
        parametros.forEach(p => parametrosUnicos.set(p.id, p));
    });

    if (parametrosUnicos.size === 0 && idsManuales.length === 0) {
        const sinNormativa = document.getElementById("checkSinNormativa").checked;
        panelVacio.innerHTML = sinNormativa
            ? '<i class="bi bi-list-ul param-empty-icon"></i> Esta muestra no tiene normativa asociada — agregá parámetros con "Agregar individual".'
            : '<i class="bi bi-list-ul param-empty-icon"></i> Seleccioná un destino de vuelco o agregá parámetros manualmente';
        panelVacio.style.display = "flex";
        return;
    }

    panelVacio.style.display = "none";
    parametrosUnicos.forEach(p => agregarParametroALaLista(p, "norma"));

    // Reponer los agregados manualmente (si el usuario ya había buscado alguno antes)
    idsManuales.forEach(id => {
        const param = todosLosParametrosCache.find(p => String(p.id) === String(id));
        if (param && !parametrosUnicos.has(param.id)) {
            agregarParametroALaLista(param, "manual");
        }
    });
}


// ============================================================
// 6. BUSCADOR INDIVIDUAL DE PARÁMETROS
// ============================================================
async function abrirBuscadorIndividual() {
    const buscadorContainer = document.getElementById("buscadorIndividualContainer");
    buscadorContainer.classList.remove("d-none");
    document.getElementById("inputBuscarParametroIndividual").focus();

    if (todosLosParametrosCache.length === 0) {
        try {
            const response = await fetchConAuth(`${API_URL}/parametros`);
            todosLosParametrosCache = await response.json();
        } catch (error) {
            console.error("Error cargando parámetros:", error);
        }
    }
}

function onBuscarParametroIndividual(e) {
    const termino = e.target.value.toLowerCase().trim();
    const contenedor = document.getElementById("resultadosBusquedaIndividual");
    contenedor.innerHTML = "";

    if (!termino) return;

    const filtrados = todosLosParametrosCache.filter(p =>
        p.nombre.toLowerCase().includes(termino)
    );

    if (filtrados.length === 0) {
        contenedor.innerHTML = `<div class="list-group-item text-muted small">Sin resultados para "${termino}"</div>`;
        return;
    }

    filtrados.slice(0, 10).forEach(param => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "list-group-item list-group-item-action py-2";
        const metodo = param.metodologia?.nombre || "Sin metodología";
        btn.innerHTML = `
            <strong>${param.nombre}</strong>
            <span class="text-muted small ms-1">(${param.unidad || '-'})</span>
            <span class="badge bg-light text-dark border float-end">${metodo}</span>
        `;
        btn.addEventListener("click", () => {
            if (document.getElementById(`check-param-${param.id}`)) {
                mostrarToast(`El parámetro "${param.nombre}" ya está agregado.`, true);
                return;
            }
            agregarParametroALaLista(param, "manual");
            cerrarPanelBuscador();
        });
        contenedor.appendChild(btn);
    });
}

function cerrarPanelBuscador() {
    document.getElementById("buscadorIndividualContainer").classList.add("d-none");
    document.getElementById("inputBuscarParametroIndividual").value = "";
    document.getElementById("resultadosBusquedaIndividual").innerHTML = "";
}


// ============================================================
// 7. AGREGAR PARÁMETRO A LA LISTA VISUAL
// ============================================================
function agregarParametroALaLista(parametro, origen = "manual") {
    const contenedorLista = document.getElementById("parametrosLista");
    document.getElementById("parametrosVacio").style.display = "none";

    // Evita duplicar si el parámetro ya está en la lista (puede venir de dos destinos distintos)
    if (contenedorLista.querySelector(`[data-parametro-id="${parametro.id}"]`)) {
        return;
    }

    const fila = document.createElement("div");
    fila.className = "parametro-item-row d-flex align-items-center justify-content-between p-2 mb-2 border rounded bg-light";
    fila.dataset.parametroId = parametro.id;
    fila.dataset.origen = origen;

    const metodo = parametro.metodologia?.nombre || "Sin metodología";
    const descripcion = parametro.metodologia?.descripcion || "";

    fila.innerHTML = `
        <div class="d-flex align-items-center" style="gap: 12px;">
            <input
                type="checkbox"
                class="form-check-input check-parametro"
                value="${parametro.id}"
                id="check-param-${parametro.id}"
                checked
            />
            <label for="check-param-${parametro.id}" class="mb-0 fw-semibold" style="cursor:pointer;">
                ${parametro.nombre}
                <span class="text-muted small">(${parametro.unidad || '-'})</span>
            </label>
        </div>
        <div class="text-end">
            <span class="badge bg-secondary text-wrap"
                  style="max-width:200px; font-size:0.8rem;"
                  title="${descripcion}">
                <i class="bi bi-gear me-1"></i> ${metodo}
            </span>
        </div>
    `;
    contenedorLista.appendChild(fila);
}


// ============================================================
// 8. SUBMIT DEL FORMULARIO
// ============================================================
async function onSubmitMuestra(e) {
    e.preventDefault();

    if (!validarFormulario()) return;

    // FIX: userId (número) en vez de clienteNombre (texto)
    // FIX: idMuestra incluido (faltaba antes)
    // NUEVO: puntoMuestreo incluido
    // NUEVO: resolucionDestinoIds como array (una muestra puede evaluarse contra varias resoluciones a la vez)
    const payload = {
        nroProtocolo:       document.getElementById("inputProtocolo").value.trim(),
        fechaIngreso:       document.getElementById("inputFecha").value,
        fechaEntrega:       document.getElementById("inputFechaEntrega").value || null,
        clienteId:          parseInt(document.getElementById("inputCliente").value),
        idMuestra:          document.getElementById("inputIdMuestra").value.trim(),
        puntoMuestreo:      document.getElementById("inputPuntoMuestreo").value.trim() || null,
        // NUEVO: matrizId en vez de tipoMuestraId (el select ahora lista MATRIZ directo)
        matrizId:           parseInt(document.getElementById("inputTipoMuestra").value),
        resolucionDestinoIds: Array.from(destinosSeleccionados),
        observaciones:      document.getElementById("inputObservaciones").value.trim() || null,
        // Solo los parámetros que quedaron con el checkbox tildado
        parametrosIds:      Array.from(document.querySelectorAll(".check-parametro:checked"))
            .map(cb => parseInt(cb.value))
    };

    if (payload.parametrosIds.length === 0) {
        mostrarToast("Seleccioná al menos un parámetro para analizar.", true);
        return;
    }

    const btnGuardar = document.getElementById("btnGuardar");
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Guardando...`;

    try {
        const response = await fetchConAuth(`${API_URL}/estudios`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || "Error en el servidor");
        }

        mostrarToast("Muestra guardada correctamente.");
        cerrarModal();
        await cargarMuestrasActivas();

    } catch (error) {
        console.error("Error al guardar muestra:", error);
        mostrarToast(`No se pudo guardar la muestra: ${error.message}`, true);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `<i class="bi bi-check-lg"></i> Guardar muestra`;
    }
}


// ============================================================
// 9. VALIDACIÓN DEL FORMULARIO
// ============================================================
function validarFormulario() {
    let valido = true;
    limpiarErrores();

    const campos = [
        { id: "inputProtocolo", errId: "errProtocolo" },
        { id: "inputFecha",     errId: "errFecha" },
        { id: "inputIdMuestra", errId: "errIdMuestra" },
        { id: "inputTipoMuestra", errId: "errTipoMuestra" },
    ];

    // Validar cliente
    const clienteVal = document.getElementById("inputCliente").value;
    if (!clienteVal) {
        document.getElementById("errCliente").style.display = "block";
        valido = false;
    }

    campos.forEach(({ id, errId }) => {
        const el = document.getElementById(id);
        if (!el.value || el.value.trim() === "") {
            document.getElementById(errId).style.display = "block";
            valido = false;
        }
    });

    return valido;
}

function limpiarErrores() {
    document.querySelectorAll(".field-error").forEach(el => el.style.display = "none");
}


// ============================================================
// 10. FILTROS Y BÚSQUEDA EN LA TABLA
// ============================================================
function aplicarFiltrosYBusqueda() {
    const textoCodigo  = document.getElementById("inputBuscarCodigo").value.toLowerCase().trim();
    const textoCliente = document.getElementById("inputBuscarCliente").value.toLowerCase().trim();

    let filtradas = todasLasMuestras;

    // Filtro por estado
    if (estadoActivo !== "todos") {
        filtradas = filtradas.filter(m => m.estado === estadoActivo);
    }

    // Filtro por código
    if (textoCodigo) {
        filtradas = filtradas.filter(m =>
            (m.nroProtocolo || m.idMuestra || String(m.id) || "")
                .toLowerCase().includes(textoCodigo)
        );
    }

    // Filtro por cliente
    if (textoCliente) {
        filtradas = filtradas.filter(m =>
            (m.cliente || "").toLowerCase().includes(textoCliente)
        );
    }

    renderizarTablaMuestras(filtradas);
}


// ============================================================
// 11. RENDER DE LA TABLA CON PAGINACIÓN
// ============================================================
function renderizarTablaMuestras(lista) {
    const tbody = document.getElementById("tablaMuestrasBody");
    tbody.innerHTML = "";

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    No hay muestras que coincidan con los filtros.
                </td>
            </tr>`;
        actualizarPaginacion(0, 0);
        return;
    }

    // Paginación en cliente (mientras el backend no tenga paginación propia)
    const inicio = paginaActual * ITEMS_POR_PAGINA;
    const fin = Math.min(inicio + ITEMS_POR_PAGINA, lista.length);
    const pagina = lista.slice(inicio, fin);

    pagina.forEach(m => {
        const fila = document.createElement("tr");
        const codigo = m.nroProtocolo || m.idMuestra || m.id || "S/N";
        fila.innerHTML = `
            <td><span class="cod-badge">${codigo}</span></td>
            <td>${m.cliente || '—'}</td>
            <td>${m.matrizNombre || m.tipoAnalisis || '—'}</td>
            <td><span class="${badgeClassDetalle(m.estado)}">${labelEstadoDetalle(m.estado)}</span></td>
            <td>${formatearFecha(m.fechaIngreso)}</td>
            <td>${formatearFecha(m.fechaEntrega)}</td>
            <td>
                <button class="btn btn-sm btn-light" title="Ver detalle"
                        onclick="verDetalleMuestra(${m.id})">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        `;
        tbody.appendChild(fila);
    });

    actualizarPaginacion(lista.length, fin);
}

function actualizarPaginacion(total, fin) {
    const inicio = paginaActual * ITEMS_POR_PAGINA;
    document.getElementById("pagInfoEmpleado").textContent =
        total === 0 ? "Sin resultados" : `Mostrando ${inicio + 1}–${fin} de ${total}`;

    const controles = document.getElementById("pagControlsEmpleado");
    controles.innerHTML = "";
    const totalPaginas = Math.ceil(total / ITEMS_POR_PAGINA);
    if (totalPaginas <= 1) return;

    if (paginaActual > 0) {
        const btnAnterior = document.createElement("button");
        btnAnterior.className = "btn btn-sm btn-outline-secondary me-1";
        btnAnterior.textContent = "← Anterior";
        btnAnterior.addEventListener("click", () => {
            paginaActual--;
            aplicarFiltrosYBusqueda();
        });
        controles.appendChild(btnAnterior);
    }

    if (paginaActual < totalPaginas - 1) {
        const btnSiguiente = document.createElement("button");
        btnSiguiente.className = "btn btn-sm btn-outline-secondary";
        btnSiguiente.textContent = "Siguiente →";
        btnSiguiente.addEventListener("click", () => {
            paginaActual++;
            aplicarFiltrosYBusqueda();
        });
        controles.appendChild(btnSiguiente);
    }
}


// ============================================================
// 12. HELPERS
// ============================================================

// Wrapper de fetch que inyecta el JWT automáticamente
async function fetchConAuth(url, opciones = {}) {
    const token = localStorage.getItem("token");
    const headers = {
        ...(opciones.headers || {}),
        "Authorization": `Bearer ${token}`
    };
    const response = await fetch(url, { ...opciones, headers });
    if (response.status === 401) {
        // Token vencido — redirigir al login
        window.location.href = "/login.html";
    }
    return response;
}

function establecerFechaHoy() {
    const el = document.getElementById("fecha-hoy");
    if (el) {
        el.textContent = new Date().toLocaleDateString("es-ES", {
            weekday: "long", year: "numeric", month: "long", day: "numeric"
        });
    }
}

function formatearFecha(fecha) {
    if (!fecha) return "—";
    try {
        return new Date(fecha).toLocaleDateString("es-AR");
    } catch {
        return fecha;
    }
}

function mostrarToast(mensaje, esError = false) {
    const toast = document.getElementById("toastConfirm");
    const msg   = document.getElementById("toastMsg");
    if (!toast || !msg) return;
    msg.textContent = mensaje;
    toast.style.backgroundColor = esError ? "#dc3545" : "";
    toast.classList.add("visible");
    setTimeout(() => {
        toast.classList.remove("visible");
        toast.style.backgroundColor = "";
    }, 3500);
}

// ============================================================
// DETALLE DE MUESTRA (modal de solo lectura)
// ============================================================
async function obtenerDetalleMuestra(id) {
    if (USAR_MOCK_DETALLE) {
        return mockDetalleMuestra(id);
    }
    const response = await fetchConAuth(`${API_URL}/estudios/${id}/detalle`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

window.verDetalleMuestra = async function(id) {
    detalleAnalisisId = id;
    const modal = document.getElementById("modalDetalleMuestra");
    const loading = document.getElementById("detalleLoading");
    const contenido = document.getElementById("detalleContenido");
    const errorBox = document.getElementById("detalleError");

    modal.classList.add("visible");
    loading.classList.remove("d-none");
    contenido.classList.add("d-none");
    errorBox.classList.add("d-none");
    document.getElementById("detalleProtocolo").textContent = "…";

    try {
        const detalle = await obtenerDetalleMuestra(id);
        renderizarDetalleMuestra(detalle);
        loading.classList.add("d-none");
        contenido.classList.remove("d-none");
    } catch (error) {
        console.error("Error al cargar detalle de muestra:", error);
        loading.classList.add("d-none");
        errorBox.classList.remove("d-none");
    }
};

function cerrarModalDetalle() {
    document.getElementById("modalDetalleMuestra").classList.remove("visible");
}

function badgeClassDetalle(estado) {
    const map = {
        PENDIENTE: "badge-pendiente",
        EN_PROCESO: "badge-proceso",
        COMPLETO_SIN_INFORME: "badge-completo-sin-informe",
        DEMORADA: "badge-demorada",
        COMPLETO: "badge-informe",
    };
    return "badge-estado " + (map[(estado || "").toUpperCase()] || "");
}

function labelEstadoDetalle(estado) {
    const map = {
        PENDIENTE: "Pendiente",
        EN_PROCESO: "En proceso",
        COMPLETO_SIN_INFORME: "Completo sin informe",
        DEMORADA: "Demorada",
        COMPLETO: "Completo",
    };
    return map[(estado || "").toUpperCase()] || (estado || "—");
}

function renderizarDetalleMuestra(d) {
    document.getElementById("detalleProtocolo").textContent = d.nroProtocolo || d.idMuestra || `#${d.id}`;

    // El botón "Generar informe" se oculta si la muestra ya está COMPLETO
    const btnGenerar = document.getElementById("btnGenerarInforme");
    btnGenerar.style.display = (d.estado === "COMPLETO") ? "none" : "";

    // Estado badge
    const estadoEl = document.getElementById("detalleEstado");
    estadoEl.className = badgeClassDetalle(d.estado);
    estadoEl.textContent = labelEstadoDetalle(d.estado);

    document.getElementById("detalleCliente").textContent = d.cliente || "—";
    document.getElementById("detalleIdMuestra").textContent = d.idMuestra || "—";
    document.getElementById("detalleMatrizTipo").textContent = d.matrizNombre || "—";
    document.getElementById("detallePuntoMuestreo").textContent = d.puntoMuestreo || "—";
    document.getElementById("detalleFechas").textContent =
        `${formatearFecha(d.fechaIngreso)} → ${d.fechaEntrega ? formatearFecha(d.fechaEntrega) : "sin definir"}`;

    // Observaciones
    const wrapObs = document.getElementById("detalleObservacionesWrap");
    if (d.observaciones) {
        document.getElementById("detalleObservaciones").textContent = d.observaciones;
        wrapObs.style.display = "";
    } else {
        wrapObs.style.display = "none";
    }

    // Normativas (chips)
    const contResoluciones = document.getElementById("detalleResoluciones");
    contResoluciones.innerHTML = "";
    if (!d.resolucionesAplicadas || d.resolucionesAplicadas.length === 0) {
        contResoluciones.innerHTML = '<span style="color:var(--color-text-tertiary);font-size:13px">Sin normativa asociada</span>';
    } else {
        d.resolucionesAplicadas.forEach(nombre => {
            const chip = document.createElement("span");
            chip.className = "detalle-chip";
            chip.textContent = nombre;
            contResoluciones.appendChild(chip);
        });
    }

    // Parámetros
    const contParametros = document.getElementById("detalleParametros");
    contParametros.innerHTML = "";

    if (!d.parametros || d.parametros.length === 0) {
        contParametros.innerHTML = '<span style="color:var(--color-text-tertiary);font-size:13px">Sin parámetros cargados.</span>';
        return;
    }

    d.parametros.forEach(p => {
        const card = document.createElement("div");
        card.className = "param-card";

        let limitesHtml = "";
        if (!p.limites || p.limites.length === 0) {
            limitesHtml = `<div class="param-card-limites"><span style="color:var(--color-text-tertiary);font-size:12px">Sin límite normativo asociado</span></div>`;
        } else {
            const filas = p.limites.map(l => {
                const textoLimite = formatearLimite(l);
                let badgeClass, badgeText;
                if (l.cumple === null || l.cumple === undefined) {
                    badgeClass = "badge-cumple badge-cumple-nd";
                    badgeText = "Sin evaluar";
                } else if (l.cumple) {
                    badgeClass = "badge-cumple badge-cumple-si";
                    badgeText = "Cumple";
                } else {
                    badgeClass = "badge-cumple badge-cumple-no";
                    badgeText = "No cumple";
                }
                return `
                    <div class="param-limite-row">
                        <span class="param-limite-origen">${l.origenNombre}</span>
                        <span class="param-limite-valor">${textoLimite}</span>
                        <span class="${badgeClass}"
                              data-tipo="${l.tipoLimite || ''}"
                              data-min="${l.limiteMin ?? ''}"
                              data-max="${l.limiteMax ?? ''}"
                        >${badgeText}</span>
                    </div>`;
            }).join("");
            limitesHtml = `<div class="param-card-limites">${filas}</div>`;
        }

        card.innerHTML = `
            <div class="param-card-header">
                <div>
                    <div class="param-card-nombre">${p.nombre} <span class="param-card-unidad">(${p.unidad || "—"})</span></div>
                    <div class="param-card-metodo">${p.metodologiaNombre || "Sin metodología"}</div>
                </div>
                <div class="param-resultado-wrap">
                    <input
                        class="param-resultado-input"
                        type="text"
                        data-parametro-id="${p.id}"
                        value="${p.valorResultado || ''}"
                        placeholder="Resultado..."
                    >
                    <span class="param-resultado-unidad">${p.unidad || ""}</span>
                </div>
            </div>
            <div class="param-obs-wrap">
                <input
                    class="param-obs-input"
                    type="text"
                    id="obs-param-${p.id}"
                    value="${p.observacion || ''}"
                    placeholder="Observación..."
                >
            </div>
            ${limitesHtml}
        `;
        contParametros.appendChild(card);
    });
}

// Formatea un límite según su tipo (MAX, MIN, RANGO, TEXTO) para mostrarlo legible
function formatearLimite(l) {
    switch (l.tipoLimite) {
        case "MAX":
            return `≤ ${l.limiteMax}`;
        case "MIN":
            return `≥ ${l.limiteMin}`;
        case "RANGO":
            return `${l.limiteMin} – ${l.limiteMax}`;
        case "TEXTO":
            return l.limiteTexto || "—";
        default:
            return l.limiteTexto || `${l.limiteMin ?? ''} ${l.limiteMax ?? ''}`.trim() || "—";
    }
}

// Updates a badge-cumple element based on a typed result value
function actualizarBadge(badge, valorStr) {
    const tipo = badge.dataset.tipo;
    if (!tipo || tipo === "TEXTO" || !valorStr || !valorStr.trim()) {
        badge.className = "badge-cumple badge-cumple-nd";
        badge.textContent = "Sin evaluar";
        return;
    }
    const valor = parseFloat(valorStr.replace(",", ".").trim());
    if (isNaN(valor)) {
        badge.className = "badge-cumple badge-cumple-nd";
        badge.textContent = "Sin evaluar";
        return;
    }
    const min = parseFloat(badge.dataset.min);
    const max = parseFloat(badge.dataset.max);
    let cumple;
    switch (tipo) {
        case "MAX":   cumple = !isNaN(max) && valor <= max; break;
        case "MIN":   cumple = !isNaN(min) && valor >= min; break;
        case "RANGO": cumple = !isNaN(min) && !isNaN(max) && valor >= min && valor <= max; break;
        default:      cumple = null;
    }
    if (cumple === true) {
        badge.className = "badge-cumple badge-cumple-si";
        badge.textContent = "Cumple";
    } else if (cumple === false) {
        badge.className = "badge-cumple badge-cumple-no";
        badge.textContent = "No cumple";
    } else {
        badge.className = "badge-cumple badge-cumple-nd";
        badge.textContent = "Sin evaluar";
    }
}

async function onGuardarResultados() {
    if (!detalleAnalisisId) return;

    const inputs = document.querySelectorAll(".param-resultado-input");
    const resultados = [];
    inputs.forEach(input => {
        const parametroId = parseInt(input.dataset.parametroId);
        const obsInput = document.getElementById(`obs-param-${parametroId}`);
        resultados.push({
            parametroId,
            valorResultado: input.value.trim() || null,
            observacion: obsInput ? (obsInput.value.trim() || null) : null,
        });
    });

    const btn = document.getElementById("btnGuardarResultados");
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Guardando...`;

    try {
        const resp = await fetchConAuth(`${API_URL}/estudios/${detalleAnalisisId}/resultados`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(resultados),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        mostrarToast("Resultados guardados correctamente.");
        cerrarModalDetalle();
    } catch (err) {
        console.error("Error guardando resultados:", err);
        mostrarToast("Error al guardar los resultados.", true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
    }
}

async function onGenerarInforme() {
    if (!detalleAnalisisId) return;

    const inputs = document.querySelectorAll(".param-resultado-input");
    const vacios = [];
    inputs.forEach(input => {
        const vacio = !input.value || !input.value.trim();
        input.style.borderColor = vacio ? "#dc3545" : "";
        input.style.background  = vacio ? "#fff5f5" : "";
        if (vacio) {
            const card = input.closest(".param-card");
            const nombreEl = card?.querySelector(".param-card-nombre");
            const nombre = nombreEl
                ? (nombreEl.childNodes[0]?.textContent?.trim() || nombreEl.textContent.split("(")[0].trim())
                : `#${input.dataset.parametroId}`;
            vacios.push(nombre);
        }
    });

    if (vacios.length > 0) {
        const msg = vacios.length <= 3
            ? `Faltan resultados en: ${vacios.join(", ")}.`
            : `${vacios.length} parámetros sin resultado. Completá todos los campos antes de generar el informe.`;
        mostrarToast(msg, true);
        return;
    }

    const btn = document.getElementById("btnGenerarInforme");
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Generando...`;

    try {
        const resp = await fetchConAuth(`${API_URL}/estudios/${detalleAnalisisId}/generar-informe`, {
            method: "POST"
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || `Error HTTP ${resp.status}`);
        }

        // Descarga el PDF directamente en el navegador
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `informe-${detalleAnalisisId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        mostrarToast("Informe generado y descargado correctamente.");
        cerrarModalDetalle();
        await cargarMuestrasActivas();

    } catch (err) {
        console.error("Error generando informe:", err);
        mostrarToast(`Error al generar el informe: ${err.message}`, true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
    }
}

function init() {
    inicializarHeader();
    cargarClientes();
    cargarMatrices();
    cargarMuestrasActivas();
    vincularEventos();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}