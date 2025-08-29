document.addEventListener("DOMContentLoaded", function () {
    const header = document.getElementById("inicio");
    setTimeout(() => {
        header.classList.add("visible");
    }, 200); // slight delay for effect
});

// Typewriter effect for header <p>
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

const cinta = document.querySelector('.cinta');
cinta.innerHTML += cinta.innerHTML;