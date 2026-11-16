# BR-APOCALIPSE 🧟🚚

Jogo de ação e sobrevivência sobre rodas para celulares Android. O vírus Carniça-26 colapsou o Brasil. De Bauru (SP), um grupo de até 4 sobreviventes precisa cruzar mais de 3.000 km de rodovias até a Base Naval de Fortaleza (CE) antes que o último navio da Marinha zarpe.

## Como instalar no celular
1. Abra a aba **Actions** do repositório no GitHub e entre na última execução de **Gerar APK**.
2. Baixe o artefato `br-apocalipse-apk` (um .zip com o APK dentro). O mesmo APK também é salvo em `dist/br-apocalipse-vNN.apk`.
3. No celular, abra o APK e permita "instalar apps de fontes desconhecidas" quando pedir.

O jogo roda deitado (paisagem), em tela cheia (inclusive a faixa do furo da câmera), e funciona sem internet.

**Resolução:** por padrão o jogo desenha na resolução da própria tela — 1080 × 2400 num Galaxy S20 FE, 1264 × 2780 num Motorola Signature. No menu inicial (e na pausa), **🖥 Resolução** troca entre Automática, FULL HD+ (1080 × 2400), 1.5K SUPER HD (1264 × 2780) e HD+ (720 × 1600, mais leve para celulares simples). Nas resoluções fixas vale o número de linhas; a largura acompanha a proporção da tela.

## O que tem no jogo
- **4 sobreviventes** com passiva e Botão de Adrenalina (recarga de 60 s): Trovão (turbo "Pé no Porão"), Graxa (solda a frio da blindagem), Falcão (pontos fracos em vermelho) e Cobra (munição incendiária). Cada um tem mãos, luvas e relógio próprios em 1ª pessoa.
- **Piloto em 1ª pessoa** com painel de verdade: velocímetro, conta-giros, combustível, temperatura (fumaça sai das saídas de ar quando ferve), retrovisores renderizados em tempo real (o esquerdo pode quebrar), sangue/ácido/óleo no para-brisa, limpador com esguicho, trincas de bala, tela de arame e chapa de aço com fresta, rádio com estações, mapa de papel no porta-luvas. Também dá para jogar em 3ª pessoa.
- **Artilheiros nas janelas, teto solar, caçamba e torretas**: tiro livre com retícula e mira de ferro (alça e massa), recuo, chacoalhão da suspensão, cobertura no banco para recarregar, armas brancas (facão, lança, porrete, motosserra de mão e industrial) e torretas pesadas (.50, 20 mm, 25 mm, 30 mm) que superaquecem e puxam o carro com o recuo.
- **Bestiário** com pele aberrante verde e laranja luminescente (que brilha no escuro e atravessa a neblina): Andarilhos, Corredores, e as 6 mutações (Carrapato de Parabrisa, Boiadeiro Inchado, Engolidor de Fumaça, Encouraçado, Cangaceiro de Espinhos e Colosso Rodoviário), além de bois infectados, motos, caminhonetes, buggies suicidas e blindados das Gangues do Asfalto.
- **10 cidades e 10 Chefes de Estrada** nas rodovias reais (SP-300, Anhanguera, BR-050, BR-153, BR-060, BR-020, BR-242, BR-407, BR-116…), de O Usineiro em Ribeirão Preto ao Almirante da Ferrugem e o salto no Porto do Mucuripe.
- **Oficina** em cada cidade: 5 classes de veículo (Uno com escada até Scania Bicuda), para-choques até o Limpa-Trilhos com 6 motosserras, motosserras laterais, telas e chapas, pneus run-flat e maciços com espinhos, turbo, suspensão, tanque, blindagem de titânio, arma fixa do capô e munição.
- **Arsenal que cresce cidade a cidade** — de revólveres com 18 balas em Bauru até o canhão 30 mm de um Guarani tombado em Messejana.
- **Eventos de estrada**: resgate no ponto de ônibus, emboscada com tapete de pregos, comboio militar tombado e boiada zumbi; clima com tromba d'água, canavial em chamas, queimada de cerrado, tempestade de areia e neblina noturna.
- **Zona de saque** ao chegar em cada cidade, **placar** por jogador, **conquistas** e os modos pós-jogo **Expresso da Meia-Noite**, **Fúria da Sucata** (New Game+) e **Rei da BR** (arena infinita).

