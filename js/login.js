const API_URL = API_BASE;

document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const formBody = new URLSearchParams();
    formBody.append("email", email);
    formBody.append("password", password);

    try {
        const response = await fetch(API_URL+"/login", {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: formBody
        });

        if (response.ok) {
            const data = await response.json();

            // FIX: limpiamos todo lo de una sesión anterior ANTES de escribir los datos nuevos.
            // Esto evita que quede pegado el nombre/rol de un login previo si por algún motivo
            // el usuario no pasó por "Cerrar sesión" (cerró la pestaña, navegó directo a login.html, etc.)
            ["token", "userEmail", "userRole", "userId", "userName"].forEach(k => localStorage.removeItem(k));

            localStorage.setItem("token", data.token);
            localStorage.setItem("userEmail", email);
            localStorage.setItem("userRole", data.role.toUpperCase());
            localStorage.setItem("userId", data.userId);
            // FIX: antes no se guardaba — el header/sidebar mostraban el nombre de la sesión anterior
            localStorage.setItem("userName", data.username || "");

            const rol = data.role.toUpperCase();

            if (rol === "ROLE_CLIENTE") {
                window.location.href = "dashboard-cliente.html";
            } else {
                window.location.href = "dashboard-empleado.html";
            }
        } else {
            document.getElementById("error-message").style.display = "block";
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        document.getElementById("error-message").style.display = "block";
    }
});