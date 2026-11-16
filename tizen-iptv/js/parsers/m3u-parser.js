/**
 * m3u-parser.js — parser de playlists M3U estendidas (#EXTM3U / #EXTINF).
 *
 * Extrai tvg-id, tvg-name, tvg-logo e group-title de cada #EXTINF, a URL do
 * stream da linha seguinte, e agrupa por categoria. Entradas cujo link aponta
 * para arquivo de vídeo (.mp4, .mkv, /movie/ ...) vão para a seção "vod"; links
 * com /series/ ou títulos no padrão "Nome S01E02" viram episódios agrupados
 * por série na seção "series".
 *
 * O texto é percorrido linha a linha com indexOf (sem split, para não duplicar
 * a lista inteira na memória) e em fatias de tempo: a cada ~12 ms de trabalho o
 * parser devolve o controle para a UI. Assim listas com dezenas de milhares de
 * itens não travam a TV e o carregamento pode ser cancelado com Voltar.
 *
 * Resultado:
 *   { live: Section, vod: Section, series: Section, epgUrl, total }
 *   Section  = { categories: [Category], total }
 *   Category = { id, name, items: [Item] }
 *   Item     = { id, num, name, tvgId, tvgName, logo, group, url, kind }
 */
(function (IPTV) {
  'use strict';

  const Utils = IPTV.Utils;

  const ATTRIBUTE_RE = /([A-Za-z0-9_-]+)="([^"]*)"/g;
  const VOD_FILE_RE = /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|mpg|mpeg)$/i;
  const VOD_PATH_RE = /\/(movie|movies|vod)\//i;
  const SERIES_PATH_RE = /\/series\//i;
  /* "Nome da Série S01E02" → [1] nome, [2] temporada, [3] episódio */
  const EPISODE_RE = /^(.*?)\bS(\d{1,3})\s*[._-]?\s*E(\d{1,4})\b/i;
  const HAS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
  const STREAM_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
  const HLS_STREAM_RE = /#EXT-X-(STREAM-INF|TARGETDURATION|MEDIA-SEQUENCE|MEDIA:|VERSION|INDEPENDENT-SEGMENTS)/;
  const UNGROUPED = 'Sem categoria';

  /** '#EXTINF:-1 tvg-id="x" group-title="A, B",Nome do canal' → { attrs, title } */
  function parseExtInf(line) {
    const attrs = {};
    let attrsEnd = 0;
    let match;
    ATTRIBUTE_RE.lastIndex = 0;
    while ((match = ATTRIBUTE_RE.exec(line)) !== null) {
      attrs[match[1].toLowerCase()] = match[2];
      attrsEnd = ATTRIBUTE_RE.lastIndex;
    }
    // O título vem depois da primeira vírgula que sucede os atributos
    // (valores entre aspas podem conter vírgulas).
    const comma = line.indexOf(',', attrsEnd || 8);
    const title = comma === -1 ? '' : line.substring(comma + 1).trim();
    return { attrs, title, group: '' };
  }

  function classify(url, title) {
    const path = url.split('#')[0].split('?')[0];
    if (SERIES_PATH_RE.test(path)) return 'series';
    const isFile = VOD_FILE_RE.test(path);
    if (isFile && EPISODE_RE.test(title)) return 'series';
    return isFile || VOD_PATH_RE.test(path) ? 'vod' : 'live';
  }

  function resolveUrl(url, baseUrl) {
    if (HAS_SCHEME_RE.test(url) || !baseUrl) return url;
    try {
      return new URL(url, baseUrl).href;
    } catch (e) {
      return url;
    }
  }

  function fileName(url) {
    const path = url.split('#')[0].split('?')[0];
    const name = path.substring(path.lastIndexOf('/') + 1);
    try {
      return decodeURIComponent(name);
    } catch (e) {
      return name;
    }
  }

  function createSection() {
    return { categories: [], total: 0, _byName: new Map(), _series: new Map() };
  }

  function categoryFor(section, name, prefix) {
    let category = section._byName.get(name);
    if (!category) {
      category = { id: prefix + ':' + section.categories.length, name, items: [] };
      section._byName.set(name, category);
      section.categories.push(category);
    }
    return category;
  }

  /** Playlist HLS de um único stream (não é lista de canais)? */
  function looksLikeHlsStream(text) {
    return HLS_STREAM_RE.test(text.substring(0, 8192));
  }

  /**
   * @param {string} text  Conteúdo do arquivo .m3u/.m3u8
   * @param {object} [options]
   *   sourceUrl    URL de origem (resolve links relativos)
   *   sourceName   Nome usado se o arquivo for um stream HLS único
   *   cancelToken  IPTV.CancelToken
   *   onProgress   function(fração 0..1, itensLidos)
   */
  async function parse(text, options) {
    const opts = options || {};
    const token = opts.cancelToken;
    const baseUrl = opts.sourceUrl || '';
    const sliceMs = IPTV.Config.PARSE_SLICE_MS;
    const result = { live: createSection(), vod: createSection(), series: createSection(), epgUrl: '', total: 0 };

    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('A playlist está vazia');
    }

    function addEntry(meta, rawUrl) {
      const attrs = meta ? meta.attrs : {};
      const url = resolveUrl(rawUrl, baseUrl);
      const tvgName = attrs['tvg-name'] || '';
      const name = (meta && meta.title) || tvgName || fileName(url) || 'Sem nome';
      const kind = classify(url, name);
      const section = result[kind];
      const groupName = (attrs['group-title'] || (meta && meta.group) || '').trim() || UNGROUPED;
      const tvgId = attrs['tvg-id'] || '';
      const logo = Utils.safeImageUrl(attrs['tvg-logo'] || attrs.logo);
      const id = 'm3u:' + Utils.hash(tvgId + '|' + name + '|' + url);
      result.total++;
      if (kind === 'series') {
        addEpisode(section, groupName, name, logo, id, url);
        return;
      }
      section.total++;
      categoryFor(section, groupName, kind).items.push({
        id, num: section.total, name, tvgId, tvgName, logo, group: groupName, url, kind
      });
    }

    /** Episódios são agrupados em um item "série" (kind: 'series') por grupo + nome. */
    function addEpisode(section, groupName, title, logo, id, url) {
      const match = EPISODE_RE.exec(title);
      const seriesName = (match && match[1].replace(/[\s._-]+$/, '')) || title;
      const key = groupName + '|' + seriesName.toLowerCase();
      let series = section._series.get(key);
      if (!series) {
        section.total++;
        series = {
          id: 'm3u:series:' + Utils.hash(key),
          num: section.total,
          name: seriesName,
          logo,
          group: groupName,
          url: '',
          kind: 'series',
          episodes: []
        };
        section._series.set(key, series);
        categoryFor(section, groupName, 'series').items.push(series);
      }
      series.episodes.push({
        id,
        num: match ? parseInt(match[3], 10) : series.episodes.length + 1,
        season: match ? parseInt(match[2], 10) : 1,
        name: title,
        logo: logo || series.logo,
        group: seriesName,
        url,
        kind: 'vod',
        isEpisode: true
      });
    }

    if (looksLikeHlsStream(text)) {
      // O usuário informou a URL de um stream .m3u8 direto: vira um canal único.
      if (!baseUrl) throw new Error('O arquivo é um stream HLS, não uma lista de canais');
      addEntry({ attrs: {}, title: opts.sourceName || fileName(baseUrl), group: '' }, baseUrl);
    } else {
      const length = text.length;
      let position = text.charCodeAt(0) === 0xFEFF ? 1 : 0; // ignora BOM
      let pending = null;
      let lineCount = 0;
      let sliceStart = Utils.now();

      while (position < length) {
        let end = text.indexOf('\n', position);
        if (end === -1) end = length;
        const line = text.substring(position, end).trim();
        position = end + 1;

        if (line) {
          if (line.charCodeAt(0) === 35 /* # */) {
            if (line.lastIndexOf('#EXTINF:', 0) === 0) {
              pending = parseExtInf(line);
            } else if (line.lastIndexOf('#EXTGRP:', 0) === 0) {
              if (pending) pending.group = line.substring(8);
            } else if (line.lastIndexOf('#EXTM3U', 0) === 0) {
              const header = parseExtInf(line).attrs;
              result.epgUrl = header['url-tvg'] || header['x-tvg-url'] || result.epgUrl;
            }
            // Demais diretivas (#EXTVLCOPT, #KODIPROP...) são ignoradas.
          } else if (pending || STREAM_URL_RE.test(line)) {
            // Linha de stream: vem após um #EXTINF ou é uma URL solta (M3U simples).
            // Qualquer outra coisa (ex.: página HTML de erro do servidor) é descartada.
            addEntry(pending, line);
            pending = null;
          }
        }

        // A cada 256 linhas confere o orçamento de tempo da fatia.
        if ((++lineCount & 255) === 0 && Utils.now() - sliceStart >= sliceMs) {
          if (typeof opts.onProgress === 'function') opts.onProgress(position / length, result.total);
          await Utils.yieldToUI();
          if (token) token.throwIfCancelled();
          sliceStart = Utils.now();
        }
      }
    }

    if (result.total === 0) {
      throw new Error('Nenhum canal encontrado. O endereço aponta mesmo para um arquivo M3U?');
    }
    ['live', 'vod', 'series'].forEach((kind) => {
      delete result[kind]._byName;
      delete result[kind]._series;
    });
    if (typeof opts.onProgress === 'function') opts.onProgress(1, result.total);
    return result;
  }

  IPTV.Parsers.M3U = { parse, parseExtInf };
})(window.IPTV);
