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

## 4. Transferências com valor: credores e devedores
O BID não informa valores nem a carreira fora do Brasil. Para completar as lacunas, o programa
importa a base aberta **transfermarkt-datasets** (a mesma do Kaggle `davidcariboo/player-scores`):
```
bid.bat importar-tm                                  # baixa players, clubs e transfers
bid.bat importar-tm --origem C:\Downloads\archive.zip # ou usa o .zip baixado do Kaggle
bid.bat importar-csv planilha.csv --fonte ogol       # qualquer outra fonte, em CSV
bid.bat vincular                                     # liga atletas do BID aos da fonte
bid.bat carreira --buscar "vinicius"                 # acha o ID do atleta na fonte
bid.bat carreira --id-fonte 371998                   # carreira consolidada
bid.bat apurar --de 2024-11-01 --tipo solidariedade --valor-min 500000 --saida creditos.xlsx
bid.bat apurar --credor "Flamengo" --so-no-prazo --resumo --saida carteira.xlsx
```
- **Carreira consolidada:** o BID tem prioridade; a fonte externa só preenche períodos sem registro
  no BID. Base (U17/U20/Sub-20) e time B contam para o clube principal.
- **`apurar`** gera uma linha por transferência × clube credor: devedor (clube de destino), vendedor,
  idades e anos no credor (rateio proporcional aos dias), % do valor, **valor estimado do crédito em
  EUR**, âmbito (internacional/nacional), data-limite de 2 anos e situação do prazo.
  `--resumo` soma por credor × devedor.
- **Solidariedade:** só transferências com valor > 0. **Compensação por treinamento:** transferências
  até os 23 anos; informe `--custo-anual` e `--custo-anual-12-15` (tabela da circular FIFA para a
  categoria do clube devedor) para estimar o valor.
- `--presumir-inicio` conta o primeiro clube conhecido desde os 12 anos. É uma hipótese: a fonte
  não diz quando o atleta chegou lá.
- CSV de outra fonte: colunas `atleta, nascimento, data, origem, destino, valor` (EUR), `;` ou `,`.

**Limites desta apuração**
- A base aberta cobre cerca de 50 mil atletas das principais ligas (inclui a Série A) e está
  **parada em 6/7/2026**; atletas de divisões menores entram pelo BID ou por CSV.
- Valores são estimativas públicas, não os do contrato. Empréstimos vêm com valor 0.
- País do clube só é conhecido para clubes das ligas cobertas; nos demais o âmbito sai "indefinido".
- O ano de idade é contado de aniversário a aniversário; o RSTP usa temporadas. Categoria do clube,
  renúncias, prazo e regulamento vigente na data do fato precisam de conferência caso a caso.
- O site do Transfermarkt bloqueia acesso automatizado e não é raspado; ogol, API Futebol e Base
  dos Dados não têm importador próprio (use `importar-csv`).

## 5. Boas práticas e legalidade
- Rate limit padrão de 2 s entre requisições, retentativas com backoff e **respeito ao robots.txt**.
  Não reduza o intervalo sem necessidade; confira os Termos de Uso do BID.
- Contém dados pessoais (inclusive de menores no histórico de base): LGPD se aplica — use com base
  legal definida (ex.: exercício regular de direitos), minimize e proteja a base `data/bid.sqlite`.
- HTML/JSON brutos ficam em `data/raw/` (gzip) para auditoria.

## 6. Estrutura
`bidscraper/` http · parsers · scraper · db · creditos · fontes · apuracao · export · cli — `tests/` (`python -m unittest discover -s tests -t .`).
