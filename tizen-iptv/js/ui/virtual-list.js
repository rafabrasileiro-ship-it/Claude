/**
 * virtual-list.js — lista vertical virtualizada.
 *
 * Só as linhas visíveis (mais uma pequena margem) existem no DOM, e os
 * elementos são reciclados durante a rolagem. É o que permite navegar em
 * listas com dezenas de milhares de canais no hardware limitado da TV.
 *
 * Integração com a navegação espacial:
 *  - cada linha é um focável (data-focusable="true");
 *  - cima/baixo são tratados aqui (evento nav-move), movendo o cursor e
 *    rolando a lista; esquerda/direita seguem para a busca espacial;
 *  - ao voltar para a lista (nav-enter), o foco retorna à linha do cursor.
 *
 * options: {
 *   rowHeightRem,                 // altura da linha em rem
 *   createRow() → HTMLElement,    // cria a estrutura de uma linha (reutilizada)
 *   renderRow(row, item, index),  // preenche a linha com um item
 *   onFocus(item, index),         // cursor mudou (teclado ou mouse)
 *   onSelect(item, index),        // OK / clique
 *   onEnter(),                    // o foco está entrando na lista
 *   onSettle(rows: Map),          // rolagem parou (bom momento para carregar imagens)
 *   overscan,                     // linhas extras acima/abaixo (padrão 3)
 *   paddingRem                    // folga no topo e no fim da lista (padrão 0.5)
 * }
 */
