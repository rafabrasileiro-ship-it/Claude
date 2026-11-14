# DEDOS TWISTER 🔴🔵🟢🟡

O clássico Twister, mas jogado **com os dedos** na tela do celular. Tem modo **1 jogador** e **2 jogadores no mesmo celular** (deitado na mesa, um de cada lado; cada um vê os textos virados para o seu lado).

## Como jogar
1. Cada jogador usa **uma mão** e joga na **sua metade** da tela.
2. A cada jogada o giro sorteia **um dedo e uma cor** (ex.: *INDICADOR → AZUL*).
3. Apoie aquele dedo num **círculo vazio** da cor sorteada. Se o dedo já está na tela, **levante só ele** e leve para a nova cor.
4. Os outros dedos **não saem do lugar**.
5. Perde quem levantar um dedo que não devia, tocar na cor errada, tocar fora da vez, tocar num círculo ocupado ou estourar o tempo (que diminui a cada jogada).
6. No modo 1 jogador, o objetivo é bater o recorde de jogadas (fica salvo no aparelho).

As cores também têm símbolos (● ▲ ■ ★) para quem tem dificuldade com cores.
Nas opções do menu dá para escolher de **2 a 5 dedos por jogador** e ligar/desligar o som.

> O celular não sabe *qual* dedo você usou, só quantos toques existem e onde. Vale a honestidade, como no Twister de verdade. Alguns aparelhos reconhecem poucos toques ao mesmo tempo; se acontecer, escolha menos dedos (padrão: 3 por jogador = 6 toques).

## Como instalar
O APK é gerado pelo GitHub Actions (workflow **Gerar APK - Dedos Twister**):
1. Aba **Actions** → última execução → baixe o artefato `dedos-twister-apk` (ou pegue `dist/dedos-twister-v*.apk` na branch).
2. No celular, abra o APK e permita "instalar apps de fontes desconhecidas".

## Compilar localmente
Com o Android SDK instalado, dentro desta pasta:
```
./gradlew assembleRelease
```
O APK fica em `app/build/outputs/apk/release/`.

O jogo inteiro está em `app/src/main/assets/index.html` (HTML + CSS + JS, sem bibliotecas); o app Android só o abre em tela cheia (`MainActivity.java`). Dá para testar no navegador do celular abrindo esse arquivo.
