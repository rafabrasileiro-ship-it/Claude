/**
 * config.js — constantes de configuração do app.
 */
(function (IPTV) {
  'use strict';

  IPTV.Config = {
    APP_NAME: 'IPTV Player',
    VERSION: '1.0.0',

    /* Armazenamento */
    STORAGE_PREFIX: 'iptv.',

    /* Rede */
    HTTP_TIMEOUT: 30000,
    PLAYLIST_TIMEOUT: 120000,

    /* Parser: tempo máximo (ms) de trabalho contínuo antes de devolver o controle à UI */
    PARSE_SLICE_MS: 12,

    /* Player */
    OSD_TIMEOUT: 4000,
    ZAP_DEBOUNCE: 350,
    SEEK_STEP: 10,
    MAX_RETRIES: 3,
    RETRY_DELAYS: [1500, 3000, 5000],
    STABLE_PLAYBACK_MS: 10000,

    /* webapis.avplay.setDisplayRect() sempre trabalha em coordenadas 1920x1080 */
    AVPLAY_BASE_WIDTH: 1920,
    AVPLAY_BASE_HEIGHT: 1080,

    /* Fallback de navegador: hls.js carregado sob demanda (nunca é baixado na TV) */
    HLS_JS_URL: 'https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js'
  };
})(window.IPTV);
