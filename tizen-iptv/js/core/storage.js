/**
 * storage.js — persistência em localStorage (playlists, favoritos e preferências).
 *
 * Chaves:
 *   iptv.profiles            → [{ id, name, type: 'm3u'|'xtream', url | host+username+password }]
 *   iptv.favorites.<perfil>  → [idDoCanal, ...]
 *   iptv.progress.<perfil>   → { id: ponto em que parei } (filmes, episódios, séries)
 *   iptv.settings            → { chave: valor }
 */
(function (IPTV) {
  'use strict';

  const PREFIX = IPTV.Config.STORAGE_PREFIX;
  const memory = {};
  const PROGRESS_LIMIT = 300;

  function read(key, fallback) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : fallback;
    }
  }

  function write(key, value) {
    memory[key] = value;
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[IPTV] localStorage indisponível ou cheio:', e && e.message);
      return false;
    }
  }

  function remove(key) {
    delete memory[key];
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch (e) {
      /* sem armazenamento: nada a remover */
    }
  }

  const Storage = {
    /* ---------------- Playlists / perfis ---------------- */
    getProfiles() {
      const list = read('profiles', []);
      return Array.isArray(list) ? list : [];
    },

    getProfile(id) {
      return this.getProfiles().filter((p) => p.id === id)[0] || null;
    },

    /** Insere ou atualiza (pelo id). Retorna o perfil salvo. */
    saveProfile(profile) {
      const list = this.getProfiles();
      const saved = Object.assign({}, profile);
      if (!saved.id) {
        saved.id = IPTV.Utils.uid('pl');
        saved.createdAt = Date.now();
      }
      const index = list.findIndex((p) => p.id === saved.id);
      if (index === -1) list.push(saved);
      else list[index] = saved;
      write('profiles', list);
      return saved;
    },

    removeProfile(id) {
      write('profiles', this.getProfiles().filter((p) => p.id !== id));
      remove('favorites.' + id);
      remove('progress.' + id);
    },

    /* ---------------- Favoritos ---------------- */
    getFavorites(profileId) {
      const list = read('favorites.' + profileId, []);
      return new Set(Array.isArray(list) ? list : []);
    },

    /** Alterna o favorito e devolve true se o canal ficou marcado. */
    toggleFavorite(profileId, itemId) {
      const favorites = this.getFavorites(profileId);
      const nowFavorite = !favorites.has(itemId);
      if (nowFavorite) favorites.add(itemId);
      else favorites.delete(itemId);
      write('favorites.' + profileId, Array.from(favorites));
      return nowFavorite;
    },

    /* ---------------- Onde parei (filmes e séries) ---------------- */
    /**
     * Mapa por playlist:
     *   idDoFilmeOuEpisódio → { p: segundos, d: duração, t: quando }
     *   idDaSérie           → { e: idDoEpisódio, s: temporada, n: episódio, t: quando }
     */
    getProgress(profileId) {
      const map = read('progress.' + profileId, {});
      return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
    },

    /** Grava o mapa, mantendo só os registros mais recentes (remove os antigos do próprio mapa). */
    saveProgress(profileId, map) {
      const keys = Object.keys(map);
      if (keys.length > PROGRESS_LIMIT) {
        keys.sort((a, b) => (map[b].t || 0) - (map[a].t || 0));
        keys.slice(PROGRESS_LIMIT).forEach((key) => { delete map[key]; });
      }
      write('progress.' + profileId, map);
    },

    /* ---------------- Preferências ---------------- */
    getSetting(key, fallback) {
      const settings = read('settings', {});
      return Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : fallback;
    },

    setSetting(key, value) {
      const settings = read('settings', {});
      settings[key] = value;
      write('settings', settings);
    }
  };

  IPTV.Storage = Storage;
})(window.IPTV);
