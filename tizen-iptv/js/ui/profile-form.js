/**
 * profile-form.js — modal para adicionar/editar uma playlist.
 *
 * Dois métodos:
 *   - Playlist M3U:  nome + URL direta (.m3u / .m3u8)
 *   - Xtream Codes:  nome + host (http://dominio:porta) + usuário + senha
 *
 * ProfileForm.open(perfilExistente?) → Promise<perfilSalvo | null>
 */
(function (IPTV) {
  'use strict';

  const Utils = IPTV.Utils;
  const h = Utils.h;
  const XtreamClient = IPTV.Parsers.XtreamClient;

  function hostLabel(url) {
    const match = /^https?:\/\/([^/:?#]+)/i.exec(String(url || ''));
    return match ? match[1] : '';
  }

  function textField(label, placeholder, value) {
    const input = h('input', {
      class: 'input',
      type: 'text',
      'data-focusable': 'true',
      placeholder,
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false'
    });
    input.value = value || '';
    return { input, el: h('label', { class: 'field' }, [h('span', { class: 'field-label', text: label }), input]) };
  }

  function open(existing) {
    const editing = !!(existing && existing.id);
    const data = existing || {};
    let type = data.type === 'xtream' ? 'xtream' : 'm3u';

    const name = textField('Nome da lista', 'Ex.: Minha lista', data.name);
    const url = textField('URL da playlist (.m3u / .m3u8)', 'http://servidor.com/lista.m3u', data.url);
    const host = textField('Host / URL do servidor', 'http://dominio:porta', data.host);
    const username = textField('Usuário', 'usuário', data.username);
    const password = textField('Senha', 'senha', data.password);

    const tabM3U = h('div', { class: 'segment', 'data-focusable': 'true', text: 'Playlist M3U' });
    const tabXtream = h('div', { class: 'segment', 'data-focusable': 'true', text: 'Xtream Codes API' });
    const groupM3U = h('div', { class: 'field-group' }, url.el);
    const groupXtream = h('div', { class: 'field-group' }, [
      host.el,
      h('div', { class: 'field-row' }, [username.el, password.el])
    ]);
    const errorBox = h('div', { class: 'form-error' });
    errorBox.hidden = true;

    function selectType(next) {
      type = next;
      tabM3U.classList.toggle('selected', type === 'm3u');
      tabXtream.classList.toggle('selected', type === 'xtream');
      groupM3U.hidden = type !== 'm3u';
      groupXtream.hidden = type !== 'xtream';
      errorBox.hidden = true;
    }
    tabM3U.addEventListener('click', () => selectType('m3u'));
    tabXtream.addEventListener('click', () => selectType('xtream'));
    selectType(type);

    const content = h('div', { class: 'form' }, [
      h('div', { class: 'segmented', 'data-focus-section': 'profile-type' }, [tabM3U, tabXtream]),
      name.el,
      groupM3U,
      groupXtream,
      errorBox
    ]);

    /** Valida e monta o perfil; devolve { profile } ou { error, field }. */
    function build() {
      const profile = { id: data.id, createdAt: data.createdAt, type, name: name.input.value.trim() };
      if (type === 'm3u') {
        profile.url = url.input.value.trim();
        if (!Utils.isHttpUrl(profile.url)) {
          return { error: 'Informe a URL completa da playlist, começando com http:// ou https://', field: url.input };
        }
        if (!profile.name) profile.name = hostLabel(profile.url) || 'Playlist M3U';
      } else {
        profile.host = XtreamClient.normalizeHost(host.input.value);
        profile.username = username.input.value.trim();
        profile.password = password.input.value.trim();
        if (!Utils.isHttpUrl(profile.host)) {
          return { error: 'Informe o host do servidor, por exemplo http://dominio:8080', field: host.input };
        }
        if (!profile.username) return { error: 'Informe o usuário', field: username.input };
        if (!profile.password) return { error: 'Informe a senha', field: password.input };
        if (!profile.name) profile.name = hostLabel(profile.host) || 'Xtream';
      }
      return { profile };
    }

    const SAVE = {};
    let saved = null;

    return IPTV.UI.Dialog.open({
      title: editing ? 'Editar playlist' : 'Adicionar playlist',
      className: 'modal-form',
      content,
      dismissValue: null,
      buttons: [
        { label: 'Salvar', value: SAVE, kind: 'primary' },
        { label: 'Cancelar', value: null }
      ],
      beforeClose: (value) => {
        if (value !== SAVE) return true;
        const result = build();
        if (result.error) {
          errorBox.textContent = result.error;
          errorBox.hidden = false;
          IPTV.Navigation.focus(result.field);
          return false;
        }
        saved = IPTV.Storage.saveProfile(result.profile);
        return true;
      }
    }).then((value) => (value === SAVE ? saved : null));
  }

  IPTV.UI.ProfileForm = { open };
})(window.IPTV);
