# BR-APOCALIPSE 🧟🚚

Jogo de ação e sobrevivência sobre rodas para celulares Android. O vírus Carniça-26 colapsou o Brasil. De Bauru (SP), um grupo de até 4 sobreviventes precisa cruzar mais de 3.000 km de rodovias até a Base Naval de Fortaleza (CE) antes que o último navio da Marinha zarpe.

## Como instalar no celular
1. Abra a aba **Actions** do repositório no GitHub e entre na última execução de **Gerar APK**.
2. Baixe o artefato `br-apocalipse-apk` (um .zip com o APK dentro). O mesmo APK também é salvo em `dist/br-apocalipse-vNN.apk`.
3. No celular, abra o APK e permita "instalar apps de fontes desconhecidas" quando pedir.

O jogo roda deitado (paisagem), em tela cheia (inclusive a faixa do furo da câmera), e funciona sem internet.

**Gráficos 3D:** o mundo é desenhado em 3D de verdade (WebGL), com polígonos texturizados, luz por pixel e neblina, no espírito dos jogos de PlayStation 1. Os zumbis são modelos com esqueleto e animação própria de cada tipo: o Andarilho arrasta uma perna com os braços esticados, o Corredor dispara se debatendo, o Carrapato vem de quatro e salta no para-brisa, o Colosso carrega um bloco de concreto acima da cabeça. Tomam tranco com cada tiro e caem de verdade: tombam e ficam na pista com poça de sangue, a cabeça estoura no tiro certeiro e quem é atropelado voa por cima do carro. À noite, os faróis iluminam a pista em cone e a pele luminescente brilha no escuro. Carros inimigos, o carro dos jogadores com os upgrades, todo o cenário (canaviais, cerrado, prédios de Brasília, mandacarus, coqueiros, placas com o nome das cidades), os 10 chefes e os retrovisores também são 3D. Em celulares sem WebGL o jogo volta sozinho para o desenho 2D clássico; o botão **🧊 Gráficos** no menu inicial alterna entre os dois.

**Cabine, braços, armas e carro em 3D:** no volante, a cabine é 3D de verdade: mostradores retroiluminados com ponteiros, LEDs de alerta, régua de blindagem, rádio e o mapa de papel no porta-luvas; o volante gira com as mãos agarradas e a mão direita vai ao câmbio a cada troca de marcha; os três retrovisores mostram a estrada de trás; o pingente balança nas curvas e freadas; limpadores, telas e chapas de aço nas janelas e o capô com para-choques, lâminas, motosserras e a arma do capô. Na janela, o Artilheiro vê a própria lataria ao lado e segura cada arma em 3D (revólver, pistola, espingardas, submetralhadoras, fuzis, FN MAG, lança-granadas, .50 e canhões, facão, lança, porrete e motosserras), com braços de cada classe (manga, luva, relógio, pulseira, tatuagem). As armas têm peças que se mexem (ferrolho, bomba, tambor, cano dos canhões, fita de munição, corrente da motosserra), coice em molas, balanço com o carro, recarga animada, cápsulas voando e o clarão do tiro iluminando a cena; a mira de ferro alinha alça e massa no ponto de mira. A carroceria tem suspensão: rola nas curvas, mergulha na freada, agacha na arrancada e trepida em buracos, atropelamentos e batidas — por dentro, por fora e vista da janela. Em 3ª pessoa, os companheiros aparecem debruçados nas janelas atirando.

**Sons de tiro:** cada arma usa uma gravação real de tiro (revólver, 9 mm, 10 mm, escopeta, 7,62, fuzil de ferrolho, tiro genérico e explosão). Quando não há gravação própria, o som é adaptado: o 5,56 é o 7,62 mais agudo e seco, a FN MAG é o 7,62 mais grave, a .50 e os canhões ganham reforço grave (25/30 mm com um pedaço da explosão) e o lança-granadas faz um "tump" abafado. Todos os tiros soam — os seus, os da IA (o Falcão usa o fuzil de ferrolho), os de motos, caminhonetes, blindados e chefes (os jagunços do Coronel também atiram de ferrolho) e, no co-op, os dos outros celulares — com distância (abafa e atrasa pela velocidade do som) e lado esquerdo/direito.

**Resolução:** por padrão o jogo desenha na resolução da própria tela — 1080 × 2400 num Galaxy S20 FE, 1264 × 2780 num Motorola Signature. No menu inicial (e na pausa), **🖥 Resolução** troca entre Automática, FULL HD+ (1080 × 2400), 1.5K SUPER HD (1264 × 2780) e HD+ (720 × 1600, mais leve para celulares simples). Nas resoluções fixas vale o número de linhas; a largura acompanha a proporção da tela.

