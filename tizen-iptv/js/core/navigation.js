/**
 * navigation.js — navegação espacial e teclas do controle remoto.
 *
 * Conceitos:
 *  - Focável: qualquer elemento com data-focusable="true". O elemento em foco
 *    recebe a classe .focused (não usamos o foco nativo do DOM, exceto em <input>
 *    durante a digitação, para abrir o teclado virtual da TV).
 *  - Seção: contêiner com data-focus-section. Ao entrar numa seção vinda de
 *    outra, o foco volta para o último item usado nela (memória de foco).
 *  - Camada (layer): { root, onKey(key, ev), onBack() }. A tela ativa é a camada
 *    base; modais e o player em tela cheia empilham camadas por cima. Só a
 *    camada do topo recebe teclas e só os focáveis dentro do seu root contam.
 *
 * Eventos (CustomEvent, com bubbling) para componentes:
 *  - nav-move  (cancelável, detail.direction): disparado no item em foco antes
 *    da busca espacial. Listas virtuais chamam preventDefault() e movem sozinhas.
 *  - nav-enter (cancelável, detail.direction/from/candidate): disparado na seção
 *    de destino quando o foco cruza de uma seção para outra.
 *  - nav-focus / nav-blur: notificação de mudança de foco.
 */
(function (IPTV) {
  'use strict';

  const FOCUSABLE = '[data-focusable="true"]';
  const SECTION = '[data-focus-section]';

  /* Teclas que precisam de registro explícito no Tizen → nome lógico */
  const TIZEN_KEYS = {
    MediaPlayPause: 'playpause',
    MediaPlay: 'play',
    MediaPause: 'pause',
    MediaStop: 'stop',
    MediaRewind: 'rewind',
    MediaFastForward: 'forward',
    ColorF0Red: 'red',
    ColorF1Green: 'green',
    ColorF2Yellow: 'yellow',
    ColorF3Blue: 'blue',
    ChannelUp: 'chup',
    ChannelDown: 'chdown',
    Info: 'info'
  };

  /* keyCode → nome lógico (valores padrão dos controles Samsung + teclado do PC) */
  const codeMap = {
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    13: 'enter',
    10009: 'back',      // Voltar (Tizen)
    27: 'back',         // Esc (PC)
    10252: 'playpause',
    415: 'play',
    19: 'pause',
    413: 'stop',
    412: 'rewind',
    417: 'forward',
    403: 'red',
    404: 'green',
    405: 'yellow',
    406: 'blue',
    427: 'chup',
    428: 'chdown',
    457: 'info',
    65376: 'ime-done',   // "OK/Concluído" do teclado virtual
    65385: 'ime-cancel'  // "Cancelar" do teclado virtual
  };

  /* Atalhos de teclado para testar no PC */
  const pcKeyMap = {
    Backspace: 'back',
    ' ': 'playpause',
    Spacebar: 'playpause',
    PageUp: 'chup',
    PageDown: 'chdown',
    r: 'red',
    g: 'green',
    y: 'yellow',
    b: 'blue',
    i: 'info',
    s: 'stop'
  };

  /* Teclas que não devem repetir quando o botão fica pressionado */
  const NO_REPEAT = {
    enter: true, back: true, red: true, green: true, yellow: true, blue: true,
    playpause: true, play: true, pause: true, stop: true, info: true
  };

  const layers = [];
  const sectionMemory = new WeakMap();
  let current = null;
  let pointerActive = false;
  let unhandledKeyHandler = null;

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */
  function isTextInput(el) {
    if (!el || !el.tagName) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  }

  function isVisible(el) {
    if (!el || !el.getClientRects || el.getClientRects().length === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return window.getComputedStyle(el).visibility !== 'hidden';
  }

  function topLayer() {
    return layers.length ? layers[layers.length - 1] : null;
  }

  function scopeRoot() {
    const layer = topLayer();
    return (layer && layer.root) || document.body;
  }

  function isUsable(el, scope) {
    return !!el && (scope || scopeRoot()).contains(el) &&
      el.getAttribute('data-focusable') === 'true' && isVisible(el);
  }

  function fire(el, type, detail, cancelable) {
    const ev = new CustomEvent(type, { bubbles: true, cancelable: !!cancelable, detail: detail || {} });
    return el.dispatchEvent(ev);
  }

  function mapKey(ev) {
    const byCode = codeMap[ev.keyCode];
    if (byCode) return byCode;
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return null;
    return pcKeyMap[ev.key] || null;
  }

  /* ------------------------------------------------------------------ */
  /* Foco                                                                */
  /* ------------------------------------------------------------------ */
  function clearFocus() {
    if (!current) return;
    const previous = current;
    current = null;
    previous.classList.remove('focused');
    fire(previous, 'nav-blur');
  }

  function focus(el, options) {
    if (!el) return false;
    const opts = options || {};
    const active = document.activeElement;
    if (isTextInput(active) && active !== el) active.blur();
    if (el === current) {
      if (!el.classList.contains('focused')) el.classList.add('focused');
      return true;
    }
    clearFocus();
    current = el;
    el.classList.add('focused');
    const section = el.closest(SECTION);
    if (section) sectionMemory.set(section, el);
    if (!opts.preventScroll && typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } catch (e) {
        el.scrollIntoView(false);
      }
    }
    fire(el, 'nav-focus');
    return true;
  }

  /** Foca o item padrão de um contêiner: [data-focus-default], senão o primeiro visível. */
  function focusFirst(root) {
    const scope = root || scopeRoot();
    const preferred = scope.querySelector('[data-focus-default="true"]' + FOCUSABLE);
    if (preferred && isVisible(preferred)) return focus(preferred);
    const all = scope.querySelectorAll(FOCUSABLE);
    for (let i = 0; i < all.length; i++) {
      if (isVisible(all[i])) return focus(all[i]);
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Busca espacial                                                      */
  /* ------------------------------------------------------------------ */
  function centerX(r) {
    return r.left + r.width / 2;
  }

  function centerY(r) {
    return r.top + r.height / 2;
  }

  /** Itens rolados para fora de uma seção com overflow não são candidatos. */
  function clippedBySection(el, rect, cache) {
    const section = el.closest(SECTION);
    if (!section) return false;
    let box = cache.get(section);
    if (!box) {
      box = section.getBoundingClientRect();
      cache.set(section, box);
    }
    const cx = centerX(rect);
    const cy = centerY(rect);
    return cx < box.left - 1 || cx > box.right + 1 || cy < box.top - 1 || cy > box.bottom + 1;
  }

  function findNext(from, direction, scope) {
    const origin = from.getBoundingClientRect();
    const candidates = scope.querySelectorAll(FOCUSABLE);
    const sectionRects = new Map();
    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (el === from || !isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (clippedBySection(el, rect, sectionRects)) continue;

      let primary;   // distância no eixo do movimento
      let cross;     // desalinhamento no eixo perpendicular
      if (direction === 'left' || direction === 'right') {
        if (direction === 'right') {
          if (centerX(rect) <= origin.right - 1) continue;
          primary = Math.max(0, rect.left - origin.right);
        } else {
          if (centerX(rect) >= origin.left + 1) continue;
          primary = Math.max(0, origin.left - rect.right);
        }
        const overlap = Math.min(rect.bottom, origin.bottom) - Math.max(rect.top, origin.top);
        cross = overlap > 0 ? 0 : Math.abs(centerY(rect) - centerY(origin));
      } else {
        if (direction === 'down') {
          if (centerY(rect) <= origin.bottom - 1) continue;
          primary = Math.max(0, rect.top - origin.bottom);
        } else {
          if (centerY(rect) >= origin.top + 1) continue;
          primary = Math.max(0, origin.top - rect.bottom);
        }
        const overlap = Math.min(rect.right, origin.right) - Math.max(rect.left, origin.left);
        cross = overlap > 0 ? 0 : Math.abs(centerX(rect) - centerX(origin));
      }

      // Alinhamento pesa mais que proximidade: num grid, "baixo" vai para a mesma coluna.
      const score = primary + cross * 3;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  }

  function move(direction) {
    const scope = scopeRoot();
    if (!isUsable(current, scope)) {
      focusFirst(scope);
      return true;
    }
    const from = current;
    if (!fire(from, 'nav-move', { direction }, true)) return true;

    const next = findNext(from, direction, scope);
    if (!next) return false;

    const fromSection = from.closest(SECTION);
    const toSection = next.closest(SECTION);
    if (toSection && toSection !== fromSection) {
      const proceed = fire(toSection, 'nav-enter', { direction, from, candidate: next }, true);
      if (!proceed) return true;
      const remembered = sectionMemory.get(toSection);
      if (remembered && toSection.contains(remembered) && isUsable(remembered, scope)) {
        return focus(remembered);
      }
      const preferred = toSection.querySelector('[data-focus-default="true"]' + FOCUSABLE);
      if (preferred && isUsable(preferred, scope)) return focus(preferred);
    }
    return focus(next);
  }

  function activate() {
    const scope = scopeRoot();
    if (!isUsable(current, scope)) {
      focusFirst(scope);
      return;
    }
    if (isTextInput(current)) {
      // Foco nativo: na TV isso abre o teclado virtual (IME).
      current.focus();
      try {
        const end = current.value.length;
        current.setSelectionRange(end, end);
      } catch (e) {
        /* tipos de input sem seleção */
      }
      return;
    }
    current.click();
  }

  /* ------------------------------------------------------------------ */
  /* Camadas                                                             */
  /* ------------------------------------------------------------------ */
  function setScreen(layer) {
    clearFocus();
    layers.length = 0;
    layers.push(layer);
  }

  function pushLayer(layer) {
    layer._previousFocus = current;
    clearFocus();
    layers.push(layer);
    focusFirst(layer.root);
  }

  function popLayer(layer) {
    const index = layers.indexOf(layer);
    if (index === -1) return;
    const wasTop = index === layers.length - 1;
    layers.splice(index, 1);
    if (!wasTop) return;
    clearFocus();
    const previous = layer._previousFocus;
    layer._previousFocus = null;
    if (!isUsable(previous) || !focus(previous)) focusFirst();
  }

  /* ------------------------------------------------------------------ */
  /* Teclado                                                             */
  /* ------------------------------------------------------------------ */
  function onKeyDown(ev) {
    pointerActive = false;
    const key = mapKey(ev);
    const active = document.activeElement;

    // Modo edição: um <input> tem o foco nativo (teclado virtual aberto na TV).
    if (isTextInput(active)) {
      if (key === 'ime-done' || key === 'enter') {
        ev.preventDefault();
        active.blur();
        move('down');
      } else if (key === 'ime-cancel' || (key === 'back' && ev.keyCode !== 8)) {
        ev.preventDefault();
        active.blur();
      } else if (key === 'up' || key === 'down') {
        ev.preventDefault();
        active.blur();
        move(key);
      }
      return; // letras, Backspace e setas laterais ficam com o campo
    }

    if (!key || key === 'ime-done' || key === 'ime-cancel') return;
    if (ev.repeat && NO_REPEAT[key]) {
      ev.preventDefault();
      return;
    }

    const layer = topLayer();
    if (layer && typeof layer.onKey === 'function' && layer.onKey(key, ev) === true) {
      ev.preventDefault();
      return;
    }

    switch (key) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        ev.preventDefault();
        move(key);
        break;
      case 'enter':
        ev.preventDefault();
        activate();
        break;
      case 'back':
        ev.preventDefault();
        if (layer && typeof layer.onBack === 'function') layer.onBack();
        break;
      default:
        if (unhandledKeyHandler && unhandledKeyHandler(key, ev) === true) ev.preventDefault();
    }
  }

  /* Suporte a ponteiro (mouse no PC / controle com cursor): passar por cima foca. */
  function onMouseOver(ev) {
    if (!pointerActive || !ev.target || !ev.target.closest) return;
    const el = ev.target.closest(FOCUSABLE);
    if (el && isUsable(el)) focus(el, { preventScroll: true });
  }

  function onFocusIn(ev) {
    const el = ev.target && ev.target.closest ? ev.target.closest(FOCUSABLE) : null;
    if (el && el !== current && isUsable(el)) focus(el, { preventScroll: true });
  }

  /* ------------------------------------------------------------------ */
  /* Tizen                                                               */
  /* ------------------------------------------------------------------ */
  function registerTizenKeys() {
    if (!(window.tizen && window.tizen.tvinputdevice)) return;
    const input = window.tizen.tvinputdevice;
    Object.keys(TIZEN_KEYS).forEach((name) => {
      try {
        input.registerKey(name);
        const info = input.getKey(name);
        if (info && typeof info.code === 'number') codeMap[info.code] = TIZEN_KEYS[name];
      } catch (e) {
        console.warn('[IPTV] tecla não suportada neste modelo: ' + name);
      }
    });
  }

  function init() {
    registerTizenKeys();
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('mousemove', () => { pointerActive = true; }, true);
    document.addEventListener('mouseover', onMouseOver, false);
    document.addEventListener('focusin', onFocusIn, false);
  }

  IPTV.Navigation = {
    init,
    focus,
    focusFirst,
    clearFocus,
    move,
    activate,
    setScreen,
    pushLayer,
    popLayer,
    current: () => current,
    isUsable: (el) => isUsable(el),
    isEditing: () => isTextInput(document.activeElement),
    /** Recebe teclas que nem a camada do topo nem a navegação padrão trataram. */
    setUnhandledKeyHandler: (fn) => { unhandledKeyHandler = fn; }
  };
})(window.IPTV);
