'use strict';
/* BR-APOCALIPSE — dados do jogo: classes, armas, veículos, cidades, chefes */

const CLASSES = [
  { id: 'trovao', nome: 'Trovão', sub: 'Ex-Caminhoneiro da Rondon', papel: 'Piloto ou Artilheiro Pesado',
    passiva: 'Mestre do Asfalto: 25% menos perda de velocidade ao atropelar hordas, motor demora mais para ferver e menos chacoalhão.',
    ativa: 'Pé no Porão', ativaDesc: 'Turbo improvisado por 8s: dano de impacto e das motosserras do carro em dobro.',
    dur: 8, skin: '#a8703f', glove: '#4a2f1a', sleeve: '#6d2b1c', hair: true,
    falas: ['Segura que o pai tá on!', 'Isso aqui já rodou mais que notícia ruim!', 'Pé no porão, cambada!'] },
  { id: 'graxa', nome: 'Graxa', sub: 'Mecânica e Soldadora de Ferro-Velho', papel: 'Piloto ou Combate Próximo',
    passiva: 'Gambiarra de Mestre: armas brancas +40% de dano; motosserras não travam, gastam 30% menos e dobram o dano em carros de bandidos.',
    ativa: 'Solda a Frio', ativaDesc: 'Restaura 25% da blindagem, conserta radiador e pneus sem parar o carro.',
    dur: 1, skin: '#8a5a3c', glove: '#3b3b36', sleeve: '#2f4d7a', hair: false,
    falas: ['Na gambiarra a gente chega!', 'Solda segurando, pode acelerar!', 'Arruma depois, corta agora!'] },
  { id: 'falcao', nome: 'Falcão', sub: 'Ex-Agente Tático da PRF', papel: 'Artilheiro de Precisão',
    passiva: 'Treinamento de Choque: recarrega 35% mais rápido e tem metade do recuo na Mira de Ferro.',
    ativa: 'Tiro de Interdição', ativaDesc: 'Por 6s os pontos fracos brilham em vermelho e os tiros perfuram blindagem.',
    dur: 6, skin: '#c99872', glove: '#111214', sleeve: '#4b5a3a', hair: false,
    falas: ['Alvo na mira.', 'Abordagem encerrada.', 'Interdição autorizada!'] },
  { id: 'cobra', nome: 'Cobra', sub: 'Ex-Fuzileiro, Especialista em Demolição', papel: 'Artilheiro de Torreta Pesada',
    passiva: 'Arsenal Pesado: torretas e armas fixas demoram o dobro para superaquecer e o grupo carrega 25% mais munição pesada.',
    ativa: 'Munição Incendiária', ativaDesc: 'Por 8s todos os seus disparos explodem e incendeiam.',
    dur: 8, skin: '#7a4b34', glove: '#d8d2c4', sleeve: '#2b2b2b', hair: false,
    falas: ['Vai virar churrasco!', 'Fita incendiária carregada!', 'ADSUMUS, carniça!'] },
];

