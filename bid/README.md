# BID Scraper — Android

App que abre o site do BID da CBF e **captura as tabelas da tela** para um banco local, com
histórico de atletas e triagem de créditos (compensação por treinamento / solidariedade).

## Como funciona (e por que assim)
O BID exige um **CAPTCHA**. Este app **não o quebra** nem usa proxies para driblar bloqueios:
**você** resolve o CAPTCHA e faz a consulta (UF/clube → Confirmar) dentro do app, e ele lê o que
já está na tela. Por isso a coleta é **assistida**, não automática: dois anos de histórico exigem
muitas consultas manuais. Para volume, o caminho correto é pedir **acesso oficial/licenciado** à CBF.

## Uso
1. Instale o APK (aba **Actions → "Gerar APK do BID" → artefato `bid-scraper-android-apk`**) e
   permita fontes desconhecidas.
2. Resolva o CAPTCHA e faça a consulta. Toque **Capturar** (ou **Auto: ON** para capturar a cada
   mudança de página).
3. **Modo: Histórico**: abra a página de um atleta e toque **Capturar** para guardar os vínculos.
4. **Dados** → exporte CSVs (eventos, históricos, triagem de créditos; `;` + UTF-8, abre no Excel).
   Os dados ficam só no aparelho.

## ⚠️ Não validado contra o site real
Foi escrito sem acesso a `bid.cbf.com.br`. Ele lê elementos `<table>` por nome de coluna
(`core/Campos.java`). Se aparecer "Nenhuma tabela reconhecida", use **Dados → Salvar página
(diagnóstico)** e envie o HTML para ajustar o parser.
A triagem de créditos gera **indícios**: o BID não traz valor de transferência nem prova de formação.

## Desenvolvimento
Lógica em Java puro (`core/`), testada sem Android:
```
javac -encoding UTF-8 -d out bid/src/main/java/com/rafa/bid/core/*.java bid/tests/CoreSelfTest.java
java -cp out CoreSelfTest
```
Build: `./gradlew :bid:assembleRelease`. O CI compila e testa a cada push em `bid/**`.
