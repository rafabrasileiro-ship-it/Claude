/**
 * utils.js — namespace global e utilitários compartilhados.
 *
 * O app usa scripts clássicos (sem ES Modules) de propósito: na TV o conteúdo é
 * servido via file:// e o motor é um Chromium antigo (Tizen 5.0 = Chromium 63),
 * então evitamos qualquer coisa que dependa de módulos, `?.`, `??` etc.
 */
(function (global) {
  'use strict';

  const IPTV = global.IPTV = global.IPTV || {};
  IPTV.UI = IPTV.UI || {};
  IPTV.Parsers = IPTV.Parsers || {};

  /* ------------------------------------------------------------------ */
  /* Emitter (pub/sub mínimo)                                            */
  /* ------------------------------------------------------------------ */
  class Emitter {
    constructor() {
      this._listeners = {};
    }

    on(type, fn) {
      (this._listeners[type] || (this._listeners[type] = [])).push(fn);
      return () => this.off(type, fn);
    }

    off(type, fn) {
      const list = this._listeners[type];
      if (!list) return;
      const index = list.indexOf(fn);
      if (index !== -1) list.splice(index, 1);
    }

    emit(type, payload) {
      const list = this._listeners[type];
      if (!list) return;
      list.slice().forEach((fn) => {
        try {
          fn(payload);
        } catch (e) {
          console.error('[IPTV] erro em listener "' + type + '"', e);
        }
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Cancelamento cooperativo (download/parse de listas grandes)         */
  /* ------------------------------------------------------------------ */
  function cancelError() {
    const error = new Error('Operação cancelada');
    error.cancelled = true;
    return error;
  }

  class CancelToken {
    constructor() {
      this.cancelled = false;
      this._handlers = [];
    }

    onCancel(fn) {
      if (this.cancelled) fn();
      else this._handlers.push(fn);
    }

    cancel() {
      if (this.cancelled) return;
      this.cancelled = true;
      this._handlers.splice(0).forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.warn('[IPTV] erro ao cancelar', e);
        }
      });
    }

    throwIfCancelled() {
      if (this.cancelled) throw cancelError();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Tempo / agendamento                                                 */
  /* ------------------------------------------------------------------ */
  const now = (global.performance && typeof global.performance.now === 'function')
    ? () => global.performance.now()
    : () => Date.now();

  /** Devolve o controle para o navegador pintar/tratar teclas. */
  function yieldToUI() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function debounce(fn, wait) {
    let timer = null;
    const debounced = function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn.apply(null, args);
      }, wait);
    };
    debounced.cancel = () => {
      clearTimeout(timer);
      timer = null;
    };
    return debounced;
  }

  /* ------------------------------------------------------------------ */
  /* HTTP (XMLHttpRequest: tem timeout e abort no Chromium 63)           */
  /* ------------------------------------------------------------------ */
  function request(url, options) {
    const opts = options || {};
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      try {
        xhr.open('GET', url, true);
      } catch (e) {
        reject(new Error('URL inválida: ' + url));
        return;
      }
      xhr.timeout = opts.timeout || 30000;
      if (typeof opts.onProgress === 'function') {
        xhr.onprogress = (ev) => opts.onProgress(ev.loaded, ev.lengthComputable ? ev.total : 0);
      }
      xhr.onload = () => {
        const ok = (xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText);
        if (ok) resolve(xhr.responseText);
        else reject(new Error('O servidor respondeu HTTP ' + xhr.status));
      };
      xhr.onerror = () => reject(new Error(
        'Falha de rede. Verifique a URL e a conexão' +
        (IPTV.isTizen() ? '.' : ' (no navegador do PC o servidor também precisa liberar CORS).')
      ));
      xhr.ontimeout = () => reject(new Error('Tempo de resposta esgotado'));
      xhr.onabort = () => reject(cancelError());
      if (opts.cancelToken) opts.cancelToken.onCancel(() => xhr.abort());
      xhr.send();
    });
  }

  function requestJSON(url, options) {
    return request(url, options).then((text) => {
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('Resposta inválida do servidor (JSON esperado)');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* DOM                                                                 */
  /* ------------------------------------------------------------------ */
  function appendChildren(el, children) {
    if (children == null || children === false) return;
    if (Array.isArray(children)) {
      children.forEach((child) => appendChildren(el, child));
    } else if (children instanceof Node) {
      el.appendChild(children);
    } else {
      el.appendChild(document.createTextNode(String(children)));
    }
  }

  /**
   * Cria elementos sem innerHTML — nomes de canais vêm de listas de terceiros
   * e nunca devem ser interpretados como HTML.
   */
  function h(tag, props, children) {
    const el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((key) => {
        const value = props[key];
        if (value == null || value === false) return;
        if (key === 'class') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key.slice(0, 2) === 'on' && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value);
        } else el.setAttribute(key, value === true ? '' : value);
      });
    }
    appendChildren(el, children);
    return el;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /** Ícone a partir dos <symbol> declarados no index.html. */
  function icon(name, extraClass) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon' + (extraClass ? ' ' + extraClass : ''));
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#icon-' + name);
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#icon-' + name);
    svg.appendChild(use);
    return svg;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function rootFontSize() {
    return parseFloat(global.getComputedStyle(document.documentElement).fontSize) || 16;
  }

  /* ------------------------------------------------------------------ */
  /* Texto / formatação                                                  */
  /* ------------------------------------------------------------------ */
  /** Hash de 32 bits (djb2) em hexadecimal — usado para IDs estáveis de canais M3U. */
  function hash(str) {
    let h1 = 5381;
    for (let i = 0; i < str.length; i++) {
      h1 = ((h1 << 5) + h1 + str.charCodeAt(i)) | 0;
    }
    return (h1 >>> 0).toString(16);
  }

  /** Minúsculas e sem acentos, para busca. */
  function normalizeText(text) {
    const lower = String(text || '').toLowerCase();
    return typeof lower.normalize === 'function'
      ? lower.normalize('NFD').replace(/[̀-ͯ]/g, '')
      : lower;
  }

  function initials(name) {
    const words = String(name || '').replace(/[^0-9A-Za-zÀ-ÿ ]/g, ' ').trim().split(/\s+/);
    if (!words[0]) return '?';
    const first = words[0].charAt(0);
    const second = words.length > 1 ? words[1].charAt(0) : words[0].charAt(1);
    return (first + (second || '')).toUpperCase();
  }

  function formatNumber(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatTime(totalSeconds) {
    const total = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = (hours && minutes < 10 ? '0' : '') + minutes;
    const ss = (seconds < 10 ? '0' : '') + seconds;
    return (hours ? hours + ':' : '') + mm + ':' + ss;
  }

  function formatClock(date) {
    const d = date || new Date();
    const hh = d.getHours();
    const mm = d.getMinutes();
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  /** Só aceitamos imagens http(s) ou data:image vindas das listas. */
  function safeImageUrl(url) {
    const value = String(url || '').trim();
    return /^(https?:\/\/|data:image\/)/i.test(value) ? value : '';
  }

  function isHttpUrl(url) {
    return /^https?:\/\/[^\s/]+/i.test(String(url || '').trim());
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' +
      Math.floor(Math.random() * 1e9).toString(36);
  }

  /* ------------------------------------------------------------------ */
  /* Plataforma                                                          */
  /* ------------------------------------------------------------------ */
  IPTV.isTizen = function () {
    return typeof global.tizen !== 'undefined';
  };

  IPTV.hasAVPlay = function () {
    return !!(global.webapis && global.webapis.avplay);
  };

  IPTV.Emitter = Emitter;
  IPTV.CancelToken = CancelToken;
  IPTV.Utils = {
    cancelError,
    now,
    yieldToUI,
    debounce,
    request,
    requestJSON,
    h,
    icon,
    byId,
    rootFontSize,
    hash,
    normalizeText,
    initials,
    formatNumber,
    formatTime,
    formatClock,
    safeImageUrl,
    isHttpUrl,
    uid
  };
})(window);
