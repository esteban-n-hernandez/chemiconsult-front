const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:8080'
    : window.location.hostname === 'esteban-n-hernandez.github.io'
        ? 'https://chemiconsult-users.onrender.com' // QUITAR cuando dejes de usar GitHub Pages
        : '';
