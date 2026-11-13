# Jogo do Dino 🦖

Jogo simples para Android inspirado no jogo do dinossauro que aparece no navegador quando você está sem internet.

## Como jogar
- **Toque** na tela para começar e para pular (segure para pular mais alto).
- **Segure na parte de baixo** da tela para abaixar e desviar dos pássaros (no ar, isso faz o dino descer mais rápido).
- Desvie dos prédios e das bolas de fogo. A velocidade aumenta com o tempo.
- A dificuldade aumenta aos poucos: mais bolas de fogo (e em dupla), grupos maiores de prédios, intervalos menores e bolas de fogo mais rápidas.
- A cada 700 pontos o cenário alterna entre dia e noite.
- Na tela inicial (e no fim de jogo) toque nas setas ◀ ▶ para trocar de personagem: Dino, Godzilla, Predador, Alien, Cabra e Salsicha. A escolha fica salva.
- Tem som de pulo e de fim de jogo.
- O recorde fica salvo no aparelho.

## Como instalar
1. Abra a aba **Actions** do repositório no GitHub e entre na última execução de **Gerar APK**.
2. Baixe o artefato `jogo-do-dino-apk` (um .zip com o APK dentro).
3. No celular, abra o APK e permita "instalar apps de fontes desconhecidas" quando pedir.

## Compilar localmente
Com o Android SDK instalado:
```
./gradlew assembleRelease
```
O APK fica em `app/build/outputs/apk/release/`.

Código principal: `app/src/main/java/com/rafa/dino/GameView.java` (desenho com Canvas, sem imagens nem bibliotecas extras).

---

# Operação Patriota 3D 🇧🇷 (módulo `patriota`)

Beat 'em up de luta de rua (progressão lateral, visual low poly) para Android, baseado no GDD "Operação Patriota 3D".
Feito em Java nativo, com um renderizador 3D próprio (câmera em perspectiva, modelos de blocos articulados, luz e sombra) sem bibliotecas externas, então o APK é minúsculo.

- 5 missões (a 4 é dividida em 4 minifases nos estúdios), 8 fases selecionáveis, chefes com padrões próprios.
- Heróis: Jair Bonossauro e 3 desbloqueáveis (Patriota do Caminhão, Tiozão do Zap, Véio da Havan-a).
- Golpes: combo de 4, voadora (B+A), onda de choque (segurar A 1s), agarrão/arremesso (C), especial (D, gasta 50 de Patriotismo).
- Fase bônus: Travessia do Lago de jet-ski, desviando (ou batendo de frente) em baleias caricatas; o especial chama patriotas de jet-ski.
- Modo dupla por Bluetooth: pareie os dois celulares, um cria a sala e o outro entra. Os dois heróis ficam na mesma tela, com o dobro de inimigos comuns e chefões com o dobro de vida (o jet-ski é só solo). O anfitrião roda o jogo e o convidado recebe a imagem e envia os toques.
- Missão 5: Velociraptor com a bandeira de batalha (combo de bandeirada, varredura aérea, investida com lança, rugido).
- Gráficos Leve/Normal/Alta (sombras suaves, texturas, gradientes, perspectiva e vinheta) nas Opções.
- Itens, armas temporárias, menus (splash, menu, seleção, opções, créditos), briefing, pausa, game over e vitória.
- Falas só tocam (e só aparecem) se houver gravação em `res/raw`; efeitos e música gerados por código.

APK pronto: pasta `dist/` (`operacao-patriota-vN.apk`), gerado pelo workflow **Gerar APK**.
Compilar local: `./gradlew :patriota:assembleRelease` → `patriota/build/outputs/apk/release/`.

**Vozes reais:** coloque as gravações em `patriota/src/main/res/raw/` com os nomes listados em `patriota/VOZES-LEIA-ME.txt` (ex.: `voz_mula_brasil.ogg`). Sem o arquivo, a fala não aparece nem toca.
