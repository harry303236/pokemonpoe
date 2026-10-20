/* ============ run-ui.js — cartas de nivel, pausa y fin de run ============ */
G.RunUI = (() => {
  const $ = G.UI.$;
  let offers = null, offerCb = null, coopMode = false;

  /*
   * Al aparecer unas cartas (nivel, colocación, objeto) no se pueden elegir
   * durante GUARD s y se ven apagadas: en plena pelea se pulsa 1-4 (o se toca
   * la pantalla) para cambiar de ataque y se elegía una carta sin querer.
   * Cambiar las cartas o el 2.º paso del vínculo no lo vuelven a poner: ahí ya
   * estás eligiendo a propósito.
   */
  const GUARD = 0.6;
  let guardUntil = 0, guardT = 0;
  function guard(box) {
    guardUntil = performance.now() + GUARD * 1000;
    box.classList.add('guard');
    clearTimeout(guardT);
    guardT = setTimeout(() => document.querySelectorAll('.cards.guard').forEach(b => b.classList.remove('guard')), GUARD * 1000);
  }
  const guarded = () => performance.now() < guardUntil;

  /** @param coop  en grupo: tras elegir, se queda esperando a los demás */
  function showLevelUp(level, list, cb, coop = false) {
    offerCb = cb; coopMode = coop;
    $('lvl-num').textContent = level;
    $('lvl-wait').textContent = '';
    $('lvl-wait').classList.toggle('hidden', !coop);
    $('cards').classList.remove('done');
    renderCards(list);
    $('lvl-reroll').onclick = reroll;
    G.UI.show('scr-levelup');
    guard($('cards'));
  }

  /**
   * Cambiar las cartas: 1 vez gratis por partida y 1 más por cada jefe
   * derrotado (en grupo cuentan los jefes del equipo; cada uno tiene los suyos).
   */
  function rerollsLeft() {
    const p = G.Game.player;
    // 1 gratis + los comprados en Mejoras (antes, 1 más por cada jefe).
    return p ? Math.max(0, 1 + (p.rerollBonus || 0) - (p.rerolls || 0)) : 0;
  }

  function reroll() {
    if (!offers || rerollsLeft() <= 0) return;
    const p = G.Game.player;
    p.rerolls = (p.rerolls || 0) + 1;
    G.Audio.sfx('select');
    renderCards(G.LevelUp.offer(p));
  }

  function renderCards(list) {
    offers = list;
    const left = rerollsLeft();
    $('lvl-rr-n').textContent = left;
    $('lvl-reroll').classList.toggle('hidden', left <= 0);
    const box = $('cards');
    box.innerHTML = '';
    list.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      const tag = c.type === 'new'
        ? `<span class="tag-chip" style="background:${c.color}">Nuevo · ${c.tag}</span>`
        : c.type === 'up' || c.type === 'evo'
          ? `<span class="tag-chip" style="background:${c.color}">${c.tag}</span>`
          : `<span class="tag-chip" style="background:${c.color === '#ffd23f' ? '#ffd23f' : '#9fb1c9'}">${c.tag}</span>`;
      if (c.type === 'evo') el.classList.add('evo');
      el.innerHTML =
        `<div class="ico" style="background:${c.color}33">${G.Icons.html(c.icon, 32)}</div>
         <div class="txt"><div class="nm">${c.title} ${tag}</div><div class="ds">${c.desc}</div></div>
         <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none';             // el juego pone su propio sonido al elegir
      el.onclick = () => pick(i);
      box.appendChild(el);
    });
  }

  function pick(i) {
    if (!offers || !offers[i] || guarded()) return;
    const c = offers[i], cb = offerCb;
    offers = null; offerCb = null;
    $('lvl-reroll').classList.add('hidden');
    if (coopMode) {
      // Se queda la carta elegida a la vista mientras eligen los demás.
      $('cards').querySelectorAll('.card').forEach((el, j) => el.classList.toggle('picked', j === i));
      $('cards').classList.add('done');
    } else G.UI.hide('scr-levelup');
    cb(c);
  }

  /** Cooperativo: quién falta por elegir. */
  function setWaiting(names) {
    const me = G.Social.me ? G.Social.me.name : '';
    const others = names.filter(n => n !== me);
    const list = a => new Intl.ListFormat(G.I18n.locale, { style: 'long', type: 'conjunction' }).format(a);
    $('lvl-wait').setAttribute('translate', 'no');
    $('lvl-wait').textContent = !names.length ? ''
      : !others.length ? G.T('Elige tu carta')
      : names.includes(me) ? G.I18n.f('Faltan por elegir: {x}', list([...others, G.T('tú')]))
      : G.I18n.f('Esperando a {x}…', list(others));
  }

  function closeLevelUp() {
    offers = null; offerCb = null;
    $('cards').classList.remove('done');
    G.UI.hide('scr-levelup');
  }

  /**
   * Mensaje de apoyo (Ko-fi) al acabar: tras un récord o cada 10 partidas,
   * nunca en la primera y como mucho una vez al día. Se cierra con la X.
   */
  function askSupport(r) {
    if (!G.Funding || !G.Funding.url) return false;
    const runs = (G.DB.save && G.DB.save.stats && G.DB.save.stats.runs) || 0;
    if (runs < 2 || !(r.record || runs % 10 === 0)) return false;
    const today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem('ps.ask') === today) return false; localStorage.setItem('ps.ask', today); } catch (e) { return false; }
    return true;
  }

  function showOver(r, onBack) {
    $('over-title').textContent = r.dead ? 'Has caído…' : 'Run terminada';
    $('over-stats').innerHTML = `
      <div><span>Tiempo</span><b>${G.U.mmss(r.time)}</b></div>
      <div><span>Nivel</span><b>${r.level}</b></div>
      <div><span>Derrotados</span><b>${r.kills}</b></div>
      <div><span>Jefes</span><b>${r.bosses}</b></div>
      ${r.judge ? `<div style="grid-column:1/-1"><span>Ante Arceus</span><b class="gold">${G.U.mmss(r.judge.time)} · ${r.judge.bosses} ${r.judge.bosses === 1 ? 'legendario' : 'legendarios'}</b></div>` : ''}
      <div style="grid-column:1/-1"><span>Pokémonedas ganadas</span>
        <b class="gold"><span class="coin"></span> +${r.coins}</b>
        <div style="font-size:12px;color:var(--muted)">${r.breakdown}</div></div>
      ${r.t1 || r.t10 ? `<div style="grid-column:1/-1"><span>Tickets del gacha</span><b>
        ${r.t1 ? G.Icons.html('ticket', 22) + ' +' + r.t1 + ' ' : ''}${r.t10 ? G.Icons.html('ticket10', 22) + ' +' + r.t10 + ' ×10' : ''}</b></div>` : ''}
      <div style="grid-column:1/-1"><span>Movimientos</span><b style="font-size:15px">
        ${r.moves.map(m => `${G.Icons.html('move:' + m.id, 16)} ${G.T(m.name, 'move')} Nv.${m.lvl}`).join(' · ') || '—'}</b></div>
      ${r.caught && r.caught.length ? `<div style="grid-column:1/-1" class="caught"><span>${G.Icons.html('shiny', 12)} Shinies conseguidos</span>
        <div class="caught-row" id="over-caught"></div></div>` : ''}
      ${r.record ? '<div style="grid-column:1/-1;text-align:center" class="gold">¡Nuevo récord de tiempo!</div>' : ''}
      ${askSupport(r) ? `<div class="support-ask" id="over-ask" style="grid-column:1/-1">
        <button class="x" type="button" aria-label="Cerrar">×</button>
        <p>¿Te está gustando PokéSurvivor? Lo hago yo solo y los servidores cuestan dinero. Si quieres, puedes ayudarme a mantenerlo en línea.</p>
        <a class="btn small gold" href="${G.Funding.url}" target="_blank" rel="noopener">${G.Icons.html('heart', 14)} Apoyar en Ko-fi</a>
      </div>` : ''}`;
    const ask = $('over-ask');
    if (ask) ask.querySelector('.x').onclick = () => ask.remove();
    $('btn-again').onclick = onBack;
    if (r.caught && r.caught.length) {
      const row = $('over-caught');
      for (const c of r.caught) {
        const w = document.createElement('div');
        w.appendChild(G.UI.spriteCanvas(c.dex, 90, 72, { shiny: true, lively: true, scale: 2 }));
        w.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[c.dex].name}${c.isNew ? ' · ¡nuevo!' : ''}</small>`);
        row.appendChild(w);
      }
    }
    G.UI.show('scr-over');
  }

  /** Has encontrado un objeto llevando ya otro: ¿con cuál te quedas? */
  function showItemChoice(cur, next, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    [[cur, 'Quedarme con'], [next, 'Cambiar a']].forEach(([id, verb], i) => {
      const it = G.Items.BY[id];
      const el = document.createElement('div');
      el.className = 'card' + (i === 1 ? ' evo' : '');
      el.innerHTML = `<div class="ico">${G.Icons.html(id, 36)}</div>
        <div class="txt"><div class="nm">${verb} ${it.name}</div><div class="ds">${it.desc}</div></div>
        <div class="key">${i + 1}</div>`;
      el.onclick = () => { if (guarded()) return; G.UI.hide('scr-item'); cb(id); };
      box.appendChild(el);
    });
    G.UI.show('scr-item');
    guard(box);
  }

  // ---------------- movimiento nuevo: dónde se coloca ----------------

  let place = null;         // { opts, cb }

  /**
   * @param id    movimiento que acabas de aprender
   * @param opts  pl.placements(): { kind: 'slot' } y/o { kind: 'socket', group }
   * @param cb    recibe la opción elegida
   */
  function showPlace(id, opts, cb) {
    place = { id, opts, cb };
    const d = G.Moves.BY_ID[id], col = G.U.TYPE_COLOR[d.type];
    $('bond-sub').textContent = G.T('¿Dónde colocas') + ' ' + G.T(d.name, 'move') + '?';
    const box = $('bond-cards');
    box.innerHTML = '';
    opts.forEach((o, i) => {
      const el = document.createElement('div');
      el.className = 'card' + (o.kind === 'socket' ? ' bond' : '');
      const main = o.kind === 'socket' ? o.group[0] : null;
      el.innerHTML = o.kind === 'slot'
        ? `<div class="ico" style="background:${col}33">${G.Icons.html('move:' + id, 32)}</div>
           <div class="txt"><div class="nm">${G.T('Hueco nuevo')}</div><div class="ds">${G.T('Se usa por sí solo y lo eliges con 1-4.')}</div></div>
           <div class="key">${i + 1}</div>`
        : `<div class="ico" style="background:${G.U.TYPE_COLOR[main.type]}33">${G.Icons.html('move:' + main.id, 32)}</div>
           <div class="txt"><div class="nm">${G.T('Ranura de')} ${G.T(main.name, 'move')} <span class="tag-chip" style="background:${G.U.TYPE_COLOR[main.type]}">${o.group.length - 1}/${G.Game.player.socketCap()}</span></div>
           <div class="ds">${G.T('Se lanzará a la vez que')} ${G.T(main.name, 'move')} ${G.T('y no ocupa hueco.')}</div></div>
           <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none';
      el.onclick = () => pickPlace(i);
      box.appendChild(el);
    });
    G.UI.show('scr-bond');
    guard(box);
  }

  function pickPlace(i) {
    if (!place || !place.opts[i] || guarded()) return;
    const { opts, cb } = place;
    place = null;
    G.UI.hide('scr-bond');
    cb(opts[i]);
  }

  // ---------------- pausa: gestionar las ranuras ----------------

  const mname = m => G.T(m.name, 'move');

  /** Lista de grupos con botones para sacar / mover / ascender los insertados y para insertar los sueltos. */
  function socketsHtml(pl) {
    const cap = pl.socketCap();
    let h = `<h3>${G.T('Ranuras')} <small>${cap}/${Player_MAX()} ${G.T('por movimiento')}</small></h3>`;
    if (cap === 0) return h + `<p class="sub">${G.T('Al nivel 5 tendrás la primera ranura (y una más cada 5 niveles, hasta el 20).')}</p>`;
    pl.slots.forEach((g, gi) => {
      const free = pl.freeSockets(g);
      h += `<div class="sock-group"><div class="sock-main"><kbd>${gi + 1}</kbd> ${G.Icons.html('move:' + g[0].id, 20)} <b>${mname(g[0])}</b>`;
      for (let k = 1; k <= cap; k++) h += g[k] ? ` <span class="sock on">${G.Icons.html('move:' + g[k].id, 14)}</span>` : ' <span class="sock"></span>';
      h += '</div>';
      for (let k = 1; k < g.length; k++) {
        const m = g[k];
        h += `<div class="sock-row">${G.Icons.html('move:' + m.id, 16)} ${mname(m)} <small>Nv.${m.lvl}</small>
          <span class="sock-btns"><button class="btn small" data-act="promote" data-m="${m.id}">${G.T('Hacer principal')}</button>`;
        if (pl.slots.length < pl.maxMoves) h += `<button class="btn small" data-act="eject" data-m="${m.id}">${G.T('Sacar')}</button>`;
        for (const o of pl.slots) if (o !== g && pl.freeSockets(o) > 0) h += `<button class="btn small" data-act="transfer" data-m="${m.id}" data-to="${o[0].id}">→ ${mname(o[0])}</button>`;
        h += '</span></div>';
      }
      if (g.length === 1) {
        const targets = pl.slots.filter(o => o !== g && pl.freeSockets(o) > 0);
        if (targets.length) h += `<div class="sock-row"><span class="sub">${G.T('Insertar en')}:</span><span class="sock-btns">${targets.map(o => `<button class="btn small" data-act="insert" data-m="${g[0].id}" data-to="${o[0].id}">${mname(o[0])}</button>`).join('')}</span></div>`;
      }
      h += '</div>';
    });
    return h;
  }
  const Player_MAX = () => G.Player ? G.Player.SOCKET_MAX : 4;

  function wireSockets() {
    const box = $('pause-sockets');
    box.onclick = e => {
      const b = e.target.closest('button[data-act]');
      const pl = G.Game.player;
      if (!b || !pl) return;
      const m = pl.moves.find(x => x.id === b.dataset.m);
      const to = b.dataset.to && pl.slots.find(g => g[0].id === b.dataset.to);
      const act = b.dataset.act;
      let ok = false;
      if (act === 'promote') ok = pl.promote(m);
      else if (act === 'eject') ok = pl.eject(m);
      else if (act === 'transfer') ok = pl.transfer(m, to);
      else if (act === 'insert') ok = pl.insert(m, to);
      G.Audio.sfx(ok ? 'confirm' : 'back');
      refreshPause();
    };
  }

  function refreshPause() {
    const pl = G.Game.player;
    if (!pl) return;
    $('pause-sockets').innerHTML = socketsHtml(pl);
    $('pause-sum').innerHTML = pauseSummary();
  }

  /*
   * Resumen de la partida en la pausa: tus ataques (categoría, daño hecho y
   * daño por segundo), tus estadísticas con todo lo subido y el objeto y las
   * cartas de mejora que llevas.
   */
  function pauseSummary() {
    const pl = G.Game.player;
    if (!pl) return '';
    const t = G.Game.st.time, n = v => Math.round(v).toLocaleString('es');
    const k2 = v => '×' + v.toFixed(2).replace('.', ',');
    const pct = v => Math.round(v * 100) + ' %';
    const moves = pl.moves.map(m => {
      const secs = Math.max(5, t - (m.since || 0)), col = G.U.TYPE_COLOR[m.type];
      const cat = m.cat ? `<span class="tag-chip" style="background:${col}">${G.Stats.NAME[m.cat]}</span>` : '<span class="sub">Mejora</span>';
      return `<tr><td>${G.Icons.html('move:' + m.id, 18)} ${G.T(m.name, 'move')} <small>Nv.${m.lvl}</small></td><td>${cat}</td>
        <td class="num">${m.cat ? n(m.dealt || 0) : '—'}</td><td class="num">${m.cat ? n((m.dealt || 0) / secs) + '/s' : '—'}</td></tr>`;
    }).join('');
    const mon = pl.mon, fis = 1 - G.Stats.taken(mon, 'physical'), esp = 1 - G.Stats.taken(mon, 'special');
    const guard = v => (v >= 0 ? '−' : '+') + Math.round(Math.abs(v) * 100) + ' %';
    const st = [
      ['Vida', n(pl.hp) + ' / ' + n(pl.maxHp)],
      ['Ataque', k2(pl.atkFor({ cat: 'physical' }))],
      ['At. Esp.', k2(pl.atkFor({ cat: 'special' }))],
      ['Defensa', mon.df + ' <small>' + guard(fis) + ' físico</small>'],
      ['Def. Esp.', mon.sd + ' <small>' + guard(esp) + ' especial</small>'],
      ['Velocidad', n(pl.spd)],
      ['Crítico', pct(pl.critChance || 0)],
      ['Reducción de daño', pct(pl.reduction)],
      ['Recarga', pl.cdMul < 0.995 ? '−' + pct(1 - pl.cdMul) : '0 %'],
      ['Regeneración', pl.regen.toFixed(1).replace('.', ',') + ' /s']
    ].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    const it = pl.item && G.Items.BY[pl.item];
    const cards = Object.entries(pl.statsTaken || {}).map(([id, c]) => {
      const s = G.LevelUp.STATS.find(x => x.id === id);
      return s ? `<span class="chip">${G.Icons.html(s.icon, 12)} ${s.title} ×${c}</span>` : '';
    }).join('');
    return `<h3>Tus ataques</h3>
      <table class="sum-moves"><tr><th></th><th></th><th class="num">Daño</th><th class="num">Por segundo</th></tr>${moves}</table>
      <h3>Tus estadísticas</h3><div class="sum-stats">${st}</div>
      <h3>Objeto y cartas</h3>
      <p class="sub">${it ? G.Icons.html(pl.item, 18) + ' <b>' + it.name + '</b>: ' + it.desc : 'Sin objeto.'}</p>
      <div class="chips">${cards || '<span class="sub">Aún no has cogido cartas de mejora.</span>'}</div>`;
  }

  function showPause(coop = false) {
    wireSockets();
    refreshPause();
    G.UI.soundControls($('pause-sound'));
    $('pause-coop').classList.toggle('hidden', !coop);
    $('btn-quit').textContent = coop ? 'Salir de la partida' : 'Abandonar run';
    G.UI.show('scr-pause');
  }

  function wirePause(onResume, onQuit) {
    $('btn-resume').onclick = onResume;
    $('btn-quit').onclick = onQuit;
  }

  return { showLevelUp, reroll, showItemChoice, showPlace, pickPlace, pick, setWaiting, closeLevelUp, showOver, wirePause, showPause };
})();
