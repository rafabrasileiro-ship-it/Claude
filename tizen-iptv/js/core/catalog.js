/**
 * catalog.js — abre uma playlist (M3U, Xtream ou a lista de teste) e entrega
 * uma "fonte" com a mesma interface para a UI, independente da origem:
 *
 *   source = {
 *     profile,                      // perfil salvo no Storage
 *     info,                         // dados da conta (Xtream) ou null
 *     isLoaded(kind),               // a seção já está em memória?
 *     loadSection(kind, options)    // Promise<Section>; kind = 'live' | 'vod'
 *   }
 *   Section = { categories: [{ id, name, items }], all: [Item], total }
 *
 * M3U: as duas seções saem de um único parse. Xtream: cada seção é baixada
 * só quando o usuário entra nela (listas de filmes costumam ser enormes).
 */
(function (IPTV) {
  'use strict';

  const Utils = IPTV.Utils;

  function formatBytes(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  /** Acrescenta a lista plana "all" (ordem de numeração dos canais). */
  function finalizeSection(section) {
    const all = [];
    section.categories.forEach((category) => {
      for (let i = 0; i < category.items.length; i++) all.push(category.items[i]);
    });
    all.sort((a, b) => a.num - b.num);
    section.all = all;
    section.total = all.length;
    return section;
  }

  async function openM3U(profile, options) {
    const status = options.onStatus;
    const token = options.cancelToken;
    let text;
    let sourceUrl = '';

    if (profile.type === 'demo') {
      text = IPTV.Parsers.DEMO_PLAYLIST;
    } else {
      sourceUrl = profile.url;
      status('Baixando playlist…', null);
      text = await Utils.request(sourceUrl, {
        timeout: IPTV.Config.PLAYLIST_TIMEOUT,
        cancelToken: token,
        onProgress: (loaded, total) => {
          status('Baixando playlist… ' + formatBytes(loaded), total ? loaded / total : null);
        }
      });
    }

    status('Processando playlist…', 0);
    const parsed = await IPTV.Parsers.M3U.parse(text, {
      sourceUrl,
      sourceName: profile.name,
      cancelToken: token,
      onProgress: (fraction, count) => {
        status('Processando playlist… ' + Utils.formatNumber(count) + ' itens', fraction);
      }
    });
    text = null; // libera o texto bruto o quanto antes (listas de vários MB)

    const sections = {
      live: finalizeSection(parsed.live),
      vod: finalizeSection(parsed.vod)
    };

    return {
      profile,
      info: null,
      isLoaded: () => true,
      loadSection: (kind) => Promise.resolve(sections[kind])
    };
  }

  async function openXtream(profile, options) {
    const status = options.onStatus;
    const client = new IPTV.Parsers.XtreamClient({
      host: profile.host,
      username: profile.username,
      password: profile.password,
      preferHls: IPTV.Player.engineName !== 'avplay'
    });

    status('Autenticando no servidor…', null);
    const info = await client.getAccountInfo({ cancelToken: options.cancelToken });
    const cache = {};

    return {
      profile,
      info,
      client,
      isLoaded: (kind) => !!cache[kind],
      loadSection: async (kind, sectionOptions) => {
        if (!cache[kind]) cache[kind] = finalizeSection(await client.loadSection(kind, sectionOptions));
        return cache[kind];
      }
    };
  }

  /**
   * @param {object} profile  { type: 'm3u' | 'xtream' | 'demo', ... }
   * @param {object} [options] { cancelToken, onStatus(mensagem, fração|null) }
   */
  function open(profile, options) {
    const opts = Object.assign({ onStatus: function () {} }, options);
    return profile.type === 'xtream' ? openXtream(profile, opts) : openM3U(profile, opts);
  }

  IPTV.Catalog = { open };
})(window.IPTV);
