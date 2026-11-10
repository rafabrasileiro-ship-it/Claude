# BID Scraper (CBF) — recuperação de créditos de formação e solidariedade

Coleta o **BID da CBF** (últimos 2 anos + atualização diária), guarda o **histórico de cada atleta**
em SQLite e expõe os dados por **consultas parametrizadas** e por uma **triagem de indícios** de
*compensação por treinamento* e *mecanismo de solidariedade*.

> ⚠️ **Status honesto:** o ambiente em que isto foi escrito não tinha acesso a `bid.cbf.com.br`,
> então o parser foi validado só com HTML sintético (`tests/`). **Antes de usar, rode o passo 2
> (`sondar`)** e ajuste o `config.toml` — é uma questão de minutos, sem mexer no código.

## 1. Instalação (Windows)
Python 3.11+ no PATH, depois:
```
scripts\instalar.bat
```
Ou baixe o `.exe` pronto na aba **Actions → "BID Scraper (Windows .exe)" → artefato**
(mantenha `config.toml` na mesma pasta). Edite o `user_agent` do `config.toml` com seu contato.

## 2. Calibrar com o site real
```
scripts\bid.bat sondar
scripts\bid.bat sondar --url "https://bid.cbf.com.br/..." --salvar pagina.html
```
Mostra tabelas, cabeçalhos, formulários, APIs referenciadas e quantas linhas o parser reconheceu.
- Dados em **tabela HTML**: ajuste `[site] url_dia`, `url_atleta`, `regex_id_atleta`.
- Dados vindos de **API JSON** (veja a aba Network do navegador, F12): aponte `url_dia` para ela.
- Página montada por **JavaScript**: `pip install playwright && playwright install chromium` e `[http] modo = "browser"`.

Cabeçalhos são reconhecidos por nome com sinônimos (`parsers.py → SYNONYMS`), não por posição.

## 3. Uso
```
scripts\bid.bat backfill                      # 730 dias, retomável (pula dias já coletados)
scripts\bid.bat backfill --de 2024-01-01 --ate 2024-03-31
scripts\bid.bat historico                     # histórico dos atletas ainda sem histórico
scripts\bid.bat diario                        # últimos 3 dias + históricos pendentes + exports/
scripts\bid.bat status
```
**Agendar todo dia (PowerShell):** `.\scripts\agendar_diario.ps1 -Hora "06:30"`
(roda ao ligar o PC se perder o horário).

### Consulta parametrizada
```
bid.bat consulta --atleta "silva" --de 2024-01-01 --tipo transfer --saida eventos.xlsx
bid.bat consulta --clube "Clube A" --nascidos-de 2003-01-01 --nascidos-ate 2005-12-31 --saida x.csv
bid.bat consulta --atleta-id 101 --historico
```
Saídas: `.csv` (`;`, UTF-8 com BOM — abre direto no Excel), `.xlsx`, `.json`, ou tabela no terminal.

### Triagem de créditos
```
bid.bat creditos --de 2024-01-01 --clube-formador "Clube A" --pct-min 0.5 --saida creditos.xlsx
```
Uma linha por (evento gatilho × clube formador): atleta, idades no clube, anos de formação 12–15 e
16–21, **% de solidariedade** (0,25% por ano dos 12–15; 0,5% por ano dos 16–23, sobre o valor pago
ao vendedor) e sinalização de compensação por treinamento. Gatilhos: contrato profissional e
transferência. O clube vendedor é excluído por padrão (`--incluir-vendedor` para ver).

**Limites que você precisa conhecer**
- O BID **não traz o valor** da transferência, a categoria do formador nem prova de formação:
  a saída são *indícios* para qualificar leads; valide documentalmente (registros, CBF/FIFA TMS).
- Atribuição do clube por ano de vida = clube com mais dias no ano; empréstimos são ignorados.
  Confira com o histórico real antes de cobrar.
- Regras FIFA (RSTP Anexos 4/5) e a regulamentação nacional (Lei Pelé/RNRT-CBF) mudam; confirme a
  versão vigente na data de cada fato.

## 4. Boas práticas e legalidade
- Rate limit padrão de 2 s entre requisições, retentativas com backoff e **respeito ao robots.txt**.
  Não reduza o intervalo sem necessidade; confira os Termos de Uso do BID.
- Contém dados pessoais (inclusive de menores no histórico de base): LGPD se aplica — use com base
  legal definida (ex.: exercício regular de direitos), minimize e proteja a base `data/bid.sqlite`.
- HTML/JSON brutos ficam em `data/raw/` (gzip) para auditoria.

## 5. Estrutura
`bidscraper/` http · parsers · scraper · db · creditos · export · cli — `tests/` (`python -m unittest discover -s tests -t .`).
