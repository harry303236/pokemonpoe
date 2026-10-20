/* ============ support.js — movimientos de apoyo (PokemonPOE) ============
 * Curar, proteger y provocar. No hacen daño; el rol de cada uno (tanque, sanador...)
 * sale de los movimientos que lleves, no del tipo del Pokémon.
 *
 *   heal     cura un % de la vida máxima (a ti y a los de alrededor)    amount, radius, cure
 *   shield   escudo que absorbe daño (a ti o a los de alrededor)        amount, dur, radius
 *   guard    reduce el daño físico / especial / ambos de los de alrededor  amount, dur, radius, gcat
 *   taunt    los enemigos cercanos te persiguen a ti; tú recibes menos    radius, dur, guard
 *   protect  invulnerable un momento                                      dur
 *   rally    sube la velocidad de movimiento de los de alrededor         amount, dur, radius
 *   wish     cura un % pasado `delay` segundos (a quien estaba en radio) amount, delay, radius
 *   synth    cura al lanzador; más con sol, menos con otro clima         amount
 *   weather  pone un clima del juego (`wx`) durante `dur`                wx, dur
 *   field    zona quieta: field 'heal' (vida/s) o 'haste' (ataque)       field, amount, dur, radius
 *   control  sin daño: ctrl 'stun' o 'burn' a los enemigos del radio     ctrl, radius, stun, burn
 *   haste    los de alrededor atacan más rápido (baja su recarga)        amount, dur, radius
 *
 * Cooperativo: cada uno recibe el efecto en SU aparato. Cuando un compañero lanza un apoyo,
 * llega como "fantasma" (combat.ghostCast): si estás dentro de su radio, te lo aplicas tú.
 * La provocación sí se anota también en el fantasma, porque quien mueve a los enemigos
 * es el anfitrión (enemy.js: nearestPlayer).
 */
