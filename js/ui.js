/* ui.js — Toast + Confirm Modal compartido */
(function () {
    let _injected = false;

    function injectDOM() {
        if (_injected || !document.body) return;
        _injected = true;

        // Toast (solo para páginas que no tienen el suyo propio)
        if (!document.getElementById('ui-toast')) {
            const toast = document.createElement('div');
            toast.id = 'ui-toast';
            toast.innerHTML = '<i id="ui-toast-icon" class="bi"></i><span id="ui-toast-msg"></span>';
            document.body.appendChild(toast);
        }

        // Modal de confirmación
        if (!document.getElementById('ui-confirm-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'ui-confirm-overlay';
            overlay.innerHTML = `
                <div id="ui-confirm-modal">
                    <div id="ui-confirm-icon-wrap"><i id="ui-confirm-icon" class="bi"></i></div>
                    <p id="ui-confirm-titulo"></p>
                    <p id="ui-confirm-subtexto"></p>
                    <div id="ui-confirm-btns">
                        <button class="ui-btn-cancel" id="ui-confirm-cancel">Cancelar</button>
                        <button class="ui-btn-confirm danger" id="ui-confirm-ok">Confirmar</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectDOM);
    } else {
        injectDOM();
    }

    // Toast global — las páginas con su propio mostrarToast lo van a pisar al cargarse después
    window.mostrarToast = function (msg, tipo = 'success') {
        if (!_injected) injectDOM();
        const iconMap = {
            success: 'bi-check-circle-fill',
            danger:  'bi-x-circle-fill',
            warning: 'bi-exclamation-circle-fill',
        };
        const toast = document.getElementById('ui-toast');
        if (!toast) return;
        document.getElementById('ui-toast-icon').className = `bi ${iconMap[tipo] || iconMap.success}`;
        document.getElementById('ui-toast-msg').textContent = msg;
        toast.className = `visible ${tipo}`;
        clearTimeout(toast._t);
        toast._t = setTimeout(() => { toast.className = ''; }, 3500);
    };

    // UI.confirmar — devuelve Promise<boolean>
    window.UI = window.UI || {};
    window.UI.confirmar = function ({
        titulo         = '¿Confirmar acción?',
        subtexto       = '',
        textoConfirmar = 'Confirmar',
        tipo           = 'danger',
    } = {}) {
        return new Promise(resolve => {
            if (!_injected) injectDOM();

            const overlay   = document.getElementById('ui-confirm-overlay');
            const iconEl    = document.getElementById('ui-confirm-icon');
            const iconWrap  = document.getElementById('ui-confirm-icon-wrap');
            const tituloEl  = document.getElementById('ui-confirm-titulo');
            const subEl     = document.getElementById('ui-confirm-subtexto');
            const okBtn     = document.getElementById('ui-confirm-ok');
            const cancelBtn = document.getElementById('ui-confirm-cancel');

            if (!overlay) { resolve(false); return; }

            const iconMap = {
                danger:  'bi-trash3',
                warning: 'bi-exclamation-triangle',
                primary: 'bi-question-circle',
            };

            iconEl.className  = `bi ${iconMap[tipo] || iconMap.danger}`;
            iconWrap.className = tipo;
            tituloEl.textContent = titulo;
            subEl.textContent    = subtexto;
            subEl.style.display  = subtexto ? '' : 'none';
            okBtn.textContent    = textoConfirmar;
            okBtn.className      = `ui-btn-confirm ${tipo}`;

            overlay.classList.add('visible');

            function cleanup(result) {
                overlay.classList.remove('visible');
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onOverlay);
                resolve(result);
            }

            const onOk      = () => cleanup(true);
            const onCancel  = () => cleanup(false);
            const onOverlay = e => { if (e.target === overlay) cleanup(false); };

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
            overlay.addEventListener('click', onOverlay);
        });
    };
})();
