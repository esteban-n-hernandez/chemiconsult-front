const API_URL = "http://localhost:8080/api";

document.addEventListener("DOMContentLoaded", () => {
    cargarMetodologias();
});

async function cargarMetodologias() {
    try {
        // Buscamos el token de tu JWT (asumiendo que lo guardás en localStorage)
        const token = localStorage.getItem('token');
        console.log(token);
        const response = await fetch(`${API_URL}/metodologias`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Si la ruta está protegida, mandamos el token
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error("Error al obtener las metodologías");

        const metodologias = await response.json();
        renderizarTablaMetodologias(metodologias);

    } catch (error) {
        console.error("Error:", error);
        document.getElementById('tablaMetodologiasBody').innerHTML = `
            <tr><td colspan="3" class="text-center text-danger">Error al cargar los datos</td></tr>
        `;
    }
}

function renderizarTablaMetodologias(lista) {
    const tbody = document.getElementById('tablaMetodologiasBody');
    tbody.innerHTML = ''; // Limpiamos la tabla (por si decía "Cargando...")

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center">No hay metodologías cargadas.</td></tr>`;
        return;
    }

    lista.forEach(met => {
        // Armamos la fila de la tabla con el diseño de tu HTML
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${met.nombre}</td>
            <td>${met.referencia || '-'}</td>
            <td>
                <button class="btn-accion-danger" onclick="eliminarMetodologia(${met.id})" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

// Función vacía para prepararla para el futuro
function eliminarMetodologia(id) {
    if (confirm("¿Estás seguro de eliminar esta metodología?")) {
        console.log("Acá iría el fetch con método DELETE para el ID:", id);
    }
}