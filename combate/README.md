# Combate (Stratego) — 2 jogadores, cada um no seu celular

Jogo em rede local: um servidor Node.js (sem dependências) + site otimizado para celular.

## Como jogar
1. Num computador (ou no próprio celular via Termux) na mesma rede Wi-Fi dos jogadores:
   ```
   cd combate
   node server.js
   ```
2. O terminal mostra o endereço, ex.: `http://192.168.0.15:3000`.
3. Os dois celulares abrem esse endereço no navegador.
4. Jogador 1 toca em **Criar partida** e vê um código de 4 números; jogador 2 digita o código em **Entrar**.
5. Cada um posiciona suas 40 peças (toque na peça da bandeja e depois na casa; ou **🎲 Aleatório**) e toca em **Pronto**.
6. Toque numa peça sua para ver os movimentos possíveis e toque no destino.

Se não conectar: confira que os celulares estão no mesmo Wi-Fi (sem "isolamento de clientes"/rede de convidados) e que o firewall do computador permite a porta 3000 (`PORT=8080 node server.js` troca a porta).

## Regras implementadas
Tabuleiro 10×10 com 2 lagos, 40 peças por jogador, soldado (2) anda várias casas, cabo (3) desarma bombas, espião (1) vence o marechal ao atacar, peças que lutaram ficam reveladas, regra de não repetir movimento mais de 3 vezes, vitória por captura da bandeira ou falta de movimentos, desistência e revanche (alterna quem começa). O servidor valida todas as jogadas e nunca envia ao adversário o valor das suas peças ocultas.

## Modo contra a máquina
Na tela inicial, escolha **Fácil / Médio / Difícil** e toque em **🤖 Jogar contra a máquina**. Roda inteiramente no aparelho (sem servidor e sem Wi-Fi). A máquina só usa a informação que um jogador humano teria: calcula probabilidades com base nas peças que ainda restam e nas que já se moveram, usa soldados para explorar e evita ficar ao lado de peças que possam capturá-la.

## Visão 3D
O tabuleiro é exibido em perspectiva, com as peças "em pé" (espessura, sombra e destaque de seleção), como no jogo da Estrela. Em pé a câmera fica mais alta; deitado fica mais inclinada. Dá para desligar em **☰ Menu → Visão 3D**.
