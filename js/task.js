const API_URL = "http://localhost:8080/api/tasks"; // ajustalo a tu backend

let tasks = [];
let draggedTaskId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await loadTasks();
    setupForm();
    setupDropzones();
});

async function loadTasks() {
    try {
        const res = await fetch(API_URL);
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
    div.className = `task-card ${task.status.toLowerCase()}`;
    div.draggable = true;
    div.dataset.id = task.id;

    div.innerHTML = `
    <div class="task-title">${escapeHtml(task.title)}</div>
    <div class="task-meta mb-2">${escapeHtml(task.description || "")}</div>
    <div class="d-flex gap-2">
      <button class="btn btn-sm btn-outline-danger" onclick="deleteTask(${task.id})">Eliminar</button>
    </div>
  `;

    div.addEventListener("dragstart", () => { draggedTaskId = task.id; });
    div.addEventListener("dragend", () => { draggedTaskId = null; });

    return div;
}

function setupDropzones() {
    document.querySelectorAll(".kanban-col").forEach(col => {
        col.addEventListener("dragover", (e) => {
            e.preventDefault();
            col.classList.add("dropzone-over");
        });

        col.addEventListener("dragleave", () => col.classList.remove("dropzone-over"));

        col.addEventListener("drop", async (e) => {
            e.preventDefault();
            col.classList.remove("dropzone-over");
            if (!draggedTaskId) return;

            const newStatus = col.dataset.status;
            const task = tasks.find(t => t.id === draggedTaskId);
            if (!task || task.status === newStatus) return;

            await updateTaskStatus(task, newStatus);
        });
    });
}

async function updateTaskStatus(task, newStatus) {
    const payload = { ...task, status: newStatus };

    try {
        const res = await fetch(`${API_URL}/${task.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
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
            status: document.getElementById("status").value
        };

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
        const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("No se pudo eliminar");
        tasks = tasks.filter(t => t.id !== id);
        renderBoard();
    } catch (e) {
        console.error(e);
        alert("Error eliminando tarea");
    }
}

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}