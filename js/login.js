const API_URL = API_BASE;

function esMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
}

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

            // Limpiar sesión anterior antes de escribir datos nuevos
            ["token", "userEmail", "userRole", "userId", "userName", "userModulos"]
                .forEach(k => localStorage.removeItem(k));

            localStorage.setItem("token", data.token);
            localStorage.setItem("userEmail", email);
            localStorage.setItem("userRole", data.role.toUpperCase());
            localStorage.setItem("userId", data.userId);
            localStorage.setItem("userName", data.username || "");
            // Módulos habilitados para este usuario (array de strings)
            localStorage.setItem("userModulos", JSON.stringify(
                (data.modulos || []).map(m => String(m).toUpperCase())
            ));

            const rol = data.role.toUpperCase();

            if (rol === "ROLE_CLIENTE") {
                window.location.href = "dashboard-cliente.html";
            } else if (esMobile()) {
                window.location.href = "mobile.html";
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