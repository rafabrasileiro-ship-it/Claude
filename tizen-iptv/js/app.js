/**
 * app.js — inicialização e roteamento entre telas.
 *
 * Fluxo do botão Voltar (cada nível só é alcançado quando o anterior já fechou):
 *   modal/teclado aberto → fecha
 *   OSD visível (tela cheia) → oculta
 *   tela cheia → volta para a lista de canais
 *   episódios de uma série → volta para a lista de séries
 *   lista de canais → volta para as playlists
 *   playlists → confirmação → tizen.application.getCurrentApplication().exit()
 */
(function (IPTV) {
  'use strict';

  const UI = IPTV.UI;
  const Navigation = IPTV.Navigation;

  const screens = {};
  let current = null;
  let exitDialogOpen = false;

  const App = {
    init() {
      Navigation.init();
      UI.PlayerView.init();          // também escolhe o motor de vídeo (AVPlay ou HTML5)
      [UI.Home, UI.Browse].forEach((screen) => {
        screen.init();
        screens[screen.name] = screen;
      });

      // App indo para segundo plano / voltando (tecla Home da TV).
      document.addEventListener('visibilitychange', () => {
        IPTV.Player.handleVisibility(document.hidden);
      });

      window.addEventListener('error', (ev) => {
        console.error('[IPTV] erro não tratado:', ev.message, ev.filename + ':' + ev.lineno);
      });
      window.addEventListener('unhandledrejection', (ev) => {
        console.error('[IPTV] promise rejeitada:', ev.reason);
      });

      this.showScreen('home');
    },

    showScreen(name) {
      const next = screens[name];
      if (!next || next === current) return;
      if (current) {
        current.onHide();
        current.root.classList.remove('active');
      }
      current = next;
      next.root.classList.add('active');
      Navigation.setScreen(next.layer);
      next.onShow();
    },

    isCurrent(name) {
      return !!current && current.name === name;
    },

    async confirmExit() {
      if (exitDialogOpen) return;
      exitDialogOpen = true;
      const leave = await UI.Dialog.confirm({
        title: 'Sair do ' + IPTV.Config.APP_NAME + '?',
        message: 'A reprodução será encerrada.',
        confirmLabel: 'Sair',
        cancelLabel: 'Continuar no app',
        focusConfirm: true
      });
      exitDialogOpen = false;
      if (!leave) return;

      IPTV.Player.stop();
      try {
        window.tizen.application.getCurrentApplication().exit();
      } catch (e) {
        // Fora da TV não existe a API do Tizen.
        UI.Toast.show('No navegador, basta fechar a aba para sair.');
      }
    }
  };

  IPTV.App = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})(window.IPTV);
