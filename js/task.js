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
    setupReasignarForm();
});

// NUEVO: trae la lista de usuarios (empleados) para poblar los selects de asignación
async function cargarUsuarios() {
    try {
        const res = await fetch(USERS_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("No se pudieron cargar usuarios");
        usuarios = await res.json();

        const selectAlta = document.getElementById("asignadoUserId");
        const selectReasignar = document.getElementById("reasignarUserId");

        usuarios.forEach(u => {
            const label = u.username || u.email;
            selectAlta.appendChild(new Option(label, u.id));
            selectReasignar.appendChild(new Option(label, u.id));
        });

        // Preselecciona al usuario logueado como asignado por defecto (se puede cambiar antes de guardar)
        if (userId) {
            selectAlta.value = userId;
        }
    } catch (e) {
        console.error(e);
        // No bloquea el resto de la pantalla — los selects quedan con "Sin asignar" solamente
    }
}

async function loadTasks() {
    console.log(token);
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
    const colDone = document.getElementById("col-done");

    colTodo.innerHTML = "";
    colInProgress.innerHTML = "";
    colDone.innerHTML = "";

    tasks.forEach(task => {
        const card = createTaskCard(task);
        if (task.status === "TODO") colTodo.appendChild(card);
        else if (task.status === "IN_PROGRESS") colInProgress.appendChild(card);
        else colDone.appendChild(card);
    });

    document.getElementById("count-todo").textContent = tasks.filter(t => t.status === "TODO").length;
    document.getElementById("count-inprogress").textContent = tasks.filter(t => t.status === "IN_PROGRESS").length;
    document.getElementById("count-done").textContent = tasks.filter(t => t.status === "DONE").length;
}

function createTaskCard(task) {
    const div = document.createElement("div");

    // Convertimos IN_PROGRESS a in_progress para que coincida exactamente con las reglas de CSS
    const statusClass = task.status.toLowerCase().replace("-", "_");
    div.className = `kanban-card ${statusClass}`;
    div.draggable = true;
    div.dataset.id = task.id;

    // FIX: el backend ya manda userName correctamente en todas las respuestas (create/status/get).
    // Si userName viene vacío es porque la tarea genuinamente no tiene usuario asignado —
    // ya no debe caer al usuario logueado, eso mostraba el owner equivocado.
    const asignadoNombre = task.userName || "Sin asignar";
    const initials = task.userName ? getInitials(task.userName) : "—";

    div.innerHTML = `
    <div class="kanban-card-body">
        <div class="kanban-card-title">${escapeHtml(task.title)}</div>
        <p class="kanban-card-desc">${escapeHtml(task.description || "")}</p>
    </div>
    <div class="kanban-card-footer">
        <div class="kanban-card-actions">
            <button class="btn btn-link-danger p-0" title="Reasignar" onclick="abrirReasignar(${task.id})">
                <i class="bi bi-person-plus"></i>
            </button>
            <button class="btn btn-link-danger p-0" title="Eliminar" onclick="deleteTask(${task.id})">
                <i class="bi bi-trash3"></i>
            </button>
        </div>
        <div class="task-creator" title="Asignado a: ${escapeHtml(asignadoNombre)}">
            <span class="creator-avatar">${escapeHtml(initials)}</span>
        </div>
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

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const payload = {
            title: document.getElementById("title").value.trim(),
            description: document.getElementById("description").value.trim(),
            // NUEVO: usuario elegido en el select, en vez de siempre asignar al usuario logueado
            userId: document.getElementById("asignadoUserId").value
                ? Number(document.getElementById("asignadoUserId").value)
                : null
        };

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: {"Content-Type": "application/json", 'Authorization': `Bearer ${token}`},
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("No se pudo crear tarea");

            const created = await res.json();
            tasks.push(created);
            renderBoard();

            form.reset();
            modal.hide();
        } catch (e) {
            console.error(e);
            alert("Error creando tarea");
        }
    });
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

    // Si viene en formato email (ej: carlos.mendoza@chemiconsult.com)
    if (nameOrEmail.includes("@")) {
        const namePart = nameOrEmail.split("@")[0];
        const parts = namePart.split(/[\._\-]/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return namePart.substring(0, 2).toUpperCase();
    }

    // Si viene un nombre completo común (ej: "Carlos Mendoza")
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
// ══════════════════════════════════════════
//  REASIGNAR TAREA
// ══════════════════════════════════════════
function abrirReasignar(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById("reasignarTaskId").value = taskId;
    document.getElementById("reasignarUserId").value = task.userId || "";

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("reasignarModal"));
    modal.show();
}

function setupReasignarForm() {
    const form = document.getElementById("reasignarForm");
    const modalEl = document.getElementById("reasignarModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const taskId = document.getElementById("reasignarTaskId").value;
        const nuevoUserId = document.getElementById("reasignarUserId").value;

        if (!nuevoUserId) {
            alert("Seleccioná un usuario para reasignar la tarea");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/${taskId}/asignar?userId=${encodeURIComponent(nuevoUserId)}`, {
                method: "PUT",
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("No se pudo reasignar la tarea");

            const updated = await res.json();
            tasks = tasks.map(t => t.id === updated.id ? updated : t);
            renderBoard();

            modal.hide();
        } catch (e) {
            console.error(e);
            alert("Error al reasignar la tarea");
        }
    });
}