/* armas de mão / torretas dos artilheiros */
const WEAPONS = {
  rev38: { nome: 'Revólver .38 SPL', cat: 'pistola', dmg: 36, rof: 2.4, mag: 6, reload: 2.6, spread: 12, pen: 1, ammo: 'leve', city: 0, recoil: 9 },
  pist9: { nome: 'Pistola 9mm', cat: 'pistola', dmg: 28, rof: 5.5, mag: 15, reload: 1.5, spread: 11, pen: 1, ammo: 'leve', city: 1, recoil: 6 },
  cal20: { nome: 'Espingarda Cal. 20', cat: 'escopeta', dmg: 95, rof: 1.2, mag: 5, reload: 2.6, spread: 20, pen: 1, ammo: 'cartucho', city: 1, sg: 60, recoil: 22 },
  smg9: { nome: 'Submetralhadora MT-12 9mm', cat: 'smg', dmg: 21, rof: 11, mag: 32, reload: 2, spread: 16, pen: 1, ammo: 'leve', city: 2, auto: 1, recoil: 4 },
  cal12: { nome: 'Espingarda Cal. 12 Pump', cat: 'escopeta', dmg: 170, rof: 1.3, mag: 7, reload: 3, spread: 22, pen: 2, ammo: 'cartucho', city: 3, sg: 75, recoil: 28 },
  smg10: { nome: 'Submetralhadora 10mm', cat: 'smg', dmg: 32, rof: 10, mag: 30, reload: 2, spread: 14, pen: 2, ammo: 'leve', city: 3, auto: 1, recoil: 5 },
  fz556: { nome: 'Fuzil IMBEL IA2 5,56', cat: 'fuzil', dmg: 46, rof: 10, mag: 30, reload: 2.2, spread: 8, pen: 3, ammo: 'fuzil', city: 4, auto: 1, recoil: 5 },
  fz762: { nome: 'FAL 7,62', cat: 'fuzil', dmg: 82, rof: 7, mag: 20, reload: 2.4, spread: 7, pen: 3, ammo: 'fuzil', city: 4, auto: 1, recoil: 8 },
  lmg: { nome: 'FN MAG 7,62 (fita)', cat: 'fuzil', dmg: 76, rof: 12, mag: 100, reload: 5, spread: 12, pen: 3, ammo: 'fuzil', city: 5, auto: 1, recoil: 6 },
  mgl: { nome: 'Lança-Granadas MGL 40mm', cat: 'lanca', dmg: 420, rof: 1.6, mag: 6, reload: 4, spread: 6, pen: 4, ammo: 'pesada', city: 6, expl: 9, recoil: 26, cost: 3 },
  m2: { nome: '.50 BMG M2 Browning', cat: 'torreta', dmg: 190, rof: 8, mag: 100, reload: 5, spread: 9, pen: 4, ammo: 'pesada', city: 7, auto: 1, heat: 5, minVeh: 3, recoil: 10, kick: 0.5 },
  c20: { nome: 'Canhão Automático 20mm', cat: 'torreta', dmg: 340, rof: 9, mag: 60, reload: 5, spread: 8, pen: 5, ammo: 'pesada', city: 8, auto: 1, heat: 6, expl: 3, minVeh: 3, recoil: 12, kick: 0.8 },
  c25: { nome: 'Canhão Bushmaster 25mm', cat: 'torreta', dmg: 520, rof: 6, mag: 50, reload: 5.5, spread: 5, pen: 5, ammo: 'pesada', city: 9, auto: 1, heat: 7, expl: 4, minVeh: 4, recoil: 14, kick: 1.1 },
  c30: { nome: 'Canhão 30mm UT30BR', cat: 'torreta', dmg: 850, rof: 5, mag: 40, reload: 6, spread: 4, pen: 6, ammo: 'pesada', city: 10, auto: 1, heat: 8, expl: 6, minVeh: 4, recoil: 16, kick: 1.5 },
};

const MELEE = {
  facao: { nome: 'Facão de Mato', dmg: 60, cd: 0.32, kb: 1, city: 0 },
  lanca: { nome: 'Lança Improvisada', dmg: 80, cd: 0.6, kb: 1, reach: 1, city: 0 },
  porrete: { nome: 'Porrete com Pregos', dmg: 65, cd: 0.7, kb: 4, city: 0 },
  serra: { nome: 'Motosserra de Mão', dps: 300, saw: 1, pen: 3, city: 1 },
  serraInd: { nome: 'Motosserra Industrial', dps: 520, saw: 1, pen: 4, city: 5 },
};

/* arma fixa do capô (Piloto) */
const CAPO = [
  null,
  { nome: 'Submetralhadora 9mm soldada', dmg: 22, rof: 11, pen: 1, heat: 3, custo: 160, city: 2, veh: 1 },
  { nome: 'Cal. 12 automática', dmg: 60, rof: 6, pen: 2, heat: 4, custo: 280, city: 3, veh: 2 },
  { nome: 'Metralhadora 7,62mm', dmg: 80, rof: 11, pen: 3, heat: 4, custo: 450, city: 5, veh: 3 },
  { nome: '.50 BMG dupla', dmg: 190, rof: 12, pen: 4, heat: 5, custo: 700, city: 7, veh: 4 },
  { nome: 'Canhão 25mm frontal', dmg: 500, rof: 6, pen: 5, heat: 6, expl: 4, custo: 1000, city: 9, veh: 5 },
  { nome: 'Canhão 30mm UT30BR', dmg: 850, rof: 5, pen: 6, heat: 6, expl: 6, custo: 0, city: 10, veh: 4 },
];