(function (IPTV) {
  'use strict';

  const Utils = IPTV.Utils;
  const Navigation = IPTV.Navigation;

  class VirtualList {
    constructor(container, options) {
      this.el = container;
      this.options = options;
      this.items = [];
      this.cursor = 0;
      this.rows = new Map();   // índice → elemento montado
      this.pool = [];          // elementos livres para reutilização
      this.rowHeight = 1;
      this.padding = 0;
      this._frame = 0;

      this.track = Utils.h('div', { class: 'vlist-track' });
      container.classList.add('vlist');
      container.appendChild(this.track);

      this._settle = Utils.debounce(() => {
        if (typeof options.onSettle === 'function') options.onSettle(this.rows);
      }, 160);

      container.addEventListener('scroll', () => this._scheduleRender());
      container.addEventListener('nav-move', (ev) => this._onMove(ev));
      container.addEventListener('nav-enter', (ev) => this._onEnter(ev));
      container.addEventListener('nav-focus', (ev) => this._onFocus(ev));
      container.addEventListener('click', (ev) => this._onClick(ev));

      this._measure();
    }

    /* ---------------- API ---------------- */

    get length() {
      return this.items.length;
    }

    hasFocus() {
      const focused = Navigation.current();
      return !!focused && this.el.contains(focused);
    }

    /** Troca o conteúdo. Se a lista estava em foco, o foco vai para o novo cursor. */
    setItems(items, cursor) {
      const hadFocus = this.hasFocus();
      this.items = items || [];
      this.cursor = this._clamp(cursor || 0);
      this._releaseAll();
      this._measure();
      this.track.style.height = this._contentHeight() + 'px';
      this._centerOn(this.cursor);
      this.render();
      if (hadFocus && this.items.length) this.focusIndex(this.cursor);
    }

    /** Recalcula medidas (tela exibida, janela redimensionada). */
    relayout() {
      const hadFocus = this.hasFocus();
      this._releaseAll();
      this._measure();
      this.track.style.height = this._contentHeight() + 'px';
      this._ensureVisible(this.cursor);
      this.render();
      if (hadFocus && this.items.length) this.focusIndex(this.cursor);
    }

    /** Redesenha as linhas montadas (ex.: mudou favorito ou canal em reprodução). */
    refresh() {
      this.rows.forEach((row, index) => this.options.renderRow(row, this.items[index], index));
    }

    /** Move o cursor sem dar foco. */
    setCursor(index) {
      if (!this.items.length) return;
      this.cursor = this._clamp(index);
      this._ensureVisible(this.cursor);
      this.render();
    }

    focusIndex(index) {
      if (!this.items.length) return false;
      this.cursor = this._clamp(index);
      this._ensureVisible(this.cursor);
      this.render();
      const row = this.rows.get(this.cursor);
      return row ? Navigation.focus(row, { preventScroll: true }) : false;
    }

    /** direction: +1 (página abaixo) ou -1 (página acima). */
    pageBy(direction) {
      const perPage = Math.max(1, Math.floor(this.el.clientHeight / this.rowHeight) - 1);
      return this.focusIndex(this.cursor + direction * perPage);
    }

    render() {
      const count = this.items.length;
      const rowHeight = this.rowHeight;
      const top = this.el.scrollTop;
      const viewHeight = this.el.clientHeight;
      const overscan = this.options.overscan || 3;
      const first = Math.max(0, Math.floor((top - this.padding) / rowHeight) - overscan);
      const last = Math.min(count - 1, Math.ceil((top - this.padding + viewHeight) / rowHeight) - 1 + overscan);

      this.rows.forEach((row, index) => {
        if (index < first || index > last) this._release(index, row);
      });
      for (let index = first; index <= last; index++) {
        if (!this.rows.has(index)) this._mount(index);
      }
      this._settle();
    }

    /* ---------------- internos ---------------- */

    _clamp(index) {
      return Math.max(0, Math.min(this.items.length - 1, index));
    }

    _measure() {
      const rem = Utils.rootFontSize();
      const paddingRem = typeof this.options.paddingRem === 'number' ? this.options.paddingRem : 0.5;
      this.rowHeight = Math.max(1, Math.round(this.options.rowHeightRem * rem));
      this.padding = Math.round(paddingRem * rem);
    }

    _contentHeight() {
      return this.items.length * this.rowHeight + this.padding * 2;
    }

    _rowTop(index) {
      return this.padding + index * this.rowHeight;
    }

    _maxScroll() {
      return Math.max(0, this._contentHeight() - this.el.clientHeight);
    }

    _centerOn(index) {
      const viewHeight = this.el.clientHeight;
      const target = this._rowTop(index) - Math.floor((viewHeight - this.rowHeight) / 2);
      this.el.scrollTop = Math.max(0, Math.min(this._maxScroll(), target));
    }

    /** Mantém a linha visível, com uma vizinha de folga para o usuário ver o que vem a seguir. */
    _ensureVisible(index) {
      const rowHeight = this.rowHeight;
      const viewHeight = this.el.clientHeight;
      const top = this.el.scrollTop;
      const margin = viewHeight >= rowHeight * 4 ? rowHeight : 0;
      const rowTop = this._rowTop(index);
      const rowBottom = rowTop + rowHeight;
      let next = top;
      if (rowTop - margin < top) next = rowTop - margin;
      else if (rowBottom + margin > top + viewHeight) next = rowBottom + margin - viewHeight;
      next = Math.max(0, Math.min(this._maxScroll(), next));
      if (next !== top) this.el.scrollTop = next;
    }

    _mount(index) {
      let row = this.pool.pop();
      if (!row) {
        row = this.options.createRow();
        row.classList.add('vrow');
        row.setAttribute('data-focusable', 'true');
      }
      row._index = index;
      row.style.top = this._rowTop(index) + 'px';
      row.style.height = this.rowHeight + 'px';
      this.options.renderRow(row, this.items[index], index);
      this.rows.set(index, row);
      this.track.appendChild(row);
    }

    _release(index, row) {
      this.rows.delete(index);
      if (row === Navigation.current()) Navigation.clearFocus();
      row.classList.remove('focused');
      if (row.parentNode) row.parentNode.removeChild(row);
      this.pool.push(row);
    }

    _releaseAll() {
      this.rows.forEach((row, index) => this._release(index, row));
    }

    _scheduleRender() {
      if (this._frame) return;
      this._frame = window.requestAnimationFrame(() => {
        this._frame = 0;
        this.render();
      });
    }

    _rowFrom(ev) {
      const row = ev.target && ev.target.closest ? ev.target.closest('.vrow') : null;
      return row && this.rows.get(row._index) === row ? row : null;
    }

    _onMove(ev) {
      const direction = ev.detail.direction;
      if (direction !== 'up' && direction !== 'down') return;
      const next = this.cursor + (direction === 'down' ? 1 : -1);
      if (next < 0) return;                 // topo: deixa o foco sair da lista (abas)
      ev.preventDefault();                  // fim da lista: o foco fica onde está
      if (next < this.items.length) this.focusIndex(next);
    }

    _onEnter(ev) {
      if (typeof this.options.onEnter === 'function') this.options.onEnter();
      if (!this.items.length) return;
      ev.preventDefault();
      this.focusIndex(this.cursor);
    }

    _onFocus(ev) {
      const row = this._rowFrom(ev);
      if (!row) return;
      this.cursor = row._index;
      if (typeof this.options.onFocus === 'function') this.options.onFocus(this.items[row._index], row._index);
    }

    _onClick(ev) {
      const row = this._rowFrom(ev);
      if (!row) return;
      if (typeof this.options.onSelect === 'function') this.options.onSelect(this.items[row._index], row._index);
    }
  }

  IPTV.UI.VirtualList = VirtualList;
})(window.IPTV);
