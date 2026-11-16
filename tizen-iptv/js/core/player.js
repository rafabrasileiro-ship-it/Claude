/**
 * player.js — motor de vídeo híbrido.
 *
 *  - AVPlayEngine: TV Samsung real, via webapis.avplay (decodificação por hardware,
 *    suporta HLS, MPEG-TS contínuo, MP4/MKV etc.).
 *  - Html5Engine: fallback para navegador de PC, com <video> + hls.js (CDN,
 *    carregado sob demanda) para acelerar o desenvolvimento.
 *
 * A fachada IPTV.Player escolhe o motor automaticamente, mantém um estado único
 * ({ status, item, bufferPercent, width, height, position, duration, error })
 * e cuida de reconexão automática, protetor de tela e suspensão do app.
 *
 * Eventos: Player.on('change', state) e Player.on('notice', mensagem).
 */
(function (IPTV) {
  'use strict';

  const Config = IPTV.Config;

  /* ================================================================== */
  /* Motor 1: Samsung AVPlay                                             */
  /* ================================================================== */
  const AV_ERRORS = {
    PLAYER_ERROR_CONNECTION_FAILED: 'Falha de conexão com o servidor do stream',
    PLAYER_ERROR_INVALID_URI: 'Endereço do stream inválido',
    PLAYER_ERROR_NO_SUCH_FILE: 'Stream não encontrado',
    PLAYER_ERROR_NOT_SUPPORTED_FILE: 'Formato não suportado pela TV',
    PLAYER_ERROR_NOT_SUPPORTED_FORMAT: 'Formato não suportado pela TV',
    PLAYER_ERROR_NOT_SUPPORTED_AUDIO_CODEC: 'Codec de áudio não suportado pela TV',
    PLAYER_ERROR_NOT_SUPPORTED_VIDEO_CODEC: 'Codec de vídeo não suportado pela TV',
    PLAYER_ERROR_RESOURCE_LIMIT: 'Recursos de vídeo da TV em uso por outro app',
    PLAYER_ERROR_SEEK_FAILED: 'Não foi possível avançar/retroceder'
  };

  function describeAvError(type) {
    const code = String(type && type.name ? type.name : type || '');
    return AV_ERRORS[code] || ('Erro de reprodução' + (code ? ' (' + code + ')' : ''));
  }

  class AVPlayEngine {
    constructor(surface) {
      this.name = 'avplay';
      this.av = window.webapis.avplay;
      this.host = null;
      this.rect = null;
      // O vídeo é desenhado num plano de hardware atrás da página; este <object>
      // marca a região por onde ele aparece.
      this.object = document.createElement('object');
      this.object.setAttribute('type', 'application/avplayer');
      this.object.className = 'player-avobject';
      surface.appendChild(this.object);
    }

    open(url, item, host, startAt) {
      this.close();
      this.host = host;
      const av = this.av;
      const alive = () => this.host === host;

      try {
        av.open(url);
        av.setListener({
          onbufferingstart: () => { if (alive()) host.onBuffering(0); },
          onbufferingprogress: (percent) => { if (alive()) host.onBuffering(percent); },
          onbufferingcomplete: () => { if (alive()) host.onBufferingDone(); },
          onstreamcompleted: () => { if (alive()) host.onEnded(); },
          oncurrentplaytime: (ms) => { if (alive()) host.onTime(ms / 1000, this._duration()); },
          onerror: (type) => { if (alive()) host.onError(describeAvError(type), String(type)); },
          onerrormsg: (type, message) => {
            console.warn('[IPTV] avplay:', type, message);
          },
          onevent: (type) => {
            if (alive() && type === 'PLAYER_MSG_RESOLUTION_CHANGED') this._reportResolution(host);
          },
          onsubtitlechange: () => {},
          ondrmevent: () => {},
          onresourceconflicted: () => {
            if (alive()) host.onError('Outro app assumiu o decodificador de vídeo', 'RESOURCE_CONFLICT', true);
          }
        });

        this._applyRect();
        try {
          av.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
        } catch (e) {
          /* modelos antigos: mantém o padrão */
        }
        this._enable4K();

        av.prepareAsync(() => {
          if (!alive()) return;
          try {
            if (startAt > 0) av.seekTo(Math.floor(startAt * 1000));
            av.play();
          } catch (e) {
            host.onError(describeAvError(e), e && e.name);
            return;
          }
          host.onPlaying();
          this._reportResolution(host);
          host.onTime(startAt || 0, this._duration());
        }, (error) => {
          if (alive()) host.onError(describeAvError(error), error && error.name);
        });
      } catch (e) {
        if (alive()) host.onError(describeAvError(e), e && e.name);
      }
    }

    /** Painéis UHD precisam do decodificador 4K ligado antes do prepare. */
    _enable4K() {
      try {
        const info = window.webapis.productinfo;
        if (info && typeof info.isUdPanelSupported === 'function' && info.isUdPanelSupported()) {
          this.av.setStreamingProperty('SET_MODE_4K', 'TRUE');
        }
      } catch (e) {
        /* opcional */
      }
    }

    _duration() {
      try {
        return (this.av.getDuration() || 0) / 1000;
      } catch (e) {
        return 0;
      }
    }

    _reportResolution(host) {
      try {
        const streams = this.av.getCurrentStreamInfo() || [];
        for (let i = 0; i < streams.length; i++) {
          if (streams[i].type !== 'VIDEO') continue;
          const extra = JSON.parse(streams[i].extra_info || '{}');
          host.onResolution(parseInt(extra.Width, 10) || 0, parseInt(extra.Height, 10) || 0);
          return;
        }
      } catch (e) {
        /* resolução indisponível neste stream */
      }
    }

    _state() {
      try {
        return this.av.getState();
      } catch (e) {
        return 'NONE';
      }
    }

    pause() {
      try {
        if (this._state() === 'PLAYING') {
          this.av.pause();
          if (this.host) this.host.onPaused();
        }
      } catch (e) {
        console.warn('[IPTV] avplay.pause falhou', e);
      }
    }

    resume() {
      try {
        const state = this._state();
        if (state === 'PAUSED' || state === 'READY') {
          this.av.play();
          if (this.host) this.host.onPlaying();
        }
      } catch (e) {
        console.warn('[IPTV] avplay.play falhou', e);
      }
    }

    seekBy(seconds) {
      const state = this._state();
      if (state !== 'PLAYING' && state !== 'PAUSED') return;
      const ms = Math.abs(Math.round(seconds * 1000));
      try {
        if (seconds >= 0) this.av.jumpForward(ms);
        else this.av.jumpBackward(ms);
      } catch (e) {
        console.warn('[IPTV] avplay seek falhou', e);
      }
    }

    /** rect em pixels CSS; o AVPlay espera coordenadas na base 1920x1080. */
    setRect(rect) {
      this.rect = rect;
      this._applyRect();
    }

    _applyRect() {
      if (!this.rect || this._state() === 'NONE') return;
      const sx = Config.AVPLAY_BASE_WIDTH / (window.innerWidth || Config.AVPLAY_BASE_WIDTH);
      const sy = Config.AVPLAY_BASE_HEIGHT / (window.innerHeight || Config.AVPLAY_BASE_HEIGHT);
      try {
        this.av.setDisplayRect(
          Math.max(0, Math.round(this.rect.x * sx)),
          Math.max(0, Math.round(this.rect.y * sy)),
          Math.max(1, Math.round(this.rect.width * sx)),
          Math.max(1, Math.round(this.rect.height * sy))
        );
      } catch (e) {
        console.warn('[IPTV] avplay.setDisplayRect falhou', e);
      }
    }

    close() {
      this.host = null;
      try {
        const state = this._state();
        if (state === 'NONE') return;
        if (state !== 'IDLE') this.av.stop();
        this.av.close();
      } catch (e) {
        console.warn('[IPTV] avplay.close falhou', e);
      }
    }
  }

  /* ================================================================== */
  /* Motor 2: <video> HTML5 + hls.js (desenvolvimento no PC)             */
  /* ================================================================== */
  let hlsLoader = null;

  function loadHlsLibrary() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (!hlsLoader) {
      hlsLoader = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = Config.HLS_JS_URL;
        script.async = true;
        script.onload = () => {
          if (window.Hls) resolve(window.Hls);
          else reject(new Error('hls.js não inicializou'));
        };
        script.onerror = () => {
          hlsLoader = null;
          reject(new Error('Não foi possível baixar o hls.js'));
        };
        document.head.appendChild(script);
      });
    }
    return hlsLoader;
  }

  /** 'hls' | 'file' | 'ts' | 'unknown' a partir do caminho da URL. */
  function guessKind(url) {
    const path = String(url).split('#')[0].split('?')[0].toLowerCase();
    if (/\.m3u8?$/.test(path)) return 'hls';
    if (/\.(mp4|m4v|webm|mov|ogv|mkv|mp3|aac|m4a)$/.test(path)) return 'file';
    if (/\.(ts|mpg|mpeg|flv|avi|wmv)$/.test(path)) return 'ts';
    return 'unknown';
  }

  const MEDIA_ERRORS = {
    1: 'Carregamento interrompido',
    2: 'Erro de rede ao carregar o vídeo',
    3: 'Erro ao decodificar o vídeo',
    4: 'Formato não suportado pelo navegador (ou bloqueado pelo servidor)'
  };

  class Html5Engine {
    constructor(surface) {
      this.name = 'html5';
      this.host = null;
      this.hls = null;
      this.startAt = 0;
      this.userPaused = false;
      this.video = document.createElement('video');
      this.video.className = 'player-video';
      this.video.setAttribute('playsinline', '');
      this.video.preload = 'auto';
      surface.appendChild(this.video);
      this._bindVideoEvents();
    }

    _bindVideoEvents() {
      const video = this.video;
      const on = (type, fn) => video.addEventListener(type, () => {
        if (this.host) fn(this.host);
      });
      const reportSize = (host) => host.onResolution(video.videoWidth, video.videoHeight);

      on('waiting', (host) => host.onBuffering(null));
      on('playing', (host) => {
        this.userPaused = false;
        host.onPlaying();
      });
      on('pause', (host) => {
        if (this.userPaused && !video.ended) host.onPaused();
      });
      on('ended', (host) => host.onEnded());
      on('resize', reportSize);
      on('loadedmetadata', (host) => {
        reportSize(host);
        if (this.startAt > 0) {
          try {
            video.currentTime = this.startAt;
          } catch (e) {
            /* stream sem seek */
          }
          this.startAt = 0;
        }
      });
      on('timeupdate', (host) => {
        host.onTime(video.currentTime, isFinite(video.duration) ? video.duration : 0);
      });
      on('error', (host) => {
        if (this.hls || !video.error) return; // com hls.js os erros chegam por Hls.Events.ERROR
        host.onError(MEDIA_ERRORS[video.error.code] || 'Erro de reprodução', 'MEDIA_ERR_' + video.error.code);
      });
    }

    open(url, item, host, startAt) {
      this.close();
      this.host = host;
      this.startAt = startAt || 0;
      this.userPaused = false;
      const alive = () => this.host === host;
      const kind = guessKind(url);
      const nativeHls = !!this.video.canPlayType('application/vnd.apple.mpegurl');

      if (kind === 'ts') {
        host.onError(
          'Streams MPEG-TS não tocam no navegador. Use a saída HLS (.m3u8) ou teste na TV.',
          'UNSUPPORTED_IN_BROWSER',
          true
        );
        return;
      }
      if (kind === 'file') {
        this._playNative(url, host);
        return;
      }

      // hls.js sempre que houver MSE; HLS nativo do navegador só como último recurso.
      loadHlsLibrary().then((Hls) => {
        if (!alive()) return;
        if (Hls.isSupported()) this._playHls(Hls, url, kind, host);
        else this._playNative(url, host);
      }).catch((error) => {
        if (!alive()) return;
        if (kind === 'unknown' || nativeHls) this._playNative(url, host);
        else host.onError(error.message + ' (verifique a internet do PC)', 'HLS_JS_LOAD', true);
      });
    }

    _playNative(url, host) {
      this.video.src = url;
      this._startPlayback(host);
    }

    _playHls(Hls, url, kind, host) {
      const alive = () => this.host === host;
      const hls = new Hls({ enableWorker: true, backBufferLength: 30 });
      let mediaRecoveries = 0;
      this.hls = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (alive()) this._startPlayback(host);
      });
      hls.on(Hls.Events.ERROR, (eventName, data) => {
        if (!alive() || !data || !data.fatal) return;
        const details = String(data.details || '');
        // URL sem extensão que não era HLS: tenta tocar como arquivo comum.
        if (kind === 'unknown' && details.indexOf('manifest') === 0) {
          this._destroyHls();
          this._playNative(url, host);
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
          mediaRecoveries++;
          hls.recoverMediaError();
          return;
        }
        const message = data.type === Hls.ErrorTypes.NETWORK_ERROR
          ? 'Erro de rede ao carregar o stream (URL fora do ar ou sem CORS)'
          : 'Erro ao reproduzir o stream';
        host.onError(message, details);
      });
      hls.loadSource(url);
      hls.attachMedia(this.video);
    }

    _startPlayback(host) {
      const video = this.video;
      const attempt = video.play();
      if (!attempt || typeof attempt.catch !== 'function') return;
      attempt.catch((error) => {
        if (this.host !== host || !error || error.name !== 'NotAllowedError') return;
        // Política de autoplay do navegador: toca sem som até haver interação.
        video.muted = true;
        const retry = video.play();
        if (retry && typeof retry.catch === 'function') retry.catch(() => {});
        host.onNotice('O navegador bloqueou o áudio no autoplay; reproduzindo sem som.');
      });
    }

    pause() {
      this.userPaused = true;
      this.video.pause();
    }

    resume() {
      this._startPlayback(this.host);
    }

    seekBy(seconds) {
      const video = this.video;
      if (!isFinite(video.duration)) return;
      video.currentTime = Math.max(0, Math.min(video.duration - 1, video.currentTime + seconds));
    }

    setRect() {
      /* o <video> ocupa 100% do contêiner, que a PlayerView já posiciona */
    }

    _destroyHls() {
      if (!this.hls) return;
      try {
        this.hls.destroy();
      } catch (e) {
        console.warn('[IPTV] hls.destroy falhou', e);
      }
      this.hls = null;
    }

    close() {
      this.host = null;
      this._destroyHls();
      const video = this.video;
      try {
        video.pause();
      } catch (e) {
        /* já parado */
      }
      if (video.getAttribute('src')) {
        video.removeAttribute('src');
        try {
          video.load();
        } catch (e) {
          /* reset do elemento */
        }
      }
    }
  }

  /* ================================================================== */
  /* Fachada                                                             */
  /* ================================================================== */
  function initialState() {
    return {
      status: 'idle',       // idle | loading | buffering | playing | paused | ended | error
      item: null,
      bufferPercent: null,  // null = desconhecido (HTML5)
      width: 0,
      height: 0,
      position: 0,
      duration: 0,
      error: null,
      retry: 0
    };
  }

  function setScreenSaver(enabled) {
    try {
      const appCommon = window.webapis && window.webapis.appcommon;
      if (!appCommon) return;
      const states = appCommon.AppCommonScreenSaverState;
      appCommon.setScreenSaver(enabled ? states.SCREEN_SAVER_ON : states.SCREEN_SAVER_OFF);
    } catch (e) {
      /* API ausente no emulador */
    }
  }

  class PlayerFacade extends IPTV.Emitter {
    constructor() {
      super();
      this.engine = null;
      this.state = initialState();
      this._session = 0;
      this._retries = 0;
      this._retryTimer = null;
      this._stableTimer = null;
      this._resume = null;
      this._rect = null;
    }

    /** surface: elemento onde o motor insere o <object> (AVPlay) ou o <video>. */
    init(surface) {
      this.engine = IPTV.hasAVPlay() ? new AVPlayEngine(surface) : new Html5Engine(surface);
      document.documentElement.classList.add('engine-' + this.engine.name);
      console.log('[IPTV] motor de vídeo: ' + this.engine.name);
      return this.engine.name;
    }

    get engineName() {
      return this.engine ? this.engine.name : 'none';
    }

    getState() {
      return this.state;
    }

    isActive() {
      const status = this.state.status;
      return status === 'loading' || status === 'buffering' || status === 'playing' || status === 'paused';
    }

    _set(patch) {
      Object.assign(this.state, patch);
      const status = this.state.status;
      setScreenSaver(!(status === 'loading' || status === 'buffering' || status === 'playing'));
      this.emit('change', this.state);
    }

    _clearTimers() {
      clearTimeout(this._retryTimer);
      clearTimeout(this._stableTimer);
      this._retryTimer = null;
      this._stableTimer = null;
    }

    /** item: { url, name, kind: 'live' | 'vod', ... }; startAt: segundo inicial (filmes/episódios) */
    play(item, startAt) {
      if (!item || !item.url) return;
      this._clearTimers();
      this._retries = 0;
      this._resume = null;
      this._start(item, startAt > 0 ? startAt : 0);
    }

    _start(item, startAt) {
      const session = ++this._session;
      const alive = () => session === this._session;
      const state = this.state;

      this._set(Object.assign(initialState(), {
        status: 'loading',
        item,
        retry: this._retries,
        position: startAt || 0
      }));

      const host = {
        onBuffering: (percent) => {
          if (!alive() || state.status === 'paused') return;
          this._set({
            status: state.status === 'loading' ? 'loading' : 'buffering',
            bufferPercent: typeof percent === 'number' ? percent : null
          });
        },
        onBufferingDone: () => {
          if (alive() && state.status === 'buffering') this._set({ status: 'playing', bufferPercent: 100 });
        },
        onPlaying: () => {
          if (!alive()) return;
          this._set({ status: 'playing', error: null, retry: 0 });
          clearTimeout(this._stableTimer);
          this._stableTimer = setTimeout(() => {
            if (alive()) this._retries = 0;
          }, Config.STABLE_PLAYBACK_MS);
        },
        onPaused: () => {
          if (alive()) this._set({ status: 'paused' });
        },
        onResolution: (width, height) => {
          if (alive() && width && height && (width !== state.width || height !== state.height)) {
            this._set({ width, height });
          }
        },
        onTime: (position, duration) => {
          if (!alive()) return;
          // No máximo uma atualização de UI por segundo.
          if (Math.floor(position) === Math.floor(state.position) && duration === state.duration) {
            state.position = position;
            return;
          }
          this._set({ position, duration });
        },
        onEnded: () => {
          if (!alive()) return;
          if (item.kind === 'vod') {
            this.engine.close();
            this._clearTimers();
            this._set({ status: 'ended' });
          } else {
            this._fail('A transmissão foi encerrada pelo servidor', 'STREAM_COMPLETED', false);
          }
        },
        onError: (message, code, fatal) => {
          if (alive()) this._fail(message, code, fatal);
        },
        onNotice: (message) => {
          if (alive()) this.emit('notice', message);
        }
      };

      // O motor guarda o último retângulo (setDisplayRect) e o reaplica ao abrir.
      this.engine.open(item.url, item, host, startAt || 0);
    }

    /** Erro de reprodução: tenta reconectar algumas vezes antes de desistir. */
    _fail(message, code, fatal) {
      const item = this.state.item;
      const resumeAt = item && item.kind === 'vod' ? this.state.position : 0;
      console.warn('[IPTV] erro no player:', code, message);
      this.engine.close();
      this._session++;
      clearTimeout(this._stableTimer);

      if (!fatal && item && this._retries < Config.MAX_RETRIES) {
        const delay = Config.RETRY_DELAYS[Math.min(this._retries, Config.RETRY_DELAYS.length - 1)];
        this._retries++;
        this._set({ status: 'loading', retry: this._retries, error: message, bufferPercent: null });
        this._retryTimer = setTimeout(() => this._start(item, resumeAt), delay);
        return;
      }
      this._set({ status: 'error', error: message, retry: 0 });
    }

    stop() {
      this._clearTimers();
      this._session++;
      this._resume = null;
      if (this.engine) this.engine.close();
      this._set(initialState());
    }

    pause() {
      if (this.state.status === 'playing' || this.state.status === 'buffering') this.engine.pause();
    }

    resume() {
      if (this.state.status === 'paused') this.engine.resume();
      else if (this.state.status === 'ended' || this.state.status === 'error') this.play(this.state.item);
    }

    togglePause() {
      if (this.state.status === 'paused' || this.state.status === 'ended' || this.state.status === 'error') {
        this.resume();
      } else {
        this.pause();
      }
    }

    seekBy(seconds) {
      const state = this.state;
      if (!state.item || state.item.kind !== 'vod') return false;
      if (state.status !== 'playing' && state.status !== 'paused') return false;
      this.engine.seekBy(seconds);
      return true;
    }

    /** Área de exibição em pixels CSS ({ x, y, width, height }). */
    setDisplayRect(rect) {
      this._rect = rect;
      if (this.engine) this.engine.setRect(rect);
    }

    /**
     * App indo para segundo plano (tecla Home) ou voltando. Em vez de
     * suspend/restore, reabrimos o stream: para TV ao vivo é o desejado
     * (volta no ponto atual da transmissão) e evita estados inválidos.
     */
    handleVisibility(hidden) {
      if (hidden) {
        if (!this.isActive()) return;
        const item = this.state.item;
        const position = item.kind === 'vod' ? this.state.position : 0;
        this.stop();
        this._resume = { item, position };
      } else if (this._resume) {
        const resume = this._resume;
        this._resume = null;
        this._retries = 0;
        this._start(resume.item, resume.position);
      }
    }
  }

  IPTV.Player = new PlayerFacade();
  IPTV.Player.guessKind = guessKind;
})(window.IPTV);