/* som de cada arma fixa do capô (audio.js) */
const CAPO_GUN = [null, 'smg9', 'cal12a', 'lmg', 'm2x2', 'c25', 'c30'];

const VEHICLES = [
  null,
  { nome: 'Uno de Firma (com escada)', classe: 'Nível 1 · Compacto Popular', vmax: 150, armor: 100, mass: 1, w: 1.0, cor: '#c9c5b4', custo: 0, city: 0, seats: ['Janela Esq.', 'Janela Dir.', 'Janela Tras.'] },
  { nome: 'Opala Caravan da Polícia', classe: 'Nível 2 · Perua', vmax: 168, armor: 170, mass: 1.4, w: 1.1, cor: '#2c3d57', custo: 260, city: 1, seats: ['Janela Esq.', 'Janela Dir.', 'Teto Solar'] },
  { nome: 'Hilux Cabine Dupla', classe: 'Nível 3 · Picape Agro', vmax: 162, armor: 260, mass: 2, w: 1.2, cor: '#8a8f93', custo: 520, city: 3, seats: ['Janela Esq.', 'Caçamba Dir.', 'Caçamba (Santo-Antônio)'] },
  { nome: 'Carro-Forte Blindado', classe: 'Nível 4 · Furgão Blindado', vmax: 142, armor: 440, mass: 3.6, w: 1.35, cor: '#3d4a3a', custo: 950, city: 5, seats: ['Seteira Esq.', 'Seteira Dir.', 'Torreta do Teto'] },
  { nome: 'Scania Bicuda', classe: 'Nível 5 · Bruto Rodoviário', vmax: 152, armor: 640, mass: 6, w: 1.5, cor: '#a3321f', custo: 1600, city: 7, seats: ['Passarela Esq.', 'Passarela Dir.', 'Torreta Superior'] },
];

const UPGRADES = {
  frente: { nome: 'Para-choque', niv: [
    { nome: 'Quebra-mato de ferro', custo: 120, city: 1 },
    { nome: 'Lâmina de Trator', custo: 260, city: 3 },
    { nome: 'Limpa-Trilhos de Locomotiva em V', custo: 460, city: 4 },
    { nome: 'Limpa-Trilhos c/ 6 Motosserras', custo: 820, city: 7, veh: 4 } ] },
  serra: { nome: 'Motosserras do Para-choque', niv: [
    { nome: 'Kit de Motosserras Acopladas', custo: 150, city: 2 },
    { nome: 'Barra Dupla Industrial', custo: 380, city: 5 } ] },
  lateral: { nome: 'Laterais e Portas', niv: [
    { nome: 'Barras de proteção lateral', custo: 100, city: 1 },
    { nome: 'Motosserras Laterais Acopladas', custo: 360, city: 5 } ] },
  janela: { nome: 'Janelas e Para-brisa', niv: [
    { nome: 'Telas de arame', custo: 130, city: 2 },
    { nome: 'Chapas de aço com frestas', custo: 320, city: 4 } ] },
  pneu: { nome: 'Pneus e Rodas', niv: [
    { nome: 'Pneus Run-Flat', custo: 200, city: 3 },
    { nome: 'Maciços c/ Espinhos Laterais', custo: 420, city: 8 } ] },
  turbo: { nome: 'Motor', niv: [{ nome: 'Turbo (válvula de alívio)', custo: 230, city: 2 }] },
  susp: { nome: 'Suspensão', niv: [{ nome: 'Suspensão Elevada', custo: 180, city: 3 }] },
  tanque: { nome: 'Tanque', niv: [{ nome: 'Tanque Blindado Ampliado', custo: 200, city: 4 }] },
  blind: { nome: 'Blindagem', niv: [{ nome: 'Titânio / Cerâmica Militar', custo: 650, city: 9 }] },
};

const AMMO = {
  leve: { nome: 'Munição leve (.38 / 9mm / 10mm)', pack: 60, custo: 35, max: 400 },
  cartucho: { nome: 'Cartuchos Cal. 20 / 12', pack: 20, custo: 40, max: 120 },
  fuzil: { nome: 'Munição de fuzil 5,56 / 7,62', pack: 90, custo: 60, max: 600 },
  pesada: { nome: 'Pesada (40mm / .50 / canhões)', pack: 80, custo: 90, max: 500 },
};

