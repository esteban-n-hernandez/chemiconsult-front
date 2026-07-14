const API_CLIENTES_BASE = `${API_BASE}/api`;

// ── Guard ──
const rol = (localStorage.getItem("userRole") || "").toUpperCase();
if (!localStorage.getItem("token") || rol !== "ROLE_CLIENTE") {
    window.location.href = "login.html";
}

// ── Decodificar JWT para obtener userId ──
function getPayload() {
    try {
        const token = localStorage.getItem("token");
        return JSON.parse(atob(token.split(".")[1]));
    } catch { return {}; }
}
const payload = getPayload();
const userId  = payload.userID;

// ── Datos del usuario ──
const userEmail = localStorage.getItem("userEmail");
const userName  = localStorage.getItem("userName");
const nombre    = userName || userEmail || "Cliente";
const iniciales = nombre.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase();

document.getElementById("header-nombre").textContent = nombre;
document.getElementById("header-avatar").textContent = iniciales;
document.getElementById("cliente-nombre").textContent = nombre;

// ── Fecha ──
const hoy = new Date().toLocaleDateString("es-AR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
});
document.getElementById("fecha-hoy").textContent = hoy.charAt(0).toUpperCase() + hoy.slice(1);

// ──────────────────────────────────────────
// FETCH ESTUDIOS DESDE EL BACKEND
// ──────────────────────────────────────────
const token = localStorage.getItem("token");

let todasLasMuestras = [];
let datosFiltrados   = [];
let paginaActual     = 1;
const POR_PAGINA     = 10;

