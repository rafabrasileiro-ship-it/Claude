# IPTV Player — Samsung Tizen (Web App)

Player de IPTV para Smart TVs Samsung (Tizen 5.0+), empacotável em `.wgt`.
Vanilla JavaScript (ES2017), HTML5 e CSS3 — sem frameworks, sem etapa de build.

- **Playlists M3U** (`.m3u` / `.m3u8`) e **Xtream Codes API** (`player_api.php`), com várias playlists salvas.
- **Motor de vídeo híbrido**: `webapis.avplay` na TV; `<video>` + hls.js (CDN) no navegador do PC.
- **Navegação espacial** por controle remoto, com foco visível a distância.
- **Listas virtualizadas**: dezenas de milhares de canais sem travar a TV.
- Favoritos, busca por nome, mini-player, tela cheia com OSD e reconexão automática.

O app não inclui nenhum conteúdo: você informa a sua playlist. A "lista de teste" embutida usa
apenas streams públicos de demonstração (Mux, Apple, Unified Streaming, Blender).

## Estrutura

```
tizen-iptv/
├── config.xml                 Manifesto Tizen (ID, privilégios, política de rede)
├── index.html                 Esqueleto das telas + ordem de carga dos scripts
├── icon.png                   Ícone do app (512x423)
├── .project / .tproject       Metadados para importar no Tizen Studio
├── css/
│   ├── base.css               Tokens, escala (1rem = 16px em 1080p), estilo de foco
│   ├── components.css         Botões, formulários, modais, loader, toasts, lista virtual
│   ├── screens.css            Tela inicial e tela de 3 colunas
│   └── player.css             Contêiner de vídeo e OSD
└── js/
    ├── app.js                 Inicialização e troca de telas
    ├── core/
    │   ├── utils.js           Namespace IPTV, Emitter, CancelToken, HTTP (XHR), DOM
    │   ├── config.js          Constantes (timeouts, OSD, reconexão, URL do hls.js)
    │   ├── storage.js         localStorage: playlists, favoritos, preferências
    │   ├── navigation.js      Foco espacial, camadas (modais), teclas do controle
    │   ├── player.js          AVPlay + fallback HTML5/hls.js, estado e reconexão
    │   └── catalog.js         Abre uma playlist e entrega seções (Ao Vivo / Filmes)
    ├── parsers/
    │   ├── m3u-parser.js      Parser M3U em fatias de tempo (não bloqueia a UI)
    │   ├── xtream-client.js   Cliente da Xtream Codes API + montagem das URLs
    │   └── demo-playlist.js   Lista de teste embutida
    └── ui/
        ├── components.js      Toast, Dialog (confirmar/alerta/prompt), Loader
        ├── virtual-list.js    Lista virtualizada com reciclagem de linhas
        ├── profile-form.js    Modal de adicionar/editar playlist
        ├── home-screen.js     Gerenciador de playlists
        ├── browse-screen.js   Categorias | Canais | Mini-player
        └── player-view.js     Mini-player, tela cheia e OSD
```

## Controles

| Controle Samsung | Teclado no PC | Tela de canais | Tela cheia |
| --- | --- | --- | --- |
| Setas | Setas | Mover o foco | ▲▼ trocar canal · ◄► ±10 s (filmes) |
| OK | Enter | Reproduzir; no canal que já toca, abre tela cheia | Mostrar/ocultar OSD |
| Voltar | Esc ou Backspace | Voltar às playlists | Fecha o OSD; depois volta à lista |
| Vermelho | R | Playlists (na tela inicial: remover) | — |
| Verde | G | Favoritar (na tela inicial: editar) | Favoritar |
| Amarelo | Y | Alternar Ao Vivo / Filmes | — |
| Azul | B | Buscar | — |
| CH+ / CH- | PageUp / PageDown | Página acima / abaixo | Próximo / anterior |
| Play/Pause, Stop | Espaço, S | Pausar / parar | Pausar / parar |

Voltar segue sempre a mesma ordem: teclado ou modal aberto → OSD → tela cheia → lista de canais →
playlists → confirmação de saída (`tizen.application.getCurrentApplication().exit()`).

## Testar no navegador do PC

Não há build. Sirva a pasta e abra no Chrome/Edge:

