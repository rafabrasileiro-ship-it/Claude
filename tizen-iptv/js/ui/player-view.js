/**
 * player-view.js — a "janela" do player: mini-player, tela cheia e OSD.
 *
 * Existe um único contêiner de vídeo (#player), posicionado por cima da
 * página. No modo "mini" ele acompanha o retângulo do slot da coluna direita;
 * em tela cheia ocupa a tela toda. Trocar de modo só muda o retângulo
 * (setDisplayRect no AVPlay) — o stream não é reaberto.
 *
 * Em tela cheia a view vira a camada do topo da navegação e trata as teclas:
 *   ▲ / CH+  próximo canal        ▼ / CH-  canal anterior
 *   ◄ ►      -10 s / +10 s (filmes)
 *   OK       mostra/oculta o OSD   VERDE    favorito
 *   ▶❙❙ ■    pausa / parar         VOLTAR   fecha o OSD; depois volta à lista
 *
 * O OSD some sozinho após Config.OSD_TIMEOUT (4 s) sem teclas.
 */
(function (IPTV) {
  'use strict';

  const Utils = IPTV.Utils;
  const Config = IPTV.Config;
  const Navigation = IPTV.Navigation;
  const Player = IPTV.Player;
  const byId = Utils.byId;

  let els = null;
  let mode = 'hidden';        // hidden | mini | fullscreen
  let slot = null;
  let item = null;            // canal exibido (pode estar à frente do Player durante o zapping)
  let meta = { favorite: false };
  let context = null;         // callbacks da tela de canais enquanto em tela cheia
  let osdVisible = false;
  let osdTimer = null;

  /* ------------------------------------------------------------------ */
  /* Textos de estado                                                    */
  /* ------------------------------------------------------------------ */
  function resolutionLabel(width, height) {
    if (!width || !height) return '';
    let tag = 'SD';
    if (height >= 2000 || width >= 3800) tag = '4K';
    else if (height >= 1000 || width >= 1900) tag = 'FHD';
    else if (height >= 700 || width >= 1200) tag = 'HD';
    return width + '×' + height + ' ' + tag;
  }

  /** Estado efetivo para o canal exibido: { kind, text, busy } */
  function describe() {
    const state = Player.getState();
    if (!item) return { kind: 'idle', text: 'Selecione um canal e pressione OK', busy: false };
    if (state.item !== item) return { kind: 'loading', text: 'Sintonizando…', busy: true };

    switch (state.status) {
      case 'loading':
        if (state.retry > 0) {
          return { kind: 'loading', text: 'Reconectando (' + state.retry + '/' + Config.MAX_RETRIES + ')…', busy: true };
        }
        return {
          kind: 'loading',
          text: state.bufferPercent > 0 ? 'Carregando ' + state.bufferPercent + '%' : 'Carregando…',
          busy: true
        };
      case 'buffering':
        return {
          kind: 'buffering',
          text: typeof state.bufferPercent === 'number' ? 'Buffer ' + state.bufferPercent + '%' : 'Buffer…',
          busy: true
        };
      case 'playing':
        return { kind: 'playing', text: item.kind === 'vod' ? 'Reproduzindo' : 'Ao vivo', busy: false };
      case 'paused':
        return { kind: 'paused', text: 'Pausado', busy: false };
      case 'ended':
        return { kind: 'ended', text: 'Fim da reprodução', busy: false };
      case 'error':
        return { kind: 'error', text: state.error || 'Erro de reprodução', busy: false };
      default:
        return { kind: 'idle', text: 'Parado', busy: false };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Renderização                                                        */
  /* ------------------------------------------------------------------ */
  function render() {
    if (!els || mode === 'hidden') return;
    const state = Player.getState();
    const info = describe();
    const sameItem = !!item && state.item === item;

    // Com stream aberto, o contêiner fica transparente na TV (plano de vídeo do AVPlay).
    els.root.classList.toggle('has-stream', Player.isActive());

    // Indicador central (aparece no mini-player e em tela cheia)
    const showCenter = info.kind !== 'playing';
    els.status.hidden = !showCenter;
    els.status.className = 'player-status status-' + info.kind;
    els.spinner.hidden = !info.busy;
    els.statusText.textContent = info.kind === 'error' ? 'Não foi possível reproduzir: ' + info.text : info.text;

    if (!item) return;

    // OSD
    els.osdNum.textContent = item.num != null ? item.num : '';
    els.osdName.textContent = item.name;
    els.osdGroup.textContent = (item.isEpisode ? 'Temporada ' + item.season : (item.kind === 'vod' ? 'Filme' : 'Canal')) +
      (item.group ? ' · ' + item.group : '');
    els.osdLogoText.textContent = Utils.initials(item.name);
    if (els.osdLogo._url !== item.logo) {
      els.osdLogo._url = item.logo;
      els.osdLogo.classList.remove('has-image');
      if (item.logo) els.osdLogoImg.src = item.logo;
      else els.osdLogoImg.removeAttribute('src');
    }
    els.osdStatus.textContent = info.kind === 'error' ? 'Erro' : info.text;
    els.osdStatus.className = 'chip chip-status status-' + info.kind;

    const resolution = sameItem ? resolutionLabel(state.width, state.height) : '';
    els.osdResolution.textContent = resolution;
    els.osdResolution.hidden = !resolution;
    els.osdFavorite.hidden = !meta.favorite;

    const hasTimeline = sameItem && item.kind === 'vod' && state.duration > 0;
    els.osdTimeline.hidden = !hasTimeline;
    if (hasTimeline) {
      const fraction = Math.max(0, Math.min(1, state.position / state.duration));
      els.osdProgressFill.style.width = (fraction * 100).toFixed(2) + '%';
      els.osdTime.textContent = Utils.formatTime(state.position) + ' / ' + Utils.formatTime(state.duration);
    }
    els.osdHintSeek.hidden = item.kind !== 'vod';
  }

  function updateClock() {
    if (els) els.osdClock.textContent = Utils.formatClock();
  }

  /* ------------------------------------------------------------------ */
  /* Posicionamento                                                      */
  /* ------------------------------------------------------------------ */
  function layout() {
    if (!els || mode === 'hidden') return;
    let rect;
    if (mode === 'fullscreen') {
      rect = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    } else {
      if (!slot) return;
      const box = slot.getBoundingClientRect();
      if (!box.width || !box.height) return;
      rect = {
        x: Math.round(box.left),
        y: Math.round(box.top),
        width: Math.round(box.width),
        height: Math.round(box.height)
      };
    }
    const style = els.root.style;
    style.left = rect.x + 'px';
    style.top = rect.y + 'px';
    style.width = rect.width + 'px';
    style.height = rect.height + 'px';
    Player.setDisplayRect(rect);
  }

  function setMode(next) {
    els.root.classList.remove('mode-' + mode);
    els.root.classList.add('mode-' + next);
    mode = next;
    const html = document.documentElement;
    html.classList.toggle('is-fullscreen', next === 'fullscreen');
    html.classList.toggle('player-visible', next !== 'hidden');
    layout();
    render();
  }

  /* ------------------------------------------------------------------ */
  /* OSD                                                                 */
  /* ------------------------------------------------------------------ */
  function showOsd() {
    if (mode !== 'fullscreen') return;
    osdVisible = true;
    updateClock();
    els.osd.classList.add('visible');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(hideOsd, Config.OSD_TIMEOUT);
  }

  function hideOsd() {
    osdVisible = false;
    clearTimeout(osdTimer);
    osdTimer = null;
    if (els) els.osd.classList.remove('visible');
  }

  /* ------------------------------------------------------------------ */
  /* Tela cheia                                                          */
  /* ------------------------------------------------------------------ */
  const layer = {
    root: null,

    onKey(key) {
      switch (key) {
        case 'up':
        case 'chup':
          if (context) context.zap(1);
          showOsd();
          return true;
        case 'down':
        case 'chdown':
          if (context) context.zap(-1);
          showOsd();
          return true;
        case 'left':
        case 'rewind':
          Player.seekBy(-Config.SEEK_STEP);
          showOsd();
          return true;
        case 'right':
        case 'forward':
          Player.seekBy(Config.SEEK_STEP);
          showOsd();
          return true;
        case 'enter':
          if (osdVisible) hideOsd();
          else showOsd();
          return true;
        case 'info':
          showOsd();
          return true;
        case 'playpause':
          Player.togglePause();
          showOsd();
          return true;
        case 'play':
          Player.resume();
          showOsd();
          return true;
        case 'pause':
          Player.pause();
          showOsd();
          return true;
        case 'stop':
          exitFullscreen();
          if (context && context.stop) context.stop();
          return true;
        case 'green':
          if (context) context.toggleFavorite();
          showOsd();
          return true;
        case 'red':
        case 'yellow':
        case 'blue':
          return true; // sem função em tela cheia; não vaza para a tela de baixo
        default:
          return false;
      }
    },

    // Voltar: primeiro fecha o OSD; sem OSD, sai da tela cheia para a lista.
    onBack() {
      if (osdVisible) hideOsd();
      else exitFullscreen();
    }
  };

  function enterFullscreen(ctx) {
    if (mode === 'fullscreen' || !item) return;
    context = ctx || context;
    setMode('fullscreen');
    Navigation.pushLayer(layer);
    showOsd();
  }

  function exitFullscreen() {
    if (mode !== 'fullscreen') return;
    hideOsd();
    setMode(slot ? 'mini' : 'hidden');
    Navigation.popLayer(layer);
    if (context && typeof context.onExit === 'function') context.onExit();
  }

  /* ------------------------------------------------------------------ */
  /* API                                                                 */
  /* ------------------------------------------------------------------ */
  const PlayerView = {
    init() {
      els = {
        root: byId('player'),
        surface: byId('player-surface'),
        status: byId('player-status'),
        spinner: byId('player-spinner'),
        statusText: byId('player-status-text'),
        osd: byId('osd'),
        osdClock: byId('osd-clock'),
        osdNum: byId('osd-num'),
        osdLogo: byId('osd-logo'),
        osdLogoText: byId('osd-logo-text'),
        osdLogoImg: byId('osd-logo-img'),
        osdName: byId('osd-name'),
        osdGroup: byId('osd-group'),
        osdStatus: byId('osd-status'),
        osdResolution: byId('osd-resolution'),
        osdFavorite: byId('osd-favorite'),
        osdTimeline: byId('osd-timeline'),
        osdProgressFill: byId('osd-progress-fill'),
        osdTime: byId('osd-time'),
        osdHintSeek: byId('osd-hint-seek')
      };
      layer.root = els.root;

      Player.init(els.surface);
      Player.on('change', render);
      Player.on('notice', (message) => IPTV.UI.Toast.show(message));

      els.osdLogoImg.addEventListener('load', () => els.osdLogo.classList.add('has-image'));
      els.osdLogoImg.addEventListener('error', () => els.osdLogo.classList.remove('has-image'));

      // Ponteiro em tela cheia: clique mostra o OSD, duplo clique volta para a lista.
      els.root.addEventListener('click', () => {
        if (mode === 'fullscreen') showOsd();
      });
      els.root.addEventListener('dblclick', () => exitFullscreen());

      window.addEventListener('resize', Utils.debounce(layout, 100));
      setInterval(() => {
        if (osdVisible) updateClock();
      }, 15000);
    },

    /** Mostra o player no modo mini, sobre o elemento informado. */
    showMini(slotElement) {
      slot = slotElement;
      if (mode !== 'fullscreen') setMode('mini');
    },

    hide() {
      if (mode === 'fullscreen') exitFullscreen();
      slot = null;
      context = null;
      hideOsd();
      setMode('hidden');
    },

    /** Canal exibido no OSD/mini-player. info: { favorite } */
    setItem(nextItem, info) {
      item = nextItem || null;
      meta = Object.assign({ favorite: false }, info);
      render();
    },

    setFavorite(isFavorite) {
      meta.favorite = !!isFavorite;
      render();
    },

    /** ctx: { zap(delta), toggleFavorite(), stop(), onExit() } */
    enterFullscreen,
    exitFullscreen,
    layout,
    isFullscreen: () => mode === 'fullscreen',
    isOsdVisible: () => osdVisible
  };

  IPTV.UI.PlayerView = PlayerView;
})(window.IPTV);
