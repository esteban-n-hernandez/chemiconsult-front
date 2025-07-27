// Add to your <script> in index.html
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

document.addEventListener("DOMContentLoaded", function () {
    const navbar = document.querySelector(".navbar");
    window.addEventListener("scroll", function () {
        if (window.scrollY >= 300) {
            navbar.classList.add("navbar-small");
        } else {
            navbar.classList.remove("navbar-small");
        }
    });
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

const navbarToggle = document.querySelector('.navbar-toggle');
const navbar = document.querySelector('.navbar');
navbarToggle.addEventListener('click', () => {
    navbar.classList.toggle('active');
});