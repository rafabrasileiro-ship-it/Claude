/**
 * components.js — componentes de UI reutilizáveis: Toast, Dialog e Loader.
 *
 * Dialog e Loader são camadas de navegação (Navigation.pushLayer): enquanto
 * estão abertos recebem todas as teclas, e Voltar os fecha antes de qualquer
 * outra coisa.
 */
(function (IPTV) {
  'use strict';

  const h = IPTV.Utils.h;
  const Navigation = IPTV.Navigation;

  /* ------------------------------------------------------------------ */
  /* Toast                                                               */
  /* ------------------------------------------------------------------ */
  const Toast = {
    _container: null,

    /** type: 'info' (padrão) | 'error' */
    show(message, type) {
      if (!this._container) {
        this._container = h('div', { class: 'toasts' });
        document.body.appendChild(this._container);
      }
      const container = this._container;
      while (container.children.length >= 3) container.removeChild(container.firstChild);
      const toast = h('div', { class: 'toast' + (type === 'error' ? ' toast-error' : ''), text: message });
      container.appendChild(toast);
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, type === 'error' ? 6000 : 3500);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Dialog                                                              */
  /* ------------------------------------------------------------------ */
  /**
   * Abre um modal e resolve com o `value` do botão escolhido
   * (ou `dismissValue` quando o usuário aperta Voltar).
   *
   * config: {
   *   title, message,
   *   content: Node opcional (ex.: formulário),
   *   buttons: [{ label, value, kind: 'primary' | 'danger' | undefined, autofocus }],
   *   dismissValue,
   *   className,
   *   beforeClose(value) → false para manter o modal aberto (validação),
   *   onOpen({ close, root }) chamado depois que o modal recebe o foco
   * }
   */
  function openDialog(config) {
    return new Promise((resolve) => {
      const actions = h('div', { class: 'modal-actions', 'data-focus-section': 'modal-actions' });
      const modal = h('div', { class: 'modal ' + (config.className || '') }, [
        h('h2', { class: 'modal-title', text: config.title }),
        config.message ? h('p', { class: 'modal-message', text: config.message }) : null,
        config.content || null,
        actions
      ]);
      const backdrop = h('div', { class: 'modal-backdrop' }, modal);
      let closed = false;

      const layer = {
        root: backdrop,
        onBack: () => close(config.dismissValue)
      };

      function close(value) {
        if (closed) return;
        if (typeof config.beforeClose === 'function' && config.beforeClose(value) === false) return;
        closed = true;
        Navigation.popLayer(layer);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        resolve(value);
      }

      (config.buttons || []).forEach((button) => {
        actions.appendChild(h('div', {
          class: 'btn' + (button.kind ? ' btn-' + button.kind : ''),
          'data-focusable': 'true',
          'data-focus-default': button.autofocus ? 'true' : null,
          text: button.label,
          onClick: () => close(button.value)
        }));
      });

      document.body.appendChild(backdrop);
      Navigation.pushLayer(layer);
      if (typeof config.onOpen === 'function') config.onOpen({ close, root: modal });
    });
  }

  const Dialog = {
    open: openDialog,

    /** Promise<boolean> */
    confirm(config) {
      return openDialog({
        title: config.title,
        message: config.message,
        dismissValue: false,
        buttons: [
          {
            label: config.confirmLabel || 'Confirmar',
            value: true,
            kind: config.danger ? 'danger' : 'primary',
            autofocus: !!config.focusConfirm
          },
          { label: config.cancelLabel || 'Cancelar', value: false, autofocus: !config.focusConfirm }
        ]
      });
    },

    alert(config) {
      return openDialog({
        title: config.title,
        message: config.message,
        buttons: [{ label: 'OK', value: true, kind: 'primary', autofocus: true }]
      });
    },

    /**
     * Pede um texto. Resolve com a string digitada, '' para "Limpar"
     * ou null se o usuário cancelar.
     */
    prompt(config) {
      const input = h('input', {
        class: 'input',
        type: 'text',
        'data-focusable': 'true',
        'data-focus-default': 'true',
        placeholder: config.placeholder || '',
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false'
      });
      input.value = config.value || '';
      const SUBMIT = {};
      const CLEAR = {};
      return openDialog({
        title: config.title,
        message: config.message,
        content: h('div', { class: 'form' }, h('div', { class: 'field' }, input)),
        dismissValue: null,
        buttons: [
          { label: config.confirmLabel || 'OK', value: SUBMIT, kind: 'primary' },
          { label: 'Limpar', value: CLEAR },
          { label: 'Cancelar', value: null }
        ],
        // Já abre o campo em modo de edição (na TV, sobe o teclado virtual).
        onOpen: () => Navigation.activate()
      }).then((value) => {
        if (value === SUBMIT) return input.value;
        if (value === CLEAR) return '';
        return null;
      });
    }
  };

  /* ------------------------------------------------------------------ */
  /* Loader                                                              */
  /* ------------------------------------------------------------------ */
  const Loader = {
    _el: null,
    _message: null,
    _bar: null,
    _fill: null,
    _layer: null,
    _onCancel: null,

    _build() {
      this._message = h('div', { class: 'loader-message' });
      this._fill = h('div', { class: 'progress-fill' });
      this._bar = h('div', { class: 'progress' }, this._fill);
      this._el = h('div', { class: 'loader-backdrop' }, h('div', { class: 'loader' }, [
        h('div', { class: 'spinner spinner-lg' }),
        this._message,
        this._bar,
        h('div', { class: 'loader-hint', text: 'VOLTAR para cancelar' })
      ]));
      this._layer = {
        root: this._el,
        onKey: (key) => key !== 'back',   // bloqueia a UI por baixo durante o carregamento
        onBack: () => {
          const onCancel = this._onCancel;
          if (typeof onCancel === 'function') onCancel();
        }
      };
    },

    isVisible() {
      return !!(this._el && this._el.parentNode);
    },

    /** options: { onCancel } */
    show(message, options) {
      if (!this._el) this._build();
      this._onCancel = options && options.onCancel;
      this.update(message, null);
      if (this.isVisible()) return;
      document.body.appendChild(this._el);
      Navigation.pushLayer(this._layer);
    },

    /** fraction: 0..1 para barra determinada; null/undefined para indeterminada. */
    update(message, fraction) {
      if (!this._el) return;
      if (message != null) this._message.textContent = message;
      const determinate = typeof fraction === 'number' && isFinite(fraction);
      this._bar.classList.toggle('progress-indeterminate', !determinate);
      this._fill.style.width = determinate ? Math.round(Math.max(0, Math.min(1, fraction)) * 100) + '%' : '';
    },

    hide() {
      if (!this.isVisible()) return;
      this._onCancel = null;
      Navigation.popLayer(this._layer);
      this._el.parentNode.removeChild(this._el);
    }
  };

  IPTV.UI.Toast = Toast;
  IPTV.UI.Dialog = Dialog;
  IPTV.UI.Loader = Loader;
})(window.IPTV);