/* inimigos */
/* resoluções do desenho: linhas da tela deitada (a largura acompanha a proporção da tela); 0 = a da própria tela */
const RESOLUCOES = [
  { id: 'auto', nome: 'Automática', h: 0, info: 'a da tela deste celular' },
  { id: 'fhd', nome: 'FULL HD+', h: 1080, info: '1080 × 2400 · ex.: Galaxy S20 FE' },
  { id: '15k', nome: '1.5K SUPER HD', h: 1264, info: '1264 × 2780 · ex.: Motorola Signature' },
  { id: 'hd', nome: 'HD+ (mais leve)', h: 720, info: '720 × 1600 · para celulares mais simples' },
];
const ENEMY = {
  andarilho: { nome: 'Andarilho', hp: 40, w: 0.55, h: 1.75, cor: '#4dff2e', roupa: '#23272e' },
  corredor: { nome: 'Corredor', hp: 50, w: 0.55, h: 1.75, cor: '#ff8a1a', roupa: '#2a1616', camisa: '#6a1a16' },
  carrapato: { nome: 'Carrapato de Parabrisa', hp: 70, w: 0.6, h: 1.3, cor: '#b8ff1f', roupa: '#1c1a18' },
  boiadeiro: { nome: 'Boiadeiro Inchado', hp: 130, w: 1.25, h: 1.9, cor: '#b8ff1f', roupa: '#2e2616' },
  engolidor: { nome: 'Engolidor de Fumaça', hp: 75, w: 0.6, h: 1.75, cor: '#ff5a0c', roupa: '#140c08', fogo: 1 },
  encouracado: { nome: 'Encouraçado', hp: 170, w: 0.75, h: 1.85, cor: '#4dff2e', roupa: '#10161c', camisa: '#1d2630', armor: 3 },
  cangaceiro: { nome: 'Cangaceiro de Espinhos', hp: 75, w: 0.6, h: 1.7, cor: '#ff8a1a', roupa: '#3e2814', camisa: '#5a3a1e' },
  colosso: { nome: 'Colosso Rodoviário', hp: 2600, w: 1.9, h: 3.2, cor: '#4dff2e', roupa: '#1c1c1c', armor: 2 },
  boi: { nome: 'Boi Infectado', hp: 320, w: 1.2, h: 1.6, cor: '#4a3a2e' },
  moto: { nome: 'Batedor (moto)', hp: 110, w: 0.7, h: 1.6, cor: '#2a2a2a', veh: 1 },
  pickup: { nome: 'Caminhonete de Bandido', hp: 520, w: 2.0, h: 1.9, cor: '#5a2a1a', veh: 1, armor: 2 },
  buggy: { nome: 'Buggy Suicida', hp: 160, w: 1.6, h: 1.3, cor: '#b8742a', veh: 1 },
  blindado: { nome: 'Blindado de Gangue', hp: 1500, w: 2.3, h: 2.3, cor: '#3a4038', veh: 1, armor: 4 },
  carcaca: { nome: 'Carcaça', hp: 1e9, w: 2.0, h: 1.5, cor: '#4a3f38', estatico: 1 },
  carrobomba: { nome: 'Carro-bomba', hp: 120, w: 1.8, h: 1.4, cor: '#7a1a1a', veh: 1 },
  pregos: { nome: 'Tapete de Pregos', hp: 1e9, w: 5, h: 0.15, cor: '#888', estatico: 1 },
  sobrevivente: { nome: 'Sobrevivente', hp: 1e9, w: 0.5, h: 1.75, cor: '#d9a070', estatico: 1 },
  bau: { nome: 'Caminhão do Exército', hp: 1e9, w: 2.4, h: 2.4, cor: '#3d4a2e', estatico: 1 },
};

