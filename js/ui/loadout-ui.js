/* ============ loadout-ui.js — pantalla de Tab: configurar movimientos y ranuras ============
 * PokemonPOE. 4 teclas. La 1 tiene 4 ranuras, la 2 tiene 3 y la 3 y la 4 tienen 2,
 * abiertas entre el Nv.5 y el 20. La 1 y la 2 son de ataque; la 3 y la 4, de oficio.
 * Arrastra sobre otro para cambiarlos, sobre una ranura libre para insertarlo, o
 * sobre una tecla vacía para mover el grupo. También vale tocar y luego tocar el destino. */
G.LoadoutUI = (() => {
  const $ = id => document.getElementById(id);

  const TXT = {
    'zh-Hant': {
      open: '配置技能（Tab）', title: '技能配置', close: '關閉（Tab）',
      hint: '第 1、2 鍵是輸出（傷害、加攻、強化天氣、速度），插槽上限 4 和 3。第 3、4 鍵是職能（治療、防守、挑釁、控場），各 2 孔。整套只能有一個治療，而且只能當第 3 或第 4 鍵的主招，不能鑲在攻擊上。只有亮起來的格子放得進去。Tab / Esc 關閉。',
      atk: '輸出', job: '職能', hole: '孔',
      main: '主招式', socket: '輔助插槽', using: '使用中', sockets: '已開', locked: lv => `Lv.${lv} 解鎖`,
      emptyMain: '空主招位', emptySock: '空插槽', needMain: '先放主招', lv: 'Lv.'
    },
    es: {
      open: 'Editar ranuras (Tab)', title: 'Ranuras', close: 'Cerrar (Tab)',
      hint: 'Las teclas 1 y 2 son de ataque (daño, mejoras de ataque, clima y velocidad), con 4 y 3 ranuras. Las teclas 3 y 4 son de oficio (curar, proteger, provocar), con 2. Sólo una cura en total, y sólo como movimiento principal de la 3 o la 4: no se enlaza con un ataque. Sólo se suelta donde se ilumina. Tab / Esc cierra.',
      atk: 'Ataque', job: 'Oficio', hole: '',
      main: 'Principal', socket: 'Ranuras', using: 'En uso', sockets: 'Abiertas', locked: lv => `Nv.${lv}`,
      emptyMain: 'Tecla vacía', emptySock: 'Ranura vacía', needMain: 'Falta el principal', lv: 'Nv.'
    },
    en: {
      open: 'Edit loadout (Tab)', title: 'Loadout', close: 'Close (Tab)',
      hint: 'Keys 1 and 2 are attacks (damage, attack buffs, boosting weather and speed), with 4 and 3 sockets. Keys 3 and 4 are roles (heal, protect, taunt, control), 2 sockets each. Only one heal in the whole build, and only as the main move of key 3 or 4 — never linked to an attack. Only highlighted cells accept a drop. Tab / Esc closes.',
      atk: 'Attack', job: 'Role', hole: '',
      main: 'Main move', socket: 'Sockets', using: 'In use', sockets: 'Open', locked: lv => `Unlocks at Lv.${lv}`,
      emptyMain: 'Empty key', emptySock: 'Empty socket', needMain: 'Needs a main', lv: 'Lv.'
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

  function render() {
    const p = pl();
    if (!p) return;
    const open = [0, 1, 2, 3].map(i => p.socketCap(i)).join('·');
    const maxs = [0, 1, 2, 3].map(i => p.socketMax(i)).join('·');
    $('lo-title').textContent = t('title');
    $('lo-info').innerHTML = `<span class="lo-lvbadge">Lv.${p.level}</span> ${t('sockets')} <b>${open}／${maxs}</b>`;
    $('lo-hint').textContent = t('hint');
    $('lo-close').textContent = t('close');
    let h = '';
    for (let gi = 0; gi < p.maxMoves; gi++) {
      const g = p.slots[gi], act = g && gi === p.active, job = gi >= 2;
      const plan = G.Player.SOCKET_PLAN[gi] || [];
      const role = t(job ? 'job' : 'atk');
      h += `<div class="lo-col${job ? ' job' : ''}${act ? ' active' : ''}${g ? '' : ' none'}">
        <div class="lo-head"><span class="lo-key">${gi + 1}</span><span class="lo-tag">${role} ${plan.length}${t('hole')}</span>${act ? `<span class="lo-using">${t('using')}</span>` : ''}</div>`;
      h += g ? moveCell(g[0], 'main') : `<div class="lo-cell empty main" data-col="${gi}"><span class="lo-plus">＋</span><span>${t('emptyMain')}</span></div>`;
      h += `<div class="lo-socks"><div class="lo-sock-label">${t('socket')} ${p.socketCap(gi)}/${plan.length}</div>`;
      for (let k = 0; k < plan.length; k++) {
        const lv = plan[k], unlocked = p.level >= lv;
        if (!unlocked) {
          h += `<div class="lo-cell locked"><span>🔒</span><small>${t('locked')(lv)}</small></div>`;
        } else if (!g) {
          h += `<div class="lo-cell locked wait"><small>${t('needMain')}</small></div>`;
        } else if (g[k + 1]) h += moveCell(g[k + 1], 'sock');
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
    if (c.dataset.col != null) return { column: +c.dataset.col };
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