## O que tem no jogo
- **4 sobreviventes** com passiva e Botão de Adrenalina (recarga de 60 s): Trovão (turbo "Pé no Porão"), Graxa (solda a frio da blindagem), Falcão (pontos fracos em vermelho) e Cobra (munição incendiária). Cada um tem mãos, luvas e relógio próprios em 1ª pessoa.
- **Piloto em 1ª pessoa** com painel de verdade: velocímetro, conta-giros, combustível, temperatura (fumaça sai das saídas de ar quando ferve), retrovisores renderizados em tempo real (o esquerdo pode quebrar), sangue/ácido/óleo no para-brisa, limpador com esguicho, trincas de bala, tela de arame e chapa de aço com fresta, rádio com estações, mapa de papel no porta-luvas. Também dá para jogar em 3ª pessoa.
- **Três câmeras para o Piloto**, no botão 📷 da lateral direita da tela (ou tecla P): 1ª pessoa, 3ª pessoa (atrás do carro) e **corrida** — bem afastada e por cima, como nos jogos de corrida: a câmera se afasta com a velocidade e acompanha as curvas com um pequeno atraso. O tiro do carro sai do teto nas câmeras de 3ª pessoa.
- **Volume da música** separado do volume geral: controle deslizante 🎵 no menu inicial (opções) e na tela de pausa; fica salvo.
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
- **Conexão estável:** o app mantém o Wi-Fi em modo de baixa latência durante a sala, tenta conectar até 3 vezes e descarta o que ficou velho quando a rede engasga. Se um celular perder o sinal (ou o Piloto ficar um instante em segundo plano), ele **reconecta sozinho por até 40 s** e recebe de volta o mesmo sobrevivente, as estatísticas e o estado da partida; enquanto isso a IA cobre o lugar. Aparece "RECONECTANDO…" na base da tela. Só uma sala fechada pelo Piloto encerra de vez.
- **Mensagens na base da tela:** rádio, gritos, conquistas, título de trecho/chefe, habilidades e avisos de rede aparecem empilhados na parte de baixo (acima dos botões ESQ!/CAPÔ!/DIR! do Artilheiro), nunca no meio da pista.

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
- O jogo é HTML5 em JavaScript puro (`br-apocalipse/www`), sem imagens nem bibliotecas: modelos e texturas são gerados em código (texturas desenhadas em canvas na hora); os tiros e explosões usam gravações embutidas e o resto dos sons é sintetizado com WebAudio. Tudo é pensado em coordenadas de 540 linhas e rasterizado na resolução escolhida (`RENDER.resize`).
- O mundo 3D usa WebGL 1 num canvas por baixo do canvas 2D (que fica com o painel, as mãos e o HUD). A projeção 3D é a mesma da estrada pseudo-3D original, então os acertos de tiro continuam batendo com o que aparece na tela. Peças: `gl.js` (núcleo WebGL), `tex3d.js` (texturas procedurais), `world3d.js` (estrada, céu, luz, neblina, retrovisores), `zombie3d.js` + `zanim3d.js` (zumbis, esqueleto, animação e cadáveres), `kit3d.js` (primitivas de modelagem), `veh3d.js` (veículos), `scene3d.js` (cenário), `boss3d.js` (chefes) e `fx3d.js` (sangue e perigos).
- A 1ª pessoa 3D é desenhada numa passada de primeiro plano (plano próximo de 3 cm): `cabin3d.js` (cabine do Piloto), `vm3d.js` (arma, poses e física do Artilheiro), `guns3d.js` (modelos das armas), `arms3d.js` (braços com cinemática inversa) e `carfx.js` (suspensão da carroceria). Os sons gravados ficam em `sons.js` (MP3 embutido) e são tocados pelo `audio.js`.
- O app Android (`brapocalipse/`) é um WebView em tela cheia que carrega esses arquivos como assets. A classe `Bridge.java` dá ao jogo vibração e a rede local do co-op.
- No co-op, o celular do Piloto simula tudo e manda o estado ~15 vezes por segundo; os Artilheiros desenham esse estado, cuidam da própria arma e mandam os acertos ao Piloto.

Arquivos principais: `js/data.js` (classes, armas, veículos, cidades), `js/game.js` (física, hordas, IA), `js/boss.js` (os 10 chefes), `js/render.js` (estrada, cockpit, retrovisores), `js/net.js` (co-op), `js/ui.js` (telas e controles).

## Testar no computador
Abra `br-apocalipse/www/index.html` no Chrome. Para testar o co-op sem celulares, sirva a pasta por HTTP (por exemplo `npx http-server br-apocalipse/www`) e abra o jogo em duas abas: elas se encontram como se fossem dois celulares. Acrescente `?unlock` ao endereço para liberar os modos extras.

## Compilar o APK localmente
Com o Android SDK instalado: `./gradlew :brapocalipse:assembleRelease`. O APK fica em `brapocalipse/build/outputs/apk/release/`.
