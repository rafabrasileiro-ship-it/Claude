/**
 * browse-screen.js — tela principal de reprodução, em 3 colunas:
 *
 *   Categorias  |  Canais  |  Mini-player + informações do canal
 *
 *   OK num canal            reproduz no mini-player
 *   OK no canal já tocando  tela cheia (ou seja: OK duas vezes)
 *   VERMELHO  volta para as playlists     VERDE  favorita/desfavorita
 *   AMARELO   alterna Ao Vivo / Filmes    AZUL   busca por nome
 *   CH+ / CH- pula uma página na lista em foco
 *   VOLTAR    volta para as playlists
 */
(function (IPTV) {
  'use strict';

  const Utils = IPTV.Utils;
  const h = Utils.h;
  const byId = Utils.byId;
  const UI = IPTV.UI;
  const Navigation = IPTV.Navigation;
  const Player = IPTV.Player;
  const Storage = IPTV.Storage;

  const SECTION_LABEL = { live: 'Ao Vivo', vod: 'Filmes' };
  const SECTION_NOUN = { live: 'canais', vod: 'filmes' };

  const state = {
    source: null,
    section: 'live',
    data: null,             // seção atual: { categories, all, total }
    categories: [],         // categorias exibidas (virtuais + reais)
    category: null,         // categoria cujos canais estão na coluna central
    channels: [],
    favorites: new Set(),
    favoritesCategory: null,
    searchCategory: null,
    focusedItem: null,
    playing: null,          // { item, list, index } — list é a fila usada no zapping
    busy: false
  };

  let els = null;
  let categoryList = null;
  let channelList = null;
  let pendingCategory = null;
  let zapTimer = null;
  let clockTimer = null;

  /* ------------------------------------------------------------------ */
  /* Categorias                                                          */
  /* ------------------------------------------------------------------ */
  function createCategoryRow() {
    const iconBox = h('span', { class: 'cat-icon' });
    const name = h('span', { class: 'cat-name' });
    const count = h('span', { class: 'cat-count' });
    const row = h('div', { class: 'row category-row' }, [iconBox, name, count]);
    row._parts = { iconBox, name, count };
    return row;
  }

  function renderCategoryRow(row, category) {
    const parts = row._parts;
    parts.name.textContent = category.name;
    parts.count.textContent = Utils.formatNumber(category.items.length);
    if (row._icon !== (category.icon || '')) {
      row._icon = category.icon || '';
      parts.iconBox.textContent = '';
      if (category.icon) parts.iconBox.appendChild(Utils.icon(category.icon));
    }
    parts.iconBox.hidden = !category.icon;
    row.classList.toggle('selected', category === state.category);
  }

  function favoriteItems() {
    const favorites = state.favorites;
    return favorites.size ? state.data.all.filter((item) => favorites.has(item.id)) : [];
  }

  function buildCategories() {
    const list = [];
    if (state.searchCategory) list.push(state.searchCategory);
    state.favoritesCategory = { id: '@favorites', name: 'Favoritos', icon: 'star', items: favoriteItems() };
    list.push(state.favoritesCategory);
    list.push({ id: '@all', name: 'Todos', icon: 'grid', items: state.data.all });
    state.data.categories.forEach((category) => list.push(category));
    state.categories = list;
  }

  /** Mostra os canais da categoria na coluna central. */
  function showCategory(category) {
    pendingCategory = null;
    state.category = category;
    state.channels = category.items;
    let cursor = 0;
    if (state.playing) {
      const playingIndex = state.channels.indexOf(state.playing.item);
      if (playingIndex !== -1) cursor = playingIndex;
    }
    channelList.setItems(state.channels, cursor);
    categoryList.refresh();
    els.channelsTitle.textContent = category.name;
    updateChannelCount(state.channels.length ? cursor : -1);
    updateEmptyState();
    if (!channelList.hasFocus()) {
      state.focusedItem = state.channels[cursor] || null;
      renderInfo(state.focusedItem);
    }
  }

  const showCategoryDebounced = Utils.debounce(() => {
    if (pendingCategory && pendingCategory !== state.category) showCategory(pendingCategory);
    pendingCategory = null;
  }, 140);

  /** Aplica já a categoria em foco (antes de o foco entrar na lista de canais). */
  function flushPendingCategory() {
    showCategoryDebounced.cancel();
    if (pendingCategory && pendingCategory !== state.category) showCategory(pendingCategory);
    pendingCategory = null;
  }

  function onCategoryFocus(category) {
    pendingCategory = category;
    showCategoryDebounced();
  }

  function onCategorySelect(category) {
    pendingCategory = category;
    flushPendingCategory();
    if (state.channels.length) channelList.focusIndex(channelList.cursor);
  }

  function updateEmptyState() {
    const empty = state.channels.length === 0;
    els.channelsEmpty.hidden = !empty;
    if (!empty) return;
    let message = 'Nenhum item nesta categoria.';
    if (state.category === state.favoritesCategory) {
      message = 'Nenhum favorito ainda. Pressione o botão VERDE sobre um canal para favoritar.';
    } else if (state.category === state.searchCategory) {
      message = 'Nada encontrado para essa busca.';
    } else if (!state.data.total) {
      message = 'Esta playlist não tem ' + SECTION_NOUN[state.section] + '.';
    }
    els.channelsEmpty.textContent = message;
  }

  function updateChannelCount(index) {
    const total = state.channels.length;
    els.channelsCount.textContent = total
      ? (index >= 0 ? Utils.formatNumber(index + 1) + ' / ' : '') + Utils.formatNumber(total)
      : '';
  }

  /* ------------------------------------------------------------------ */
  /* Canais                                                              */
  /* ------------------------------------------------------------------ */
  function createChannelRow() {
    const num = h('span', { class: 'ch-num' });
    const logoText = h('span', { class: 'logo-text' });
    const logoImg = h('img', { class: 'logo-img', alt: '' });
    const logo = h('span', { class: 'logo ch-logo' }, [logoText, logoImg]);
    const name = h('span', { class: 'ch-name' });
    const playing = h('span', { class: 'ch-playing' }, Utils.icon('play'));
    const favorite = h('span', { class: 'ch-favorite' }, Utils.icon('star'));
    const row = h('div', { class: 'row channel-row' }, [num, logo, name, playing, favorite]);
    row._parts = { num, logo, logoText, logoImg, name };
    row._logo = '';
    row._logoPending = false;
    logoImg.addEventListener('load', () => logo.classList.add('has-image'));
    logoImg.addEventListener('error', () => logo.classList.remove('has-image'));
    return row;
  }

  function renderChannelRow(row, item) {
    const parts = row._parts;
    parts.num.textContent = item.num;
    parts.name.textContent = item.name;
    parts.logoText.textContent = Utils.initials(item.name);
    if (row._logo !== item.logo) {
      row._logo = item.logo;
      row._logoPending = !!item.logo;
      parts.logo.classList.remove('has-image');
      parts.logoImg.removeAttribute('src');
    }
    row.classList.toggle('is-favorite', state.favorites.has(item.id));
    row.classList.toggle('is-playing', !!state.playing && state.playing.item === item);
  }

  /** Logos só são pedidos quando a rolagem para — evita centenas de downloads ao segurar ▼. */
  function loadVisibleLogos(rows) {
    rows.forEach((row) => {
      if (!row._logoPending) return;
      row._logoPending = false;
      row._parts.logoImg.src = row._logo;
    });
  }

  function onChannelFocus(item, index) {
    state.focusedItem = item;
    renderInfo(item);
    updateChannelCount(index);
  }

  function onChannelSelect(item, index) {
    const status = Player.getState().status;
    const alreadyPlaying = !!state.playing && state.playing.item === item &&
      status !== 'idle' && status !== 'error' && status !== 'ended';
    if (alreadyPlaying) enterFullscreen();
    else playItem(item, state.channels, index, false);
  }

  /* ------------------------------------------------------------------ */
  /* Reprodução                                                          */
  /* ------------------------------------------------------------------ */
  function playItem(item, list, index, debounced) {
    state.playing = { item, list, index };
    UI.PlayerView.setItem(item, { favorite: state.favorites.has(item.id) });
    clearTimeout(zapTimer);
    if (debounced) {
      // Zapping rápido: só abre o stream quando o usuário para de trocar de canal.
      zapTimer = setTimeout(() => Player.play(item), IPTV.Config.ZAP_DEBOUNCE);
    } else {
      Player.play(item);
    }
    channelList.refresh();
    renderNowPlaying();
  }

  function stopPlayback() {
    clearTimeout(zapTimer);
    Player.stop();
    state.playing = null;
    UI.PlayerView.setItem(null);
    if (channelList) channelList.refresh();
    renderNowPlaying();
  }

  function zap(delta) {
    const playing = state.playing;
    if (!playing || !playing.list.length) return;
    const count = playing.list.length;
    const index = ((playing.index + delta) % count + count) % count;
    playItem(playing.list[index], playing.list, index, true);
    if (playing.list === state.channels) channelList.setCursor(index);
  }

  const fullscreenContext = {
    zap,
    toggleFavorite: () => toggleFavorite(state.playing && state.playing.item),
    stop: stopPlayback,
    onExit: () => {
      // Ao voltar da tela cheia, o foco fica no canal que está tocando.
      const playing = state.playing;
      if (playing && playing.list === state.channels) channelList.focusIndex(playing.index);
      else if (!Navigation.isUsable(Navigation.current())) focusLists();
    }
  };

  function enterFullscreen() {
    if (!state.playing) {
      UI.Toast.show('Escolha um canal e pressione OK para reproduzir');
      return;
    }
    UI.PlayerView.enterFullscreen(fullscreenContext);
  }

  /* ------------------------------------------------------------------ */
  /* Coluna direita                                                      */
  /* ------------------------------------------------------------------ */
  function renderInfo(item) {
    els.info.classList.toggle('is-empty', !item);
    if (!item) {
      els.infoName.textContent = 'Nenhum canal selecionado';
      els.infoMeta.textContent = '';
      els.infoGroup.textContent = '';
      els.infoLogoText.textContent = '';
      els.infoLogo.classList.remove('has-image');
      els.infoLogoImg.removeAttribute('src');
      els.infoLogo._url = '';
      els.infoFavorite.hidden = true;
      return;
    }
    const isFavorite = state.favorites.has(item.id);
    els.infoName.textContent = item.name;
    els.infoMeta.textContent = (item.kind === 'vod' ? 'Filme' : 'Canal') + ' ' + item.num;
    els.infoGroup.textContent = item.group || '';
    els.infoLogoText.textContent = Utils.initials(item.name);
    if (els.infoLogo._url !== item.logo) {
      els.infoLogo._url = item.logo;
      els.infoLogo.classList.remove('has-image');
      if (item.logo) els.infoLogoImg.src = item.logo;
      else els.infoLogoImg.removeAttribute('src');
    }
    els.infoFavorite.hidden = !isFavorite;
    els.favoriteLabel.textContent = isFavorite ? 'Remover favorito' : 'Favoritar';
  }

  function renderNowPlaying() {
    const playing = state.playing;
    els.nowPlaying.classList.toggle('is-idle', !playing);
    els.slot.classList.toggle('has-video', !!playing);
    if (!playing) {
      els.nowPlayingName.textContent = 'Nada em reprodução';
      els.nowPlayingStatus.textContent = '';
      return;
    }
    const player = Player.getState();
    const same = player.item === playing.item;
    let status = 'Sintonizando…';
    if (same) {
      switch (player.status) {
        case 'playing':
          status = (playing.item.kind === 'vod' ? 'Reproduzindo' : 'Ao vivo') +
            (player.width ? ' · ' + player.width + '×' + player.height : '');
          break;
        case 'paused': status = 'Pausado'; break;
        case 'buffering': status = 'Buffer…'; break;
        case 'error': status = 'Erro'; break;
        case 'ended': status = 'Fim'; break;
        default: status = 'Carregando…';
      }
    }
    els.nowPlayingName.textContent = playing.item.name;
    els.nowPlayingStatus.textContent = status;
  }

  /* ------------------------------------------------------------------ */
  /* Favoritos e busca                                                   */
  /* ------------------------------------------------------------------ */
  /** Canal alvo do botão VERDE: o que está em foco na lista, senão o último focado/tocando. */
  function targetItem() {
    if (channelList.hasFocus()) return state.channels[channelList.cursor] || null;
    return state.focusedItem || (state.playing && state.playing.item) || null;
  }

  function toggleFavorite(item) {
    if (!item) return;
    const added = Storage.toggleFavorite(state.source.profile.id, item.id);
    if (added) state.favorites.add(item.id);
    else state.favorites.delete(item.id);
    UI.Toast.show(added ? '"' + item.name + '" adicionado aos favoritos' : '"' + item.name + '" removido dos favoritos');

    state.favoritesCategory.items = favoriteItems();
    categoryList.refresh();
    if (state.category === state.favoritesCategory) {
      state.channels = state.favoritesCategory.items;
      channelList.setItems(state.channels, channelList.cursor);
      updateChannelCount(state.channels.length ? channelList.cursor : -1);
      updateEmptyState();
      state.focusedItem = state.channels[channelList.cursor] || null;
      if (!UI.PlayerView.isFullscreen() && !Navigation.isUsable(Navigation.current())) {
        categoryList.focusIndex(categoryList.cursor);
      }
    } else {
      channelList.refresh();
    }
    renderInfo(state.focusedItem);
    if (state.playing && state.playing.item === item) UI.PlayerView.setFavorite(added);
  }

  function applySearch(term) {
    if (term) {
      const needle = Utils.normalizeText(term);
      const items = state.data.all.filter((item) => {
        if (item._search === undefined) item._search = Utils.normalizeText(item.name);
        return item._search.indexOf(needle) !== -1;
      });
      state.searchCategory = { id: '@search', name: 'Busca: ' + term, icon: 'search', items, term };
    } else {
      state.searchCategory = null;
    }
    buildCategories();
    const target = state.searchCategory || state.categories[1];
    categoryList.setItems(state.categories, state.categories.indexOf(target));
    showCategory(target);
    focusLists();
  }

  async function openSearch() {
    const term = await UI.Dialog.prompt({
      title: 'Buscar em ' + SECTION_LABEL[state.section],
      placeholder: 'Nome do canal ou filme',
      value: state.searchCategory ? state.searchCategory.term : '',
      confirmLabel: 'Buscar'
    });
    if (term === null) return;
    applySearch(term.trim());
  }

  /* ------------------------------------------------------------------ */
  /* Seções (Ao Vivo / Filmes)                                           */
  /* ------------------------------------------------------------------ */
  function applySection(kind, data) {
    state.section = kind;
    state.data = data;
    state.searchCategory = null;
    state.focusedItem = null;
    els.tabLive.classList.toggle('selected', kind === 'live');
    els.tabVod.classList.toggle('selected', kind === 'vod');
    buildCategories();
    const start = state.categories[1]; // "Todos"
    categoryList.setItems(state.categories, 1);
    showCategory(start);
  }

  async function switchSection(kind) {
    if (state.busy || kind === state.section) return;
    state.busy = true;
    const token = new IPTV.CancelToken();
    const useLoader = !state.source.isLoaded(kind);
    if (useLoader) {
      UI.Loader.show('Carregando ' + SECTION_LABEL[kind] + '…', { onCancel: () => token.cancel() });
    }
    try {
      const data = await state.source.loadSection(kind, {
        cancelToken: token,
        onStatus: (message, fraction) => UI.Loader.update(message, fraction)
      });
      token.throwIfCancelled();
      if (useLoader) UI.Loader.hide();
      applySection(kind, data);
      focusLists();
    } catch (error) {
      if (useLoader) UI.Loader.hide();
      if (!error.cancelled) UI.Toast.show('Não foi possível carregar ' + SECTION_LABEL[kind] + ': ' + error.message, 'error');
    } finally {
      state.busy = false;
    }
  }

  function focusLists() {
    if (state.channels.length) channelList.focusIndex(channelList.cursor);
    else categoryList.focusIndex(categoryList.cursor);
  }

  function goHome() {
    IPTV.App.showScreen('home');
  }

  function updateClock() {
    els.clock.textContent = Utils.formatClock();
  }

  /* ------------------------------------------------------------------ */
  /* Camada de navegação                                                 */
  /* ------------------------------------------------------------------ */
  function onKey(key) {
    switch (key) {
      case 'red':
        goHome();
        return true;
      case 'green':
        toggleFavorite(targetItem());
        return true;
      case 'yellow':
        switchSection(state.section === 'live' ? 'vod' : 'live');
        return true;
      case 'blue':
        openSearch();
        return true;
      case 'chup':
      case 'chdown': {
        const list = categoryList.hasFocus() ? categoryList : channelList;
        if (list.length) list.pageBy(key === 'chdown' ? 1 : -1);
        return true;
      }
      case 'playpause':
        if (state.playing) Player.togglePause();
        return true;
      case 'play':
        if (state.playing) Player.resume();
        return true;
      case 'pause':
        if (state.playing) Player.pause();
        return true;
      case 'stop':
        stopPlayback();
        return true;
      default:
        return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* API                                                                 */
  /* ------------------------------------------------------------------ */
  const Browse = {
    name: 'browse',
    root: null,
    layer: null,

    init() {
      els = {
        root: byId('screen-browse'),
        title: byId('browse-title'),
        tabLive: byId('tab-live'),
        tabVod: byId('tab-vod'),
        tabSearch: byId('tab-search'),
        tabHome: byId('tab-home'),
        clock: byId('browse-clock'),
        categoryList: byId('category-list'),
        channelList: byId('channel-list'),
        channelsTitle: byId('channels-title'),
        channelsCount: byId('channels-count'),
        channelsEmpty: byId('channels-empty'),
        slot: byId('mini-slot'),
        nowPlaying: byId('now-playing'),
        nowPlayingName: byId('now-playing-name'),
        nowPlayingStatus: byId('now-playing-status'),
        info: byId('channel-info'),
        infoLogo: byId('info-logo'),
        infoLogoText: byId('info-logo-text'),
        infoLogoImg: byId('info-logo-img'),
        infoName: byId('info-name'),
        infoMeta: byId('info-meta'),
        infoGroup: byId('info-group'),
        infoFavorite: byId('info-favorite'),
        btnFullscreen: byId('btn-fullscreen'),
        btnFavorite: byId('btn-favorite'),
        favoriteLabel: byId('btn-favorite-label')
      };
      this.root = els.root;
      this.layer = { root: els.root, onKey, onBack: goHome };

      categoryList = new UI.VirtualList(els.categoryList, {
        rowHeightRem: 4.25,
        createRow: createCategoryRow,
        renderRow: renderCategoryRow,
        onFocus: onCategoryFocus,
        onSelect: onCategorySelect
      });
      channelList = new UI.VirtualList(els.channelList, {
        rowHeightRem: 5,
        createRow: createChannelRow,
        renderRow: renderChannelRow,
        onFocus: onChannelFocus,
        onSelect: onChannelSelect,
        onEnter: flushPendingCategory,
        onSettle: loadVisibleLogos
      });

      els.tabLive.addEventListener('click', () => switchSection('live'));
      els.tabVod.addEventListener('click', () => switchSection('vod'));
      els.tabSearch.addEventListener('click', openSearch);
      els.tabHome.addEventListener('click', goHome);
      els.slot.addEventListener('click', enterFullscreen);
      els.btnFullscreen.addEventListener('click', enterFullscreen);
      els.btnFavorite.addEventListener('click', () => toggleFavorite(targetItem()));
      els.infoLogoImg.addEventListener('load', () => els.infoLogo.classList.add('has-image'));
      els.infoLogoImg.addEventListener('error', () => els.infoLogo.classList.remove('has-image'));

      Player.on('change', () => {
        if (state.source) renderNowPlaying();
      });
      window.addEventListener('resize', Utils.debounce(() => {
        if (!IPTV.App.isCurrent('browse')) return;
        categoryList.relayout();
        channelList.relayout();
      }, 150));
    },

    /**
     * Carrega os dados da playlist (chamado pela tela inicial, sob o Loader).
     * A renderização acontece em onShow, quando a tela já tem dimensões.
     */
    async load(source, options) {
      let kind = 'live';
      let data = await source.loadSection('live', options);
      if (!data.total) {
        const vod = await source.loadSection('vod', options);
        if (vod.total) {
          kind = 'vod';
          data = vod;
        }
      }
      state.source = source;
      state.section = kind;
      state.data = data;
      state.playing = null;
      state.favorites = Storage.getFavorites(source.profile.id);
    },

    onShow() {
      els.title.textContent = state.source.profile.name;
      updateClock();
      clockTimer = setInterval(updateClock, 15000);
      UI.PlayerView.showMini(els.slot);
      UI.PlayerView.setItem(null);
      applySection(state.section, state.data);
      renderNowPlaying();
      focusLists();
    },

    onHide() {
      clearInterval(clockTimer);
      showCategoryDebounced.cancel();
      pendingCategory = null;
      stopPlayback();
      UI.PlayerView.hide();
      // Libera a memória da playlist ao sair.
      categoryList.setItems([], 0);
      channelList.setItems([], 0);
      state.source = null;
      state.data = null;
      state.categories = [];
      state.category = null;
      state.channels = [];
      state.focusedItem = null;
      state.favoritesCategory = null;
      state.searchCategory = null;
    }
  };

  UI.Browse = Browse;
})(window.IPTV);
