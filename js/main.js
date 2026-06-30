// ======================================================
// WHATSAPP: mostrar ícono fijo siempre (no depende de sección)
// ======================================================
document.addEventListener("DOMContentLoaded", function () {
    const icono = document.querySelector(".whatsapp-icon");
    if (icono) icono.style.display = "block";
});

// ======================================================
// SCROLL EFFECT: aparición suave de secciones
// ======================================================
document.addEventListener("DOMContentLoaded", function () {
    const sections = document.querySelectorAll(".scroll-effect");

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1 }
    );

    sections.forEach(section => observer.observe(section));
});

// ======================================================
// NAVBAR: cerrar menú mobile al hacer click en un link
// ======================================================
document.addEventListener("DOMContentLoaded", function () {
    const navLinks = document.querySelectorAll(".navbar-nav .nav-link, .navbar-nav .dropdown-item");
    const navbarCollapse = document.getElementById("navbarSupportedContent");

    navLinks.forEach(link => {
        link.addEventListener("click", function () {
            if (navbarCollapse && navbarCollapse.classList.contains("show")) {
                const bsCollapse = bootstrap.Collapse.getOrCreateInstance(navbarCollapse);
                bsCollapse.hide();
            }
        });
    });
});

// ======================================================
// PRICING MODAL: popular con datos del servicio clickeado
// ======================================================
document.addEventListener("DOMContentLoaded", function () {
    var pricingModal = document.getElementById("pricingModal");
    if (!pricingModal) return;

    pricingModal.addEventListener("show.bs.modal", function (event) {
        var button = event.relatedTarget;
        var titulo     = button.getAttribute("data-titulo");
        var descripcion = button.getAttribute("data-descripcion");
        var items      = button.getAttribute("data-items").split("|");
        var nota       = button.getAttribute("data-nota");

        pricingModal.querySelector("#pricingModalLabel").textContent = titulo;
        pricingModal.querySelector("#pricingModalDesc").textContent  = descripcion;
        pricingModal.querySelector("#pricingModalNota").textContent  = nota;

        var lista = pricingModal.querySelector("#pricingModalItems");
        lista.innerHTML = "";
        items.forEach(function (item) {
            var li = document.createElement("li");
            li.textContent = item;
            lista.appendChild(li);
        });

        var wppMsg = encodeURIComponent("Hola, quisiera consultar un presupuesto para el servicio de " + titulo);
        var wppBtn = pricingModal.querySelector("#pricingModalWhatsapp");
        if (wppBtn) wppBtn.href = "https://wa.me/5491158692422?text=" + wppMsg;
    });
});



// ======================================================
// PRICING: cargar precios desde Google Sheet
// ======================================================
document.addEventListener("DOMContentLoaded", function () {

    const URL_SHEET = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRuKGVMeUjKHUEwzBzRfq6hg91g9HNb4eCziJCVRCxUQGt6jaP3_AroTD8PfRoxZNorDcoiITPck8X/pub?output=csv";

    fetch(URL_SHEET)
        .then(response => response.text())
        .then(csv => {

            const filas = csv.split("\n");

            filas.slice(1).forEach(fila => {

                if (!fila.trim()) return;

                const columnas = fila.split(",");

                const servicio = columnas[0]?.trim();
                const precio = columnas[1]?.trim();

                const tarjetas = document.querySelectorAll("[data-titulo]");

                tarjetas.forEach(tarjeta => {

                    const titulo = tarjeta.getAttribute("data-titulo");

                    if (titulo === servicio) {
                        // Guardamos el precio en su propio atributo,
                        // sin pisar la nota explicativa de cada servicio
                        tarjeta.setAttribute("data-precio", precio);
                    }

                });

            });

        })
        .catch(error => {
            console.error("Error cargando precios:", error);
        });

});

// ======================================================
// PRICING MODAL: popular con datos del servicio clickeado
// ======================================================
document.addEventListener("DOMContentLoaded", function () {
    var pricingModal = document.getElementById("pricingModal");
    if (!pricingModal) return;

    pricingModal.addEventListener("show.bs.modal", function (event) {
        var button = event.relatedTarget;
        if (!button) return;

        var titulo      = button.getAttribute("data-titulo");
        var descripcion = button.getAttribute("data-descripcion");
        var items       = (button.getAttribute("data-items") || "").split("|");
        var nota        = button.getAttribute("data-nota");
        var precio      = button.getAttribute("data-precio");

        pricingModal.querySelector("#pricingModalLabel").textContent = titulo;
        pricingModal.querySelector("#pricingModalDesc").textContent  = descripcion;
        pricingModal.querySelector("#pricingModalNota").textContent  = nota;
        pricingModal.querySelector("#pricingModalPrecio").textContent = precio || "A consultar";

        var lista = pricingModal.querySelector("#pricingModalItems");
        lista.innerHTML = "";
        items.forEach(function (item) {
            if (!item.trim()) return;
            var li = document.createElement("li");
            li.textContent = item;
            lista.appendChild(li);
        });

        var wppMsg = encodeURIComponent("Hola, quisiera consultar un presupuesto para el servicio de " + titulo);
        var wppBtn = pricingModal.querySelector("#pricingModalWhatsapp");
        if (wppBtn) wppBtn.href = "https://wa.me/5491158692422?text=" + wppMsg;
    });


    var pricingModalWhatsapp = document.querySelector("#pricingModalWhatsapp");
    if (pricingModalWhatsapp) {
        pricingModalWhatsapp.addEventListener("click", function () {
            var modalInstance = bootstrap.Modal.getInstance(pricingModal);
            if (modalInstance) modalInstance.hide();
        });
    }

});

  // Actualizar el link de Empretienda en el modal según la opción seleccionada
    document.querySelectorAll('.btn-pricing-modal').forEach(button => {
        button.addEventListener('click', function() {
            const empretiendaUrl = this.getAttribute('data-empretienda');
            const empretiendaLink = document.getElementById('pricingModalEmpretienda');
            
            if (empretiendaUrl) {
                empretiendaLink.href = empretiendaUrl;
            }
        });
    });
