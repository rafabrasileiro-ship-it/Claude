'use strict';
/* Telas (menu, classes, cutscenes, placar, oficina, co-op), controles de toque/teclado e laço principal */
const UI = (() => {
  const $ = (s) => document.querySelector(s), ui = () => $('#ui');
  let last = 0, endT = 0;
  const esc = (s) => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const cName = (id) => (CLASSES.find(c => c.id === id) || { nome: '?' }).nome;
  function show(html, glass) { const u = ui(); u.innerHTML = html; u.className = 'show' + (glass ? ' glass' : ''); u.style.background = ''; u.scrollTop = 0; $('#ctl').classList.add('hide'); }
  function hide() { ui().className = ''; ui().innerHTML = ''; $('#ctl').classList.remove('hide'); sync(); }
  const head = (title, btn) => `<div class="bar"><h2>${title}</h2>${btn || ''}</div>`;   // título + botão de saída sempre visíveis
  function on(sel, fn) { ui().querySelectorAll(sel).forEach(el => el.addEventListener('click', (e) => { SFX.init(); SFX.ui(); fn(el, e); })); }

  /* ---------- menu ---------- */
  function menu() {
    if (NET.client) { NET.leave(true); loadMeta(); } else if (NET.host) NET.leave(false);
    G.mode = 'menu'; G.netClient = false; SFX.music(null);
    const cont = S && S.stage < 10 && S.mode !== 'arena';
    // grade do menu inicial: 2 colunas nas duas primeiras linhas, 5 na última (largura total da tela)
    show(`<div class="mm"><h1>BR-<span>APOCALIPSE</span></h1><div class="tag">Expresso Carnificina · 3.000 km de Bauru ao Mar</div>
      <div class="mgrid">
        <div class="btn go" data-a="novo">NOVA JORNADA<small>Bauru (SP) → Fortaleza (CE) · 10 cidades · 10 chefes de estrada</small></div>
        <div class="btn ${cont ? '' : 'dis'}" data-a="cont">CONTINUAR<small>${cont ? 'Oficina de ' + esc(S.stage === 0 ? 'Bauru' : STAGES[S.stage - 1].cidade) + ' · ' + esc(cName(S.cls)) + (S.mode !== 'normal' ? ' · ' + S.mode : '') : 'nenhuma jornada salva'}</small></div>
        <div class="btn" data-a="coop">CO-OP WI-FI (ATÉ 4 CELULARES)<small>Um celular é o Piloto e servidor da partida; os outros entram como Artilheiros</small></div>
        <div class="btn" data-a="modos">MODOS EXTRAS<small>${META.zerou ? 'Expresso da Meia-Noite · Fúria da Sucata · Rei da BR' : '🔒 chegue a Fortaleza para desbloquear'}</small></div>
        <div class="row5">
          <button data-a="conq">🏆 Conquistas<small>${Object.keys(META.ach).length} de ${Object.keys(CONQUISTAS).length}</small></button>
          <button data-o="gyro" class="${META.opts.gyro ? 'on' : ''}">📱 Giroscópio no volante<small>${META.opts.gyro ? 'ligado' : 'desligado'}</small></button>
          <button data-o="fpp" class="${META.opts.fpp ? 'on' : ''}">🔒 Travar em 1ª pessoa<small>${META.opts.fpp ? 'ligado' : 'desligado'}</small></button>
          <button data-o="vol">🔊 Volume<small>${Math.round(META.opts.vol * 100)}%</small></button>
          <button data-o="ajuda">❔ Controles<small>piloto e artilheiro</small></button>
        </div>
      </div>
      <div class="note">No jogo solo você controla 1 sobrevivente e troca entre VOLANTE e JANELA a qualquer momento (🔁); a IA assume os outros três.</div></div>`);
    on('[data-a]', (el) => { const a = el.dataset.a; if (a === 'novo') classes('normal'); else if (a === 'cont') { G.arena = false; garage(); } else if (a === 'coop') coop(); else if (a === 'modos') modos(); else conquistas(); });
    on('[data-o]', (el) => { const o = el.dataset.o; if (o === 'vol') { META.opts.vol = META.opts.vol >= 1 ? 0 : Math.round((META.opts.vol + 0.2) * 10) / 10; SFX.setVol(META.opts.vol); } else if (o === 'ajuda') return ajuda(menu); else { META.opts[o] = !META.opts[o]; if (o === 'gyro' && META.opts.gyro && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {}); } saveAll(); menu(); });
  }
  function ajuda(back) {
    show(`${head('CONTROLES', '<div class="btn" data-a="v">VOLTAR</div>')}<div class="gar"><div><h3>Piloto (volante)</h3><table class="big">
      <tr><td>◀ ▶ / A D / setas</td><td>Direção (ou giroscópio)</td></tr><tr><td>ACEL / W</td><td>Acelerador</td></tr><tr><td>FREIO / S</td><td>Freio e ré</td></tr>
      <tr><td>🅿 / Espaço</td><td>Freio de mão (cavalo de pau derruba zumbis das portas)</td></tr><tr><td>🔥 / F</td><td>Arma fixa do capô (linha reta)</td></tr>
      <tr><td>🪚 / C</td><td>Liga/desliga motosserras acopladas</td></tr><tr><td>🧽 / V</td><td>Limpador com esguicho</td></tr><tr><td>💡 / L</td><td>Farol baixo / alto</td></tr><tr><td>Toque no rádio / M</td><td>Troca de estação</td></tr></table></div>
      <div><h3>Artilheiro (janela)</h3><table class="big">
      <tr><td>Arrastar / mouse</td><td>Mira</td></tr><tr><td>FOGO / clique</td><td>Atira ou golpeia</td></tr><tr><td>🎯 / botão direito</td><td>Mira de ferro (ADS)</td></tr>
      <tr><td>🔪 / Q</td><td>Arma branca (toque de novo para trocar)</td></tr><tr><td>🔫 / G</td><td>Troca de arma de fogo</td></tr><tr><td>🙇 / X</td><td>Expor / agachar (recarrega em cobertura)</td></tr>
      <tr><td>💺 / Z · ↩ / B</td><td>Troca de assento · olhar para trás</td></tr><tr><td>1 2 3</td><td>Avisos ao piloto: esquerda, capô, direita</td></tr></table>
      <h3>Geral</h3><table class="big"><tr><td>🔁 / Tab</td><td>Troca Volante ⇄ Janela</td></tr><tr><td>📷 / P</td><td>1ª / 3ª pessoa</td></tr><tr><td>⚡ / E</td><td>Habilidade da classe (60s)</td></tr><tr><td>⏸ / Esc</td><td>Pausa</td></tr></table></div></div>`, G.mode === 'pause');
    on('[data-a]', back);
  }
  function conquistas() {
    show(`${head('CONQUISTAS E TROFÉUS', '<div class="btn" data-a="v">VOLTAR</div>')}<div class="list2">${Object.keys(CONQUISTAS).map(k => `<div class="item ${META.ach[k] ? 'ok' : ''}"><span>${META.ach[k] ? '🏆' : '🔒'} <b>${CONQUISTAS[k].nome}</b><small>${CONQUISTAS[k].desc}</small></span></div>`).join('')}
      ${META.arenaBest ? `<div class="item"><span>Rei da BR — melhor onda: <b>${META.arenaBest}</b></span></div>` : ''}</div>`);
    on('[data-a]', menu);
  }
  function modos(coopHost) {
    const l = META.zerou ? '' : 'dis';
    show(`<h2>MODOS EXTRAS</h2><div class="m2">
      <div class="btn ${l}" data-m="expresso">EXPRESSO DA MEIA-NOITE<small>Realismo brutal: 1ª pessoa travada, sem retícula, viagem 100% noturna sob chuva e neblina.</small></div>
      <div class="btn ${l}" data-m="furia">FÚRIA DA SUCATA (NEW GAME+)<small>Começa em Bauru de Scania Nível 5 com Canhão 30mm — triplo de hordas e blindados de gangue desde a primeira BR.</small></div>
      <div class="btn ${l}" data-m="arena">REI DA BR<small>Arena infinita no entroncamento da BR-153. Sucata a cada onda para comprar e reparar.</small></div>
      <div class="btn" data-m="v">VOLTAR</div></div>${META.zerou ? '' : '<div class="note">🔒 Embarque no último navio em Fortaleza para liberar.</div>'}`);
    on('[data-m]', (el) => el.dataset.m === 'v' ? (coopHost ? hostSetup() : menu()) : classes(el.dataset.m, coopHost));
  }
  function classes(mode, coopHost) {
    show(`${head('ESCOLHA SEU SOBREVIVENTE', '<div class="btn" data-c="">VOLTAR</div>')}${coopHost ? '<div class="note" style="text-align:left;margin:0 0 1.2vh">Você é o Piloto: abre a sala e dirige.</div>' : ''}<div class="cards">${CLASSES.map(c => card(c)).join('')}</div>`);
    on('[data-c]', (el) => {
      if (!el.dataset.c) return coopHost ? hostSetup() : menu();
      G.wave = 1; startRun(el.dataset.c, mode);
      if (coopHost) return openRoom();
      if (mode === 'arena') { G.role = 'pilot'; go(); } else intro();
    });
  }
  const card = (c, dis) => `<div class="card ${dis ? 'dis' : ''}" data-c="${c.id}"><div class="sw" style="background:linear-gradient(90deg,${c.sleeve},${c.skin},${c.glove})"></div><b>"${c.nome.toUpperCase()}"</b><i>${c.sub}</i><p><u>${c.papel}</u></p><p>🛡 ${c.passiva}</p><p>⚡ <b class="ab">${c.ativa}</b>: ${c.ativaDesc}</p>${dis ? '<p><b class="ab taken">JÁ ESCOLHIDO</b></p>' : ''}</div>`;
  function intro() {
    const lines = ['<em>BAURU (SP) — 72 horas depois do Carniça-26.</em>', 'Garagem subterrânea. Escuro. O rádio do carro estica chiados até sintonizar uma voz metálica:',
      '<q>Marinha do Brasil. Zona segura na Base Naval de Fortaleza. Cargueiros levando sobreviventes para as plataformas do Atlântico. O último navio zarpa em 10 dias.</q>',
      'Um compacto velho coberto de poeira. Escada no teto. Dezoito balas em cada revólver.',
      'Trovão cospe no chão: <q>Ou a gente empurra essa lata velha até o Ceará, ou vira comida de carniça aqui no interior. Escolham suas armas.</q>',
      'Facão. Lança. Porrete. <em>Mais de 3.000 km de BR.</em>'];
    G.mode = 'intro';
    show(`<div class="cut" id="cut"></div><div class="menu"><div class="btn go" data-a="go">GIRAR A CHAVE</div></div>`);
    let i = 0; const add = () => { const el = $('#cut'); if (!el || i >= lines.length) return; el.insertAdjacentHTML('beforeend', '<p>' + lines[i++] + '</p>'); ui().scrollTop = ui().scrollHeight; if (i === 2) SFX.static_(); setTimeout(add, 2100); }; add();
    on('[data-a]', (el) => { el.classList.add('dis'); el.innerHTML = 'O motor de arranque falha... falha de novo...'; let done = false; const fin = () => { if (done) return; done = true; G.role = 'pilot'; go(); }; SFX.starter(fin); setTimeout(fin, 3400); });
  }
  function go() { G.snap = JSON.stringify(S); hide(); NET.beforeStage(); startStage(); NET.stageStarted(); sync(); }

  /* ---------- co-op Wi-Fi ---------- */
  function nickField() { if (!META.nick) { META.nick = 'Sobrevivente ' + (10 + Math.random() * 89 | 0); saveAll(); } return `<div class="item"><span>Seu apelido<small>aparece para os outros jogadores</small></span><input id="nick" maxlength="16" value="${esc(META.nick)}"></div>`; }
  function readNick() { const el = $('#nick'); if (el && el.value.trim()) { META.nick = el.value.trim().slice(0, 16); saveAll(); } }
  function coop() {
    G.mode = 'coop';
    const ok = NET.available(), kind = NET.kind;
    show(`<h2>CO-OP WI-FI — ATÉ 4 CELULARES</h2>
      <div class="note" style="text-align:left">Todos na mesma rede Wi-Fi — ou ligados no roteador Wi-Fi (ponto de acesso) do celular do Piloto, sem precisar de internet.
      O celular do Piloto é o servidor da partida: ele dirige, gasta a sucata na oficina e salva a jornada. Os outros entram como Artilheiros nas janelas, caçamba e teto. Lugar vazio fica com a IA.</div>
      ${nickField()}
      <div class="m2">
        <div class="btn go ${ok ? '' : 'dis'}" data-a="host">CRIAR SALA<small>Você é o Jogador 1 — o Piloto</small></div>
        <div class="btn ${ok ? '' : 'dis'}" data-a="join">ENTRAR NUMA SALA<small>Você entra como Artilheiro</small></div>
        <div class="btn full" data-a="v">VOLTAR</div>
      </div>
      ${!ok ? '<div class="note">Rede local indisponível neste aparelho.</div>' : kind === 'tabs' ? '<div class="note">Modo de teste no navegador: abra este jogo em outra aba para simular outro celular.</div>' : ''}`);
    on('[data-a]', (el) => { readNick(); const a = el.dataset.a; if (a === 'host') hostSetup(); else if (a === 'join') joinScreen(); else menu(); });
  }
  function hostSetup() {
    G.mode = 'coop'; const cont = S && S.stage < 10 && S.mode !== 'arena', l = META.zerou ? '' : 'dis';
    show(`<h2>CRIAR SALA — QUAL VIAGEM?</h2><div class="m2">
      <div class="btn go" data-a="novo">NOVA JORNADA<small>Bauru → Fortaleza do zero</small></div>
      <div class="btn ${cont ? '' : 'dis'}" data-a="cont">CONTINUAR A MINHA JORNADA<small>${cont ? 'Oficina de ' + esc(S.stage === 0 ? 'Bauru' : STAGES[S.stage - 1].cidade) + ' · você dirige como ' + esc(cName(S.cls)) : 'nenhuma jornada salva'}</small></div>
      <div class="btn ${l}" data-a="modos">MODOS EXTRAS<small>${META.zerou ? 'Expresso da Meia-Noite · Fúria da Sucata · Rei da BR' : '🔒 chegue a Fortaleza para desbloquear'}</small></div>
      <div class="btn" data-a="v">VOLTAR</div></div>`);
    on('[data-a]', (el) => { const a = el.dataset.a; if (a === 'novo') classes('normal', true); else if (a === 'cont') { G.arena = false; openRoom(); } else if (a === 'modos') modos(true); else coop(); });
  }
  function openRoom() {
    if (!NET.startHost()) { show(`<h2>NÃO FOI POSSÍVEL CRIAR A SALA</h2><div class="tag">A porta de rede do jogo está ocupada. Feche outros apps e tente de novo.</div><div class="menu"><div class="btn" data-a="v">VOLTAR</div></div>`); on('[data-a]', coop); return; }
    lobbyHost();
  }
  function lobbyHost() {
    G.mode = 'lobby'; const L = NET.lobby(), humans = [S.cls].concat(L.players.filter(p => p.cls).map(p => p.cls)), free = CLASSES.filter(c => !humans.includes(c.id));
    const first = S.stage === 0 && !G.arena && !(S.tot && S.tot.t);
    show(`<h2>SALA DE CO-OP ABERTA</h2>
      <div class="item"><span>Endereço desta sala<small>Nos outros celulares: CO-OP WI-FI → ENTRAR NUMA SALA. A sala aparece sozinha; se não aparecer, digitem este endereço.</small></span><b class="suc">${esc(NET.myIp() || '—')}</b></div>
      <h3>Jogadores (${NET.count()}/4)</h3>
      <div class="list2"><div class="item ok"><span>🚗 ${esc(META.nick)} — ${esc(cName(S.cls))}<small>Piloto · servidor da partida</small></span></div>
      ${L.players.map(p => `<div class="item"><span>🎯 ${esc(p.name)} — ${p.cls ? esc(cName(p.cls)) : '<i>escolhendo sobrevivente…</i>'}<small>Artilheiro</small></span><button data-kick="${p.id}">REMOVER</button></div>`).join('')}
      ${free.slice(0, Math.max(0, 3 - L.players.length)).map(c => `<div class="item"><span>🤖 ${esc(c.nome)} (IA)<small>lugar livre — entra quem chegar, até no meio da estrada</small></span></div>`).join('')}</div>
      <div class="m2" style="margin-top:1.6vh"><div class="btn go" data-a="go">${first ? 'COMEÇAR A FUGA ▶' : G.arena ? 'IR PARA O MEGA-POSTO ▶' : 'IR PARA A OFICINA ▶'}</div><div class="btn" data-a="close">FECHAR A SALA</div></div>`);
    on('[data-kick]', (el) => NET.kick(+el.dataset.kick));
    on('[data-a]', (el) => { if (el.dataset.a === 'close') return menu(); if (first) intro(); else garage(); });
  }
  function joinScreen(err) {
    G.mode = 'join'; NET.scan(true);
    show(`${head('ENTRAR NUMA SALA', '<div class="btn" data-a="v">VOLTAR</div>')}${err ? `<div class="item" style="border-color:#c22a1a"><span>${esc(err)}</span></div>` : ''}
      <h3>Salas encontradas na rede</h3><div id="rooms"></div>
      <div class="item"><span>Digitar o endereço do Piloto<small>aparece na tela da sala do Piloto (ex.: 192.168.43.1)</small></span><input id="ip" inputmode="decimal" placeholder="192.168.0.10" value="${esc(META.lastIp || '')}"><button data-a="ip">ENTRAR</button></div>`);
    roomsList();
    on('[data-a]', (el) => { if (el.dataset.a === 'v') { NET.leave(true); return coop(); } const ip = ($('#ip').value || '').trim(); if (ip) { META.lastIp = ip; saveAll(); connect(ip); } });
  }
  function roomsList() {
    const box = $('#rooms'); if (!box) return; const rs = NET.rooms;
    box.innerHTML = rs.length ? '<div class="list2">' + rs.map(r => `<div class="item"><span>🚗 Sala de ${esc(r.name)}<small>${esc(r.ip)}</small></span><button data-ip="${esc(r.ip)}">ENTRAR</button></div>`).join('') + '</div>' : '<div class="note">Procurando salas na rede Wi-Fi… (o Piloto precisa estar com a sala aberta)</div>';
    box.querySelectorAll('[data-ip]').forEach(b => b.addEventListener('click', () => { SFX.init(); SFX.ui(); connect(b.dataset.ip); }));
  }
  function connect(ip) {
    G.mode = 'conn'; NET.scan(false); NET.join(ip);
    show(`<h2 style="text-align:center;margin-top:12vh">CONECTANDO…</h2><div class="tag">${esc(ip)}</div><div class="menu"><div class="btn" data-a="v">CANCELAR</div></div>`);
    on('[data-a]', () => { NET.leave(true); joinScreen(); });
  }
  function clientPick(err) {
    G.mode = 'cpick'; const L = NET.lobbyInfo || { host: {}, players: [] }; const taken = [L.host.cls].concat(L.players.filter(p => p.cls && p.cls !== NET.myCls).map(p => p.cls));
    show(`${head('ESCOLHA SEU SOBREVIVENTE', '<div class="btn" data-c="">SAIR DA SALA</div>')}${err ? `<div class="item" style="border-color:#c22a1a"><span>${esc(err)}</span></div>` : ''}
      <div class="note" style="text-align:left;margin:0 0 1.2vh">Você é Artilheiro na sala de ${esc(L.host.name || 'Piloto')} (${esc(cName(L.host.cls))} no volante).</div>
      <div class="cards">${CLASSES.map(c => card(c, taken.includes(c.id))).join('')}</div>`);
    on('[data-c]', (el) => { if (!el.dataset.c) return menu(); if (el.classList.contains('dis')) return; NET.pickCls(el.dataset.c); clientWait(); });
  }
  function playersHtml(L) {
    if (!L) return '';
    const rows = [`<div class="item ok"><span>🚗 ${esc(L.host.name)} — ${esc(cName(L.host.cls))}<small>Piloto</small></span></div>`]
      .concat(L.players.map(p => `<div class="item ${p.cls === NET.myCls ? 'ok' : ''}"><span>🎯 ${esc(p.name)}${p.cls === NET.myCls ? ' (você)' : ''} — ${p.cls ? esc(cName(p.cls)) : '<i>escolhendo…</i>'}<small>Artilheiro</small></span></div>`));
    return `<h3>Na sala</h3><div class="list2">${rows.join('')}</div>`;
  }
  function clientWait(txt) {
    G.mode = 'cwait';
    show(`<h2>${esc(txt || 'AGUARDANDO O PILOTO…')}</h2><div class="note" style="text-align:left">Você é ${esc(cName(NET.myCls))}. A partida começa no seu celular assim que o Piloto pegar a estrada.</div>
      ${playersHtml(NET.lobbyInfo)}<div class="menu" style="margin-top:2vh"><div class="btn" data-a="x">SAIR DA SALA</div></div>`);
    on('[data-a]', menu);
  }
  function clientGarage() {
    const g = NET.garageInfo; if (!g) return clientWait(); G.mode = 'cwait';
    show(`<h2>OFICINA — ${esc(g.aqui.toUpperCase())}</h2>
      <div class="item"><span>O Piloto está gastando a sucata na oficina…<small>${esc(g.veh)} · ${esc(g.classe)} · blindagem ${g.armor}%</small></span><b class="suc">${g.sucata} ⚙</b></div>
      <div class="note" style="text-align:left"><b>${g.arena ? 'Próxima onda: ' + g.wave : 'Próximo trecho: ' + esc(g.estrada) + ' → ' + esc(g.prox)}</b>${g.arena ? '' : '<br>' + esc(g.intro)}</div>
      ${playersHtml(NET.lobbyInfo)}<div class="menu" style="margin-top:2vh"><div class="btn" data-a="x">SAIR DA SALA</div></div>`);
    on('[data-a]', menu);
  }
  function clientGo() { hide(); startStage(); G.netClient = true; G.snapInit = false; G.ents = []; G.boss = null; G.haz = []; G.role = 'gunner'; sync(); }
  function lostScreen(why) {
    G.mode = 'lost'; G.netClient = false; SFX.engine(0, 0, false); SFX.saw(false, 0); SFX.wind(0, false); SFX.music(null);
    show(`<h2 style="text-align:center;margin-top:10vh">FIM DO CO-OP</h2><div class="tag">${esc(why || 'Conexão perdida.')}</div><div class="menu"><div class="btn go" data-a="m">MENU</div></div>`);
    on('[data-a]', menu);
  }
  function netEvent(k, d) {
    if (k === 'rooms') { if (G.mode === 'join') roomsList(); }
    else if (k === 'fail') { if (G.mode === 'conn' || G.mode === 'join') joinScreen('Não deu para conectar. Confiram se estão na mesma rede Wi-Fi e se o endereço está certo.'); }
    else if (k === 'welcome') clientPick();
    else if (k === 'lobby') {
      if (NET.host) { if (G.mode === 'lobby') lobbyHost(); else if (G.mode === 'garage') { const y = ui().scrollTop; garage(); ui().scrollTop = y; } }
      else if (d) clientPick(d); else if (G.mode === 'cpick') clientPick(); else if (G.mode === 'cwait') { if (NET.garageInfo) clientGarage(); else clientWait(); }
    }
    else if (k === 'garage') clientGarage();
    else if (k === 'score') renderScore(d.rows, d, true);
    else if (k === 'over') clientOver(d);
    else if (k === 'end') { META.zerou = true; saveAll(); G.mode = 'end'; ending(); }
    else if (k === 'lost') lostScreen(d);
  }

  /* ---------- placar ---------- */
  function score() {
    const s = G.stats, st = G.st, limpo = s.over === 0 && s.acid === 0; if (limpo) S.sucata += 60;
    saveAll();
    const acc = s.shots ? Math.round(100 * s.hitsN / s.shots) + '%' : '';
    const rows = [{ cls: S.cls, nome: META.nick || 'Piloto', papel: G.role === 'pilot' ? 'Piloto' : 'Artilheiro', carne: (s.kills * 0.075).toFixed(1) + ' t (' + s.kills + ')', abalro: s.abalro, abates: s.gk, heads: s.heads + (acc ? ' (' + acc + ')' : ''), amput: s.amput, vex: s.vex, salva: s.salva }]
      .concat(NET.peerRows())
      .concat(G.ai.map((a, i) => ({ cls: a.cls.id, ia: true, nome: a.cls.nome + ' (IA)', papel: G.role !== 'pilot' && i === 0 ? 'Piloto' : 'Artilheiro', carne: '—', abalro: '—', abates: a.kills, heads: a.heads, amput: '—', vex: '—', salva: a.salva })));
    const x = { cidade: st.cidade, uf: st.uf, saque: st.saque || st.cidade, premio: st.premio, ganho: Math.round(s.sucata + s.premio + (limpo ? 60 : 0)), limpo, over: s.over, acid: s.acid, tempo: Math.round(s.t), kmFim: st.kmFim };
    NET.hostScore(rows, x); renderScore(rows, x, false);
  }
  function renderScore(rows, x, client) {
    G.mode = client ? 'cwait' : 'score';
    const mine = (r, i) => client ? (!r.ia && r.cls === NET.myCls && i > 0) : i === 0;
    show(`${head('FIM DE ESTRADA — ' + esc(String(x.cidade).toUpperCase()) + ' (' + esc(x.uf) + ')', client ? '<div class="btn" data-a="x">SAIR DA SALA</div>' : '<div class="btn go" data-a="g">ENTRAR NA OFICINA ▶</div>')}
      <table><tr><th>Sobrevivente</th><th>Função</th><th>Carne moída</th><th>Abalroados</th><th>Abates</th><th>Headshots</th><th>Amputações</th><th>Veíc. explodidos</th><th>Salva-vidas</th></tr>
      ${rows.map((r, i) => `<tr class="${mine(r, i) ? 'me' : ''}"><td>${mine(r, i) ? '<b>VOCÊ — ' + esc(cName(r.cls)) + '</b>' : esc(r.nome) + (r.ia ? '' : ' — ' + esc(cName(r.cls)))}</td><td>${esc(r.papel)}</td><td>${esc(r.carne)}</td><td>${esc(r.abalro)}</td><td>${esc(r.abates)}</td><td>${esc(r.heads)}${mine(r, i) && client && G.stats.shots ? ' (' + Math.round(100 * G.stats.hitsN / G.stats.shots) + '%)' : ''}</td><td>${esc(r.amput)}</td><td>${esc(r.vex)}</td><td>${esc(r.salva)}</td></tr>`).join('')}</table>
      <h3>Recompensa do grupo</h3>
      <div class="item"><span>Sucata recolhida na estrada + saque em ${esc(x.saque)}<small>${x.limpo ? 'Bônus de Direção Limpa: +60 (sem ferver o motor, sem atropelar Boiadeiro)' : 'Sem bônus de direção limpa' + (x.over ? ' · motor ferveu ' + x.over + 'x' : '') + (x.acid ? ' · ' + x.acid + ' banho(s) de ácido' : '')}</small></span><b class="suc">+${x.ganho} ⚙</b></div>
      <div class="item ok"><span>🔓 DESBLOQUEADO: ${esc(x.premio)}</span></div>
      <div class="item"><span>Tempo de estrada: ${Math.floor(x.tempo / 60)}min ${x.tempo % 60}s · Faltam ${x.kmFim} km até Fortaleza</span></div>
      ${client ? '<div class="note">Aguardando o Piloto entrar na oficina…</div>' : ''}`);
    on('[data-a]', (el) => el.dataset.a === 'g' ? garage() : menu());
  }

  /* ---------- oficina ---------- */
  function garage() {
    G.mode = 'garage'; const city = cityLevel(), arena = G.arena, V = vstats(), next = arena ? ARENA : STAGES[S.stage];
    if (!arena && S.stage >= 10) return menu();
    const it = (nome, sub, custo, ok, act, owned) => `<div class="item ${owned ? 'ok' : ''}"><span>${nome}<small>${sub}</small></span>${owned ? '<b>✔</b>' : `<button class="${ok && S.sucata >= custo ? '' : 'no'}" data-buy="${act}">${custo} ⚙</button>`}</div>`;
    let veh = ''; for (let n = 2; n <= 5; n++) { const v = VEHICLES[n]; if (v.city > city && S.veh < n) { if (v.city === city + 1) veh += `<div class="item"><span>🔒 ${v.nome}<small>${v.classe} · libera na próxima cidade</small></span></div>`; continue; } veh += it(v.nome, `${v.classe} · blindagem ${v.armor} · ${v.vmax} km/h · ${v.seats.join(' / ')}`, v.custo, S.veh < n, 'veh:' + n, S.veh >= n); }
    let ups = ''; for (const k in UPGRADES) { const u = UPGRADES[k], lv = S.up[k], nx = u.niv[lv]; if (lv > 0) ups += it(u.niv[lv - 1].nome, u.nome + ' · instalado', 0, false, '', true); if (nx) { if (nx.city > city) { if (nx.city <= city + 1) ups += `<div class="item"><span>🔒 ${nx.nome}<small>${u.nome} · libera em ${esc((STAGES[nx.city - 1] || {}).cidade || '')}</small></span></div>`; } else ups += it(nx.nome, u.nome + (nx.veh && S.veh < nx.veh ? ' · exige veículo Nível ' + nx.veh : ''), nx.custo, !(nx.veh && S.veh < nx.veh), 'up:' + k, false); } }
    let capo = ''; const cl = S.up.capo, cn = CAPO[cl + 1]; if (cl > 0) capo += it(CAPO[cl].nome, 'Arma fixa do capô · instalada', 0, false, '', true); if (cn && cn.city <= city && cn.custo > 0) capo += it(cn.nome, 'Arma fixa do Piloto' + (S.veh < cn.veh ? ' · exige veículo Nível ' + cn.veh : ''), cn.custo, S.veh >= cn.veh, 'capo', false); else if (cl === 0) capo += `<div class="item"><span>🔒 Arma fixa do capô<small>libera em Uberlândia</small></span></div>`;
    let am = ''; for (const k in AMMO) { const a = AMMO[k]; if ((k === 'cartucho' && city < 1) || (k === 'fuzil' && city < 4) || (k === 'pesada' && city < 6)) continue; am += it(a.nome, `em estoque: ${S.ammo[k]} / ${ammoMax(k)} · +${a.pack}`, a.custo, S.ammo[k] < ammoMax(k), 'ammo:' + k, false); }
    const miss = 1 - S.armorFrac, rep = Math.ceil(miss * V.armorMax * 0.5);
    const arm = usableWeapons().map(k => WEAPONS[k].nome).join(' · '), mel = usableMelee().map(k => MELEE[k].nome).join(' · ');
    const sala = NET.host ? `<div class="note" style="text-align:left;margin:0 0 1vh">📶 Sala aberta em <b>${esc(NET.myIp())}</b> · ${NET.count()}/4 jogadores: ${[esc(META.nick) + ' (' + esc(cName(S.cls)) + ')'].concat(NET.lobby().players.map(p => esc(p.name) + ' (' + (p.cls ? esc(cName(p.cls)) : 'escolhendo') + ')')).join(', ')} · lugares vazios com IA</div>` : '';
    show(`<div class="bar"><div><h2 style="margin:0">OFICINA — ${esc(arena ? 'MEGA-POSTO BR-153' : S.stage === 0 ? 'BAURU' : STAGES[S.stage - 1].cidade.toUpperCase())}</h2></div><div class="suc">${Math.round(S.sucata)} ⚙ sucata</div><div class="btn go" data-a="go" style="padding:1.6vh 2vw">${arena ? 'ONDA ' + G.wave + ' ▶' : 'PEGAR A ESTRADA → ' + esc(next.cidade.toUpperCase()) + ' ▶'}</div></div>
      ${sala}<canvas id="gcv" width="900" height="220"></canvas>
      <div class="note" style="text-align:left;margin:1vh 0">${esc(V.v.nome)} · blindagem ${Math.round(S.armorFrac * 100)}% de ${V.armorMax} · <b>Arsenal:</b> ${arm} · <b>Corpo a corpo:</b> ${mel}${arena ? '' : '<br><b>Próximo trecho:</b> ' + esc(next.estrada) + ' — ' + esc(next.intro)}</div>
      <div class="gar"><div><h3>Reparo e munição</h3>${miss > 0.01 ? it('Soldar a lataria', `repara ${Math.round(miss * 100)}% da blindagem (buracos de bala, portas amassadas)`, rep, true, 'rep', false) : it('Lataria inteira', 'nada a reparar', 0, false, '', true)}${am}<h3>Arma fixa do capô</h3>${capo}<h3>Veículos</h3>${veh}</div>
      <div><h3>Modificações estruturais</h3>${ups}</div></div>
      <div class="menu" style="margin-top:2vh"><div class="btn" data-a="menu">${NET.host ? 'FECHAR A SALA E VOLTAR AO MENU' : 'SALVAR E VOLTAR AO MENU'}</div></div>`);
    drawGarage(); NET.hostGarage();
    on('[data-buy]', (el) => { const [k, a] = el.dataset.buy.split(':'); let custo = 0;
      if (k === 'veh') { custo = VEHICLES[+a].custo; S.veh = +a; S.armorFrac = 1; }
      else if (k === 'up') { custo = UPGRADES[a].niv[S.up[a]].custo; S.up[a]++; }
      else if (k === 'capo') { custo = CAPO[S.up.capo + 1].custo; S.up.capo++; }
      else if (k === 'ammo') { custo = AMMO[a].custo; S.ammo[a] = Math.min(ammoMax(a), S.ammo[a] + AMMO[a].pack); }
      else if (k === 'rep') { custo = Math.min(rep, Math.floor(S.sucata)); S.armorFrac = Math.min(1, S.armorFrac + (custo / Math.max(1, rep)) * miss); }
      if (S.sucata < custo) return; S.sucata -= custo; SFX.buy(); saveAll(); const y = ui().scrollTop; garage(); ui().scrollTop = y; });
    on('[data-a]', (el) => { if (el.dataset.a === 'menu') { saveAll(); menu(); } else go(); });
  }
  function drawGarage() {
    const g = $('#gcv'); if (!g) return; const cw = Math.max(300, g.clientWidth), ch = Math.max(100, g.clientHeight), dpr = Math.min(2, window.devicePixelRatio || 1); g.width = cw * dpr; g.height = ch * dpr; const x = g.getContext('2d'); const sc = ch / 220; x.setTransform(dpr * sc, 0, 0, dpr * sc, 0, 0); const VW = cw / sc; x.fillStyle = '#120e09'; x.fillRect(0, 0, VW, 220); x.fillStyle = '#1c1610'; x.fillRect(0, 180, VW, 40); x.translate((VW - 900) / 2, 0);
    x.fillStyle = 'rgba(232,176,32,0.07)'; x.beginPath(); x.moveTo(380, 0); x.lineTo(520, 0); x.lineTo(700, 220); x.lineTo(200, 220); x.fill();
    x.save(); x.translate(450, 186); x.scale(52, 52); DRAW.playerCar(x, S.veh, S.up, 0, false, 0); x.restore();
    const dmg = Math.round((1 - S.armorFrac) * 14); x.fillStyle = '#0a0a0a'; for (let i = 0; i < dmg; i++) { x.beginPath(); x.arc(400 + DRAW.hash(i * 3) * 100, 110 + DRAW.hash(i * 7) * 60, 3, 0, 7); x.fill(); }
    x.fillStyle = '#7a0a0a'; if (S.up.serra || S.up.lateral >= 2) for (let i = 0; i < 6; i++) x.fillRect(380 + i * 26, 182, 8, 4);
    x.fillStyle = '#c9a060'; x.font = 'bold 16px Arial'; x.textAlign = 'left'; x.fillText(VEHICLES[S.veh].classe, 20, 30); x.font = '13px Arial'; x.fillStyle = '#9a8c70';
    const mods = Object.keys(UPGRADES).filter(k => S.up[k] > 0).map(k => UPGRADES[k].niv[S.up[k] - 1].nome); mods.slice(0, 8).forEach((m, i) => x.fillText('• ' + m, 20, 54 + i * 18)); if (S.up.capo) x.fillText('• ' + CAPO[S.up.capo].nome, 640, 54);
  }

  function over(why) {
    NET.hostOver(why);
    show(`<h2 style="color:#c22a1a;font-size:12vh;text-align:center;margin-top:6vh">FIM DA LINHA</h2><div class="tag">${esc(why)}<br>${G.arena ? 'Vocês seguraram o posto até a ONDA ' + G.wave + '.' : 'A ' + esc(G.st.estrada) + ' ficou com mais uma carcaça.'}</div>
      <div class="m2"><div class="btn go" data-a="r">${G.arena ? 'TENTAR DE NOVO' : 'VOLTAR À OFICINA E TENTAR DE NOVO'}</div><div class="btn" data-a="m">${NET.host ? 'FECHAR A SALA E VOLTAR AO MENU' : 'MENU'}</div></div>`, true);
    on('[data-a]', (el) => { if (el.dataset.a === 'm') { if (G.snap && !G.arena) { S = JSON.parse(G.snap); saveAll(); } return menu(); } if (G.arena) { G.wave = 1; startRun(S.cls, 'arena'); return garage(); } S = JSON.parse(G.snap); saveAll(); garage(); });
  }
  function clientOver(m) {
    G.mode = 'cwait';
    show(`<h2 style="color:#c22a1a;font-size:12vh;text-align:center;margin-top:6vh">FIM DA LINHA</h2><div class="tag">${esc(m.why)}<br>${m.arena ? 'O grupo segurou o posto até a ONDA ' + m.wave + '.' : 'A ' + esc(m.estrada) + ' ficou com mais uma carcaça.'}</div>
      <div class="note">Aguardando o Piloto decidir se tenta de novo…</div><div class="menu"><div class="btn" data-a="x">SAIR DA SALA</div></div>`, true);
    on('[data-a]', menu);
  }
  function pause() {
    if (G.netClient) {   // no co-op o Artilheiro não para a partida: só abre o menu por cima
      if (G.mode !== 'play' || ui().classList.contains('show')) return;
      show(`<h2 style="text-align:center;margin-top:10vh">MENU</h2><div class="note" style="margin-bottom:2vh">A partida continua no celular do Piloto.</div><div class="m2"><div class="btn go" data-a="c">VOLTAR AO JOGO</div><div class="btn" data-a="h">CONTROLES</div><div class="btn full" data-a="x">SAIR DA SALA</div></div>`, true);
      on('[data-a]', (el) => { const a = el.dataset.a; if (a === 'c') hide(); else if (a === 'h') ajuda(() => { hide(); pause(); }); else menu(); });
      return;
    }
    if (G.mode !== 'play') return; G.mode = 'pause'; NET.hostPause(true); SFX.engine(0, 0, false); SFX.saw(false, 0); SFX.wind(0, false);
    show(`<h2 style="text-align:center;margin-top:10vh">PAUSA</h2><div class="m2"><div class="btn go" data-a="c">CONTINUAR</div><div class="btn" data-a="h">CONTROLES</div><div class="btn full" data-a="m">ABANDONAR O TRECHO (volta ao menu${NET.host ? ' e fecha a sala' : ''})</div></div>`, true);
    on('[data-a]', (el) => { const a = el.dataset.a; if (a === 'c') { G.mode = 'play'; NET.hostPause(false); hide(); } else if (a === 'h') ajuda(() => { G.mode = 'play'; pause(); }); else { if (G.snap && !G.arena) { S = JSON.parse(G.snap); saveAll(); } menu(); } });
  }
  function ending() {
    NET.hostEnd();
    endT = 0; show(`<div class="cut" id="cut" style="margin-top:46vh;min-height:20vh;text-align:center;text-shadow:0 2px 6px #000"></div><div class="menu hide" id="endb"><div class="btn go" data-a="m">${NET.client || NET.host ? 'SAIR DA SALA — ' : ''}MENU · MODOS EXTRAS DESBLOQUEADOS</div></div>`, true); ui().style.background = 'transparent';
    const lines = ['O caminhão cai pesado no convés de aço. Motor fumegando. Vidro por todo o painel.', 'Quatro sobreviventes. Mais de 3.000 km. Dez chefes de estrada no ferro-velho.', 'O litoral brasileiro em chamas some atrás das ondas, ao som de uma viola distorcida.', `<em>DE BAURU AO MAR.</em> ${S.tot.kills} infectados atropelados em ${Math.round(S.tot.t / 60)} minutos de asfalto.`];
    let i = 0; const add = () => { const el = $('#cut'); if (!el) return; if (i >= lines.length) { $('#endb').classList.remove('hide'); return; } el.innerHTML = '<p>' + lines[i++] + '</p>'; setTimeout(add, 4200); }; setTimeout(add, 1200); SFX.music('viola');
    on('[data-a]', () => { ui().style.background = ''; menu(); });
  }
  function drawEnding(dt) {
    endT += dt; const cv = $('#cv'), c = cv.getContext('2d'), W = cv.width, H = cv.height, t = endT;
    const g = c.createLinearGradient(0, 0, 0, H * 0.55); g.addColorStop(0, '#0a0c1a'); g.addColorStop(1, '#c2501a'); c.fillStyle = g; c.fillRect(0, 0, W, H * 0.55);
    c.fillStyle = '#0a0806'; const cx = W * 0.5 - t * 6; for (let i = 0; i < 14; i++) c.fillRect(cx - 300 + i * 46, H * 0.55 - 16 - DRAW.hash(i) * 40, 34, 60);
    for (let i = 0; i < 9; i++) { c.fillStyle = `rgba(255,${120 + Math.sin(t * 7 + i) * 50 | 0},20,0.8)`; c.beginPath(); c.arc(cx - 280 + i * 70, H * 0.55 - 30 - DRAW.hash(i * 3) * 30, 10 + Math.sin(t * 9 + i * 2) * 4, 0, 7); c.fill(); }
    c.fillStyle = '#0c1c2e'; c.fillRect(0, H * 0.55, W, H * 0.45); c.strokeStyle = 'rgba(255,160,80,0.25)'; for (let i = 0; i < 24; i++) { const y = H * 0.57 + i * H * 0.018, x = (i * 97 + t * 30) % W; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 50, y); c.stroke(); }
    const sx = W * 0.35 + t * 8, sy = H * 0.66 + Math.sin(t * 1.2) * 4; c.fillStyle = '#2c3238'; c.beginPath(); c.moveTo(sx - 150, sy); c.lineTo(sx - 130, sy + 34); c.lineTo(sx + 150, sy + 34); c.lineTo(sx + 190, sy); c.fill(); c.fillStyle = '#3a4046'; c.fillRect(sx + 40, sy - 40, 70, 40); c.fillRect(sx + 62, sy - 62, 14, 22); c.fillStyle = '#a3321f'; c.fillRect(sx - 80, sy - 16, 44, 16); c.fillStyle = '#c22'; c.fillRect(sx - 150, sy + 22, 330, 4);
  }

  /* ---------- controles ---------- */
  function sync() {
    const play = G.mode === 'play'; if (!play) return; const pil = G.role === 'pilot';
    $('#pilot').classList.toggle('hide', !pil); $('#gunner').classList.toggle('hide', pil);
    $('#bRole').textContent = pil ? '🔁 IR P/ JANELA' : '🔁 PEGAR VOLANTE'; $('#bRole').classList.toggle('hide', !!G.netClient); $('#bCam').classList.toggle('hide', !pil);
    $('#bSaw').classList.toggle('on', !!P.saws); $('#bExp').classList.toggle('on', !A.exposed); $('#bExp').innerHTML = A.exposed ? '🙇<small>AGACHAR</small>' : '🧍<small>EXPOR</small>';
    $('#bMelee').classList.toggle('on', !!A.useMelee); $('#bAds').classList.toggle('on', !!I.ads);
  }
  function tick() {
    const ab = $('#bAbil'); if (S && G.mode === 'play') { const cd = G.abil.cd > 0; ab.classList.toggle('cd', cd && G.abil.on <= 0); ab.textContent = G.abil.on > 0 ? '⚡' + Math.ceil(G.abil.on) : cd ? Math.ceil(G.abil.cd) + 's' : '⚡ ' + cls().ativa; }
    const q = $('#qte'); if (G.qte && G.mode === 'play') { q.classList.remove('hide'); q.textContent = G.qte.txt + ' ' + Math.max(0, G.qte.t).toFixed(1); } else q.classList.add('hide');
    if (G.frame % 15 === 0) sync();
  }
  const steerKeys = { l: 0, r: 0 };
  function setSteer() { I.steer = steerKeys.r - steerKeys.l; }
  function bind() {
    const ACT = { pause, toggleRole, toggleCam, useAbility, qtePress, pressWiper, toggleLights, toggleSaws, toggleExpose, nextSeat, toggleLook, startReload, cycleWeapon, toggleMelee };
    document.querySelectorAll('#ctl button').forEach(b => {
      const d = b.dataset;
      const down = (e) => { e.preventDefault(); SFX.init(); if (d.act) { ACT[d.act](); sync(); } if (d.hold) I[d.hold] = 1; if (d.steer) { steerKeys[d.steer < 0 ? 'l' : 'r'] = 1; setSteer(); } if (d.toggle) { I[d.toggle] = I[d.toggle] ? 0 : 1; sync(); } if (d.ping !== undefined) pingAI(+d.ping); try { b.setPointerCapture(e.pointerId); } catch (x) {} };
      const up = (e) => { e.preventDefault(); if (d.hold) I[d.hold] = 0; if (d.steer) { steerKeys[d.steer < 0 ? 'l' : 'r'] = 0; setSteer(); } };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('contextmenu', e => e.preventDefault());
    });
    const cv = $('#cv'); let drag = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * G.W / r.width, (e.clientY - r.top) * G.H / r.height]; };
    cv.addEventListener('pointerdown', (e) => { SFX.init(); if (G.mode !== 'play') return; const [x, y] = pos(e);
      if (G.role === 'pilot') { const r = G.radioRect; if (G.cam === 'fpp' && r && x > r[0] && x < r[0] + r[2] && y > r[1] && y < r[1] + r[3]) nextRadio(); return; }
      if (e.pointerType === 'mouse') { A.ax = x; A.ay = y; if (e.button === 2) I.ads = 1; else I.fire = 1; } else drag = { id: e.pointerId, x, y }; });
    cv.addEventListener('pointermove', (e) => { if (G.mode !== 'play' || G.role !== 'gunner') return; const [x, y] = pos(e); if (e.pointerType === 'mouse') { A.ax = x; A.ay = y; } else if (drag && drag.id === e.pointerId) { const s = I.ads ? 0.7 : 1.25; A.ax += (x - drag.x) * s; A.ay += (y - drag.y) * s; drag.x = x; drag.y = y; } });
    const pu = (e) => { if (e.pointerType === 'mouse') { if (e.button === 2) I.ads = 0; else I.fire = 0; } else if (drag && drag.id === e.pointerId) drag = null; };
    cv.addEventListener('pointerup', pu); cv.addEventListener('pointercancel', pu); cv.addEventListener('contextmenu', e => e.preventDefault());
    const KD = { KeyW: 'gas', ArrowUp: 'gas', KeyS: 'brake', ArrowDown: 'brake', Space: 'hand' };
    const KA = { KeyC: toggleSaws, KeyV: pressWiper, KeyL: toggleLights, KeyE: useAbility, Tab: toggleRole, KeyP: toggleCam, KeyR: startReload, KeyQ: toggleMelee, KeyX: toggleExpose, KeyZ: nextSeat, KeyB: toggleLook, KeyG: cycleWeapon, KeyK: qtePress, KeyM: nextRadio, Escape: pause, Digit1: () => pingAI(-1), Digit2: () => pingAI(0), Digit3: () => pingAI(1) };
    window.addEventListener('keydown', (e) => { SFX.init(); if (G.mode !== 'play' || ui().classList.contains('show')) return; if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); if (e.repeat) return;
      if (KD[e.code]) I[KD[e.code]] = 1; else if (e.code === 'KeyA' || e.code === 'ArrowLeft') { steerKeys.l = 1; setSteer(); } else if (e.code === 'KeyD' || e.code === 'ArrowRight') { steerKeys.r = 1; setSteer(); } else if (e.code === 'KeyF') I.fire = 1; else if (KA[e.code]) { if (G.qte && e.code !== 'Escape') qtePress(); KA[e.code](); sync(); } });
    window.addEventListener('keyup', (e) => { if (KD[e.code]) I[KD[e.code]] = 0; else if (e.code === 'KeyA' || e.code === 'ArrowLeft') { steerKeys.l = 0; setSteer(); } else if (e.code === 'KeyD' || e.code === 'ArrowRight') { steerKeys.r = 0; setSteer(); } else if (e.code === 'KeyF') I.fire = 0; });
    // giroscópio: inclinação do eixo longo do celular (sin(beta) não sofre o salto de ±180° quando a tela passa da vertical)
    window.addEventListener('deviceorientation', (e) => { if (!META.opts.gyro || e.beta == null) { I.tilt = 0; return; } const a = (screen.orientation && screen.orientation.angle != null) ? screen.orientation.angle : (window.orientation || 0); const sb = Math.sin(e.beta * Math.PI / 180); let v = a === 90 ? sb : (a === 270 || a === -90) ? -sb : -Math.sin((e.gamma || 0) * Math.PI / 180); v /= 0.44; if (Math.abs(v) < 0.07) v = 0; I.tilt = clamp(v, -1, 1); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('blur', () => { I.gas = I.brake = I.hand = I.fire = 0; steerKeys.l = steerKeys.r = 0; setSteer(); });
  }
  function loop(now) {
    requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    try { NET.pump(); } catch (e) { console.error(e); }
    if (G.mode === 'play') { if (G.netClient) clientUpdate(dt); else update(dt); if (G.mode === 'play' || G.mode === 'score' || G.mode === 'over') RENDER.frame(); tick(); }
    else if (G.mode === 'end') drawEnding(dt);
    try { NET.tick(); } catch (e) { console.error(e); }
  }
  function boot() { loadMeta(); if (/[?&]unlock/.test(location.search)) META.zerou = true; SFX.setVol(META.opts.vol); RENDER.init($('#cv')); bind(); menu(); requestAnimationFrame(loop); }
  window.UI_pause = () => pause();
  window.addEventListener('load', boot);
  return { menu, score, garage, over, ending, sync, pause, go, clientGo, netEvent };
})();