/* cidades / trechos. km = km reais restantes até Fortaleza ao iniciar o trecho */
const STAGES = [
  { cidade: 'Ribeirão Preto', uf: 'SP', origem: 'Bauru (SP)', estrada: 'SP-300 Mal. Rondon · SP-255 · SP-330 Anhanguera', km: 3250, kmFim: 3040, len: 5200, curv: 0.022, seed: 1.3,
    sky: ['#1c232b', '#4a545c'], ground: ['#2c3b22', '#263420'], fog: '#3b444a', fogK: 0.75,
    clima: [[0, 'chuva'], [0.55, 'fumaca']], cen: ['arvore', 'poste', 'cana', 'cana'], cen2: ['canafogo', 'canafogo', 'cana'], cen2From: 0.55,
    spawn: { andarilho: 10, corredor: 3, carrapato: 1.6, engolidor: [0.55, 3] }, dens: 1, band: 0.25, boss: 'usineiro', musica: 'rock',
    intro: 'Tempestade torrencial na Marechal Rondon. Pouca bala: guardem os revólveres para o chefe e resolvam no facão.',
    saque: 'Oficina no distrito industrial', premio: 'Pistolas 9mm/.40/.45 · Espingarda Cal. 20 · Motosserra de Mão · Quebra-mato · Perua Nível 2' },
  { cidade: 'Uberlândia', uf: 'MG', origem: 'Ribeirão Preto (SP)', estrada: 'BR-050 · Ponte do Rio Grande · Uberaba', km: 3040, kmFim: 2750, len: 5600, curv: 0.02, seed: 2.9,
    sky: ['#5f93c4', '#cfe0ea'], ground: ['#5d7a35', '#557231'], fog: '#c4d4dc', fogK: 0.35,
    clima: [[0, 'limpo'], [0.4, 'chuva'], [0.6, 'limpo']], cen: ['arvore', 'cerca', 'carreta', 'poste', 'pasto'], ponte: [0.86, 2],
    spawn: { andarilho: 10, corredor: 4, carrapato: 1.5, boiadeiro: 2.2, engolidor: 1 }, dens: 1.15, band: 0.4, boss: 'guincho', musica: 'rock',
    intro: 'Divisa SP/MG. Carretas de gado tombadas. Boiadeiro Inchado NÃO se atropela: estoura de longe!',
    saque: 'Polo logístico de Uberlândia', premio: 'Submetralhadoras 9mm/.45 · Kit de Motosserras do Para-choque · Telas nas janelas' },
  { cidade: 'Goiânia', uf: 'GO', origem: 'Uberlândia (MG)', estrada: 'BR-153 Transbrasiliana · Itumbiara', km: 2750, kmFim: 2410, len: 6000, curv: 0.014, seed: 4.1,
    sky: ['#4f8fd0', '#e8dcc0'], ground: ['#7d8a3a', '#748236'], fog: '#dcd6c0', fogK: 0.3,
    clima: [[0, 'limpo']], cen: ['cerrado', 'poste', 'pasto', 'posto', 'cerca'], pedagio: 0.5,
    spawn: { andarilho: 9, corredor: 4, carrapato: 1.4, boiadeiro: 1.8, encouracado: 2 }, dens: 1.2, band: 1.2, boss: 'reidograu', musica: 'viola',
    intro: 'Pista dupla, boa de pé embaixo — e cheia de Batedores de moto. Fortaleza de pedágio no meio do trecho.',
    saque: 'Posto da PRF de Goiânia', premio: 'Espingardas Cal. 12 · Submetralhadoras 10mm · Picape Nível 3' },
  { cidade: 'Brasília', uf: 'DF', origem: 'Goiânia (GO)', estrada: 'BR-060 · Anápolis · Eixo Monumental', km: 2410, kmFim: 2200, len: 5600, curv: 0.016, seed: 5.6,
    sky: ['#3a2f5a', '#f08a3c'], ground: ['#6a5a34', '#62532f'], fog: '#c9703a', fogK: 0.45, sol: 1,
    clima: [[0, 'limpo']], cen: ['cerrado', 'poste', 'predio', 'cerca'], cen2: ['ministerio', 'ministerio', 'poste'], cen2From: 0.68, marco: 'congresso', mar: 0.68,
    spawn: { andarilho: 10, corredor: 4, carrapato: 1.2, boiadeiro: 1.6, encouracado: 3.5, colosso: [0.7, 0.12] }, dens: 1.3, band: 0.7, boss: 'tatuzao', musica: 'viola',
    intro: 'Pôr do sol no Planalto. A Esplanada é um mar de mortos — e o primeiro Colosso está lá.',
    saque: 'Setor Militar Urbano (SMU)', premio: 'Fuzis 5,56 e 7,62 · Limpa-Trilhos frontal' },
  { cidade: 'Luís Eduardo Magalhães', uf: 'BA', origem: 'Brasília (DF)', estrada: 'BR-020 · Formosa · Posse · Serra Geral', km: 2200, kmFim: 1660, len: 6400, curv: 0.008, seed: 7.7,
    sky: ['#3f86cf', '#f0e6c8'], ground: ['#8a9a3c', '#a8a85a'], fog: '#e6dcc0', fogK: 0.3,
    clima: [[0, 'limpo'], [0.45, 'queimada'], [0.65, 'limpo']], cen: ['soja', 'silo', 'poste', 'soja', 'algodao'],
    spawn: { andarilho: 10, corredor: 4, carrapato: 1, boiadeiro: 2, encouracado: 2, engolidor: [0.4, 3], colosso: 0.08 }, dens: 1.3, band: 1.1, boss: 'ceifador', musica: 'viola',
    intro: 'Retas infinitas do MATOPIBA. Soja e algodão abandonados — e queimada de cerrado no caminho.',
    saque: 'Cooperativa agrícola de LEM', premio: 'Metralhadoras Leves de fita · Motosserras Industriais · Furgão Blindado Nível 4' },
  { cidade: 'Barreiras', uf: 'BA', origem: 'Luís Eduardo Magalhães (BA)', estrada: 'BR-020 / BR-242 · Descida da Serra', km: 1660, kmFim: 1570, len: 4800, curv: 0.05, seed: 9.2,
    sky: ['#5a9ad8', '#f2e2b8'], ground: ['#8a6a3a', '#7d6034'], fog: '#e8d8b0', fogK: 0.35,
    clima: [[0, 'limpo']], cen: ['pedra', 'cerrado', 'pedra'], penhasco: 1,
    spawn: { andarilho: 9, corredor: 4, carrapato: 1.4, boiadeiro: 1.6, encouracado: 2, colosso: 0.08 }, dens: 1.1, band: 0.9, boss: 'derrubador', musica: 'baiao',
    intro: 'Descida sinuosa com precipício do lado direito. Não saia da pista.',
    saque: '4º Batalhão de Engenharia (4º BEC)', premio: 'Lançadores de Granadas 40mm' },
  { cidade: 'Petrolina', uf: 'PE', origem: 'Barreiras (BA)', estrada: 'BR-242 · BR-407 · Ponte Presidente Dutra', km: 1570, kmFim: 880, len: 6400, curv: 0.014, seed: 11.4,
    sky: ['#4a94dc', '#f6e7b0'], ground: ['#b89a5c', '#ad8f54'], fog: '#ecd9a4', fogK: 0.4,
    clima: [[0, 'limpo'], [0.5, 'areia'], [0.7, 'limpo']], cen: ['mandacaru', 'pedra', 'xique', 'poste', 'mandacaru'], ponte: [0.85, 2], megahorda: 0.85,
    spawn: { andarilho: 9, corredor: 4, carrapato: 1, boiadeiro: 1.4, cangaceiro: 4, encouracado: 1.4, colosso: 0.1 }, dens: 1.3, band: 0.9, boss: 'carrasco', musica: 'baiao',
    intro: 'Semiárido. Os Cangaceiros de Espinhos se jogam nas rodas para furar os pneus.',
    saque: 'Porto fluvial de Petrolina', premio: 'Metralhadora .50 BMG · Scania Nível 5' },
  { cidade: 'Salgueiro', uf: 'PE', origem: 'Petrolina (PE)', estrada: 'BR-428 · BR-116', km: 880, kmFim: 630, len: 5600, curv: 0.016, seed: 13.8,
    sky: ['#c79a4a', '#e8c878'], ground: ['#b08a4c', '#a57f44'], fog: '#d8b060', fogK: 0.6,
    clima: [[0, 'areia'], [0.35, 'limpo'], [0.6, 'areia']], cen: ['mandacaru', 'xique', 'pedra', 'cerca', 'poste'],
    spawn: { andarilho: 8, corredor: 4, carrapato: 1, boiadeiro: 1.4, cangaceiro: 5, encouracado: 1.6, colosso: 0.12 }, dens: 1.35, band: 1.3, boss: 'corisco', musica: 'baiao',
    intro: 'Tempestade de areia no sertão: os Cangaceiros só aparecem a 5 metros do para-choque.',
    saque: 'Entroncamento de Salgueiro', premio: 'Canhão Automático 20mm · Pneus Maciços com Espinhos' },
  { cidade: 'Juazeiro do Norte', uf: 'CE', origem: 'Salgueiro (PE)', estrada: 'BR-116 · CE-292 · Chapada do Araripe', km: 630, kmFim: 520, len: 5200, curv: 0.03, seed: 15.1,
    sky: ['#05070c', '#141a24'], ground: ['#1c2418', '#182014'], fog: '#2a323a', fogK: 0.85, noite: 1,
    clima: [[0, 'neblina']], cen: ['arvore', 'pedra', 'mandacaru', 'poste'], marco: 'padre', mar: 0.75,
    spawn: { andarilho: 9, corredor: 5, carrapato: 1.6, boiadeiro: 1.4, cangaceiro: 3, encouracado: 1.6, colosso: 0.12 }, dens: 1.3, band: 0.8, boss: 'iluminado', musica: 'baiao',
    intro: 'Noite fechada e neblina na Chapada. Farol alto e ouvido atento.',
    saque: 'Arsenal do Cariri', premio: 'Canhão 25mm · Blindagem de Titânio/Cerâmica' },
  { cidade: 'Fortaleza', uf: 'CE', origem: 'Juazeiro do Norte (CE)', estrada: 'BR-116 · Icó · Russas · Messejana · Av. Beira Mar', km: 520, kmFim: 0, len: 6400, curv: 0.014, seed: 17.9,
    sky: ['#2f6fc0', '#f4c98a'], ground: ['#a8a060', '#9c9458'], fog: '#e8cfa0', fogK: 0.35, sol: 1,
    clima: [[0, 'limpo']], cen: ['coqueiro', 'poste', 'predio', 'coqueiro', 'carreta'], cen2: ['predio', 'coqueiro', 'predio'], cen2From: 0.7, marco: 'navio', mar: 0.9,
    spawn: { andarilho: 10, corredor: 5, carrapato: 1.4, boiadeiro: 1.6, cangaceiro: 2, encouracado: 2.4, engolidor: 1, colosso: 0.2 }, dens: 1.5, band: 1.3, boss: 'leviata', musica: 'baiao',
    intro: 'Últimos 500 km. Em Messejana, o Canhão 30mm de um Guarani tombado é de vocês. O navio não espera.',
    saque: 'Porto do Mucuripe', premio: 'O Atlântico.' },
];

