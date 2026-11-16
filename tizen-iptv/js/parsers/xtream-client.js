/**
 * xtream-client.js — cliente da Xtream Codes API (player_api.php).
 *
 * Endpoints usados:
 *   player_api.php?username=U&password=P&action=get_account_info   (autenticação)
 *   ...&action=get_live_categories | get_live_streams
 *   ...&action=get_vod_categories  | get_vod_streams
 *   ...&action=get_series_categories | get_series | get_series_info&series_id=N
 *
 * URLs finais de reprodução:
 *   Ao vivo: {host}/live/{user}/{pass}/{stream_id}.ts   ou   .m3u8
 *   Filmes:  {host}/movie/{user}/{pass}/{stream_id}.{container_extension}
 *   Séries:  {host}/series/{user}/{pass}/{id_do_episódio}.{container_extension}
 *
 * loadSection('live' | 'vod' | 'series') devolve o mesmo formato do parser M3U:
 *   { categories: [{ id, name, items: [Item] }], total }
 */
(function (IPTV) {
  'use strict';

  const Utils = IPTV.Utils;
  const UNGROUPED = 'Sem categoria';

  const ACCOUNT_STATUS = {
    Expired: 'A assinatura desta conta expirou',
    Banned: 'Esta conta foi bloqueada pelo provedor',
    Disabled: 'Esta conta está desativada'
  };

  class XtreamClient {
    /**
     * @param {object} config { host, username, password, preferHls }
     *   preferHls: true no navegador (hls.js não toca .ts); na TV o AVPlay toca os dois.
     */
    constructor(config) {
      this.base = XtreamClient.normalizeHost(config.host);
      this.username = String(config.username || '').trim();
      this.password = String(config.password || '').trim();
      this.preferHls = !!config.preferHls;
      this.liveFormat = this.preferHls ? 'm3u8' : 'ts';
      this.account = null;
      this.server = null;
    }

    /** Aceita "dominio:porta", "http://dominio:porta/" ou a URL completa do player_api/get.php. */
    static normalizeHost(host) {
      let value = String(host || '').trim();
      if (!value) return '';
      if (!/^https?:\/\//i.test(value)) value = 'http://' + value;
      value = value.split('#')[0].split('?')[0];
      value = value.replace(/\/(player_api|get|xmltv|panel_api)\.php$/i, '');
      return value.replace(/\/+$/, '');
    }

    apiUrl(action, params) {
      let url = this.base + '/player_api.php?username=' + encodeURIComponent(this.username) +
        '&password=' + encodeURIComponent(this.password);
      if (action) url += '&action=' + encodeURIComponent(action);
      if (params) {
        Object.keys(params).forEach((key) => {
          url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        });
      }
      return url;
    }

    _call(action, params, options) {
      const opts = options || {};
      return Utils.requestJSON(this.apiUrl(action, params), {
        timeout: opts.timeout || IPTV.Config.PLAYLIST_TIMEOUT,
        cancelToken: opts.cancelToken,
        onProgress: opts.onProgress
      });
    }

    /**
     * Autentica e guarda os dados da conta (user_info / server_info).
     * Painéis que não conhecem a action get_account_info respondem sem
     * user_info; nesse caso repetimos a chamada sem action, que é a forma
     * canônica de login da API.
     */
    async getAccountInfo(options) {
      const opts = Object.assign({ timeout: IPTV.Config.HTTP_TIMEOUT }, options);
      let data = await this._call('get_account_info', null, opts);
      if (!data || !data.user_info) data = await this._call(null, null, opts);

      const user = data && data.user_info;
      if (!user) throw new Error('O servidor não respondeu como uma API Xtream Codes');
      if (String(user.auth) === '0') throw new Error('Usuário ou senha inválidos');
      if (user.status && user.status !== 'Active') {
        throw new Error(ACCOUNT_STATUS[user.status] || ('Conta com status "' + user.status + '"'));
      }

      this.account = user;
      this.server = data.server_info || null;
      this._pickLiveFormat(user.allowed_output_formats);
      return { user: this.account, server: this.server };
    }

    /** Respeita os formatos de saída liberados para a conta (m3u8 / ts). */
    _pickLiveFormat(allowed) {
      const preferred = this.preferHls ? 'm3u8' : 'ts';
      const formats = Array.isArray(allowed) ? allowed.map((f) => String(f).toLowerCase()) : [];
      if (!formats.length || formats.indexOf(preferred) !== -1) this.liveFormat = preferred;
      else if (formats.indexOf('m3u8') !== -1) this.liveFormat = 'm3u8';
      else if (formats.indexOf('ts') !== -1) this.liveFormat = 'ts';
      else this.liveFormat = preferred;
    }

    getLiveCategories(options) {
      return this._call('get_live_categories', null, options);
    }

    getLiveStreams(options) {
      return this._call('get_live_streams', null, options);
    }

    getVodCategories(options) {
      return this._call('get_vod_categories', null, options);
    }

    getVodStreams(options) {
      return this._call('get_vod_streams', null, options);
    }

    getSeriesCategories(options) {
      return this._call('get_series_categories', null, options);
    }

    getSeries(options) {
      return this._call('get_series', null, options);
    }

    getSeriesInfo(seriesId, options) {
      return this._call('get_series_info', { series_id: seriesId }, options);
    }

    _credentialsPath() {
      return encodeURIComponent(this.username) + '/' + encodeURIComponent(this.password);
    }

    buildLiveUrl(streamId, extension) {
      return this.base + '/live/' + this._credentialsPath() + '/' + streamId + '.' +
        (extension || this.liveFormat);
    }

    buildVodUrl(streamId, extension) {
      return this.base + '/movie/' + this._credentialsPath() + '/' + streamId + '.' +
        (extension || 'mp4');
    }

    buildSeriesUrl(episodeId, extension) {
      return this.base + '/series/' + this._credentialsPath() + '/' + episodeId + '.' +
        (extension || 'mp4');
    }

    /**
     * Temporadas e episódios de uma série: [{ id, name, items: [episódio] }].
     * O campo "episodes" da API vem como objeto { "1": [...], "2": [...] }
     * (ou array, em alguns painéis).
     */
    async loadEpisodes(series, options) {
      const data = await this.getSeriesInfo(series.seriesId, options);
      const raw = (data && data.episodes) || {};
      const seasons = [];
      Object.keys(raw).forEach((key) => {
        const list = Array.isArray(raw[key]) ? raw[key] : [];
        const items = [];
        list.forEach((episode, index) => {
          if (!episode || episode.id == null) return;
          const number = parseInt(episode.episode_num, 10) || (index + 1);
          const season = parseInt(episode.season, 10) || parseInt(key, 10) || 1;
          const info = episode.info && !Array.isArray(episode.info) ? episode.info : {};
          items.push({
            id: 'xt:episode:' + episode.id,
            num: number,
            season,
            name: String(episode.title || '').trim() || ('Episódio ' + number),
            logo: Utils.safeImageUrl(info.movie_image) || series.logo,
            group: series.name,
            url: this.buildSeriesUrl(episode.id, episode.container_extension),
            kind: 'vod',
            isEpisode: true
          });
        });
        if (!items.length) return;
        items.sort((a, b) => a.num - b.num);
        seasons.push({ season: items[0].season, items });
      });
      seasons.sort((a, b) => a.season - b.season);
      return seasons.map((entry) => ({
        id: 'season:' + entry.season,
        name: 'Temporada ' + entry.season,
        items: entry.items
      }));
    }

    /**
     * Baixa categorias + streams de uma seção e normaliza para o modelo do app.
     * options: { cancelToken, onStatus(mensagem, fração|null) }
     */
    async loadSection(kind, options) {
      const opts = options || {};
      const token = opts.cancelToken;
      const status = typeof opts.onStatus === 'function' ? opts.onStatus : function () {};
      const isLive = kind === 'live';
      const isSeries = kind === 'series';
      const label = isLive ? 'canais' : (isSeries ? 'séries' : 'filmes');

      status('Baixando categorias de ' + label + '…', null);
      const rawCategories = await (isLive ? this.getLiveCategories(opts)
        : isSeries ? this.getSeriesCategories(opts) : this.getVodCategories(opts));

      status('Baixando lista de ' + label + '…', null);
      const rawStreams = await (isLive ? this.getLiveStreams(opts)
        : isSeries ? this.getSeries(opts) : this.getVodStreams(opts));

      if (!Array.isArray(rawStreams)) {
        throw new Error('O servidor não retornou a lista de ' + label);
      }

      const categories = [];
      const byId = new Map();
      (Array.isArray(rawCategories) ? rawCategories : []).forEach((raw) => {
        const category = {
          id: kind + ':' + raw.category_id,
          name: String(raw.category_name || UNGROUPED).trim() || UNGROUPED,
          items: []
        };
        byId.set(String(raw.category_id), category);
        categories.push(category);
      });

      let ungrouped = null;
      const total = rawStreams.length;
      const sliceMs = IPTV.Config.PARSE_SLICE_MS;
      let sliceStart = Utils.now();

      for (let i = 0; i < total; i++) {
        const raw = rawStreams[i];
        const rawId = raw ? (isSeries ? raw.series_id : raw.stream_id) : null;
        if (rawId != null) {
          let category = byId.get(String(raw.category_id));
          if (!category) {
            if (!ungrouped) {
              ungrouped = { id: kind + ':ungrouped', name: UNGROUPED, items: [] };
              categories.push(ungrouped);
            }
            category = ungrouped;
          }
          const name = String(raw.name || '').trim() || ('Stream ' + rawId);
          category.items.push({
            id: 'xt:' + kind + ':' + rawId,
            num: parseInt(raw.num, 10) || (i + 1),
            name,
            tvgId: raw.epg_channel_id || '',
            tvgName: name,
            logo: Utils.safeImageUrl(raw.stream_icon || raw.cover),
            group: category.name,
            // Séries não têm URL própria: os episódios vêm de loadEpisodes().
            url: isSeries ? '' : (isLive
              ? this.buildLiveUrl(rawId)
              : this.buildVodUrl(rawId, raw.container_extension)),
            seriesId: isSeries ? rawId : undefined,
            kind
          });
        }

        if ((i & 511) === 511 && Utils.now() - sliceStart >= sliceMs) {
          status('Processando ' + Utils.formatNumber(i + 1) + ' de ' + Utils.formatNumber(total) + ' ' + label + '…', (i + 1) / total);
          await Utils.yieldToUI();
          if (token) token.throwIfCancelled();
          sliceStart = Utils.now();
        }
      }

      const nonEmpty = categories.filter((category) => category.items.length > 0);
      const count = nonEmpty.reduce((sum, category) => sum + category.items.length, 0);
      return { categories: nonEmpty, total: count };
    }
  }

  IPTV.Parsers.XtreamClient = XtreamClient;
})(window.IPTV);