## Co-op Wi-Fi (até 4 celulares)
- Todos os celulares precisam estar na **mesma rede Wi-Fi** — ou conectados ao **roteador Wi-Fi (ponto de acesso) do celular do Piloto**, sem precisar de internet.
- No celular do Piloto: **CO-OP WI-FI → CRIAR SALA**. Ele é o Jogador 1, o servidor da partida: dirige, gasta a sucata na oficina e guarda o progresso.
- Nos outros: **CO-OP WI-FI → ENTRAR NUMA SALA**. A sala aparece sozinha; se não aparecer, digite o endereço mostrado na tela do Piloto. Cada um escolhe um sobrevivente diferente e entra como Artilheiro.
- Lugares vazios ficam com a IA. Dá para entrar no meio da estrada; quem sai é substituído pela IA.
- Rede: TCP na porta 47820 (partida) e UDP na porta 47821 (anúncio das salas).

## Controles
| Piloto | | Artilheiro | |
|---|---|---|---|
| ◀ ▶ (ou giroscópio) | direção | arrastar o dedo | mira |
| ACEL / FREIO | acelerador, freio e ré | FOGO | atira ou golpeia |
| 🅿 | freio de mão (cavalo de pau) | 🎯 | mira de ferro |
| 🔥 | arma fixa do capô | 🔪 | arma branca (toque de novo para trocar) |
| 🪚 | liga as motosserras do carro | 🔫 / 🔄 | troca de arma / recarga |
| 🧽 / 💡 | limpador / farol | 🙇 / 💺 / ↩ | cobertura / assento / olhar para trás |
| toque no rádio | troca de estação | ◀ ESQ! CAPÔ! DIR! ▶ | avisos que acendem o painel do Piloto |

⚡ é a habilidade da classe. No jogo solo, 🔁 troca entre volante e janela (a IA assume o resto). No computador também dá para jogar com teclado e mouse (WASD, F, C, V, L, E, Q, G, R, X, Z, B, 1-2-3, Tab, P, Esc).

## Como é feito
- O jogo é HTML5 + Canvas 2D em JavaScript puro (`br-apocalipse/www`), sem imagens nem bibliotecas: estrada pseudo-3D, sprites desenhados em código e sons sintetizados com WebAudio. Tudo é desenhado em coordenadas de 540 linhas e rasterizado na resolução escolhida (`RENDER.resize`).
- O app Android (`brapocalipse/`) é um WebView em tela cheia que carrega esses arquivos como assets. A classe `Bridge.java` dá ao jogo vibração e a rede local do co-op.
- No co-op, o celular do Piloto simula tudo e manda o estado ~15 vezes por segundo; os Artilheiros desenham esse estado, cuidam da própria arma e mandam os acertos ao Piloto.

Arquivos principais: `js/data.js` (classes, armas, veículos, cidades), `js/game.js` (física, hordas, IA), `js/boss.js` (os 10 chefes), `js/render.js` (estrada, cockpit, retrovisores), `js/net.js` (co-op), `js/ui.js` (telas e controles).

## Testar no computador
Abra `br-apocalipse/www/index.html` no Chrome. Para testar o co-op sem celulares, sirva a pasta por HTTP (por exemplo `npx http-server br-apocalipse/www`) e abra o jogo em duas abas: elas se encontram como se fossem dois celulares. Acrescente `?unlock` ao endereço para liberar os modos extras.

## Compilar o APK localmente
Com o Android SDK instalado: `./gradlew :brapocalipse:assembleRelease`. O APK fica em `brapocalipse/build/outputs/apk/release/`.
