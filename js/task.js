const API_URL = `${API_BASE}/api/task`;
const USERS_URL = `${API_BASE}/api/users/asignables`;
const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userEmail = localStorage.getItem("userEmail");

let tasks = [];
let usuarios = [];
let draggedTaskId = null;
let activeFilterUser = '*';

document.addEventListener("DOMContentLoaded", async () => {
    inicializarHeader();
    await cargarUsuarios();
    await loadTasks();
    setupForm();
    setupDropzones();

    document.getElementById("archivedModal").addEventListener("show.bs.modal", loadArchivedTasks);
});

// Trae la lista de usuarios para poblar los selects de asignación
async function cargarUsuarios() {
    try {
        const res = await fetch(USERS_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("No se pudieron cargar usuarios");
        usuarios = await res.json();

        const selectAlta = document.getElementById("asignadoUserId");
        usuarios.forEach(u => {
            const label = u.username || u.email;
            selectAlta.appendChild(new Option(label, u.id));
        });

        if (userId) {
            selectAlta.value = userId;
        }

        const filterBar = document.getElementById("kb-filter-bar");
        if (filterBar) {
            const noAssign = document.createElement("button");
            noAssign.className = "kb-pill";
            noAssign.dataset.u = "none";
            noAssign.textContent = "Sin asignar";
            noAssign.onclick = function() { kbFilter(this); };
            filterBar.appendChild(noAssign);

            usuarios.forEach(u => {
                const label = u.username || u.email;
                const btn = document.createElement("button");
                btn.className = "kb-pill";
                btn.dataset.u = String(u.id);
                btn.innerHTML = `<span class="kb-pill-av">${escapeHtml(getInitials(label))}</span>${escapeHtml(label)}`;
                btn.onclick = function() { kbFilter(this); };
                filterBar.appendChild(btn);
            });
        }
    } catch (e) {
        console.error(e);
    }
}

function deadlineBadge(dueDate) {
    if (!dueDate) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate + 'T00:00:00');
    due.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / 86400000);
    if (diff < 0)   return `<span class="dl-badge dl-over">Vencida · ${formatDateShort(dueDate)}</span>`;
    if (diff === 0) return `<span class="dl-badge dl-hoy">Hoy</span>`;
    if (diff === 1) return `<span class="dl-badge dl-tom">Mañana</span>`;
    if (diff <= 7)  return `<span class="dl-badge dl-soon">En ${diff} días</span>`;
    return `<span class="dl-badge dl-ok">${formatDateShort(dueDate)}</span>`;
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const opts = { day: '2-digit', month: 'short' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('es-AR', opts);
}

async function loadTasks() {
    try {
        const res = await fetch(API_URL, {
            method: "GET",
            headers: {'Authorization': `Bearer ${token}`}
        });
        if (!res.ok) throw new Error("No se pudieron cargar tareas");
        tasks = await res.json();
        renderBoard();
    } catch (e) {
        console.error(e);
        mostrarToast("Error cargando tareas", 'danger');
    }
}

function renderBoard() {
    const colTodo = document.getElementById("col-todo");
    const colInProgress = document.getElementById("col-inprogress");
    const colRevision = document.getElementById("col-revision");
    const colDone = document.getElementById("col-done");

    colTodo.innerHTML = "";
    colInProgress.innerHTML = "";
    colRevision.innerHTML = "";
    colDone.innerHTML = "";

    tasks.forEach(task => {
        const card = createTaskCard(task);
        if (task.status === "TODO") colTodo.appendChild(card);
        else if (task.status === "IN_PROGRESS") colInProgress.appendChild(card);
        else if (task.status === "EN_REVISION") colRevision.appendChild(card);
        else colDone.appendChild(card);
    });

    document.getElementById("count-todo").textContent = tasks.filter(t => t.status === "TODO").length;
    document.getElementById("count-inprogress").textContent = tasks.filter(t => t.status === "IN_PROGRESS").length;
    document.getElementById("count-revision").textContent = tasks.filter(t => t.status === "EN_REVISION").length;
    document.getElementById("count-done").textContent = tasks.filter(t => t.status === "DONE").length;

    if (activeFilterUser !== '*') {
        document.querySelectorAll('.kanban-card').forEach(card => {
            const match = (activeFilterUser === 'none' && !card.dataset.userId)
                || card.dataset.userId === activeFilterUser;
            card.classList.toggle('kb-hidden', !match);
        });
    }
}

