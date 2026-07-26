(function () {
    'use strict';

    const API = '/api/mensajes';
    const POLL_INTERVAL = 15000;

    let panelAbierto = false;
    let vistaActual = 'lista'; // 'lista' | 'conv' | 'nueva'
    let convActual = null;     // { id, nombre }
    let pollTimer = null;

    function token() {
        return localStorage.getItem('token') || '';
    }

    function miUserId() {
        return localStorage.getItem('userId') ? parseInt(localStorage.getItem('userId')) : null;
    }

    function headers() {
        return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() };
    }

    function formatHora(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        const ahora = new Date();
        const hoy = ahora.toDateString();
        if (d.toDateString() === hoy) {
            return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        }
        const ayer = new Date(ahora); ayer.setDate(ahora.getDate() - 1);
        if (d.toDateString() === ayer.toDateString()) return 'Ayer';
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    }

    function iniciales(nombre) {
        if (!nombre) return '?';
        return nombre.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
    }

    const COLORES = [
        { bg: '#1e3a5f', color: '#93c5fd' },
        { bg: '#1a2e1a', color: '#86efac' },
        { bg: '#2d1f3d', color: '#c4b5fd' },
        { bg: '#3d2a1a', color: '#fdba74' },
        { bg: '#1a2d3d', color: '#67e8f9' },
        { bg: '#3d1a1a', color: '#fca5a5' },
    ];
    function colorParaId(id) {
        return COLORES[id % COLORES.length];
    }

    // ── Inyectar HTML ─────────────────────────────────────────────────────────
    function inyectarWidget() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/chat.css';
        document.head.appendChild(link);

        document.body.insertAdjacentHTML('beforeend', `
            <button class="chat-fab" id="chatFab" title="Mensajes" aria-label="Mensajes">
                <i class="bi bi-chat-dots-fill"></i>
                <span class="chat-fab-badge" id="chatBadge" style="display:none">0</span>
            </button>

            <div class="chat-panel" id="chatPanel" role="dialog" aria-label="Panel de mensajes">
                <div class="chat-header">
                    <span class="chat-header-title">
                        <i class="bi bi-chat-dots-fill"></i>
                        Mensajes
                    </span>
                    <div class="chat-header-actions">
                        <button class="chat-hbtn" id="chatNuevaConvBtn" title="Nueva conversación" aria-label="Nueva conversación">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="chat-hbtn" id="chatCerrarBtn" title="Cerrar" aria-label="Cerrar">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>

                <!-- Vista: lista de conversaciones -->
                <div id="chatVistaLista" class="chat-contact-list"></div>

                <!-- Vista: conversación -->
                <div id="chatVistaConv" class="chat-conv-view" style="display:none">
                    <div class="chat-conv-header">
                        <button class="chat-conv-back" id="chatConvBack" aria-label="Volver">
                            <i class="bi bi-arrow-left"></i>
                        </button>
                        <div class="chat-avatar-sm" id="chatConvAvatar"></div>
                        <span class="chat-conv-name" id="chatConvNombre"></span>
                    </div>
                    <div class="chat-messages" id="chatMensajes"></div>
                    <div class="chat-conv-input">
                        <input type="text" id="chatInput" placeholder="Escribe un mensaje..." maxlength="1000" autocomplete="off"/>
                        <button class="chat-send-btn" id="chatSendBtn" aria-label="Enviar">
                            <i class="bi bi-send-fill"></i>
                        </button>
                    </div>
                </div>

                <!-- Vista: nueva conversación (buscar empleado) -->
                <div id="chatVistaNueva" style="display:none;flex-direction:column;flex:1;overflow:hidden">
                    <div class="chat-new-conv-header">
                        <button class="chat-conv-back" id="chatNuevaBack" aria-label="Volver">
                            <i class="bi bi-arrow-left"></i>
                        </button>
                        <input type="text" class="chat-new-conv-search" id="chatBuscar" placeholder="Buscar empleado..."/>
                    </div>
                    <div class="chat-contact-list" id="chatListaEmpleados"></div>
                </div>
            </div>
        `);
    }

    // ── Mostrar vistas ────────────────────────────────────────────────────────
    function mostrarVista(vista) {
        vistaActual = vista;
        document.getElementById('chatVistaLista').style.display = vista === 'lista' ? 'block' : 'none';
        document.getElementById('chatVistaConv').style.display  = vista === 'conv'  ? 'flex'  : 'none';
        document.getElementById('chatVistaNueva').style.display = vista === 'nueva' ? 'flex'  : 'none';
        document.getElementById('chatNuevaConvBtn').style.display = vista === 'lista' ? 'flex' : 'none';
    }

    // ── Badge ─────────────────────────────────────────────────────────────────
    async function actualizarBadge() {
        if (!token()) return;
        try {
            const r = await fetch(API + '/no-leidos', { headers: headers() });
            if (!r.ok) return;
            const { total } = await r.json();
            const badge = document.getElementById('chatBadge');
            if (!badge) return;
            if (total > 0) {
                badge.textContent = total > 99 ? '99+' : total;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (_) {}
    }

    // ── Lista conversaciones ──────────────────────────────────────────────────
    async function cargarConversaciones() {
        const contenedor = document.getElementById('chatVistaLista');
        if (!contenedor) return;
        try {
            const r = await fetch(API + '/conversaciones', { headers: headers() });
            if (!r.ok) { contenedor.innerHTML = '<div class="chat-empty"><i class="bi bi-exclamation-circle"></i>Error al cargar</div>'; return; }
            const convs = await r.json();

            if (convs.length === 0) {
                contenedor.innerHTML = `
                    <div class="chat-empty">
                        <i class="bi bi-chat-square-dots"></i>
                        <span>Sin conversaciones aún.<br>Usá el lápiz para empezar una.</span>
                    </div>`;
                return;
            }

            contenedor.innerHTML = convs.map(c => {
                const col = colorParaId(c.otroUserId);
                const ini = iniciales(c.otroUserNombre);
                const badge = c.noLeidos > 0
                    ? `<span class="chat-ci-unread">${c.noLeidos}</span>` : '';
                const preview = c.ultimoMensaje
                    ? (c.ultimoMensaje.length > 35 ? c.ultimoMensaje.substring(0, 35) + '…' : c.ultimoMensaje)
                    : '';
                return `
                <div class="chat-contact-item" data-id="${c.otroUserId}" data-nombre="${c.otroUserNombre}">
                    <div class="chat-avatar" style="background:${col.bg};color:${col.color}">${ini}</div>
                    <div class="chat-ci-info">
                        <div class="chat-ci-name">${c.otroUserNombre}</div>
                        <div class="chat-ci-preview">${preview}</div>
                    </div>
                    <div class="chat-ci-meta">
                        <span class="chat-ci-time">${formatHora(c.fechaUltimo)}</span>
                        ${badge}
                    </div>
                </div>`;
            }).join('');

            contenedor.querySelectorAll('.chat-contact-item').forEach(el => {
                el.addEventListener('click', () => abrirConversacion(
                    parseInt(el.dataset.id), el.dataset.nombre
                ));
            });
        } catch (_) {
            contenedor.innerHTML = '<div class="chat-empty"><i class="bi bi-exclamation-circle"></i>Error de red</div>';
        }
    }

    // ── Conversación individual ───────────────────────────────────────────────
    async function abrirConversacion(userId, nombre) {
        convActual = { id: userId, nombre };
        const col = colorParaId(userId);
        document.getElementById('chatConvAvatar').textContent = iniciales(nombre);
        document.getElementById('chatConvAvatar').style.background = col.bg;
        document.getElementById('chatConvAvatar').style.color = col.color;
        document.getElementById('chatConvNombre').textContent = nombre;
        mostrarVista('conv');
        await cargarMensajes();
        await fetch(API + '/leer/' + userId, { method: 'PUT', headers: headers() });
        actualizarBadge();
    }

    async function cargarMensajes() {
        if (!convActual) return;
        const contenedor = document.getElementById('chatMensajes');
        const miId = miUserId();
        try {
            const r = await fetch(API + '/conversacion/' + convActual.id, { headers: headers() });
            if (!r.ok) return;
            const mensajes = await r.json();
            const scrollBottom = contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight < 60;

            contenedor.innerHTML = mensajes.map(m => {
                const esYo = m.emisorId === miId;
                const clase = esYo ? 'me' : 'them';
                return `
                    <span class="chat-msg-time ${clase}">${formatHora(m.fechaEnvio)}</span>
                    <div class="chat-msg ${clase}">${escHtml(m.contenido)}</div>
                `;
            }).join('');

            if (scrollBottom || mensajes.length === 0) {
                contenedor.scrollTop = contenedor.scrollHeight;
            }
        } catch (_) {}
    }

    async function enviarMensaje() {
        if (!convActual) return;
        const input = document.getElementById('chatInput');
        const texto = input.value.trim();
        if (!texto) return;
        input.value = '';
        try {
            const r = await fetch(API, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ receptorId: convActual.id, contenido: texto })
            });
            if (r.ok) await cargarMensajes();
        } catch (_) {}
    }

    // ── Nueva conversación (buscar empleados) ─────────────────────────────────
    let todosEmpleados = [];

    async function abrirNuevaConv() {
        mostrarVista('nueva');
        document.getElementById('chatBuscar').value = '';
        if (todosEmpleados.length === 0) {
            const r = await fetch('/api/users/asignables', { headers: headers() });
            if (r.ok) todosEmpleados = await r.json();
        }
        renderizarEmpleados(todosEmpleados);
    }

    function renderizarEmpleados(lista) {
        const miId = miUserId();
        const contenedor = document.getElementById('chatListaEmpleados');
        const filtrados = lista.filter(u => u.id !== miId);
        if (filtrados.length === 0) {
            contenedor.innerHTML = '<div class="chat-empty"><i class="bi bi-people"></i>Sin empleados</div>';
            return;
        }
        contenedor.innerHTML = filtrados.map(u => {
            const col = colorParaId(u.id);
            return `
            <div class="chat-contact-item" data-id="${u.id}" data-nombre="${u.username}">
                <div class="chat-avatar" style="background:${col.bg};color:${col.color}">${iniciales(u.username)}</div>
                <div class="chat-ci-info">
                    <div class="chat-ci-name">${u.username}</div>
                    <div class="chat-ci-preview">${u.rol || ''}</div>
                </div>
            </div>`;
        }).join('');

        contenedor.querySelectorAll('.chat-contact-item').forEach(el => {
            el.addEventListener('click', () => {
                todosEmpleados = [];
                abrirConversacion(parseInt(el.dataset.id), el.dataset.nombre);
            });
        });
    }

    // ── Toggle panel ──────────────────────────────────────────────────────────
    function abrirPanel() {
        panelAbierto = true;
        document.getElementById('chatPanel').classList.add('chat-open');
        document.getElementById('chatBadge').style.display = 'none';
        mostrarVista('lista');
        cargarConversaciones();
        iniciarPolling();
    }

    function cerrarPanel() {
        panelAbierto = false;
        document.getElementById('chatPanel').classList.remove('chat-open');
        convActual = null;
        detenerPolling();
        actualizarBadge();
    }

    // ── Polling ───────────────────────────────────────────────────────────────
    function iniciarPolling() {
        detenerPolling();
        pollTimer = setInterval(async () => {
            if (vistaActual === 'conv' && convActual) {
                await cargarMensajes();
            } else if (vistaActual === 'lista') {
                await cargarConversaciones();
                await actualizarBadge();
            }
        }, POLL_INTERVAL);
    }

    function detenerPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    // ── Seguridad: escapar HTML ───────────────────────────────────────────────
    function escHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        if (!token()) return;

        inyectarWidget();

        document.getElementById('chatFab').addEventListener('click', () => {
            panelAbierto ? cerrarPanel() : abrirPanel();
        });
        document.getElementById('chatCerrarBtn').addEventListener('click', cerrarPanel);
        document.getElementById('chatConvBack').addEventListener('click', () => {
            convActual = null;
            mostrarVista('lista');
            cargarConversaciones();
        });
        document.getElementById('chatNuevaConvBtn').addEventListener('click', abrirNuevaConv);
        document.getElementById('chatNuevaBack').addEventListener('click', () => mostrarVista('lista'));
        document.getElementById('chatSendBtn').addEventListener('click', enviarMensaje);
        document.getElementById('chatInput').addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }
        });
        document.getElementById('chatBuscar').addEventListener('input', e => {
            const q = e.target.value.toLowerCase();
            renderizarEmpleados(todosEmpleados.filter(u =>
                u.username.toLowerCase().includes(q)
            ));
        });

        // Badge inicial y polling de fondo
        actualizarBadge();
        setInterval(actualizarBadge, POLL_INTERVAL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
