const API_URL = `${API_BASE}/api/task`;
const USERS_URL = `${API_BASE}/api/users/asignables`;
const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userEmail = localStorage.getItem("userEmail");

let tasks = [];
let usuarios = [];
let draggedTaskId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await cargarUsuarios();
    await loadTasks();
    setupForm();
    setupDropzones();
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
    } catch (e) {
        console.error(e);
    }
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
        alert("Error cargando tareas");
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
}

function createTaskCard(task) {
    const div = document.createElement("div");

    const statusClass = task.status.toLowerCase().replace("-", "_");
    div.className = `kanban-card ${statusClass}`;
    div.draggable = true;
    div.dataset.id = task.id;

    const asignadoNombre = task.userName || "Sin asignar";
    const initials = task.userName ? getInitials(task.userName) : "—";

    div.innerHTML = `
    <div class="kanban-card-top">
        <p class="kanban-card-title">${escapeHtml(task.title)}</p>
    </div>
    <p class="kanban-card-desc">${escapeHtml(task.description || "")}</p>
    <div class="kanban-card-assignee">
        <span class="creator-avatar">${escapeHtml(initials)}</span>
        <span class="assignee-name">${escapeHtml(asignadoNombre)}</span>
    </div>
    <div class="kanban-card-actions">
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
        alert("Error actualizando estado");
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
                : null
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
            alert(esEdicion ? "Error actualizando la tarea" : "Error creando tarea");
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
    document.getElementById("taskModalTitle").textContent = "Editar tarea";
    document.getElementById("taskSubmitBtn").textContent = "Guardar cambios";
    // El estado no se edita acá (se cambia arrastrando la tarjeta entre columnas)
    document.getElementById("statusGroup").style.display = "none";

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("taskModal"));
    modal.show();
}

async function deleteTask(id) {
    if (!confirm("¿Eliminar tarea?")) return;
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
        alert("Error eliminando tarea");
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

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}