function createTaskCard(task) {
    const div = document.createElement("div");

    const statusClass = task.status.toLowerCase().replace("-", "_");
    div.className = `kanban-card ${statusClass}`;
    div.draggable = true;
    div.dataset.id = task.id;
    div.dataset.userId = task.userId ? String(task.userId) : '';

    const asignadoNombre = task.userName || "Sin asignar";
    const initials = task.userName ? getInitials(task.userName) : "—";

    const archiveBtn = task.status === "DONE"
        ? `<button class="btn btn-link-secondary" title="Archivar" onclick="archiveTask(${task.id})"><i class="bi bi-archive"></i></button>`
        : "";

    div.innerHTML = `
    <div class="kanban-card-top">
        <p class="kanban-card-title">${escapeHtml(task.title)}</p>
    </div>
    ${task.description ? `<p class="kanban-card-desc">${escapeHtml(task.description)}</p>` : ''}
    <div class="kanban-card-footer">
        <div class="kanban-card-assignee">
            <span class="creator-avatar">${escapeHtml(initials)}</span>
            <span class="assignee-name">${escapeHtml(asignadoNombre)}</span>
        </div>
        ${deadlineBadge(task.dueDate)}
    </div>
    <div class="kanban-card-actions">
        ${archiveBtn}
        <button class="btn btn-link-danger" title="Editar" onclick="abrirEditar(${task.id})">
            <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-link-danger" title="Eliminar" onclick="deleteTask(${task.id})">
            <i class="bi bi-trash3"></i>
        </button>
    </div>
  `;

    div.addEventListener("dragstart", () => {
        draggedTaskId = task.id;
        div.classList.add("dragging");
    });
    div.addEventListener("dragend", () => {
        draggedTaskId = null;
        div.classList.remove("dragging");
    });

    return div;
}

function setupDropzones() {
    document.querySelectorAll(".kanban-col").forEach(col => {
        const zone = col.querySelector(".dropzone");

        col.addEventListener("dragover", (e) => {
            e.preventDefault();
            zone.classList.add("drag-over");
        });

        col.addEventListener("dragleave", (e) => {
            if (!col.contains(e.relatedTarget)) zone.classList.remove("drag-over");
        });

        col.addEventListener("drop", async (e) => {
            e.preventDefault();
            zone.classList.remove("drag-over");
            if (!draggedTaskId) return;

            const newStatus = col.dataset.status;
            const task = tasks.find(t => t.id === draggedTaskId);
            if (!task || task.status === newStatus) return;

            await updateTaskStatus(task, newStatus);
        });
    });
}

async function updateTaskStatus(task, newStatus) {
    try {
        const res = await fetch(`${API_URL}/${task.id}/status?status=${encodeURIComponent(newStatus)}`, {
            method: "PUT",
            headers: {'Authorization': `Bearer ${token}`}
        });
        if (!res.ok) throw new Error("No se pudo actualizar estado");

        const updated = await res.json();
        tasks = tasks.map(t => t.id === updated.id ? updated : t);
        renderBoard();
    } catch (e) {
        console.error(e);
        mostrarToast("Error actualizando estado", 'danger');
    }
}

