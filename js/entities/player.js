/* ============ player.js — el Pokémon que controlas ============
 * (x, y) son los PIES. Sólo UN movimiento está activo a la vez: se dispara
 * solo y se cambia con 1-4 / Q / E. Cada disparo reproduce la animación de
 * ataque de Mundo Misterioso que le toca (Attack, Shoot o Charge).
 */
G.Player = class Player {
  /**
   * @param mon   entrada de G.DEX
   * @param perks mejoras permanentes ya resueltas (ver data/upgrades.js)
   */
  constructor(mon, perks = {}, shiny = false) {
    this.mon = mon;
    this.ability = null;       // PokemonPOE: habilidad elegida (js/systems/abilities.js)
    this.dex = mon.dex;
    this.shiny = shiny && G.Sprites.hasShiny(mon.dex);
    // Los grandes, algo más pequeños y con el choque de uno normal (ver sprites.js).
    this.scale = G.Sprites.playerScale(mon.dex);
    this.anim = new G.Sprites.Animator(mon.dex, this.scale, this.shiny);
    this.x = 0; this.y = 0;
    this.r = G.Sprites.playerRadius(mon.dex);
    this.bodyH = G.Sprites.bodyHeight(mon.dex, this.scale);

    this.atkMul = perks.atkMul || 1;
    this.spdMul = perks.spdMul || 1;
    this.cdMul = perks.cdMul || 1;
    this.dmgReduce = perks.dmgReduce || 0;
    this.regenFlat = perks.regen || 0;
    this.magnet = 78 * (perks.magnetMul || 1);
    this.xpMul = perks.xpMul || 1;
    this.coinMul = perks.coinMul || 1;

    this.maxHp = mon.hp + (perks.hp || 0);
    this.hp = this.maxHp;
    this.baseSpd = mon.spd;
    this.baseAtk = mon.atk;

    this.moves = [];           // todos los movimientos aprendidos
    this.slots = [];           // 4 teclas: cada una es [principal, ...ranuras] o null
    this.active = 0;           // tecla activa (0-3). Un null no se puede elegir.
    this.maxMoves = 4;         // teclas (la 1 y la 2 atacan; la 3 y la 4 son de oficio)

    // patk / satk: Danza Espada y Danza Dragón (físico) y Maquinación (especial).
    this.buffs = {
      atk: { n: 0, t: 0, amount: 0 },
      patk: { n: 0, t: 0, amount: 0 },
      satk: { n: 0, t: 0, amount: 0 },
      spd: { n: 0, t: 0, amount: 0 },
      def: { n: 0, t: 0, amount: 0 },
      regen: { n: 0, t: 0, amount: 0 }
    };

    this.level = 1;
    this.xp = 0;
    this.xpNext = Player.xpFor(1);
    this.kills = 0;
    this.bosses = 0;
    this.rerolls = 0;          // veces que ha cambiado las cartas de nivel en esta run
    this.rerollBonus = perks.rerolls || 0;   // cambios comprados en Mejoras (más el gratis)
    this.critChance = perks.crit || 0;       // probabilidad de golpe crítico (Mejoras)
    this.banned = new Set();                 // movimientos vetados (Mejoras → Veto): no salen en las cartas
    this.bind = {};                          // movimiento -> hueco fijo (0-3), elegido en Mejoras
    this.coins = 0;            // monedas recogidas en esta run
    this.t1 = 0; this.t10 = 0; // tickets del gacha recogidos en esta run
    this.dmgDealt = 0;

    this.invuln = 0;
    this.flash = 0;
    this.aim = Math.PI / 2;
    this.moveAngle = Math.PI / 2;
    this.walking = false;
    this.inLiquid = false;
    this.lavaTick = 0;
    this.attackFace = 0;       // tiempo que sigue mirando al objetivo tras atacar
    this.dead = false;
    this.power = null;         // poder de altar activo: { def, t, dur }
    this.slowT = 0;            // pegado por una trampa
    // Apoyo (systems/support.js)
    this.shield = 0; this.shieldT = 0;                         // escudo que absorbe daño
    this.guard = { physical: [0, 0], special: [0, 0] };        // [reducción, segundos] de Reflejo / Pantalla de Luz / Velo Aurora
    this.tauntUntil = 0; this.tauntR = 0;                      // Mofa / Señuelo: hasta cuándo y hasta dónde atraes
    this.hasteT = 0; this.hasteAmt = 0;                        // Arenga / Campo Eléctrico: atacas más rápido
    this.wishes = [];                                          // Deseo: curas pendientes { t, amount }
    this.item = null;          // objeto equipado (data/items.js), uno por run
    this.sashT = -999;         // última vez que salvó la Banda Focus
    this.bellHeal = 0;         // curación pendiente del Cascabel Concha
    this.statsTaken = {};      // mejoras de stat cogidas (condición de evolución)
  }

  /** Segundos que hay que estar junto a un compañero caído para levantarlo. */
  static get REVIVE_TIME() { return 3; }

  // (×2 y luego ×4 el 2026-10-10: se subía de nivel demasiado rápido.)
  static xpFor(level) {
    return Math.floor((8 + level * 6 + Math.pow(level, 1.75) * 1.6) * 4);
  }

  cy() { return this.y; }

  // ---------------- stats efectivos ----------------
  get atk() { return this.baseAtk * this.atkMul * (1 + this.buffs.atk.n * this.buffs.atk.amount); }
  /**
   * Ataque con un movimiento: el físico o el especial de tu Pokémon (ver
   * G.Stats), con las danzas que sean de su lado (las de mejora, sin ninguna).
   */
  atkFor(m) {
    const cat = m && m.cat, b = cat === 'physical' ? this.buffs.patk : cat === 'special' ? this.buffs.satk : null;
    return this.atk * G.Stats.fit(this.mon, cat) * (b ? 1 + b.n * b.amount : 1) * (m && this.monoType(m.type) ? Player.MONO_K : 1) * G.Abilities.atk(this, m);
  }
  /** Monotipo (19-10-2026): los de un solo tipo pegan un +20 % con los ataques de su tipo (tienen menos variedad). */
  static get MONO_K() { return 1.2; }
  monoType(type) { return this.mon.types.length === 1 && type === this.mon.types[0]; }
  /** Recarga: mejoras permanentes y, encima, Arenga o un campo que acelere el ataque. */
  cdScale() {
    const h = this.hasteT > 0 ? (1 - Math.min(0.55, this.hasteAmt || 0)) : 1;
    return this.cdMul * h;
  }
  get spd() {
    const s = this.baseSpd * this.spdMul * (1 + this.buffs.spd.n * this.buffs.spd.amount) * (this.slowT > 0 ? 0.5 : 1) * G.Abilities.spd(this);
    const w0 = G.Weather.speedFor(this.mon.types), w = G.Abilities.noWeather(this) ? Math.max(1, w0) : w0;
    const slow = this.inLiquid ? G.World.liquidEffect(this.mon.types).slow || 1 : 1;
    return G.Judgment && G.Judgment.active ? G.Judgment.capSpd(s * slow * w) : s * slow * w;
  }
  get reduction() { return Math.min(0.8, Math.max(-0.3, this.dmgReduce + this.buffs.def.n * this.buffs.def.amount + G.Abilities.def(this))); }
  get regen() { return this.regenFlat + this.buffs.regen.n * this.buffs.regen.amount + Math.max(0, G.Abilities.regen(this)); }

  // ---------------- movimientos ----------------
  addMove(id) {
    if (this.hasMove(id)) return false;
    const where = this.placeHome(id);
    // Un principal nuevo sólo entra en una tecla de su familia. Si sólo queda
    // ranura, lo mete learn() con learnInto; aquí no se empuja al final.
    if (!where || where.kind !== 'slot') return false;
    const m = G.Moves.instance(id, 1);
    m.since = G.Game.st.time;          // desde cuándo lo tienes (daño por segundo en el resumen)
    this.moves.push(m);
    const group = [m];
    const cur = this.slots[this.active] || null;
    this.padSlots();
    this.slots[where.index] = group;
    this.arrange();
    // Te quedas con el que llevabas (18-10-2026: antes se cambiaba solo al nuevo
    // y te quitaba el ataque que estabas usando). Sólo si no tenías ninguno, el nuevo.
    const stay = cur && this.slots.includes(cur) ? cur : group;
    const i = this.slots.indexOf(stay);
    if (i >= 0) this.active = i;
    return true;
  }

  /** Las 4 teclas existen siempre, aunque estén vacías (null no es un grupo). */
  padSlots() {
    while (this.slots.length < this.maxMoves) this.slots.push(null);
  }

  /**
   * Atajos (Mejoras): el número es de la TECLA, no del movimiento. Una cura
   * atada a la tecla 1 se ignora y va a la primera tecla de oficio libre.
   * Nunca se compacta: un hueco vacío en medio es la tecla que falta.
   */
  arrange() {
    const groups = [];
    for (const g of this.slots) if (g && g.length) groups.push(g);
    if (!groups.length) return;
    const cur = this.slots[this.active] || null;
    const out = new Array(this.maxMoves).fill(null);
    const placed = new Set();
    const want = g => {
      if (!this.bind) return null;
      let k = Infinity;
      for (const m of g) if (this.bind[m.id] != null) k = Math.min(k, this.bind[m.id]);
      if (k === Infinity || k < 0 || k >= this.maxMoves || out[k]) return null;
      if (!this.groupFits(g, k)) return null;
      return k;
    };
    const bound = groups.filter(g => want(g) != null).sort((a, b) => want(a) - want(b));
    for (const g of bound) {
      const k = want(g);
      if (k == null || out[k]) continue;
      out[k] = g;
      placed.add(g);
    }
    for (const g of groups) {
      if (placed.has(g)) continue;
      const curI = this.slots.indexOf(g);
      const home = G.Moves.homeOf(g[0]);
      const pref = [];
      if (curI >= 0 && curI < this.maxMoves) pref.push(curI);
      for (const c of (home === 'front' ? [0, 1] : [2, 3])) if (!pref.includes(c)) pref.push(c);
      let dest = null;
      for (const c of pref) if (!out[c] && this.groupFits(g, c)) { dest = c; break; }
      // Sin tecla legal no se tira el grupo: se queda donde estaba.
      if (dest == null && curI >= 0 && curI < this.maxMoves && !out[curI]) dest = curI;
      if (dest == null) { for (let c = 0; c < this.maxMoves; c++) if (!out[c]) { dest = c; break; } }
      if (dest != null) out[dest] = g;
    }
    this.slots = out;
    const stay = cur && out.includes(cur) ? cur : null;
    if (stay) this.active = out.indexOf(stay);
    else if (!out[this.active]) {
      const i = out.findIndex(g => g);
      if (i >= 0) this.active = i;
    }
  }

  /**
   * Evoluciona (PokemonPOE): cambia de especie conservando nivel, movimientos y ranuras.
   * La vida máxima, la velocidad y el ataque base suben (o bajan) lo que difiera la nueva
   * especie, así se respetan las cartas y mejoras ya cogidas.
   */
  evolveTo(mon) {
    const old = this.mon;
    this.mon = mon;
    this.dex = mon.dex;
    this.shiny = this.shiny && G.Sprites.hasShiny(mon.dex);
    this.scale = G.Sprites.playerScale(mon.dex);
    this.anim = new G.Sprites.Animator(mon.dex, this.scale, this.shiny);
    this.r = G.Sprites.playerRadius(mon.dex);
    this.bodyH = G.Sprites.bodyHeight(mon.dex, this.scale);
    const dHp = mon.hp - old.hp;
    this.maxHp += dHp;
    this.hp = Math.min(this.maxHp, Math.max(1, this.hp + Math.max(0, dHp)));
    this.baseSpd += mon.spd - old.spd;
    this.baseAtk += mon.atk - old.atk;
    this.evolved = (this.evolved || 0) + 1;
    this.invuln = Math.max(this.invuln, 1.2);
  }

  hasMove(id) { return this.moves.some(m => m.id === id); }

  setActive(i) {
    const g = this.slots[i];
    if (i < 0 || i >= this.maxMoves || !g || !g.length || i === this.active) return;
    // Cinta Elección: no se puede cambiar de movimiento.
    if (this.hasItem('choiceband') && this.slots[this.active]) {
      G.FX.dmgText(this.x, this.y - this.bodyH - 8, 'Cinta Elección', '#ff8ad8');
      return;
    }
    this.active = i;
    G.Projectiles.clearOrbs(this);
    G.Audio.sfx('select');
    for (const m of g) m.t = Math.min(m.t, m.cd * 0.35);
    const m = g[0];
    G.FX.ring(this.x, this.y - G.LIFT * 0.5, 6, this.r * 3.4, G.U.TYPE_COLOR[m.type], 0.3, 3);
  }

  cycle(dir) {
    if (!this.slots.some(g => g && g.length)) return;
    const n = this.maxMoves;
    for (let k = 1; k <= n; k++) {
      const i = (this.active + dir * k + n) % n;
      if (this.slots[i] && this.slots[i].length) { this.setActive(i); return; }
    }
  }

  // ---------------- ranuras (insertar movimientos en otro movimiento) ----------------
  // PokemonPOE: sustituye a los "vínculos" de PokéSurvivor (que daban los legendarios).
  // Cada tecla (this.slots[i]) es un GRUPO: [movimiento principal, ...insertados], o null.
  // Los insertados se lanzan a la vez que el principal, cada uno con su recarga, y
  // no tienen tecla propia. Las ranuras son de la TECLA, no del movimiento:
  //   tecla 1: 4 (Nv.5, 10, 15, 20)   tecla 2: 3 (Nv.5, 10, 15)
  //   tecla 3: 2 (Nv.10, 20)          tecla 4: 2 (Nv.15, 20)
  // La 1 y la 2 son de ataque (daño, danza de ataque, clima que potencia, prisa).
  // La 3 y la 4 son de oficio (curar, proteger, provocar, control sin daño).
  // Una cura sólo puede ser el principal de la 3 o la 4, y sólo una en total.
  static get SOCKET_PLAN() {
    return Player._SOCKET_PLAN || (Player._SOCKET_PLAN = [[5, 10, 15, 20], [5, 10, 15], [10, 20], [15, 20]]);
  }

  /** Ranuras abiertas de una tecla (0-3) o del grupo que la ocupa ahora. */
  socketCap(which) {
    let i = -1;
    if (typeof which === 'number') i = which;
    else if (Array.isArray(which)) i = this.slots.indexOf(which);
    if (i < 0 || i >= this.maxMoves) return 0;
    const plan = Player.SOCKET_PLAN[i] || [];
    let n = 0;
    for (const lv of plan) if (this.level >= lv) n++;
    return n;
  }

  /** Tope de ranuras de esa tecla (aunque aún no se hayan abierto). */
  socketMax(i) { return (Player.SOCKET_PLAN[i] || []).length; }

  /** Ranuras libres de un grupo, según la tecla en la que está. */
  freeSockets(group) {
    if (!group) return 0;
    return Math.max(0, this.socketCap(group) - (group.length - 1));
  }

  hasFreeSocket() { return this.slots.some(g => g && this.freeSockets(g) > 0); }

  /** ¿Cabe algún movimiento nuevo en alguna tecla o ranura? (peso de las cartas de stat). */
  canLearn() {
    for (let i = 0; i < this.maxMoves; i++) if (!this.slots[i]) return true;
    return this.hasFreeSocket();
  }

  /** La cura que ya llevas (principal o, si se coló, en una ranura). */
  healOwner() {
    for (const g of this.slots) {
      if (!g) continue;
      for (const m of g) if (G.Moves.homeOf(m) === 'heal') return m;
    }
    return null;
  }

  /**
   * ¿Este movimiento puede ocupar esa tecla?
   * asMain: va a ser el principal. Una cura nunca va en ranura, ni habiendo otra.
   * `m` puede ser la instancia (al arrastrarla) o el id (al aprenderla).
   */
  moveFits(m, col, asMain) {
    if (col < 0 || col >= this.maxMoves) return false;
    const home = G.Moves.homeOf(m);
    if (home === 'front') return col < 2;
    if (col < 2) return false;
    if (home !== 'heal') return true;
    if (!asMain) return false;
    const cur = this.healOwner();
    return !cur || cur === m;
  }

  /** ¿Cabe el grupo entero en esa tecla (número de ranuras y familia de cada uno)? */
  groupFits(group, col) {
    if (!group || !group.length || col < 0 || col >= this.maxMoves) return false;
    if (group.length - 1 > this.socketCap(col)) return false;
    for (let i = 0; i < group.length; i++) if (!this.moveFits(group[i], col, i === 0)) return false;
    return true;
  }

  /**
   * Dónde aprender `id`. Primero una tecla vacía de su familia; si no es cura,
   * luego una ranura libre de esa familia. null si no hay sitio legal.
   */
  placeHome(id) {
    if (this.hasMove(id)) return null;
    const home = G.Moves.homeOf(id);
    const cols = home === 'front' ? [0, 1] : [2, 3];
    for (const i of cols) {
      if (this.slots[i]) continue;
      if (this.moveFits(id, i, true)) return { kind: 'slot', index: i };
    }
    if (home === 'heal') return null;
    for (const i of cols) {
      const g = this.slots[i];
      if (g && this.freeSockets(g) > 0 && this.moveFits(id, i, false)) return { kind: 'socket', group: g };
    }
    return null;
  }

  /** El grupo al que pertenece un movimiento. */
  groupOf(m) {
    if (!m) return null;
    for (const g of this.slots) if (g && g.includes(m)) return g;
    return null;
  }

  /** Aprende un movimiento nuevo directamente dentro de una ranura libre de `group`. */
  learnInto(id, group) {
    const col = this.slots.indexOf(group);
    if (this.hasMove(id) || col < 0 || this.freeSockets(group) <= 0 || !this.moveFits(id, col, false)) return false;
    const m = G.Moves.instance(id, 1);
    m.since = G.Game.st.time;          // desde cuándo lo tienes (daño por segundo en el resumen)
    this.moves.push(m);
    group.push(m);
    this.arrange();
    return true;
  }

  /**
   * Mete un movimiento que tiene tecla propia (y ninguna ranura ocupada) en una
   * ranura libre de otro grupo: esa tecla queda vacía, no se corren las demás.
   */
  insert(m, group) {
    const from = this.groupOf(m);
    const col = this.slots.indexOf(group);
    if (!from || from.length !== 1 || from === group || col < 0 || this.freeSockets(group) <= 0) return false;
    if (!this.moveFits(m, col, false)) return false;
    const fromI = this.slots.indexOf(from);
    this.slots[fromI] = null;
    group.push(m);
    if (this.active === fromI || !this.slots[this.active]) this.active = col;
    G.Projectiles.clearOrbs(this);
    return true;
  }

  /** Saca un movimiento insertado y lo pone de principal en la tecla `col`. */
  eject(m, col) {
    const g = this.groupOf(m);
    if (!g || g[0] === m) return false;
    if (col == null) {
      const cols = G.Moves.homeOf(m) === 'front' ? [0, 1] : [2, 3];
      col = cols.find(i => !this.slots[i] && this.moveFits(m, i, true));
    }
    if (col == null || col < 0 || col >= this.maxMoves || this.slots[col] || !this.moveFits(m, col, true)) return false;
    g.splice(g.indexOf(m), 1);
    this.padSlots();
    this.slots[col] = [m];
    G.Projectiles.clearOrbs(this);
    return true;
  }

  /** Pasa un movimiento insertado a una ranura libre de otro grupo. */
  transfer(m, group) {
    const from = this.groupOf(m);
    const col = this.slots.indexOf(group);
    if (!from || from[0] === m || from === group || col < 0 || this.freeSockets(group) <= 0) return false;
    if (!this.moveFits(m, col, false)) return false;
    from.splice(from.indexOf(m), 1);
    group.push(m);
    G.Projectiles.clearOrbs(this);
    return true;
  }

  /** ¿Intercambiar m y t deja los dos grupos en teclas legales? */
  exchangeOk(m, t) {
    const gm = this.groupOf(m), gt = this.groupOf(t);
    if (!gm || !gt || m === t) return false;
    const i = this.slots.indexOf(gm), j = this.slots.indexOf(gt);
    if (i < 0 || j < 0) return false;
    if (gm === gt) {
      const g2 = gm.slice();
      const a = gm.indexOf(m), b = gm.indexOf(t);
      g2[a] = t; g2[b] = m;
      return this.groupFits(g2, i);
    }
    if (gm[0] === m && gt[0] === t) return this.groupFits(gm, j) && this.groupFits(gt, i);
    const gm2 = gm.slice(), gt2 = gt.slice();
    gm2[gm.indexOf(m)] = t;
    gt2[gt.indexOf(t)] = m;
    return this.groupFits(gm2, i) && this.groupFits(gt2, j);
  }

  /**
   * Arrastrar y soltar (pantalla de Tab). Coloca el movimiento `m` sobre:
   *   { move: t }     otro movimiento: se cambian, si los dos grupos siguen siendo legales
   *   { group: g }    una ranura libre del grupo g
   *   { column: n }   una tecla vacía: el grupo entero si arrastras el principal,
   *                   o sólo `m` si estaba en una ranura
   * Con dry = true sólo comprueba si se puede, sin tocar nada.
   */
  dropMove(m, to, dry = false) {
    const gm = this.groupOf(m);
    if (!gm || !to) return false;
    if (to.move) {
      const t = to.move;
      if (!this.exchangeOk(m, t)) return false;
      if (dry) return true;
      const gt = this.groupOf(t);
      if (gm[0] === m && gt[0] === t) {
        const cur = this.slots[this.active] || null;
        const i = this.slots.indexOf(gm), j = this.slots.indexOf(gt);
        this.slots[i] = gt; this.slots[j] = gm;
        if (cur) { const ai = this.slots.indexOf(cur); if (ai >= 0) this.active = ai; }
      } else {
        const a = gm.indexOf(m), b = gt.indexOf(t);
        gm[a] = t; gt[b] = m;
      }
      G.Projectiles.clearOrbs(this);
      return true;
    }
    if (to.group) {
      const g = to.group;
      const col = this.slots.indexOf(g);
      if (col < 0 || g === gm || this.freeSockets(g) <= 0 || !this.moveFits(m, col, false)) return false;
      if (gm[0] === m) { if (gm.length !== 1) return false; return dry ? true : this.insert(m, g); }
      return dry ? true : this.transfer(m, g);
    }
    if (to.column != null) {
      const col = to.column | 0;
      if (col < 0 || col >= this.maxMoves || this.slots[col]) return false;
      if (gm[0] === m) {
        if (!this.groupFits(gm, col)) return false;
        if (dry) return true;
        const fromI = this.slots.indexOf(gm);
        const was = this.active === fromI;
        this.slots[fromI] = null;
        this.padSlots();
        this.slots[col] = gm;
        if (was || !this.slots[this.active]) this.active = col;
        G.Projectiles.clearOrbs(this);
        return true;
      }
      if (!this.moveFits(m, col, true)) return false;
      return dry ? true : this.eject(m, col);
    }
    return false;
  }

  /** Un insertado pasa a principal de su grupo, si sigue siendo legal (una cura no puede quedar en ranura). */
  promote(m) {
    const g = this.groupOf(m);
    if (!g || g[0] === m) return false;
    const col = this.slots.indexOf(g);
    const i = g.indexOf(m);
    const g2 = g.slice();
    g2[0] = m; g2[i] = g[0];
    if (!this.groupFits(g2, col)) return false;
    g[0] = m; g[i] = g2[i];
    G.Projectiles.clearOrbs(this);
    return true;
  }

  /** Movimientos que se lanzan ahora (el grupo del hueco activo). */
  activeGroup() { return this.slots[this.active] || []; }

  activeMove() { return this.activeGroup()[0]; }

  /**
   * Lo llama combat.js al lanzar un movimiento. Elige la animación de PMD y la
   * acelera si la recarga es más corta que la animación, para que encadene.
   */
  cast(m) {
    // Vidasfera: cada ataque cuesta un poco de vida (nunca te deja KO).
    if (this.hasItem('lifeorb') && m.kind !== 'orbit' && m.kind !== 'trail' && !this.remote) {
      this.hp = Math.max(1, this.hp - Math.max(1, this.maxHp * 0.01));
    }
    const anim = { melee: 'Attack', beam: 'Shoot', projectile: 'Shoot', nova: 'Attack',
                   aura: 'Charge', buff: 'Charge', orbit: 'Charge', boomerang: 'Shoot', chain: 'Shoot',
                   mine: 'Charge', meteor: 'Charge', turret: 'Charge', dash: 'Attack', trail: 'Walk', cone: 'Shoot',
                   heal: 'Charge', shield: 'Charge', guard: 'Charge', taunt: 'Attack', protect: 'Charge', rally: 'Charge',
                   wish: 'Charge', synth: 'Charge', weather: 'Charge', field: 'Charge', control: 'Attack', haste: 'Charge' }[m.kind] || 'Attack';
    // Las familias nuevas suenan como la parecida de las de siempre.
    const SND = { boomerang: 'projectile', chain: 'beam', mine: 'nova', meteor: 'nova', turret: 'buff', dash: 'melee', trail: 'aura', cone: 'projectile',
                  heal: 'aura', shield: 'buff', guard: 'aura', taunt: 'nova', protect: 'buff', rally: 'buff',
                  wish: 'aura', synth: 'aura', weather: 'buff', field: 'aura', control: 'nova', haste: 'buff' };
    // El rastro no suena a cada charco (sería un zumbido constante).
    if (m.kind !== 'trail') G.Audio.sfx('shot', { kind: SND[m.kind] || m.kind, type: m.type });
    if (m.kind === 'trail') return;
    // No reinicies una animación que va por la mitad: se vería a tirones.
    if (this.anim.busy() && this.anim.progress() < 0.65) return;
    const meta = G.Sprites.animMeta(this.dex, anim);
    const len = meta ? meta.d.reduce((a, b) => a + b, 0) / 60 : 0.4;
    const cd = Math.max(0.12, m.cd * this.cdScale() * G.Abilities.cd(this, m));
    this.anim.play(anim, { speed: Math.max(1, len / (cd * 0.9)) });
    this.attackFace = 0.35;
  }

  // ---------------- daño y curación ----------------
  /**
   * @param type  tipo del ataque (tabla de tipos y clima); sin tipo, daño tal cual
   * @param pure  daño que no baja con la defensa ni el cuerpo a cuerpo (Arceus)
   */
  /** @param cat  'physical' | 'special': con qué defensa tuya se para (la del enemigo que pega). */
  hurt(amount, type = null, pure = false, cat = null) {
    if (this.invuln > 0 || this.dead) return;
    amount = G.Abilities.incoming(this, amount, type, cat, pure);     // PokemonPOE: habilidad (esquiva, inmunidad, resistencias...)
    if (!(amount > 0)) return;
    if (!pure) amount *= G.Stats.taken(this.mon, cat);
    let eff = null;
    if (type) {
      const k = G.Types.mult(type, this.mon.types);
      eff = G.Types.label(k);
      amount *= k * (G.Abilities.noWeather(this) ? 1 : G.Weather.mult(type));
    }
    // Con un ataque cuerpo a cuerpo activo se recibe un 25 % menos: hay que
    // estar encima de los enemigos para pegar (iban muy por detrás).
    const close = this.activeGroup().some(m => m.kind === 'melee') ? 0.75 : 1;
    let d = pure ? Math.max(1, amount) : Math.max(1, amount * (1 - this.reduction) * close * (1 - G.Support.guardOf(this, cat)));
    // Escudo: se come el daño antes que la vida.
    if (this.shield > 0) {
      const a = Math.min(this.shield, d);
      this.shield -= a; d -= a;
      G.FX.dmgText(this.x, this.y - this.bodyH - 4, '-' + Math.round(a), '#9fd8ff');
      if (d < 1) { this.invuln = 0.3; this.flash = 0.1; G.Audio.sfx('hurt'); return; }
    }
    this.hp -= d;
    this.invuln = 0.45;
    this.flash = 0.14;
    G.Audio.sfx('hurt');
    G.Camera.kick(0.28);
    if (!this.remote) G.Pad.rumble(0.25 + Math.min(0.75, d / this.maxHp * 3), 140);
    G.FX.dmgText(this.x, this.y - this.bodyH - 4, '-' + Math.round(d), eff === 'super' ? '#ff3048' : eff === 'weak' ? '#c9a0a8' : '#ff6b7a', eff === 'super');
    G.FX.burst(this.x, this.y - this.bodyH * 0.5, '#ff5f6d', 6, 90);
    G.Abilities.afterHurt(this, d, type);
    // Banda Focus: aguanta el golpe con 1 de vida (una vez cada 60 s).
    if (this.hp <= 0 && this.hasItem('focussash') && performance.now() - this.sashT > 60000) {
      this.sashT = performance.now();
      this.hp = 1; this.invuln = 1.2;
      G.FX.dmgText(this.x, this.y - this.bodyH - 16, '¡Banda Focus!', '#ff9a3d', true);
      G.FX.ring(this.x, this.y, 6, 70, '#ff9a3d', 0.5, 4);
    }
    if (this.hp <= 0) G.Abilities.sturdy(this);
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true;
      this.anim.play('Faint', { hold: true });
      G.Projectiles.clearOrbs(this);
      this.reviveT = 0;
    }
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const got = Math.round(this.hp - before);
    if (got >= 1) G.FX.dmgText(this.x, this.y - this.bodyH - 6, '+' + got, '#5fe08a');
  }

  addMaxHp(amount) { this.maxHp += amount; this.hp += amount; }

  /** Devuelve cuántos niveles ha subido (pueden ser varios de golpe). */
  gainXp(amount) {
    this.xp += amount * this.xpMul * G.Abilities.xp(this) * (G.DEV_XP || 1);   // G.DEV_XP: sólo pruebas (devcheat.js)
    let leveled = 0;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Player.xpFor(this.level);
      leveled++;
    }
    return leveled;
  }

  // ---------------- objeto equipado ----------------
  hasItem(id) { return this.item === id; }

  /** Se pone un objeto (y se quita el que llevara). */
  equip(id) {
    if (this.item) G.Items.BY[this.item].off(this);
    this.item = id;
    if (id) G.Items.BY[id].on(this);
  }

  /** Cascabel Concha: un poco de vida por el daño que haces (tope 4/s). */
  onDealt(dmg, e) {
    if (e) G.Abilities.dealt(this, e, dmg);
    if (this.item === 'shellbell') this.bellHeal = Math.min(4, this.bellHeal + dmg * 0.04);
  }

  /** Poder de un altar (ver systems/interact.js): se aplica y se quita solo. */
  addPower(def, dur) {
    if (this.power) this.power.def.off(this);
    def.on(this);
    this.power = { def, t: dur, dur };
  }

  addBuff(stat, amount, dur, maxStacks) {
    const b = this.buffs[stat];
    if (!b) return;
    b.amount = amount;
    b.n = Math.min(maxStacks, b.n + 1);
    b.t = dur;
  }

  // ---------------- ciclo ----------------
  update(dt) {
    this.anim.update(dt);
    if (this.dead) return;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.attackFace > 0) this.attackFace -= dt;

    for (const k in this.buffs) {
      const b = this.buffs[k];
      if (b.n > 0) { b.t -= dt; if (b.t <= 0) b.n = 0; }
    }
    if (this.slowT > 0) this.slowT -= dt;
    G.Support.tick(this, dt);
    if (this.bellHeal > 0) { const h = Math.min(this.bellHeal, 4 * dt); this.hp = Math.min(this.maxHp, this.hp + h); this.bellHeal -= h; }
    if (this.power && (this.power.t -= dt) <= 0) { this.power.def.off(this); this.power = null; }
    if (this.regen > 0) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    G.Abilities.tick(this, dt);

    // --- movimiento con colisiones ---
    // (En cooperativo la pausa no para el juego: sólo te quedas quieto.)
    const [ax, ay] = this.frozen ? [0, 0] : G.Input.axis();
    this.walking = ax !== 0 || ay !== 0;
    const s = this.spd;
    // Hielo: resbalas (la velocidad cambia despacio).
    const slide = this.inLiquid && G.World.liquidEffect(this.mon.types).slide;
    this.svx = slide ? G.U.damp(this.svx || 0, ax * s * 1.15, 1.6, dt) : ax * s;
    this.svy = slide ? G.U.damp(this.svy || 0, ay * s * 1.15, 1.6, dt) : ay * s;
    this.x += this.svx * dt;
    this.y += this.svy * dt;
    G.World.collide(this);
    if (this.walking) this.moveAngle = Math.atan2(ay, ax);

    // --- terreno líquido ---
    this.inLiquid = G.World.isLiquid(this.x, this.y);
    if (this.inLiquid) {
      const le = G.World.liquidEffect(this.mon.types);
      if (le.dmg) {
        this.lavaTick -= dt;
        if (this.lavaTick <= 0) {
          this.lavaTick = le.every; this.invuln = 0;
          if (!G.Abilities.noEnv(this)) this.hurt(Math.max(le.flat, this.maxHp * le.dmg * 0.5));
          G.FX.burst(this.x, this.y - 4, le.color, 5, 70);
        }
      } else if (this.walking && Math.random() < dt * 8) {
        G.FX.burst(this.x, this.y, le.slide ? '#ffffff' : '#b3defa', 2, 40);
      }
    }

    // --- apuntado: enemigo más cercano; si no hay, hacia donde caminas ---
    // Prioridad de blanco según el ataque activo:
    //   a distancia (proyectil, rayo): el jefe si está a tiro > lo que te toca > el más cercano
    //   cuerpo a cuerpo y el resto:   lo que te toca > el jefe > el más cercano
    // Con una horda encima casi siempre te toca algo; si eso ganara siempre,
    // los ataques a distancia no le darían nunca al jefe.
    // Sin enemigos, apunta a la roca o cofre más cercano.
    const all = G.EnemyMgr.all();
    const m = this.activeMove();
    const ranged = !!m && (m.kind === 'projectile' || m.kind === 'beam');
    const threat = G.Projectiles.nearest(all, this.x, this.y, this.r + 24);
    const boss = all.find(e => e.boss && !e.dead && G.U.dist(this.x, this.y, e.x, e.y) < 330);
    const tg = (ranged ? boss || threat : threat || boss)
            || G.Projectiles.nearest(all, this.x, this.y, 520)
            || G.World.nearestBreakable(this.x, this.y, 200);
    // Apuntar a mano (Ajustes > Accesibilidad): hacia el ratón o el stick derecho.
    // El blanco (para la cadena) es el enemigo que hay en esa dirección; si no
    // hay ninguno, el de siempre.
    const hand = this.handAim();
    this.manualAim = hand != null;
    if (hand != null) {
      this.aim = hand;
      this.target = this.enemyAlong(all, hand) || tg;
    } else {
      this.target = tg;
      if (tg) this.aim = Math.atan2(tg.y - this.y, tg.x - this.x);
      else if (this.walking) this.aim = this.moveAngle;
    }

    // --- animación: mira al objetivo al atacar, si no a donde camina ---
    const face = this.attackFace > 0 || !this.walking ? this.aim : this.moveAngle;
    this.anim.dir = G.Sprites.dirFromAngle(face);
    this.anim.loop(this.walking ? 'Walk' : 'Idle', this.walking ? s / 110 : 1);
  }

  /**
   * Ángulo de "Apuntar a mano", o null si toca apuntar solo. Manda lo último
   * que se haya usado: el stick derecho mientras se empuja; si no, el ratón si
   * se ha movido después (en PC). Soltar el stick sin tocar el ratón = solo.
   */
  handAim() {
    if (this.remote || !G.Settings.get('aimManual')) return null;
    const st = G.Pad.aim();
    if (st) return Math.atan2(st[1], st[0]);
    if (G.Touch.active || !G.Input.mouseMovedAt || G.Input.mouseMovedAt < G.Pad.aimAt) return null;
    const w = G.Input.mouseWorld();
    const dx = w.x - this.x, dy = w.y - (this.y - G.LIFT * 0.5);
    return Math.hypot(dx, dy) < 4 ? null : Math.atan2(dy, dx);
  }

  /** El enemigo más cercano dentro de ±25° de la dirección a (a menos de 520). */
  enemyAlong(all, a) {
    let best = null, bd = 520 * 520;
    const ca = Math.cos(a), sa = Math.sin(a), cosMax = Math.cos(0.44);
    for (const e of all) {
      if (e.dead) continue;
      const dx = e.x - this.x, dy = e.y - this.y, d2 = dx * dx + dy * dy;
      if (d2 >= bd || d2 < 1) continue;
      if ((dx * ca + dy * sa) / Math.sqrt(d2) < cosMax) continue;
      bd = d2; best = e;
    }
    return best;
  }

  /** Vuelve a levantarse (lo revive un compañero en cooperativo). */
  revive(frac = 0.5) {
    this.dead = false;
    this.hp = Math.max(1, this.maxHp * frac);
    this.invuln = 2;
    this.reviveT = 0;
    this.anim._start('Idle', false);
    G.FX.ring(this.x, this.y, 6, 70, '#5fe08a', 0.5, 4);
    G.FX.burst(this.x, this.y - this.bodyH * 0.5, '#9dffb8', 18, 150);
    G.Audio.sfx('heal');
  }

  // ---------------- compañero (cooperativo) ----------------

  /**
   * Un compañero en otro ordenador: su dueño manda su estado (posición, vida,
   * movimiento activo...) y aquí se sigue con suavidad.
   * n = { x, y, ang, walk, hp, maxHp, dead, mv, ml, mag, aim, rev }
   */
  netUpdate(dt) {
    this.anim.update(dt);
    const n = this.net;
    if (!n) return;
    if (this.flash > 0) this.flash -= dt;
    if (this.attackFace > 0) this.attackFace -= dt;
    if (G.U.dist2(this.x, this.y, n.x, n.y) > 300 * 300) { this.x = n.x; this.y = n.y; }
    else { this.x = G.U.damp(this.x, n.x, 14, dt); this.y = G.U.damp(this.y, n.y, 14, dt); }
    if (n.hp < this.hp - 0.5 && !n.dead) this.flash = 0.14;
    this.hp = n.hp; this.maxHp = n.maxHp;
    this.magnet = n.mag || this.magnet;
    this.reviveT = n.rev || 0;
    if (n.dead && !this.dead) { this.dead = true; this.anim.play('Faint', { hold: true }); G.Projectiles.clearOrbs(this); }
    else if (!n.dead && this.dead) this.revive(n.hp / (n.maxHp || 1));
    // Movimiento activo (para el halo, el HUD y los orbes).
    if (n.mv && (!this.moves[0] || this.moves[0].id !== n.mv || this.moves[0].lvl !== n.ml) && G.Moves.BY_ID[n.mv]) {
      this.moves = [G.Moves.instance(n.mv, n.ml || 1)];
      this.slots = [this.moves.slice()];
      this.active = 0;
      G.Projectiles.clearOrbs(this);
    }
    if (this.dead) return;
    this.walking = !!n.walk;
    this.moveAngle = n.ang;
    this.aim = n.aim;
    const face = this.attackFace > 0 || !this.walking ? this.aim : this.moveAngle;
    this.anim.dir = G.Sprites.dirFromAngle(face);
    this.anim.loop(this.walking ? 'Walk' : 'Idle', this.walking ? this.baseSpd / 110 : 1);
  }

  draw(ctx) {
    // Halo del tipo del movimiento activo, en el suelo.
    const m = this.activeMove();
    if (m && !this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = G.U.TYPE_COLOR[m.type];
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 1.5, this.r * 0.6, 0, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }
    G.Sprites.drawShadow(ctx, this.dex, this.x, this.y, this.scale);
    // Poder de altar: aro de su color latiendo bajo los pies.
    if (this.power && !this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 120) * 0.15;
      ctx.strokeStyle = this.power.def.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 2.1, this.r * 0.85, 0, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }

    const alpha = this.invuln > 0 && !this.dead ? (Math.floor(this.invuln * 18) % 2 ? 0.45 : 1) : 1;
    this.anim.draw(ctx, this.x, this.y, { flash: this.flash > 0, softFlash: true, alpha, color: '#ffcb3d' });

    // Arcos de buff alrededor de los pies.
    const COL = { atk: '#ff6b4d', patk: '#ff6b4d', satk: '#c47bff', spd: '#7fe0ff', def: '#b0b8c8', regen: '#5fe08a' };
    let i = 0;
    for (const k in this.buffs) {
      const b = this.buffs[k];
      if (b.n <= 0) continue;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = COL[k];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 1.8 + i * 5, (this.r * 1.8 + i * 5) * 0.42, 0, 0, 6.2832 * (b.n / 5));
      ctx.stroke();
      ctx.restore();
      i++;
    }

    // Cooperativo: anillo de "reviviendo" y nombre encima.
    if (this.dead && this.reviveT > 0) {
      ctx.save();
      ctx.strokeStyle = '#5fe08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 2.4, this.r * 1.0, 0, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, this.reviveT / G.Player.REVIVE_TIME));
      ctx.stroke();
      ctx.restore();
    }
    if (this.tag) {
      ctx.save();
      ctx.font = '700 7px Pixelify,"Segoe UI",sans-serif';
      ctx.textAlign = 'center';
      const y = this.y - this.bodyH - 8;
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      G.I18n.rawCanvas(ctx, 'strokeText', this.tag, this.x, y);
      ctx.fillStyle = this.dead ? '#ff8a96' : this.tagColor || '#fff';
      G.I18n.rawCanvas(ctx, 'fillText', this.tag, this.x, y);
      if (this.dead) {
        ctx.font = '700 6px Pixelify,"Segoe UI",sans-serif';
        ctx.strokeText(this.revLabel || '', this.x, y - 8);
        ctx.fillText(this.revLabel || '', this.x, y - 8);
      }
      ctx.restore();
    }
  }
};