const ARENA = { cidade: 'Rei da BR', uf: 'GO', origem: 'Mega-posto', estrada: 'Entroncamento da BR-153', km: 2500, kmFim: 2500, len: 1e9, curv: 0.01, seed: 21,
  sky: ['#20142c', '#b8502c'], ground: ['#6a5a34', '#62532f'], fog: '#8a4a30', fogK: 0.5, sol: 1, clima: [[0, 'limpo']], cen: ['posto', 'poste', 'carreta', 'cerrado'],
  spawn: { andarilho: 9, corredor: 5, carrapato: 1.4, boiadeiro: 1.6, encouracado: 2, cangaceiro: 2, engolidor: 1.5, colosso: 0.15 }, dens: 1.4, band: 1.5, boss: null, musica: 'viola',
  intro: 'Defendam o mega-posto. Ondas infinitas. Sucata a cada onda.' };

const BOSSES = {
  usineiro: { nome: 'O USINEIRO', sub: 'Treminhão de Cana em Chamas', n: 1, cor: '#5a3a1a', w: 3.2, h: 3.6 },
  guincho: { nome: 'FERRO-VELHO', sub: 'Guincho Pesado com Arpão', n: 2, cor: '#6a5a3a', w: 3.0, h: 3.2 },
  reidograu: { nome: 'REI DO GRAU', sub: 'Monster Truck e a Matilha da BR-153', n: 3, cor: '#b02a8a', w: 3.2, h: 3.4 },
  tatuzao: { nome: 'COMANDANTE SOMBRA', sub: 'Blindado de Choque "Tatuzão"', n: 4, cor: '#1e2226', w: 3.2, h: 3.4 },
  ceifador: { nome: 'O CEIFADOR DO OESTE', sub: 'Colheitadeira Monstro', n: 5, cor: '#2f7a2a', w: 11, h: 4.2 },
  derrubador: { nome: 'DERRUBADOR DA SERRA', sub: 'Escavadeira Blindada', n: 6, cor: '#c98a1a', w: 3.2, h: 4.6 },
  carrasco: { nome: 'CARRASCO DO VELHO CHICO', sub: 'Caminhão-Cegonha na Ponte Pres. Dutra', n: 7, cor: '#3a4a6a', w: 3.2, h: 4.4 },
  corisco: { nome: 'CORONEL CORISCO', sub: 'Comboio do Novo Cangaço Motorizado', n: 8, cor: '#6a3a1a', w: 2.6, h: 2.6 },
  iluminado: { nome: 'O ILUMINADO DO CARIRI', sub: 'Trio Elétrico "Trovão Cego"', n: 9, cor: '#3a1a5a', w: 3.6, h: 5 },
  leviata: { nome: 'ALMIRANTE DA FERRUGEM', sub: 'Leviatã do Asfalto — Bitrem Blindado', n: 10, cor: '#3a2a22', w: 3.6, h: 4.4 },
};

