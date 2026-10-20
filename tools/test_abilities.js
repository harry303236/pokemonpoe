// Comprueba que cada habilidad tiene efectos válidos y que todos se pueden describir/aplicar.
// uso: node tools/test_abilities.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.window = global; global.G = {};
const load = f => new Function('G', fs.readFileSync(path.join(root, f), 'utf8'))(G);
load('js/data/abilities.js'); load('js/data/ability-fx.js');
G.Weather = { current: null, force() {} }; G.Game = { st: { time: 100 } };
G.EnemyMgr = { queryCircle: () => [] }; G.Evolution = { nextOf: () => [] };
G.FX = { dmgText() {}, ring() {} }; G.Types = { mult: () => 1 }; G.U = { dist: () => 0 };
load('js/systems/abilities.js');
const KNOWN = new Set('atk spd hp cd def crit critdmg regen magnet xp coin immune absorb resist reduce seRes notSE fullGuard dodge sturdy ward noWeather noEnv noSlow thorns contact proc lifesteal ohbuff killbuff killheal ramp moody aura hitpulse weather ohweather adaptRes scale'.split(' '));
let bad = 0; const err = m => { console.log('✗', m); bad++; };
const ids = Object.keys(G.ABILITIES).map(Number);
for (const id of ids) {
  const d = G.ABILITY_FX[id];
  if (!d) { err('sin efectos: ' + id + ' ' + G.ABILITIES[id].en); continue; }
  if (![1, 2, 3].includes(d.tier)) err('tier raro ' + id);
  if (!d.fx.length) err('vacío ' + id);
  for (const f of d.fx) {
    if (!KNOWN.has(f.k)) err(`efecto desconocido ${f.k} en ${id}`);
    if (f.v !== undefined && !Number.isFinite(f.v)) err(`v no válido en ${id}`);
  }
  for (const lang of ['zh-Hant', 'en']) {
    window.PS_LOCALES = { lang };
    for (const t of G.Abilities.describe(id)) if (!t || /undefined|NaN|\[object/.test(t) || KNOWN.has(t)) err(`texto malo ${id} (${lang}): ${t}`);
  }
}
for (const id of Object.keys(G.ABILITY_FX)) if (!G.ABILITIES[id]) err('efectos de una habilidad que no existe: ' + id);
// Habilidades que usan los Pokémon pero no tienen efectos.
const missing = new Set();
for (const rec of Object.values(G.DEX_ABILITIES)) for (const a of rec.a) if (!G.ABILITY_FX[a]) missing.add(a);
if (missing.size) err('usadas sin efectos: ' + [...missing].join(','));
// Simulación: aplicar cada habilidad a un jugador de pega y llamar a todos los ganchos.
const mkPl = () => ({ hp: 50, maxHp: 100, level: 10, kills: 300, x: 0, y: 0, r: 8, bodyH: 20, walking: false, item: null, slowT: 5,
  mon: { types: ['fire'] }, buffs: {}, addBuff(s, v, d, m) { this.buffs[s] = (this.buffs[s] || 0) + 1; }, heal(a) { this.hp = Math.min(this.maxHp, this.hp + a); }, invuln: 0 });
const e = { dead: false, remote: false, boss: false, maxHp: 80, hurt() {}, applySlow() {}, applyStun() {}, applyBurn() {}, applyPoison() {}, x: 0, y: 0, r: 5 };
const mv = { type: 'fire', cat: 'special', kind: 'projectile', cd: 0.5 };
let n = 0;
for (const id of ids) {
  const pl = mkPl(); G.Abilities.set(pl, id);
  try {
    for (const k of ['atk', 'cd']) { const v = G.Abilities[k](pl, mv); if (!Number.isFinite(v)) err(`${k} NaN en ${id}`); }
    for (const k of ['spd', 'def', 'crit', 'critdmg', 'regen', 'magnet', 'xp', 'coin']) { const v = G.Abilities[k](pl); if (!Number.isFinite(v)) err(`${k} NaN en ${id}`); }
    for (const ty of ['fire', 'water', 'electric', 'ground', 'grass', 'dark']) { const r = G.Abilities.incoming(pl, 20, ty, 'physical', false); if (!Number.isFinite(r) || r < 0) err(`incoming raro en ${id}`); }
    G.Abilities.afterHurt(pl, 10, 'fire'); G.Abilities.contact(pl, e); G.Abilities.dealt(pl, e, 20); G.Abilities.kill(pl);
    for (let i = 0; i < 400; i++) G.Abilities.tick(pl, 0.1);
    G.Abilities.sturdy(pl);
    if (!Number.isFinite(pl.hp)) err('hp NaN en ' + id);
    n++;
  } catch (ex) { err(`excepción en ${id} ${G.ABILITIES[id].en}: ${ex.message}`); }
}
console.log(`${ids.length} habilidades · ${n} simuladas sin errores · ${bad} problemas`);
process.exit(bad ? 1 : 0);