function setupForm() {
    const form = document.getElementById("taskForm");
    const modalEl = document.getElementById("taskModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    // El botón "+ Nueva tarea" del header debe limpiar el modal antes de abrirlo
    // (si venía de editar una tarea, hay que resetear el modo)
    document.querySelector('[data-bs-target="#taskModal"]').addEventListener("click", abrirNuevaTarea);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const taskId = document.getElementById("taskId").value;
        const esEdicion = !!taskId;

        const payload = {
            title: document.getElementById("title").value.trim(),
            description: document.getElementById("description").value.trim(),
            userId: document.getElementById("asignadoUserId").value
                ? Number(document.getElementById("asignadoUserId").value)
                : null,
            dueDate: document.getElementById("dueDate").value || null
        };

        // El estado inicial solo aplica al crear — al editar no se toca (se cambia arrastrando)
        if (!esEdicion) {
            payload.status = document.getElementById("status").value;
        }

        try {
            const res = await fetch(esEdicion ? `${API_URL}/${taskId}` : API_URL, {
                method: esEdicion ? "PUT" : "POST",
                headers: {"Content-Type": "application/json", 'Authorization': `Bearer ${token}`},
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(esEdicion ? "No se pudo actualizar la tarea" : "No se pudo crear tarea");

            const guardada = await res.json();
            if (esEdicion) {
                tasks = tasks.map(t => t.id === guardada.id ? guardada : t);
            } else {
                tasks.push(guardada);
            }
            renderBoard();

            modal.hide();
        } catch (e) {
            console.error(e);
            mostrarToast(esEdicion ? "Error actualizando la tarea" : "Error creando tarea", 'danger');
        }
    });
}

// Abre el modal en modo "nueva tarea" — limpia cualquier estado de edición previo
function abrirNuevaTarea() {
    const form = document.getElementById("taskForm");
    form.reset();
    document.getElementById("taskId").value = "";
    document.getElementById("taskModalTitle").textContent = "Nueva tarea";
    document.getElementById("taskSubmitBtn").textContent = "Guardar";
    document.getElementById("statusGroup").style.display = "block";
    if (userId) document.getElementById("asignadoUserId").value = userId;
}

// Abre el modal en modo edición, precargado con los datos de la tarea
function abrirEditar(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById("taskId").value = task.id;
    document.getElementById("title").value = task.title || "";
    document.getElementById("description").value = task.description || "";
    document.getElementById("asignadoUserId").value = task.userId || "";
    document.getElementById("dueDate").value = task.dueDate || "";
    document.getElementById("taskModalTitle").textContent = "Editar tarea";
    document.getElementById("taskSubmitBtn").textContent = "Guardar cambios";
    // El estado no se edita acá (se cambia arrastrando la tarjeta entre columnas)
    document.getElementById("statusGroup").style.display = "none";

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("taskModal"));
    modal.show();
}

async function deleteTask(id) {
    const ok = await UI.confirmar({ titulo: '¿Eliminar tarea?', subtexto: 'Esta acción no se puede deshacer.', textoConfirmar: 'Eliminar', tipo: 'danger' });
    if (!ok) return;
    try {
        const res = await fetch(`${API_URL}/${id}`, {
            method: "DELETE",
            headers: {'Authorization': `Bearer ${token}`}
        });
        if (!res.ok) throw new Error("No se pudo eliminar");
        tasks = tasks.filter(t => t.id !== id);
        renderBoard();
    } catch (e) {
        console.error(e);
        mostrarToast("Error eliminando tarea", 'danger');
    }
}