const CONQUISTAS = {
  escada: { nome: 'Com Escada no Teto', desc: 'Chegar a Brasília ainda no compacto Nível 1.' },
  lenhador: { nome: 'Lenhador da Anhanguera', desc: 'Bauru → Ribeirão Preto sem disparar um único tiro de arma de fogo.' },
  pedagio: { nome: 'Sem Parar no Pedágio', desc: 'Passar pela fortaleza da BR-153 a mais de 140 km/h sem ferver o motor.' },
  cangaceiro: { nome: 'Cangaceiro de Aço', desc: 'Destruir o comboio do Coronel Corisco só com Canhão 20mm e motosserras laterais.' },
  aguia: { nome: 'Visão de Águia Cega', desc: 'Derrotar o Trio Elétrico em 1ª pessoa sem sair do asfalto.' },
  mar: { nome: 'De Bauru ao Mar', desc: 'Embarcar no último navio em Fortaleza.' },
};

const CALLOUTS = {
  boiadeiro: ['Boiadeiro Ácido na pista, desvia pra não sujar o vidro!', 'Inchado na frente! NÃO atropela!'],
  moto: ['Motoqueiro com motosserra colando! Liga a serra lateral!', 'Batedor no flanco!'],
  hood: ['Mutante no capô!', 'Carrapato no para-brisa! Freia!'],
  colosso: ['COLOSSO na pista! Desvia, desvia!', 'Brutamontes à frente!'],
  latchL: ['Zumbi agarrado na esquerda!'], latchR: ['Zumbi agarrado na direita!'],
  pickup: ['Caminhonete de bandido chegando!', 'Bandido emparelhando!'],
  cang: ['Espinhento se jogando na roda!'],
  semmun: ['Clique seco! Sem munição — vai no facão!'],
};

const RADIO = [
  { nome: 'AUTO', freq: 'AUTO' },
  { nome: 'ROCK 89 FM', freq: '89.1', m: 'rock' },
  { nome: 'VIOLA PESADA AM', freq: '740', m: 'viola' },
  { nome: 'BAIÃO METAL FM', freq: '104.5', m: 'baiao' },
  { nome: 'MARINHA · ONDAS CURTAS', freq: '6.215', m: 'marinha' },
  { nome: 'DESLIGADO', freq: '--.-', m: null },
];
const RADIO_MSGS = [
  'Marinha do Brasil. Zona segura na Base Naval de Fortaleza. Último cargueiro zarpa em breve. Repito...',
  '...alguém na escuta? Estamos presos no teto do posto, eles não param de subir...',
  'Aqui é do pedágio. A estrada agora tem dono. Quem passar, paga em sangue.',
  '...não atropelem os inchados, pelo amor de Deus, o ácido come o motor...',
  'Marinha do Brasil. Plataformas do Atlântico seguras. Sigam pela BR-116 até o Mucuripe.',
];