async function cargarEstudios() {
    try {
        const res = await fetch(`${API_CLIENTES_BASE}/estudios/user/${userId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Error al obtener estudios");

        const data = await res.json();

        console.log("Datosss")
        console.log(JSON.stringify(data))

        // Mapear respuesta al formato interno y filtrar solo estudios completados
        todasLasMuestras = data
            .filter(e => e.estado === "Completo") // Solo mostrar estudios completados
            .map(e => ({
                id:       e.id,
                codigo:   e.numeroProtocolo || `ID-${e.id}`,
                tipo:     e.tipo || "—",
                fecha:    e.createdDate
                    ? new Date(e.createdDate).toLocaleDateString("es-AR", { day:"2-digit", month:"short", year:"numeric" })
                    : "—",
                estado:   e.estado || "—",
                informe:  e.estado === "Completo" // tiene PDF disponible
            }));

        // KPIs
        document.getElementById("kpi-total").textContent   = todasLasMuestras.length;
        document.getElementById("kpi-proceso").textContent = todasLasMuestras.filter(m => m.estado === "EN_PROCESO").length;
        document.getElementById("kpi-listos").textContent  = todasLasMuestras.filter(m => m.informe).length;

        datosFiltrados = [...todasLasMuestras];
        renderTabla();

    } catch (err) {
        console.error(err);
        document.getElementById("tablaBody").innerHTML = "";
        document.getElementById("errorState").style.display = "block";
    }
}

// ──────────────────────────────────────────
// RENDER TABLA
// ──────────────────────────────────────────
function badgeHTML(estado) {
    const map = {
        "EN_PROCESO": `<span class="badge-estado badge-proceso">🔬 En análisis</span>`,
        "INFORME":    `<span class="badge-estado badge-informe">✅ Informe listo</span>`,
        "PENDIENTE":  `<span class="badge-estado badge-pendiente">⏳ Pendiente</span>`,
    };
    return map[estado] || `<span class="badge-estado">${estado}</span>`;
}

function btnInformeHTML(muestra) {
    if (muestra.informe) {
        return `<button class="btn-descargar" onclick="abrirPDF(${muestra.id}, '${muestra.codigo}')">
                    <i class="bi bi-eye"></i> Ver informe
                </button>`;
    }
    return `<button class="btn-descargar disabled" disabled>
                <i class="bi bi-clock"></i> En proceso
            </button>`;
}

function renderTabla() {
    const tbody   = document.getElementById("tablaBody");
    const sinRes  = document.getElementById("sinResultados");
    const pagInfo = document.getElementById("pag-info");
    const pagBtns = document.getElementById("paginacion-btns");

    const total     = datosFiltrados.length;
    const totalPags = Math.ceil(total / POR_PAGINA);
    const inicio    = (paginaActual - 1) * POR_PAGINA;
    const fin       = Math.min(inicio + POR_PAGINA, total);
    const slice     = datosFiltrados.slice(inicio, fin);

    if (total === 0) {
        tbody.innerHTML = "";
        sinRes.style.display = "block";
        pagInfo.textContent  = "Sin resultados";
        pagBtns.innerHTML    = "";
        return;
    }

    sinRes.style.display = "none";

    tbody.innerHTML = slice.map(m => `
        <tr>
            <td><span class="cod-badge">${m.codigo}</span></td>
            <td>${m.tipo}</td>
            <td>${m.fecha}</td>
            <td>${badgeHTML(m.estado)}</td>
            <td>${btnInformeHTML(m)}</td>
        </tr>
    `).join("");

    pagInfo.textContent = `Mostrando ${inicio + 1}–${fin} de ${total} registro${total !== 1 ? "s" : ""}`;

    // Paginación
    pagBtns.innerHTML = "";

    const btnPrev = document.createElement("button");
    btnPrev.className = "pag-btn";
    btnPrev.innerHTML = `<i class="bi bi-chevron-left"></i>`;
    btnPrev.disabled  = paginaActual === 1;
    btnPrev.onclick   = () => { paginaActual--; renderTabla(); };
    pagBtns.appendChild(btnPrev);

    for (let i = 1; i <= totalPags; i++) {
        const btn = document.createElement("button");
        btn.className = "pag-btn" + (i === paginaActual ? " active" : "");
        btn.textContent = i;
        btn.onclick = () => { paginaActual = i; renderTabla(); };
        pagBtns.appendChild(btn);
    }

    const btnNext = document.createElement("button");
    btnNext.className = "pag-btn";
    btnNext.innerHTML = `<i class="bi bi-chevron-right"></i>`;
    btnNext.disabled  = paginaActual === totalPags;
    btnNext.onclick   = () => { paginaActual++; renderTabla(); };
    pagBtns.appendChild(btnNext);
}

// ──────────────────────────────────────────
// PDF SIDE PANEL
// ──────────────────────────────────────────
const pdfPanel   = document.getElementById("pdfPanel");
const pdfOverlay = document.getElementById("pdfOverlay");
const pdfIframe  = document.getElementById("pdfIframe");
const pdfLoading = document.getElementById("pdfLoading");

function abrirPDF(estudioId, protocolo) {
    const url = `${API_CLIENTES_BASE}/estudios/${estudioId}/resultado`;

    // Actualizar título y links
    document.getElementById("pdfPanelTitulo").textContent = `Informe ${protocolo}`;
    document.getElementById("btnDescargarPdf").href = url;
    document.getElementById("btnDescargarPdf").download = `resultado_${protocolo}.pdf`;
    document.getElementById("btnAbrirNueva").href = url;

    // Mostrar loading
    pdfLoading.style.display  = "flex";
    pdfIframe.style.display   = "none";
    pdfIframe.src             = "";

    // Abrir panel
    pdfPanel.classList.add("open");
    pdfOverlay.classList.add("open");
    document.body.style.overflow = "hidden";

    // Cargar iframe con token en header no es posible directo,
    // usamos blob URL para evitar problemas de auth
    fetch(url, { headers: { "Authorization": `Bearer ${token}` } })
        .then(res => {
            if (!res.ok) throw new Error("No se pudo cargar el PDF");
            return res.blob();
        })
        .then(blob => {
            const blobUrl        = URL.createObjectURL(blob);
            pdfIframe.src        = blobUrl;
            pdfIframe.style.display = "block";
            pdfLoading.style.display = "none";

            // Actualizar links con blob para descarga directa
            document.getElementById("btnDescargarPdf").href = blobUrl;
            document.getElementById("btnAbrirNueva").href   = blobUrl;
        })
        .catch(() => {
            pdfLoading.innerHTML = `<i class="bi bi-exclamation-circle" style="font-size:32px;color:#ef4444;"></i>
                                    <span style="color:#ef4444;">No se pudo cargar el informe.</span>`;
        });
}

function cerrarPanel() {
    pdfPanel.classList.remove("open");
    pdfOverlay.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => { pdfIframe.src = ""; }, 300);
}

document.getElementById("btnCerrarPanel").addEventListener("click", cerrarPanel);
pdfOverlay.addEventListener("click", cerrarPanel);

// ── Buscador ──
document.getElementById("buscadorProtocolo").addEventListener("input", function () {
    const texto = this.value.trim().toLowerCase();
    datosFiltrados = todasLasMuestras.filter(m => m.codigo.toLowerCase().includes(texto));
    paginaActual = 1;
    renderTabla();
});

// ── Init ──
cargarEstudios();