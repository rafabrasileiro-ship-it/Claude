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
