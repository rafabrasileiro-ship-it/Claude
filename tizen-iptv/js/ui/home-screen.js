/**
 * home-screen.js — tela inicial: gerenciador de playlists.
 *
 *   OK        abre a playlist em foco
 *   VERMELHO  remove a playlist em foco (com confirmação)
 *   VERDE     edita a playlist em foco
 *   VOLTAR    confirmação de saída do app
 */
(function (IPTV) {
  'use strict';

  const Utils = IPTV.Utils;
  const h = Utils.h;
  const UI = IPTV.UI;
  const Navigation = IPTV.Navigation;
  const Storage = IPTV.Storage;

  const DEMO_PROFILE = { id: 'demo', type: 'demo', name: 'Lista de teste' };

  let els = null;
  let opening = false;

  function describe(profile) {
    if (profile.type === 'xtream') {
      return { badge: 'Xtream Codes', detail: profile.host, extra: 'Usuário: ' + profile.username };
    }
    return { badge: 'Playlist M3U', detail: profile.url, extra: '' };
  }

  function profileCard(profile) {
    const info = describe(profile);
    return h('div', {
      class: 'card card-profile',
      'data-focusable': 'true',
      'data-profile-id': profile.id,
      onClick: () => openProfile(profile)
    }, [
      h('div', { class: 'card-icon' }, Utils.icon(profile.type === 'xtream' ? 'server' : 'list')),
      h('div', { class: 'card-body' }, [
        h('div', { class: 'card-title', text: profile.name }),
        h('div', { class: 'card-badge', text: info.badge }),
        h('div', { class: 'card-detail', text: info.detail }),
        info.extra ? h('div', { class: 'card-detail', text: info.extra }) : null
      ])
    ]);
  }

  function actionCard(iconName, title, detail, onClick, extraClass) {
    return h('div', {
      class: 'card card-action ' + (extraClass || ''),
      'data-focusable': 'true',
      onClick
    }, [
      h('div', { class: 'card-icon' }, Utils.icon(iconName)),
      h('div', { class: 'card-body' }, [
        h('div', { class: 'card-title', text: title }),
        h('div', { class: 'card-detail', text: detail })
      ])
    ]);
  }

  /** focusId: perfil que deve receber o foco após redesenhar. */
  function render(focusId) {
    const profiles = Storage.getProfiles();
    els.grid.textContent = '';
    profiles.forEach((profile) => els.grid.appendChild(profileCard(profile)));
    els.grid.appendChild(actionCard(
      'plus', 'Adicionar playlist', 'M3U ou Xtream Codes API', () => addProfile(), 'card-add'
    ));
    els.grid.appendChild(actionCard(
      'play', 'Carregar lista de teste', 'Streams públicos de demonstração para validar o player',
      () => openProfile(DEMO_PROFILE), 'card-demo'
    ));
    els.empty.hidden = profiles.length > 0;
    els.hintManage.hidden = profiles.length === 0;

    const target = focusId ? els.grid.querySelector('[data-profile-id="' + focusId + '"]') : null;
    if (!target || !Navigation.focus(target)) Navigation.focusFirst(els.root);
  }

  function focusedProfile() {
    const focused = Navigation.current();
    const id = focused && focused.getAttribute('data-profile-id');
    return id ? Storage.getProfile(id) : null;
  }

  async function addProfile() {
    const saved = await UI.ProfileForm.open();
    if (!saved) return;
    render(saved.id);
    UI.Toast.show('Playlist "' + saved.name + '" salva');
  }

  async function editProfile(profile) {
    const saved = await UI.ProfileForm.open(profile);
    if (saved) render(saved.id);
  }

  async function removeProfile(profile) {
    const confirmed = await UI.Dialog.confirm({
      title: 'Remover playlist?',
      message: '"' + profile.name + '" e os favoritos dela serão apagados desta TV.',
      confirmLabel: 'Remover',
      danger: true
    });
    if (!confirmed) return;
    Storage.removeProfile(profile.id);
    render();
    UI.Toast.show('Playlist removida');
  }

  /** Baixa/processa a playlist sob o Loader e abre a tela de canais. */
  async function openProfile(profile) {
    if (opening) return;
    opening = true;
    const token = new IPTV.CancelToken();
    const onStatus = (message, fraction) => UI.Loader.update(message, fraction);
    UI.Loader.show('Abrindo "' + profile.name + '"…', { onCancel: () => token.cancel() });
    try {
      const source = await IPTV.Catalog.open(profile, { cancelToken: token, onStatus });
      await UI.Browse.load(source, { cancelToken: token, onStatus });
      token.throwIfCancelled();
      UI.Loader.hide();
      if (profile.id !== DEMO_PROFILE.id) Storage.setSetting('lastProfileId', profile.id);
      IPTV.App.showScreen('browse');
    } catch (error) {
      UI.Loader.hide();
      if (!error.cancelled) {
        console.warn('[IPTV] falha ao abrir playlist:', error.message);
        UI.Dialog.alert({ title: 'Não foi possível abrir a playlist', message: error.message });
      }
    } finally {
      opening = false;
    }
  }

  const Home = {
    name: 'home',
    root: null,
    layer: null,

    init() {
      els = {
        root: Utils.byId('screen-home'),
        grid: Utils.byId('profile-grid'),
        empty: Utils.byId('home-empty'),
        hintManage: Utils.byId('home-hint-manage'),
        version: Utils.byId('home-version')
      };
      els.version.textContent = 'v' + IPTV.Config.VERSION + ' · motor de vídeo: ' +
        (IPTV.Player.engineName === 'avplay' ? 'Samsung AVPlay' : 'HTML5 + hls.js (navegador)');
      this.root = els.root;
      this.layer = {
        root: els.root,
        onKey: (key) => {
          const profile = focusedProfile();
          if (key === 'red' && profile) {
            removeProfile(profile);
            return true;
          }
          if (key === 'green' && profile) {
            editProfile(profile);
            return true;
          }
          return false;
        },
        onBack: () => IPTV.App.confirmExit()
      };
    },

    onShow() {
      render(Storage.getSetting('lastProfileId', null));
    },

    onHide() {}
  };

  UI.Home = Home;
})(window.IPTV);