async function archiveTask(id) {
    try {
        const res = await fetch(`${API_URL}/${id}/archive`, {
            method: "PUT",
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("No se pudo archivar");
        tasks = tasks.filter(t => t.id !== id);
        renderBoard();
    } catch (e) {
        console.error(e);
        mostrarToast("Error archivando tarea", 'danger');
    }
}

async function archiveAllDone() {
    const doneTasks = tasks.filter(t => t.status === "DONE");
    if (doneTasks.length === 0) return;
    const ok = await UI.confirmar({ titulo: `¿Archivar ${doneTasks.length} tareas finalizadas?`, subtexto: 'Las tareas se moverán al historial y no estarán en el tablero.', textoConfirmar: 'Archivar', tipo: 'warning' });
    if (!ok) return;
    try {
        const res = await fetch(`${API_URL}/archive-all-done`, {
            method: "PUT",
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("No se pudo archivar");
        tasks = tasks.filter(t => t.status !== "DONE");
        renderBoard();
    } catch (e) {
        console.error(e);
        mostrarToast("Error archivando tareas", 'danger');
    }
}

let archivedTasks = [];
let archivedPage = 0;
let archivedFilter = "";
const ARCHIVED_PAGE_SIZE = 8;

async function loadArchivedTasks() {
    try {
        const res = await fetch(`${API_URL}/archived`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("No se pudo cargar el archivo");
        archivedTasks = await res.json();
        archivedPage = 0;
        archivedFilter = "";
        const searchInput = document.getElementById("archivedSearch");
        if (searchInput) searchInput.value = "";
        renderArchivedPage();
    } catch (e) {
        console.error(e);
    }
}

function onArchivedSearch(value) {
    archivedFilter = value.trim().toLowerCase();
    archivedPage = 0;
    renderArchivedPage();
}

function renderArchivedPage() {
    const tbody = document.getElementById("archivedTableBody");
    const tableWrap = document.getElementById("archivedTableWrap");
    const empty = document.getElementById("archivedEmpty");
    const pagination = document.getElementById("archivedPagination");
    const countEl = document.getElementById("archivedCount");

    const filtered = archivedFilter
        ? archivedTasks.filter(t => t.title.toLowerCase().includes(archivedFilter))
        : archivedTasks;

    const total = archivedTasks.length;
    const filteredTotal = filtered.length;
    if (total === 0) {
        countEl.textContent = "";
    } else if (archivedFilter && filteredTotal !== total) {
        countEl.textContent = `${filteredTotal} de ${total} tarea${total !== 1 ? "s" : ""}`;
    } else {
        countEl.textContent = `${total} tarea${total !== 1 ? "s" : ""}`;
    }

    if (filteredTotal === 0) {
        tableWrap.style.display = "none";
        empty.style.display = "flex";
        pagination.style.display = "none";
        return;
    }

    tableWrap.style.display = "block";
    empty.style.display = "none";

    const totalPages = Math.ceil(filteredTotal / ARCHIVED_PAGE_SIZE);
    const start = archivedPage * ARCHIVED_PAGE_SIZE;
    const slice = filtered.slice(start, start + ARCHIVED_PAGE_SIZE);

    tbody.innerHTML = "";
    slice.forEach(task => {
        const initials = task.userName ? getInitials(task.userName) : "—";
        const assigneeName = escapeHtml(task.userName || "Sin asignar");
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><span class="archive-task-title" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</span></td>
            <td>
                <div class="archive-assignee">
                    <span class="creator-avatar">${escapeHtml(initials)}</span>
                    <span>${assigneeName}</span>
                </div>
            </td>
            <td><span class="archive-date">${formatDate(task.completedDate)}</span></td>
            <td><span class="archive-date">${formatDate(task.archivedDate)}</span></td>
            <td>
                <button class="archive-restore-btn" onclick="restoreTask(${task.id})">
                    <i class="bi bi-arrow-counterclockwise"></i> Restaurar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (totalPages > 1) {
        pagination.style.display = "flex";
        document.getElementById("pageInfo").textContent = `${archivedPage + 1} / ${totalPages}`;
        document.getElementById("prevPage").disabled = archivedPage === 0;
        document.getElementById("nextPage").disabled = archivedPage === totalPages - 1;
    } else {
        pagination.style.display = "none";
    }
}

function changePage(dir) {
    const totalPages = Math.ceil(archivedTasks.length / ARCHIVED_PAGE_SIZE);
    archivedPage = Math.max(0, Math.min(archivedPage + dir, totalPages - 1));
    renderArchivedPage();
}

async function restoreTask(id) {
    try {
        const res = await fetch(`${API_URL}/${id}/restore`, {
            method: "PUT",
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("No se pudo restaurar");
        const restored = await res.json();
        tasks.push(restored);
        renderBoard();
        archivedTasks = archivedTasks.filter(t => t.id !== id);
        const filtered = archivedFilter
            ? archivedTasks.filter(t => t.title.toLowerCase().includes(archivedFilter))
            : archivedTasks;
        if (archivedPage > 0 && archivedPage >= Math.ceil(filtered.length / ARCHIVED_PAGE_SIZE)) {
            archivedPage--;
        }
        renderArchivedPage();
    } catch (e) {
        console.error(e);
        mostrarToast("Error restaurando tarea", 'danger');
    }
}

function formatDate(date) {
    if (!date) return "—";
    try {
        const d = new Date(date);
        return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
        return String(date);
    }
}

function getInitials(nameOrEmail) {
    if (!nameOrEmail) return "??";

    if (nameOrEmail.includes("@")) {
        const namePart = nameOrEmail.split("@")[0];
        const parts = namePart.split(/[\._\-]/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return namePart.substring(0, 2).toUpperCase();
    }

    const parts = nameOrEmail.trim().split(" ");
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameOrEmail.substring(0, 2).toUpperCase();
}

function kbFilter(btn) {
    document.querySelectorAll('.kb-pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    activeFilterUser = btn.dataset.u;
    document.querySelectorAll('.kanban-card').forEach(card => {
        const match = activeFilterUser === '*'
            || (activeFilterUser === 'none' && !card.dataset.userId)
            || card.dataset.userId === activeFilterUser;
        card.classList.toggle('kb-hidden', !match);
    });
}

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}