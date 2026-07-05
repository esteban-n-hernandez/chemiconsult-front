document.addEventListener('DOMContentLoaded', () => {
    AOS.init({duration: 900, once: true});
});

// WHATSAPP: mostrar ícono fijo siempre (no depende de sección)
document.addEventListener("DOMContentLoaded", function () {
    const icono = document.querySelector(".whatsapp-icon");
    if (icono) icono.style.display = "block";
});

// SCROLL EFFECT: aparición suave de secciones
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
        {threshold: 0.1}
    );

    sections.forEach(section => observer.observe(section));
});

// NAVBAR: cerrar menú mobile al hacer click en un link
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

// PRICING: cargar precios desde Google Sheet
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

// PRICING MODAL: popular con datos del servicio clickeado
document.addEventListener("DOMContentLoaded", function () {
    var pricingModal = document.getElementById("pricingModal");
    if (!pricingModal) return;

    pricingModal.addEventListener("show.bs.modal", function (event) {
        var button = event.relatedTarget;
        if (!button) return;

        var titulo = button.getAttribute("data-titulo");
        var descripcion = button.getAttribute("data-descripcion");
        var items = (button.getAttribute("data-items") || "").split("|");
        var nota = button.getAttribute("data-nota");
        var precio = button.getAttribute("data-precio");
        var empretiendaUrl = button.getAttribute("data-empretienda");
        var whatsappMsg = button.getAttribute("data-whatsapp");

        pricingModal.querySelector("#pricingModalLabel").textContent = titulo || '';
        pricingModal.querySelector("#pricingModalDesc").textContent = descripcion || '';
        pricingModal.querySelector("#pricingModalNota").textContent = nota || '';
        // Mostrar precio con "+ IVA" sólo si existe un precio válido.
        var precioRaw = precio || "";
        var precioTrim = precioRaw.toString().trim();
        var displayPrecio;
        if (!precioTrim || precioTrim.toLowerCase() === 'a consultar' || precioTrim.toLowerCase() === 'consultar') {
            displayPrecio = "Consultar";
        } else {
            displayPrecio = precioTrim + " + IVA";
        }
        pricingModal.querySelector("#pricingModalPrecio").textContent = displayPrecio;

        var lista = pricingModal.querySelector("#pricingModalItems");
        var itemsLabel = pricingModal.querySelector("#pricingModalItemsLabel");
        lista.innerHTML = "";

        var hasItems = false;
        items.forEach(function (item) {
            item = (item || "").trim();
            if (!item) return;
            hasItems = true;
            var li = document.createElement("li");
            // innerHTML (en vez de textContent) permite usar <i>, <em>, <b>, etc.
            // dentro de data-items para dar formato (ej: cursiva en nombres científicos)
            li.innerHTML = item;
            lista.appendChild(li);
        });

        // Ocultar "Incluye:" y la lista si no hay items
        if (itemsLabel) itemsLabel.style.display = hasItems ? "block" : "none";
        lista.style.display = hasItems ? "block" : "none";

        // Empretienda link
        var empretiendaBtn = pricingModal.querySelector("#pricingModalEmpretienda");
        if (empretiendaBtn && empretiendaUrl) {
            empretiendaBtn.href = empretiendaUrl;
        }

        // WhatsApp link: usa data-whatsapp si existe, sino genera mensaje con el título
        var msgWA = whatsappMsg || "Hola, quisiera consultar un presupuesto para el servicio de " + titulo;
        var wppBtn = pricingModal.querySelector("#pricingModalWhatsapp");
        if (wppBtn) {
            wppBtn.href = "https://wa.me/5491158692422?text=" + encodeURIComponent(msgWA);
        }
    });

    // Cerrar modal al hacer click en botón de WhatsApp
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
    button.addEventListener('click', function () {
        const empretiendaUrl = this.getAttribute('data-empretienda');
        const empretiendaLink = document.getElementById('pricingModalEmpretienda');

        if (empretiendaUrl) {
            empretiendaLink.href = empretiendaUrl;
        }
    });
});