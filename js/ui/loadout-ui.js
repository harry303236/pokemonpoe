/* ============ loadout-ui.js — pantalla de Tab: configurar movimientos y ranuras ============
 * PokemonPOE. 4 movimientos principales; cada uno gana una ranura cada 5 niveles
 * (Nv.5/10/15/20 → hasta 4). Arrastra un movimiento sobre otro para cambiarlos de
 * sitio, sobre una ranura libre para insertarlo, o sobre un hueco principal vacío
 * para sacarlo. También vale tocar uno y luego tocar el destino (móvil). */
G.LoadoutUI = (() => {
  const $ = id => document.getElementById(id);

  const TXT = {
    'zh-Hant': {
      open: '配置技能（Tab）', title: '技能配置', close: '關閉（Tab）',
      hint: '拖曳技能到其他技能＝交換位置；拖到空插槽＝鑲嵌；把插槽裡的技能拖到「空主招位」＝取下。也可以先點選再點目標。Tab / Esc 關閉。',
      main: '主招式', socket: '輔助插槽', using: '使用中', sockets: '輔助插槽已開', locked: lv => `Lv.${lv} 解鎖`, emptyMain: '空主招位', emptySock: '空插槽', lv: 'Lv.'
    },
    en: {
      open: 'Edit loadout (Tab)', title: 'Loadout', close: 'Close (Tab)',
      hint: 'Drag a move onto another to swap, onto an empty socket to socket it, or from a socket onto an empty main slot to take it out. You can also tap one, then tap the target. Tab / Esc closes.',
      main: 'Main move', socket: 'Support sockets', using: 'In use', sockets: 'Sockets unlocked', locked: lv => `Unlocks at Lv.${lv}`, emptyMain: 'Empty main slot', emptySock: 'Empty socket', lv: 'Lv.'
    }
  };
  const lang = () => (window.PS_LOCALES && window.PS_LOCALES.lang) || 'en';
  const dict = () => TXT[lang()] || (String(lang()).startsWith('zh') ? TXT['zh-Hant'] : TXT.en);
  const t = k => dict()[k];

  let sel = null;               // id del movimiento elegido con un toque
  let drag = null;              // { id, x, y, moved, ghost }
  let suppressClick = false;
  let wired = false;

  const pl = () => G.Game && G.Game.player;
  const open = () => { if (!pl()) return; wire(); sel = null; render(); G.UI.show('scr-loadout'); };
  const close = () => {
    if (!G.UI.isOpen('scr-loadout')) return;
    G.Game.toggleLoadout();     // reanuda (o, en grupo, sólo cierra)
  };

  // ---------------- dibujo ----------------

  function moveCell(m, role) {
    const col = G.U.TYPE_COLOR[m.type], nm = G.T(m.name, 'move');
    const type = G.U.TYPE_NAME && G.U.TYPE_NAME[m.type] ? G.U.TYPE_NAME[m.type] : '';
    const on = sel === m.id ? ' sel' : '';
    if (role === 'main') {
      return `<div class="lo-cell filled main${on}" data-move="${m.id}" style="--tc:${col}" title="${nm}">
        <div class="lo-ico">${G.Icons.html('move:' + m.id, 48)}</div>
        <div class="lo-nm">${nm}</div>
        <div class="lo-meta"><span class="lo-chip">${type}</span><span class="lo-lv">${t('lv')}${m.lvl}</span></div></div>`;
    }
    return `<div class="lo-cell filled lo-sk${on}" data-move="${m.id}" style="--tc:${col}" title="${nm}">
      <div class="lo-ico">${G.Icons.html('move:' + m.id, 32)}</div>
      <div class="lo-txt"><div class="lo-nm">${nm}</div><div class="lo-meta"><span class="lo-chip">${type}</span><span class="lo-lv">${t('lv')}${m.lvl}</span></div></div></div>`;
  }

  /** Los 4 escalones de ranura: Lv.5 / 10 / 15 / 20, encendidos según tu nivel. */
  function pips(p) {
    let h = '';
    for (let k = 1; k <= G.Player.SOCKET_MAX; k++) {
      const lv = k * G.Player.SOCKET_EVERY;
      h += `<span class="lo-pip${p.level >= lv ? ' on' : ''}">Lv.${lv}</span>`;
    }
    return h;
  }

  function render() {
    const p = pl();
    if (!p) return;
    const cap = p.socketCap(), MAX = G.Player.SOCKET_MAX;
    $('lo-title').textContent = t('title');
    $('lo-info').innerHTML = `<span class="lo-lvbadge">Lv.${p.level}</span> ${t('sockets')} <b>${cap}/${MAX}</b> <span class="lo-pips">${pips(p)}</span>`;
    $('lo-hint').textContent = t('hint');
    $('lo-close').textContent = t('close');
    let h = '';
    for (let gi = 0; gi < p.maxMoves; gi++) {
      const g = p.slots[gi], act = g && gi === p.active;
      h += `<div class="lo-col${act ? ' active' : ''}${g ? '' : ' none'}">
        <div class="lo-head"><span class="lo-key">${gi + 1}</span><span class="lo-tag">${t('main')}</span>${act ? `<span class="lo-using">${t('using')}</span>` : ''}</div>`;
      h += g ? moveCell(g[0], 'main') : `<div class="lo-cell empty main" data-new="1"><span class="lo-plus">＋</span><span>${t('emptyMain')}</span></div>`;
      h += `<div class="lo-socks"><div class="lo-sock-label">${t('socket')}</div>`;
      for (let k = 1; k <= MAX; k++) {
        if (!g || k > cap) {
          h += `<div class="lo-cell locked"><span>🔒</span><small>${t('locked')(k * G.Player.SOCKET_EVERY)}</small></div>`;
        } else if (g[k]) h += moveCell(g[k], 'sock');
        else h += `<div class="lo-cell empty lo-sk" data-gi="${gi}"><span class="lo-plus">＋</span><span>${t('emptySock')}</span></div>`;
      }
      h += '</div></div>';
    }
    $('lo-grid').innerHTML = h;
    markTargets();
  }

  /** Resalta dónde se puede soltar lo que llevas (arrastrado o elegido). */
  function markTargets() {
    const p = pl(), id = drag && drag.moved ? drag.id : sel;
    const m = id && p && p.moves.find(x => x.id === id);
    for (const c of $('lo-grid').querySelectorAll('.lo-cell')) {
      const to = m && target(c);
      c.classList.toggle('ok', !!(to && p.dropMove(m, to, true)));
    }
  }

  /** A qué destino corresponde una celda. */
  function target(c) {
    const p = pl();
    if (!c || !p) return null;
    if (c.dataset.move) return { move: p.moves.find(x => x.id === c.dataset.move) };
    if (c.dataset.gi != null) return { group: p.slots[+c.dataset.gi] };
    if (c.dataset.new) return { newSlot: true };
    return null;
  }

  function drop(id, c) {
    const p = pl(), m = p && p.moves.find(x => x.id === id), to = target(c);
    const ok = !!(m && to && p.dropMove(m, to));
    G.Audio.sfx(ok ? 'confirm' : 'back');
    sel = null; drag = null;
    render();
  }

  // ---------------- ratón y táctil ----------------

  function ghostAt(x, y) {
    if (!drag.ghost) {
      const g = document.createElement('div');
      g.className = 'lo-ghost';
      const m = pl().moves.find(v => v.id === drag.id);
      g.innerHTML = G.Icons.html('move:' + m.id, 44);
      document.body.appendChild(g);
      drag.ghost = g;
    }
    drag.ghost.style.left = x + 'px'; drag.ghost.style.top = y + 'px';
  }

  function wire() {
    if (wired) return;
    wired = true;
    const grid = $('lo-grid');
    $('lo-close').onclick = close;

    grid.addEventListener('pointerdown', e => {
      const c = e.target.closest('.lo-cell[data-move]');
      if (!c || e.button > 0) return;
      drag = { id: c.dataset.move, x: e.clientX, y: e.clientY, moved: false, ghost: null };
    });
    addEventListener('pointermove', e => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      if (!drag.moved) { drag.moved = true; sel = null; markTargets(); }
      ghostAt(e.clientX, e.clientY);
    });
    addEventListener('pointerup', e => {
      if (!drag) return;
      const d = drag;
      if (d.ghost) d.ghost.remove();
      if (d.moved) {
        suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const c = el && el.closest('.lo-cell');
        if (c && $('lo-grid').contains(c)) drop(d.id, c);
        else { drag = null; render(); }
      } else drag = null;
    });
    addEventListener('pointercancel', () => { if (drag && drag.ghost) drag.ghost.remove(); drag = null; if (G.UI.isOpen('scr-loadout')) render(); });

    // Toque / clic sin arrastrar: elegir y luego elegir destino.
    grid.addEventListener('click', e => {
      if (suppressClick) return;
      const c = e.target.closest('.lo-cell');
      if (!c || c.classList.contains('locked')) return;
      if (sel) {
        if (c.dataset.move === sel) { sel = null; render(); return; }
        drop(sel, c);
      } else if (c.dataset.move) { sel = c.dataset.move; G.Audio.sfx('select'); render(); }
    });
    grid.addEventListener('dragstart', e => e.preventDefault());
  }

  return { open, close, render, t, isOpen: () => G.UI.isOpen('scr-loadout') };
})();
