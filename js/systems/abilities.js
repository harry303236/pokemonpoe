/* ============ abilities.js — habilidades (PokemonPOE) ============
 * Cada Pokémon elige UNA habilidad entre las de su forma final (js/data/abilities.js) y el
 * juego la aplica con los "efectos" de js/data/ability-fx.js. Aquí está el motor:
 *   - consultas de números (atk, spd, cd, def, crit, regen, magnet, xp, coin) que usa Player/Combat
 *   - ganchos: incoming (daño recibido), afterHurt, contact (choque con un enemigo), dealt (daño
 *     hecho), kill (derrotas) y tick (cada fotograma)
 *   - texto de cada habilidad ("lo que hace de verdad aquí") en zh-Hant / en
 * Los ganchos no hacen nada si el jugador no tiene habilidad.
 */
G.Abilities = (() => {
  const NONE = [];
  const now = () => performance.now();
  const fxOf = pl => (pl && pl.ability && pl.ability.fx) || NONE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------- condiciones y filtros ----------------
  const wx = () => { const w = G.Weather && G.Weather.current; return w ? w.kind : null; };
  let crowdAt = 0, crowdN = 0;
  function crowd(pl) {
    const t = now();
    if (t - crowdAt > 250) { crowdAt = t; crowdN = G.EnemyMgr.queryCircle(pl.x, pl.y, 220).filter(e => !e.dead).length; }
    return crowdN;
  }
  function cond(pl, c) {
    if (!c) return true;
    switch (c) {
      case 'low': return pl.hp <= pl.maxHp / 3;
      case 'half': return pl.hp <= pl.maxHp / 2;
      case 'full': return pl.hp >= pl.maxHp * 0.95;
      case 'rain': case 'sun': case 'sand': case 'snow': case 'fog': return wx() === c;
      case 'wx': return !!wx();
      case 'still': return !pl.walking;
      case 'move': return !!pl.walking;
      case 'crowd': return crowd(pl) >= 6;
      case 'noitem': return !pl.item;
      case 'early': return G.Game.st.time < 45;
      case 'late': return G.Game.st.time > 240;
      default: return false;
    }
  }
  // Grupos de movimientos para los filtros "kind".
  const KINDS = {
    close: ['melee', 'dash', 'cone', 'spin', 'shove', 'quake', 'charge', 'stun'],
    ranged: ['projectile', 'boomerang', 'homing', 'bounce', 'chain', 'turret'],
    beam: ['beam', 'chain'],
    buff: ['buff'],
    area: ['nova', 'aura', 'meteor', 'mine', 'vortex', 'trail']
  };
  const has = (list, v) => Array.isArray(list) ? list.includes(v) : list === v;
  function fits(pl, f, m) {
    if (f.t != null && !(m && has(f.t, m.type))) return false;
    if (f.cat && !(m && m.cat === f.cat)) return false;
    if (f.kind != null) {
      const ks = Array.isArray(f.kind) ? f.kind : [f.kind];
      if (!(m && ks.some(k => (KINDS[k] || [k]).includes(m.kind)))) return false;
    }
    if (f.stab && !(m && pl.mon.types.includes(m.type))) return false;
    if (f.fast && !(m && m.cd <= 0.6)) return false;
    return cond(pl, f.if);
  }
  function sum(pl, k, m) {
    let s = 0;
    for (const f of fxOf(pl)) if (f.k === k && fits(pl, f, m)) s += f.v;
    return s;
  }
  const flag = (pl, k) => fxOf(pl).some(f => f.k === k);

  // ---------------- números que consultan Player y Combat ----------------
  function atk(pl, m) {
    let s = sum(pl, 'atk', m);
    for (const f of fxOf(pl)) if (f.k === 'scale' && f.stat === 'atk') s += Math.min(f.max, Math.floor(pl.kills / f.per) * f.v);
    return clamp(1 + s, 0.4, 3);
  }
  const spd = pl => clamp(1 + sum(pl, 'spd'), 0.5, 2.2);
  const cd = (pl, m) => clamp(1 - sum(pl, 'cd', m), 0.5, 1.6);
  const def = pl => sum(pl, 'def');
  const crit = pl => sum(pl, 'crit');
  const critdmg = pl => sum(pl, 'critdmg');
  const regen = pl => sum(pl, 'regen') * pl.maxHp;                 // PV por segundo (puede ser negativo)
  const magnet = pl => 1 + sum(pl, 'magnet');
  const xp = pl => 1 + sum(pl, 'xp');
  const coin = pl => 1 + sum(pl, 'coin');
  const noWeather = pl => flag(pl, 'noWeather') || flag(pl, 'noEnv');
  const noEnv = pl => flag(pl, 'noEnv');

  // ---------------- estados sobre enemigos ----------------
  const ST_COL = { slow: '#9ad7ff', stun: '#ffe14d', burn: '#ff9a4d', poison: '#d47cf0', dmg: '#b78cff', heal: '#5fe08a' };
  function status(e, st, v, d) {
    if (!e || e.dead || e.remote) return;
    if (st === 'rand') st = ['burn', 'poison', 'stun'][Math.floor(Math.random() * 3)];
    if (st === 'slow') e.applySlow(v || 0.5, d || 2);
    else if (st === 'stun') e.applyStun(e.boss ? (d || 1) * 0.3 : (d || 1));
    else if (st === 'burn') e.applyBurn(1);
    else if (st === 'poison') e.applyPoison(1);
  }
  const enemiesAround = (pl, r) => Array.from(G.EnemyMgr.queryCircle(pl.x, pl.y, r)).filter(e => !e.dead && !e.remote && G.U.dist(pl.x, pl.y, e.x, e.y) <= r + e.r);

  // ---------------- asignar la habilidad ----------------
  function set(pl, id) {
    const def0 = G.ABILITY_FX && G.ABILITY_FX[id];
    if (!def0) { pl.ability = null; return null; }
    pl.ability = { id, fx: def0.fx, tier: def0.tier, st: { ward: -1e9, sturdy: -1e9, hp: 0, ohw: -1e9, t: {} } };
    for (const f of def0.fx) if (f.k === 'weather') pl.ability.st.t[f.kind] = 2;     // la primera al entrar
    return pl.ability;
  }

  // ---------------- daño recibido ----------------
  function say(pl, txt, col = '#9ad7ff') { G.FX.dmgText(pl.x, pl.y - pl.bodyH - 16, txt, col, true); }

  /** Devuelve el daño final (0 = no te toca). Se llama al principio de Player.hurt. */
  function incoming(pl, amount, type, cat, pure) {
    const fx = fxOf(pl);
    if (!fx.length) return amount;
    const st = pl.ability.st, t = now();
    for (const f of fx) if (f.k === 'ward' && t - st.ward >= f.cd * 1000) { st.ward = t; say(pl, ward_txt()); return 0; }
    let dp = 0;
    for (const f of fx) if (f.k === 'dodge' && cond(pl, f.if)) dp += f.v;
    if (dp > 0 && Math.random() < dp) { say(pl, dodge_txt()); return 0; }
    if (pure) return amount;
    if (type) {
      for (const f of fx) {
        if ((f.k === 'immune' || f.k === 'absorb') && has(f.t, type)) {
          if (f.v > 0) pl.heal(pl.maxHp * f.v);
          if (f.buff) pl.addBuff(f.buff.stat, f.buff.v, f.buff.dur, 1);
          if (!(f.v > 0)) say(pl, immune_txt());
          return 0;
        }
      }
      for (const f of fx) if (f.k === 'resist' && has(f.t, type)) amount *= 1 - f.v;
      if (st.adapt && st.adapt.type === type && t < st.adapt.until) amount *= 1 - st.adapt.v;
      const k = G.Types.mult(type, pl.mon.types);
      for (const f of fx) {
        if (f.k === 'seRes' && k > 1) amount *= 1 - f.v;
        else if (f.k === 'notSE' && k <= 1) amount *= 1 - f.v;
      }
    }
    for (const f of fx) {
      if (f.k === 'reduce' && cat === f.cat) amount *= 1 - f.v;
      else if (f.k === 'fullGuard' && pl.hp >= pl.maxHp * 0.95) amount *= 1 - f.v;
    }
    return amount;
  }
  const lang = () => (window.PS_LOCALES && window.PS_LOCALES.lang) || 'en';
  const zh = () => String(lang()).startsWith('zh');
  const ward_txt = () => (zh() ? '無效！' : 'Blocked!');
  const dodge_txt = () => (zh() ? '閃避！' : 'Dodged!');
  const immune_txt = () => (zh() ? '免疫' : 'Immune');

  /** ¿Aguantas con 1 PV un golpe mortal? (una vez cada cd s) */
  function sturdy(pl) {
    const st = pl.ability && pl.ability.st, t = now();
    for (const f of fxOf(pl)) {
      if (f.k === 'sturdy' && t - st.sturdy >= f.cd * 1000) {
        st.sturdy = t; pl.hp = 1; pl.invuln = 1.2;
        G.FX.dmgText(pl.x, pl.y - pl.bodyH - 16, zh() ? '撐住了！' : 'Hung on!', '#ff9a3d', true);
        G.FX.ring(pl.x, pl.y, 6, 70, '#ff9a3d', 0.5, 4);
        return true;
      }
    }
    return false;
  }

  /** Tras recibir daño. */
  function afterHurt(pl, d, type) {
    const fx = fxOf(pl);
    if (!fx.length) return;
    const st = pl.ability.st, t = now();
    for (const f of fx) {
      if (f.k === 'ohbuff' && (f.t == null || (type && has(f.t, type)))) pl.addBuff(f.stat, f.v, f.dur, f.max);
      else if (f.k === 'adaptRes' && type) st.adapt = { type, v: f.v, until: t + f.dur * 1000 };
      else if (f.k === 'ohweather' && t - st.ohw > 60000) { st.ohw = t; G.Weather.force(f.kind, 30); }
      else if (f.k === 'hitpulse' && t - (st['hp' + f.st] || -1e9) > 3000) {
        st['hp' + f.st] = t;
        if (f.st === 'heal') pl.heal(pl.maxHp * f.v);
        else for (const e of enemiesAround(pl, f.r)) status(e, f.st, f.v, 2.5);
        G.FX.ring(pl.x, pl.y, 8, f.r, ST_COL[f.st] || '#fff', 0.3, 3);
      }
    }
  }

  // ---------------- choque con un enemigo ----------------
  function contact(pl, e) {
    for (const f of fxOf(pl)) {
      if (f.k === 'thorns') {
        const dmg = Math.max(4 + pl.level * 2, e.maxHp * f.v * (e.boss ? 0.15 : 1));
        e.hurt(dmg, '#aab4c4', e.x - pl.x, e.y - pl.y, 40);
      } else if (f.k === 'contact' && Math.random() < f.p) status(e, f.st, 0.55, f.d);
    }
  }

  // ---------------- daño hecho y derrotas ----------------
  function dealt(pl, e, dmg) {
    for (const f of fxOf(pl)) {
      if (f.k === 'proc' && Math.random() < f.p) status(e, f.st, 0.5, f.d);
      else if (f.k === 'lifesteal') pl.hp = Math.min(pl.maxHp, pl.hp + dmg * f.v);
    }
  }
  function kill(pl) {
    for (const f of fxOf(pl)) {
      if (f.k === 'killbuff') pl.addBuff(f.stat, f.v, f.dur, f.max);
      else if (f.k === 'killheal') pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * f.v);
    }
  }

  // ---------------- cada fotograma ----------------
  const MOODY = ['atk', 'spd', 'def'];
  function tick(pl, dt) {
    const fx = fxOf(pl);
    if (!fx.length) return;
    const st = pl.ability.st;
    for (let i = 0; i < fx.length; i++) {
      const f = fx[i];
      switch (f.k) {
        case 'noSlow': pl.slowT = 0; break;
        case 'weather':
          if ((st.t[f.kind] -= dt) <= 0) { st.t[f.kind] = f.every; G.Weather.force(f.kind, f.dur); }
          break;
        case 'ramp': {
          const key = 'r' + i;
          if ((st[key] = (st[key] || 0) + dt) >= f.every) { st[key] = 0; pl.addBuff(f.stat, f.v, 9999, f.max); }
          break;
        }
        case 'moody': {
          const key = 'm' + i;
          if ((st[key] = (st[key] || 0) + dt) >= 15) { st[key] = 0; pl.addBuff(MOODY[Math.floor(Math.random() * 3)], 0.1, 15, 1); }
          break;
        }
        case 'aura': {
          const key = 'a' + i;
          if ((st[key] = (st[key] || 0) + dt) >= f.every) {
            st[key] = 0;
            const near = enemiesAround(pl, f.r);
            if (near.length) {
              for (const e of near) {
                if (f.st === 'dmg') e.hurt((6 + pl.level * 2.5) * f.v, ST_COL.dmg, 0, 0, 0);
                else status(e, f.st, f.v, f.st === 'slow' ? f.every + 0.6 : f.v);
              }
              G.FX.ring(pl.x, pl.y, 8, f.r, ST_COL[f.st] || '#fff', 0.35, 2);
            }
          }
          break;
        }
        default: break;
      }
    }
    // Pérdida de vida por efecto (Poder Solar): nunca te deja KO.
    const r = regen(pl);
    if (r < 0) pl.hp = Math.max(1, pl.hp + r * dt);
  }

  // ---------------- elección ----------------
  /** ¿Es la forma final (sin más evoluciones)? */
  const isFinal = dex => !G.Evolution.nextOf(dex).length;

  /** Habilidades entre las que elegir ahora ([] si no toca): al llegar a la forma final, o Nv.10 si no evoluciona. */
  function offer(pl) {
    if (pl.ability || pl.abilityAsked || !isFinal(pl.dex)) return [];
    if (!(pl.evolved > 0) && pl.level < 10) return [];
    const rec = G.DEX_ABILITIES && G.DEX_ABILITIES[pl.dex];
    const ids = rec ? rec.a.filter(id => G.ABILITY_FX[id]) : [];
    pl.abilityAsked = true;
    return ids;
  }

  // ---------------- textos ----------------
  const TYPES_ZH = { normal: '一般', fire: '火', water: '水', grass: '草', electric: '電', ice: '冰', fighting: '格鬥', poison: '毒', ground: '地面',
    flying: '飛行', psychic: '超能力', bug: '蟲', rock: '岩石', ghost: '幽靈', dragon: '龍', dark: '惡', steel: '鋼', fairy: '妖精' };
  const TYPES_EN = { normal: 'Normal', fire: 'Fire', water: 'Water', grass: 'Grass', electric: 'Electric', ice: 'Ice', fighting: 'Fighting', poison: 'Poison',
    ground: 'Ground', flying: 'Flying', psychic: 'Psychic', bug: 'Bug', rock: 'Rock', ghost: 'Ghost', dragon: 'Dragon', dark: 'Dark', steel: 'Steel', fairy: 'Fairy' };
  const L = {
    zh: {
      cond: { low: '血量≤1/3時', half: '血量≤1/2時', full: '滿血時', rain: '下雨時', sun: '大晴天時', sand: '沙暴時', snow: '下雪時', fog: '起霧時', wx: '有天氣時',
        still: '站著不動時', move: '移動時', crowd: '周圍敵人多時', noitem: '沒有持有道具時', early: '前 45 秒', late: '4 分鐘後' },
      kind: { close: '近戰類', ranged: '遠程類', beam: '光束類', buff: '輔助類', area: '範圍類' },
      st: { slow: '減速', stun: '暈眩', burn: '灼傷', poison: '中毒', rand: '隨機異常', dmg: '受到傷害', heal: '回復' },
      stat: { atk: '攻擊', patk: '物攻', satk: '特攻', spd: '速度', def: '防禦', regen: '回復' },
      wx: { sun: '大晴天', rain: '下雨', sand: '沙暴', snow: '下雪', fog: '起霧' },
      move: '招式', stab: '本系招式', fast: '快速招式', phys: '物理', spec: '特殊'
    },
    en: {
      cond: { low: 'at ≤1/3 HP', half: 'at ≤1/2 HP', full: 'at full HP', rain: 'in rain', sun: 'in sun', sand: 'in a sandstorm', snow: 'in snow', fog: 'in fog', wx: 'during weather',
        still: 'while standing still', move: 'while moving', crowd: 'when surrounded', noitem: 'with no held item', early: 'in the first 45 s', late: 'after 4 min' },
      kind: { close: 'close-range', ranged: 'ranged', beam: 'beam', buff: 'support', area: 'area' },
      st: { slow: 'slow', stun: 'stun', burn: 'burn', poison: 'poison', rand: 'a random status', dmg: 'damage', heal: 'heal' },
      stat: { atk: 'Attack', patk: 'Attack', satk: 'Sp. Atk', spd: 'Speed', def: 'Defense', regen: 'Regen' },
      wx: { sun: 'sun', rain: 'rain', sand: 'a sandstorm', snow: 'snow', fog: 'fog' },
      move: 'moves', stab: 'same-type moves', fast: 'fast moves', phys: 'physical', spec: 'special'
    }
  };
  const pc = v => Math.round(Math.abs(v) * 100);
  const sg = v => (v >= 0 ? '+' : '−');

  /** Una línea de texto para un efecto. */
  function line(f) {
    const Z = zh(), D = Z ? L.zh : L.en, TN = Z ? TYPES_ZH : TYPES_EN;
    const types = t => [].concat(t).map(x => TN[x] || x).join(Z ? '、' : '/') + (Z ? '系' : '');
    const when = f.if ? (Z ? '（' + D.cond[f.if] + '）' : ' ' + D.cond[f.if]) : '';
    const scope = () => {
      if (f.t != null) return types(f.t) + (Z ? '招式' : ' moves');
      if (f.cat) return (f.cat === 'physical' ? D.phys : D.spec) + (Z ? '招式' : ' moves');
      if (f.kind != null) return [].concat(f.kind).map(k => D.kind[k] || k).join(Z ? '、' : '/') + (Z ? '招式' : ' moves');
      if (f.stab) return D.stab;
      if (f.fast) return D.fast;
      return Z ? '招式' : 'moves';
    };
    const stat = s => D.stat[s] || s;
    const dur = n => (Z ? `${n} 秒` : `${n}s`);
    switch (f.k) {
      case 'atk': return Z ? `${scope()}傷害 ${sg(f.v)}${pc(f.v)}%${when}` : `${scope()} damage ${sg(f.v)}${pc(f.v)}%${when}`;
      case 'spd': return Z ? `移動速度 ${sg(f.v)}${pc(f.v)}%${when}` : `Move speed ${sg(f.v)}${pc(f.v)}%${when}`;
      case 'cd': return Z ? `${scope()}冷卻時間 ${f.v >= 0 ? '−' : '+'}${pc(f.v)}%${when}` : `${scope()} cooldown ${f.v >= 0 ? '−' : '+'}${pc(f.v)}%${when}`;
      case 'def': return Z ? `受到傷害 ${f.v >= 0 ? '−' : '+'}${pc(f.v)}%${when}` : `Damage taken ${f.v >= 0 ? '−' : '+'}${pc(f.v)}%${when}`;
      case 'crit': return Z ? `暴擊率 ${sg(f.v)}${pc(f.v)}%${when}` : `Crit chance ${sg(f.v)}${pc(f.v)}%${when}`;
      case 'critdmg': return Z ? `暴擊傷害 +${pc(f.v)}%` : `Crit damage +${pc(f.v)}%`;
      case 'regen': return Z ? `每秒${f.v >= 0 ? '回復' : '損失'} ${(Math.abs(f.v) * 100).toFixed(1)}% 最大生命${when}` : `${f.v >= 0 ? 'Heals' : 'Loses'} ${(Math.abs(f.v) * 100).toFixed(1)}% max HP/s${when}`;
      case 'magnet': return Z ? `拾取範圍 +${pc(f.v)}%` : `Pickup range +${pc(f.v)}%`;
      case 'xp': return Z ? `獲得經驗 +${pc(f.v)}%` : `XP gained +${pc(f.v)}%`;
      case 'coin': return Z ? `獲得金幣 +${pc(f.v)}%` : `Coins gained +${pc(f.v)}%`;
      case 'immune': return Z ? `免疫${types(f.t)}攻擊` : `Immune to ${types(f.t)} attacks`;
      case 'absorb': {
        const b = f.buff ? (Z ? `，並獲得${stat(f.buff.stat)} +${pc(f.buff.v)}%（${dur(f.buff.dur)}）` : `, and gains ${stat(f.buff.stat)} +${pc(f.buff.v)}% (${dur(f.buff.dur)})`) : '';
        const h = f.v > 0 ? (Z ? `，回復 ${pc(f.v)}% 最大生命` : `, heals ${pc(f.v)}% max HP`) : '';
        return Z ? `被${types(f.t)}攻擊打中時無效${h}${b}` : `Nullifies ${types(f.t)} attacks${h}${b}`;
      }
      case 'resist': return Z ? `${types(f.t)}傷害 −${pc(f.v)}%` : `${types(f.t)} damage taken −${pc(f.v)}%`;
      case 'reduce': return Z ? `${f.cat === 'physical' ? D.phys : D.spec}攻擊傷害 −${pc(f.v)}%` : `${f.cat === 'physical' ? D.phys : D.spec} damage taken −${pc(f.v)}%`;
      case 'seRes': return Z ? `效果絕佳的傷害 −${pc(f.v)}%` : `Super-effective damage taken −${pc(f.v)}%`;
      case 'notSE': return Z ? `非效果絕佳的傷害 −${pc(f.v)}%` : `Non-super-effective damage taken −${pc(f.v)}%`;
      case 'fullGuard': return Z ? `滿血時受到傷害 −${pc(f.v)}%` : `Damage taken −${pc(f.v)}% at full HP`;
      case 'dodge': return Z ? `${pc(f.v)}% 機率閃避攻擊${when}` : `${pc(f.v)}% chance to dodge${when}`;
      case 'sturdy': return Z ? `致命傷時保留 1 點生命（每 ${f.cd} 秒一次）` : `Survives a lethal hit with 1 HP (every ${f.cd}s)`;
      case 'ward': return Z ? `每 ${f.cd} 秒無效化一次傷害` : `Negates one hit every ${f.cd}s`;
      case 'noWeather': return Z ? '不受天氣傷害與減速影響' : 'Ignores weather damage and slowdown';
      case 'noEnv': return Z ? '不受天氣與環境傷害' : 'Immune to weather and hazard chip damage';
      case 'noSlow': return Z ? '免疫陷阱的減速' : 'Immune to slowing traps';
      case 'thorns': return Z ? `被碰到時反彈傷害（敵人最大生命 ${pc(f.v)}%）` : `Reflects ${pc(f.v)}% of the enemy's max HP on contact`;
      case 'contact': return Z ? `被碰到時 ${pc(f.p)}% 機率使敵人${D.st[f.st]}` : `${pc(f.p)}% chance to ${D.st[f.st]} enemies that touch you`;
      case 'proc': return Z ? `攻擊時 ${pc(f.p)}% 機率使敵人${D.st[f.st]}` : `${pc(f.p)}% chance to ${D.st[f.st]} on hit`;
      case 'lifesteal': return Z ? `吸血 ${pc(f.v)}%` : `Lifesteal ${pc(f.v)}%`;
      case 'ohbuff': return Z ? `${f.t != null ? '被' + types(f.t) + '打中' : '被打中'}時${stat(f.stat)} +${pc(f.v)}%（最多 ${f.max} 層，${dur(f.dur)}）`
        : `${f.t != null ? 'Hit by ' + types(f.t) : 'When hit'}: ${stat(f.stat)} +${pc(f.v)}% (max ${f.max} stacks, ${dur(f.dur)})`;
      case 'killbuff': return Z ? `擊倒敵人時${stat(f.stat)} +${pc(f.v)}%（最多 ${f.max} 層，${dur(f.dur)}）` : `On KO: ${stat(f.stat)} +${pc(f.v)}% (max ${f.max} stacks, ${dur(f.dur)})`;
      case 'killheal': return Z ? `擊倒敵人時回復 ${pc(f.v)}% 最大生命` : `On KO: heals ${pc(f.v)}% max HP`;
      case 'ramp': return Z ? `每 ${f.every} 秒${stat(f.stat)} +${pc(f.v)}%（最多 ${f.max} 層）` : `Every ${f.every}s: ${stat(f.stat)} +${pc(f.v)}% (max ${f.max} stacks)`;
      case 'moody': return Z ? '每 15 秒隨機強化攻擊、速度或防禦其中一項' : 'Every 15s, randomly boosts Attack, Speed or Defense';
      case 'aura': return Z ? `每 ${f.every} 秒讓 ${f.r} 範圍內的敵人${f.st === 'dmg' ? '受到傷害' : D.st[f.st]}` : `Every ${f.every}s, enemies within ${f.r} get ${D.st[f.st]}`;
      case 'hitpulse': return Z ? `被打中時${f.st === 'heal' ? '回復 ' + pc(f.v) + '% 生命' : '周圍敵人' + D.st[f.st]}（每 3 秒一次）` : `When hit: ${f.st === 'heal' ? 'heals ' + pc(f.v) + '% HP' : 'nearby enemies get ' + D.st[f.st]} (every 3s)`;
      case 'weather': return Z ? `每 ${f.every} 秒召喚${D.wx[f.kind]}（${dur(f.dur)}）` : `Every ${f.every}s, summons ${D.wx[f.kind]} (${dur(f.dur)})`;
      case 'ohweather': return Z ? `被打中時召喚${D.wx[f.kind]}（每 60 秒一次）` : `When hit, summons ${D.wx[f.kind]} (every 60s)`;
      case 'adaptRes': return Z ? `被某屬性打中後，${f.dur} 秒內該屬性傷害 −${pc(f.v)}%` : `After being hit by a type, takes −${pc(f.v)}% from it for ${f.dur}s`;
      case 'scale': return Z ? `每擊倒 ${f.per} 隻，${stat(f.stat)} +${pc(f.v)}%（最多 +${pc(f.max)}%）` : `Per ${f.per} KOs: ${stat(f.stat)} +${pc(f.v)}% (up to +${pc(f.max)}%)`;
      default: return f.k;
    }
  }
  const describe = id => ((G.ABILITY_FX[id] || {}).fx || []).map(line);

  function nameOf(id) {
    const a = G.ABILITIES[id];
    if (!a) return '#' + id;
    const l = lang();
    return (l === 'zh-Hans' ? a.zhs : String(l).startsWith('zh') ? a.zh : l === 'ja' ? a.ja : a.en) || a.en || a.zh;
  }
  /** Texto oficial de la habilidad (en el idioma si existe). */
  function officialOf(id) {
    const a = G.ABILITIES[id];
    if (!a) return '';
    return zh() ? (a.descZh || a.descEn || a.desc) : (a.descEn || a.desc);
  }

  return {
    set, offer, isFinal, describe, line, nameOf, officialOf,
    atk, spd, cd, def, crit, critdmg, regen, magnet, xp, coin, noWeather, noEnv,
    incoming, sturdy, afterHurt, contact, dealt, kill, tick
  };
})();