G.Support = (() => {
  const KINDS = new Set(['heal', 'shield', 'guard', 'taunt', 'protect', 'rally',
    'wish', 'synth', 'weather', 'field', 'control', 'haste']);
  let zones = [];
  let zoneFx = 0;
  const now = () => performance.now() / 1000;
  const palOf = pl => (pl.mon && pl.mon.types && pl.mon.types[0]) || 'normal';
  const colOf = pl => G.U.TYPE_COLOR[palOf(pl)] || '#ffffff';
  const R = G.U.rand;

  function allies(pl) { return G.Coop.active ? G.Coop.players() : [pl]; }

  /** ¿Vale la pena lanzarlo ahora? (así no se gasta la recarga con la vida llena y sin enemigos) */
  function ready(pl, m) {
    switch (m.kind) {
      case 'heal':
      case 'wish':
      case 'synth': {
        const r2 = (m.radius || 0) ** 2;
        return allies(pl).some(a => !a.dead && (a === pl || (r2 && G.U.dist2(a.x, a.y, pl.x, pl.y) <= r2)) &&
          (a.hp < a.maxHp * 0.93 || (m.cure && a.slowT > 0)));
      }
      case 'weather': {
        const w = G.Weather.current;
        if (w && w.kind === m.wx && w.left > 5) return false;
        return G.EnemyMgr.queryCircle(pl.x, pl.y, 420).length > 0;
      }
      case 'control': return G.EnemyMgr.queryCircle(pl.x, pl.y, m.radius || 160).length > 0;
      case 'taunt': return G.EnemyMgr.queryCircle(pl.x, pl.y, m.radius).length > 0;
      default: return G.EnemyMgr.queryCircle(pl.x, pl.y, 380).length > 0;
    }
  }

  /** A quién le toca: si es tu lanzamiento, a ti; si es de un compañero, a ti sólo si estás en su radio. */
  function targets(pl, m, ghost) {
    if (!ghost) return [pl];
    const me = G.Game.player;
    if (!me || me === pl || me.dead || !m.radius) return [];
    return G.U.dist2(me.x, me.y, pl.x, pl.y) <= m.radius * m.radius ? [me] : [];
  }

  function sparkle(shape, pal, p, n, vy) {
    for (let i = 0; i < n; i++) {
      G.FX.sp(shape, pal, p.x + R(-p.r * 1.3, p.r * 1.3), p.y - R(0, p.bodyH * 0.9), { vy, life: 0.7 });
    }
  }

  function cast(pl, m, ghost) {
    const col = colOf(pl), pal = palOf(pl);
    const rad = m.radius || 0;
    switch (m.kind) {
      case 'heal': {
        G.FX.ring(pl.x, pl.y, 8, rad || pl.r * 3, col, 0.5, 3);
        for (const t of targets(pl, m, ghost)) {
          t.heal(t.maxHp * m.amount);
          if (m.cure) t.slowT = 0;
          sparkle('heart', pal, t, 3, -60);
        }
        break;
      }
      case 'shield': {
        G.FX.ring(pl.x, pl.y, 6, rad || pl.r * 3.2, col, 0.4, 3);
        for (const t of targets(pl, m, ghost)) {
          t.shield = Math.max(t.shield || 0, t.maxHp * m.amount);
          t.shieldT = m.dur;
          sparkle('star', pal, t, 3, -30);
        }
        break;
      }
      case 'guard': {
        G.FX.ring(pl.x, pl.y, rad * 0.4, rad, col, 0.5, 3);
        for (const t of targets(pl, m, ghost)) {
          const both = !m.gcat || m.gcat === 'both';
          if (both || m.gcat === 'physical') t.guard.physical = [m.amount, m.dur];
          if (both || m.gcat === 'special') t.guard.special = [m.amount, m.dur];
          sparkle('star', pal, t, 2, -25);
        }
        break;
      }
      case 'taunt': {
        // Se anota también en el fantasma: el anfitrión necesita saber a quién siguen los enemigos.
        pl.tauntUntil = now() + m.dur;
        pl.tauntR = rad;
        G.FX.ring(pl.x, pl.y, rad, rad * 0.35, col, 0.45, 3);
        if (m.guard && !ghost) { pl.guard.physical = [m.guard, m.dur]; pl.guard.special = [m.guard, m.dur]; }
        sparkle('arrow', pal, pl, 3, -80);
        break;
      }
      case 'protect': {
        if (!ghost) pl.invuln = Math.max(pl.invuln, m.dur);
        G.FX.ring(pl.x, pl.y, 6, pl.r * 3.4, col, m.dur, 4);
        sparkle('star', pal, pl, 4, -40);
        break;
      }
      case 'rally': {
        G.FX.ring(pl.x, pl.y, 8, rad, col, 0.5, 3);
        for (const t of targets(pl, m, ghost)) {
          t.addBuff('spd', m.amount, m.dur, 1);
          sparkle('arrow', pal, t, 3, -70);
        }
        break;
      }
      case 'wish': {
        G.FX.ring(pl.x, pl.y, 8, rad || pl.r * 3, col, 0.45, 3);
        for (const t of targets(pl, m, ghost)) {
          t.wishes = t.wishes || [];
          t.wishes.push({ t: m.delay || 3.5, amount: m.amount });
          sparkle('star', pal, t, 3, -50);
        }
        break;
      }
      case 'synth': {
        let amt = m.amount;
        const w = G.Weather.current;
        if (w && w.kind === 'sun') amt *= 1.55;
        else if (w && (w.kind === 'rain' || w.kind === 'sand' || w.kind === 'snow')) amt *= 0.6;
        if (!ghost) {
          pl.heal(pl.maxHp * amt);
          sparkle('heart', pal, pl, 4, -50);
        }
        G.FX.ring(pl.x, pl.y, 6, pl.r * 3.2, '#b6f27a', 0.45, 3);
        break;
      }
      case 'weather': {
        G.FX.ring(pl.x, pl.y, 12, 280, col, 0.6, 4);
        // El clima lo pone quien manda (solo, o el anfitrión al ver el lanzamiento).
        if (!G.Coop.active || G.Coop.isHost) {
          if (!ghost || G.Coop.isHost) {
            G.Weather.force(m.wx, m.dur);
            if (G.Coop.isHost) G.Coop.broadcast(['wx', m.wx, m.dur]);
          }
        }
        break;
      }
      case 'field': {
        zones.push({ x: pl.x, y: pl.y, r: rad || 160, t: m.dur || 6, mode: m.field || 'heal',
          amount: m.amount || 0, col });
        G.FX.ring(pl.x, pl.y, 10, rad || 160, col, 0.5, 3);
        break;
      }
      case 'control': {
        G.FX.ring(pl.x, pl.y, rad * 0.3, rad, col, 0.4, 3);
        // El daño de estado lo aplica el dueño del lanzamiento. En el invitado,
        // applyStun/applyBurn de una copia avisa al anfitrión (no repetir en el fantasma).
        if (ghost) break;
        for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, rad || 160)) {
          if (m.ctrl === 'burn') e.applyBurn(m.burn || 1);
          else e.applyStun(e.boss ? Math.min(0.45, (m.stun || 1) * 0.45) : (m.stun || 1));
        }
        break;
      }
      case 'haste': {
        G.FX.ring(pl.x, pl.y, 8, rad, col, 0.5, 3);
        for (const t of targets(pl, m, ghost)) {
          t.hasteAmt = Math.max(t.hasteAmt || 0, m.amount || 0);
          t.hasteT = Math.max(t.hasteT || 0, m.dur || 4);
          sparkle('arrow', pal, t, 3, -40);
        }
        break;
      }
    }
  }

  /** Los enemigos van a por el que provoca, si está lo bastante cerca. */
  function taunter(players, x, y) {
    const t = now();
    let best = null, bd = Infinity;
    for (const p of players) {
      if (p.dead || !(p.tauntUntil > t)) continue;
      const d = G.U.dist2(x, y, p.x, p.y);
      if (d <= (p.tauntR + 40) ** 2 && d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** Reducción de daño por escudos de grupo según la categoría del golpe. */
  function guardOf(pl, cat) {
    const a = pl.guard.physical, b = pl.guard.special;
    const pa = a[1] > 0 ? a[0] : 0, sb = b[1] > 0 ? b[0] : 0;
    return cat === 'physical' ? pa : cat === 'special' ? sb : Math.min(pa, sb);
  }

  function tick(pl, dt) {
    if (pl.guard.physical[1] > 0) pl.guard.physical[1] -= dt;
    if (pl.guard.special[1] > 0) pl.guard.special[1] -= dt;
    if (pl.shield > 0 && (pl.shieldT -= dt) <= 0) pl.shield = 0;
    if (pl.shield > 0 && (pl._shT = (pl._shT || 0) - dt) <= 0) {
      pl._shT = 0.6;
      G.FX.ring(pl.x, pl.y - pl.bodyH * 0.5, pl.bodyH * 0.55, pl.bodyH * 0.7, '#9fd8ff', 0.5, 2);
    }
    if (pl.hasteT > 0 && (pl.hasteT -= dt) <= 0) pl.hasteAmt = 0;
    if (pl.wishes && pl.wishes.length) {
      for (let i = pl.wishes.length - 1; i >= 0; i--) {
        if ((pl.wishes[i].t -= dt) > 0) continue;
        const w = pl.wishes.splice(i, 1)[0];
        if (!pl.dead) {
          pl.heal(pl.maxHp * w.amount);
          sparkle('heart', palOf(pl), pl, 4, -55);
          G.FX.ring(pl.x, pl.y, 6, pl.r * 3.4, '#ffe9a0', 0.4, 3);
        }
      }
    }
    // Las zonas viven en este módulo y sólo las cuenta el jugador local (un tick por frame).
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      z.t -= dt;
      if (z.t <= 0) { zones.splice(i, 1); continue; }
      if (pl.dead || G.U.dist2(pl.x, pl.y, z.x, z.y) > z.r * z.r) continue;
      if (z.mode === 'heal') pl.heal(pl.maxHp * z.amount * dt);
      else if (z.mode === 'haste') {
        pl.hasteAmt = Math.max(pl.hasteAmt || 0, z.amount);
        pl.hasteT = Math.max(pl.hasteT || 0, 0.35);
      }
    }
    zoneFx -= dt;
    if (zoneFx <= 0 && zones.length) {
      zoneFx = 0.5;
      for (const z of zones) G.FX.ring(z.x, z.y, z.r * 0.92, z.r, z.col, 0.45, 2);
    }
  }

  function reset() { zones = []; zoneFx = 0; }

  return { KINDS, ready, cast, taunter, guardOf, tick, reset };
})();