```bash
cd tizen-iptv
python3 -m http.server 8080      # ou: npx serve -l 8080
# abra http://localhost:8080
```

1. Na tela inicial, escolha **Carregar lista de teste**.
2. `Enter` num canal reproduz no mini-player; `Enter` de novo abre em tela cheia.

Sem `webapis.avplay`, o app usa `<video>` + hls.js automaticamente (o rodapé da tela inicial mostra o
motor ativo). O erro 404 de `$WEBAPIS/webapis/webapis.js` no console é esperado fora da TV.

Limitações do modo navegador (não existem na TV):

- **CORS**: o navegador só baixa playlists e streams de servidores que enviam cabeçalhos CORS. Para
  testar uma lista sem CORS, abra um Chrome só para desenvolvimento:
  `chrome --disable-web-security --user-data-dir=/tmp/chrome-iptv`.
- **MPEG-TS** (`.ts`) não toca no navegador. Para contas Xtream o app já pede a saída `.m3u8` quando
  roda no PC; na TV usa `.ts` (ou `.m3u8`, conforme os formatos liberados na conta).

## Gerar o `.wgt` no Tizen Studio

Pré-requisitos: Tizen Studio com **TV Extensions** e **Samsung Certificate Extension** (Package Manager).

1. **Importar**: `File > Import > Tizen > Tizen Project`, selecione a pasta `tizen-iptv` e conclua
   (perfil `tv-samsung`). Se o assistente não reconhecer a pasta, crie um projeto
   `File > New > Tizen Project > Template > TV > Web Application > Basic Project` e substitua o
   conteúdo dele pelos arquivos desta pasta.
2. **Certificado**: `Tools > Certificate Manager`, crie um perfil **Samsung** (autor + distribuidor;
   inclua o DUID da TV no certificado de distribuidor).
3. **Empacotar**: botão direito no projeto → `Build Signed Package`. O arquivo `.wgt` é gerado na
   raiz do projeto.
4. **Instalar na TV**: na TV, abra *Apps*, digite `12345`, ative o *Developer mode* e informe o IP do
   PC; reinicie a TV. No Tizen Studio, `Device Manager > Remote Device Manager` para conectar e
   depois `Run As > Tizen Web Application`.

Pela linha de comando (CLI do Tizen Studio):

```bash
tizen build-web -e "README.md" -- /caminho/tizen-iptv
tizen package -t wgt -s <perfil-de-certificado> -- /caminho/tizen-iptv/.buildResult
tizen install -n <arquivo-gerado>.wgt -t <nome-da-tv> -- /caminho/tizen-iptv/.buildResult
```

### Sobre o `config.xml`

- `tizen:application id="Xq7RtB2kLm.IPTVPlayer"` é um ID fictício; troque o `package` se for publicar.
- Privilégios: `internet`, `tv.inputdevice` (teclas coloridas, mídia e canal) e `application.launch`.
  O privilégio `http://developer.samsung.com/privilege/avplay` foi incluído por compatibilidade com
  modelos que o exigem para o AVPlay; se o validador do seu Tizen Studio reclamar, pode removê-lo.
- `<access origin="*" subdomains="true"/>` libera playlists e streams de qualquer domínio e porta.

## Notas de implementação

- **Compatibilidade**: Tizen 5.0 usa Chromium 63. O código evita ES Modules (o app roda em `file://`),
  `?.`, `??`, `gap` em flexbox, `inset`, `aspect-ratio` etc.
- **AVPlay**: o vídeo é desenhado num plano atrás da página. O `<object type="application/avplayer">`
  e o fundo transparente da página (classe `player-visible`) deixam o vídeo aparecer; mini-player e
  tela cheia são o mesmo stream, só muda o `setDisplayRect` (sempre na base 1920x1080).
- **Listas grandes**: o parser trabalha em fatias de ~12 ms e devolve o controle à UI; as listas só
  mantêm no DOM as linhas visíveis; logos só são baixados quando a rolagem para.
- **Xtream**: os canais ao vivo são carregados ao abrir a playlist; os filmes só quando você entra na
  aba Filmes. Séries e EPG não fazem parte desta estrutura inicial.
- **Credenciais**: URLs, usuário e senha ficam em `localStorage` da TV, em texto puro (requisito do
  projeto). Não use o app em aparelhos compartilhados se isso for um problema.
