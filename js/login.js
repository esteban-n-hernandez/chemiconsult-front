const API_URL = 'https://chemiconsult.onrender.com';

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
            localStorage.setItem("token", data.token);
            localStorage.setItem("userEmail", email);
            localStorage.setItem("userRole", data.role.toUpperCase());
            localStorage.setItem("userId", data.userId);

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

// OAuth buttons desactivados
// document.getElementById("msLoginBtn").addEventListener("click", function () {
//     window.location.href = "https://chemiconsult.onrender.com/oauth2/authorization/microsoft";
// });

// document.getElementById("googleLoginBtn").addEventListener("click", function () {
//     window.location.href = "https://chemiconsult.onrender.com/oauth2/authorization/google";
// });