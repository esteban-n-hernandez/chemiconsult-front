document.addEventListener("DOMContentLoaded", function () {
    const header = document.getElementById("inicio");
    setTimeout(() => {
        header.classList.add("visible");
    }, 200); // slight delay for effect
});

document.addEventListener("DOMContentLoaded", function () {
    const header = document.getElementById("inicio");
    setTimeout(() => {
        header.classList.add("visible");
        // Typewriter effect
        const p = header.querySelector(".contenedor-header p");
        const text = p.textContent;
        p.textContent = "";
        let i = 0;

        function type() {
            if (i < text.length) {
                p.textContent += text.charAt(i);
                i++;
                setTimeout(type, 40); // speed of typing
            }
        }

        setTimeout(type, 400); // delay after fade-in
    }, 200);
});


document.addEventListener("scroll", function () {
    const contacto = document.getElementById("contacto");
    const icono = document.querySelector(".whatsapp-icon");

    if (!contacto || !icono) return;

    const rect = contacto.getBoundingClientRect();
    const estaVisible = rect.top <= window.innerHeight && rect.bottom >= 0;

    icono.style.display = estaVisible ? "block" : "none";
});

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

document.addEventListener("DOMContentLoaded", function () {
    const navbarToggle = document.querySelector('.navbar-toggle');
    const navbar = document.querySelector('.navbar');
    if (navbarToggle && navbar) {
        navbarToggle.addEventListener('click', () => {
            navbar.classList.toggle('active');
        });
    }
});

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
        }, 3000); // cambia cada 3 segundos
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const grupoServicios = document.querySelector('.grupo-servicios');
    const leftArrow = document.querySelector('.carousel-arrow.left');
    const rightArrow = document.querySelector('.carousel-arrow.right');

    if (grupoServicios && leftArrow && rightArrow) {
        const scrollAmount = grupoServicios.offsetWidth * 0.9; // scroll by one card

        leftArrow.addEventListener('click', () => {
            grupoServicios.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });

        rightArrow.addEventListener('click', () => {
            grupoServicios.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Function to check if an element is in viewport
    function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    const serviciosSection = document.getElementById('servicios');

    serviciosSection.classList.add('section-debug');

    function checkServicesVisibility() {
        if (!isInViewport(serviciosSection)) {
            console.log('Services section is not in viewport');
            // Make section more visible by adding a distinctive style
            serviciosSection.style.padding = '50px 0';
            serviciosSection.style.margin = '20px 0';
        }
    }

    checkServicesVisibility();
    window.addEventListener('scroll', checkServicesVisibility);
    window.addEventListener('resize', checkServicesVisibility);

    // Add a click handler for the navigation link to ensure scrolling works
    document.querySelector('a[href="#servicios"]').addEventListener('click', function(e) {
        e.preventDefault();
        serviciosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

document.addEventListener('DOMContentLoaded', function() {
    // Function to force the servicios section to be visible regardless of scaling
    function forceServiciosVisibility() {
        const serviciosSection = document.getElementById('servicios');

        if (serviciosSection) {
            // Ensure the section is visible by adding these critical properties
            serviciosSection.style.display = "block";
            serviciosSection.style.visibility = "visible";
            serviciosSection.style.opacity = "1";
            serviciosSection.style.transform = "translateY(0)";
            serviciosSection.style.position = "relative";
            serviciosSection.style.zIndex = "1";
            serviciosSection.classList.add("visible");

            // Add a clear margin to ensure spacing
            serviciosSection.style.marginTop = "100px";
            serviciosSection.style.marginBottom = "100px";

            console.log("Force visibility applied to services section");
        }
    }

    forceServiciosVisibility();
    window.addEventListener('resize', forceServiciosVisibility);

    window.addEventListener('scroll', function() {
        const serviciosSection = document.getElementById('servicios');
        if (!serviciosSection) return;

        const rect = serviciosSection.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;

        if (rect.top <= windowHeight && rect.bottom >= 0) {
            forceServiciosVisibility();
        }
    });
});
