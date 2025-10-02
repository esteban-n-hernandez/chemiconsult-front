// Efecto de fade-in inicial y máquina de escribir en el header
document.addEventListener("DOMContentLoaded", function () {
    const header = document.getElementById("inicio");
    if (header) {
        setTimeout(() => {
            header.classList.add("visible");
            // Typewriter effect
            const p = header.querySelector(".contenedor-header p");
            if (p) {
                const text = p.textContent;
                p.textContent = "";
                let i = 0;
                function type() {
                    if (i < text.length) {
                        p.textContent += text.charAt(i);
                        i++;
                        setTimeout(type, 40);
                    }
                }
                setTimeout(type, 400);
            }
        }, 200);
    }
});

// Mostrar/ocultar el icono de WhatsApp según visibilidad de la sección contacto
document.addEventListener("scroll", function () {
    const contacto = document.getElementById("contacto");
    const icono = document.querySelector(".whatsapp-icon");
    if (!contacto || !icono) return;
    const rect = contacto.getBoundingClientRect();
    const estaVisible = rect.top <= window.innerHeight && rect.bottom >= 0;
    icono.style.display = estaVisible ? "block" : "none";
});

// Aparición suave de secciones con IntersectionObserver
document.addEventListener("DOMContentLoaded", function () {
    const sections = [
        document.getElementById("identificador-quienes-somos"),
        document.getElementById("mision-vision"),
        document.getElementById("servicios"),
        document.getElementById("clientes"),
        document.getElementById("contacto")
    ].filter(Boolean);

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        {threshold: 0.2}
    );

    sections.forEach(section => observer.observe(section));
});

// Toggle de menú mobile
document.addEventListener("DOMContentLoaded", function () {
    const navbarToggle = document.querySelector('.navbar-toggle');
    const navbar = document.querySelector('.navbar');
    if (navbarToggle && navbar) {
        navbarToggle.addEventListener('click', () => {
            navbar.classList.toggle('active');
        });
    }
});

// Indicadores de carrusel de servicios
document.addEventListener("DOMContentLoaded", function () {
    const grupo = document.querySelector("#servicios .grupo-servicios");
    const indicators = document.querySelector("#servicios .carousel-indicators");
    if (!grupo || !indicators) return;
    const items = grupo.querySelectorAll(".servicio");
    items.forEach((_, i) => {
        const dot = document.createElement("span");
        dot.className = "dot" + (i === 0 ? " active" : "");
        indicators.appendChild(dot);
    });
    grupo.addEventListener("scroll", () => {
        const scrollLeft = grupo.scrollLeft;
        const itemWidth = items[0].offsetWidth + 15; // 15px gap
        const index = Math.round(scrollLeft / itemWidth);
        indicators.querySelectorAll(".dot").forEach((dot, i) => {
            dot.classList.toggle("active", i === index);
        });
    });
});

// Carrusel de imágenes de servicios
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".imagenes-servicio").forEach(contenedor => {
        let imagenes = contenedor.querySelectorAll("img");
        let indice = 0;
        if (imagenes.length > 0) {
            imagenes[0].classList.add("activa");
        }
        setInterval(() => {
            imagenes[indice].classList.remove("activa");
            indice = (indice + 1) % imagenes.length;
            imagenes[indice].classList.add("activa");
        }, 3000);
    });
});

// Flechas para scroll horizontal del carrusel de servicios
document.addEventListener('DOMContentLoaded', function () {
    const grupoServicios = document.querySelector('.grupo-servicios');
    const leftArrow = document.querySelector('.carousel-arrow.left');
    const rightArrow = document.querySelector('.carousel-arrow.right');
    if (grupoServicios && leftArrow && rightArrow) {
        const scrollAmount = grupoServicios.offsetWidth * 0.9;
        leftArrow.addEventListener('click', () => {
            grupoServicios.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });
        rightArrow.addEventListener('click', () => {
            grupoServicios.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });
    }
});

// Scroll suave al hacer click en el nav a servicios
document.addEventListener('DOMContentLoaded', function() {
    const serviciosSection = document.getElementById('servicios');
    const linkServicios = document.querySelector('a[href="#servicios"]');
    if (serviciosSection && linkServicios) {
        linkServicios.addEventListener('click', function(e) {
            e.preventDefault();
            serviciosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
});