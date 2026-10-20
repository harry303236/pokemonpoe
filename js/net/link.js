/* ============ link.js — salas sin servidor (PokemonPOE) ============
 * Conectar con amigos SIN Firebase ni cuentas: se intercambian "códigos de
 * conexión" (copiar y pegar por chat). Debajo es el mismo WebRTC directo que usa
 * net.js; coop.js no se entera de la diferencia.
 *
 *   Anfitrión: crea la sala → en el vestíbulo "Generar código de invitación" por
 *              amigo → el amigo devuelve un código de respuesta → "Conectar".
 *   Invitado:  pega el código de invitación → genera su código de respuesta y se
 *              lo manda al anfitrión. Al abrirse el canal envía 'hello' y el
 *              anfitrión le manda la lista de la sala ('roster').
 *
 * Mensajes (por el canal de datos):
 *   invitado -> anfitrión  { k:'hello', name, dex, shiny }
 *   anfitrión -> todos     { k:'roster', host, members:[{uid,name,dex,shiny}] }
 */
G.Link = (() => {
  const MAX = 4;
  const rid = () => 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
  let myId = null, hostId = null, isHost = false;
  let members = [];                      // anfitrión: la lista de la sala
  let guestName = '';

  const clean = s => String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, 16) || '玩家';

  function partner() {
    const s = G.DB.save || {};
    return { dex: s.partner || 25, shiny: !!s.partnerShiny && G.DB.ownsShiny && G.DB.ownsShiny(s.partner) };
  }

  function publish(what) {
    G.Social.localSetRoom({ host: hostId, isHost, members: members.slice(), open: !(G.Social.room && G.Social.room.open === false) }, what);
  }

  function roster() { G.Net.broadcast({ k: 'roster', host: hostId, members }); }

  // ---------------- anfitrión ----------------

  function createRoom(name) {
    leave(true);
    myId = hostId = rid(); isHost = true;
    G.Social.localIdentity(myId, clean(name));
    G.Net.openLocal(myId, true, myId);
    const p = partner();
    members = [{ uid: myId, name: clean(name), dex: p.dex, shiny: p.shiny }];
    publish('room');
  }

  /** Código de invitación para un amigo nuevo. */
  async function invite() {
    if (!isHost) throw Error('no-host');
    if (members.length >= MAX) throw Error('full');
    return G.Net.hostOffer(rid());
  }

  /** Código de respuesta del amigo. */
  async function accept(code) { return G.Net.hostAccept(code); }

  // ---------------- invitado ----------------

  async function answer(code, name) {
    leave(true);
    isHost = false; guestName = clean(name);
    const r = await G.Net.guestAnswer(code);
    myId = r.uid; hostId = r.host;
    G.Social.localIdentity(myId, guestName);
    return r.code;
  }

  // ---------------- salir ----------------

  function leave(silent) {
    const had = !!G.Social.room;
    if (G.Net.isLocal) G.Net.close();
    members = []; hostId = null; myId = null; isHost = false;
    if (had) G.Social.localSetRoom(null, silent ? 'room' : 'room');
  }

  // ---------------- mensajes y conexiones ----------------

  G.Net.on((from, msg) => {
    if (!msg || !G.Net.isLocal) return;
    if (msg.k === 'hello' && isHost) {
      const room = G.Social.room;
      if (!room || room.open === false || members.length >= MAX || members.some(m => m.uid === from)) { roster(); return; }
      members.push({ uid: from, name: clean(msg.name), dex: G.DEX_BY[msg.dex] ? +msg.dex : 25, shiny: !!msg.shiny });
      publish('room'); roster();
    } else if (msg.k === 'roster' && !isHost && from === hostId && Array.isArray(msg.members)) {
      members = msg.members.slice(0, MAX).map(m => ({ uid: String(m.uid), name: clean(m.name), dex: G.DEX_BY[m.dex] ? +m.dex : 25, shiny: !!m.shiny }));
      publish('room');
    }
  });

  G.Net.onPeer((u, mode) => {
    if (!G.Net.isLocal) return;
    if (!isHost && u === hostId) {
      if (mode === 'direct') {
        const p = partner();
        G.Net.send(hostId, { k: 'hello', name: guestName, dex: p.dex, shiny: p.shiny });
      } else if ((mode === 'closed' || mode === 'failed') && G.Social.room) {
        G.Net.close(); members = [];
        G.Social.localSetRoom(null, 'room-closed');
      }
    } else if (isHost && (mode === 'closed' || mode === 'failed') && members.some(m => m.uid === u)) {
      members = members.filter(m => m.uid !== u);
      G.Net.dropPeer(u);
      publish('room'); roster();
    }
  });

  return { createRoom, invite, accept, answer, leave, get busy() { return G.Net.isLocal; } };
})();

/* ---------------- pantalla "Con amigos" y panel del vestíbulo ---------------- */
G.LinkUI = (() => {
  const $ = id => document.getElementById(id);
  const NAMEKEY = 'pp.linkname';
  let initDone = false;

  function savedName() {
    let n = '';
    try { n = localStorage.getItem(NAMEKEY) || ''; } catch (e) { /* nada */ }
    return n || (G.DB && G.DB.user) || (G.DB && G.DB.save && G.DB.save.name) || '';
  }
  function nameOk() {
    const v = $('lk-name').value.trim();
    if (!v) { G.UI.toast('先輸入你的暱稱', 2200); $('lk-name').focus(); return null; }
    try { localStorage.setItem(NAMEKEY, v); } catch (e) { /* nada */ }
    return v;
  }

  async function copy(el) {
    el.focus(); el.select();
    try { await navigator.clipboard.writeText(el.value); G.UI.toast('已複製', 1400); }
    catch (e) { try { document.execCommand('copy'); G.UI.toast('已複製', 1400); } catch (e2) { G.UI.toast('請手動複製（已選取）', 2400); } }
  }

  function err(e) {
    const m = (e && e.message) || '';
    return m === 'bad-code' ? '連線碼格式不對，請完整複製（不要漏字）' : m === 'full' ? '房間已滿（最多 4 人）'
      : m === 'no-webrtc' ? '這個瀏覽器不支援直連（WebRTC）' : m === 'unknown' ? '這個回覆碼不屬於目前的邀請，請重新產生邀請碼'
      : '操作失敗，請重試';
  }

  function init() {
    if (initDone || !$('scr-link')) return;
    initDone = true;
    $('lk-create').onclick = () => {
      const n = nameOk(); if (!n) return;
      G.Link.createRoom(n);
      G.LobbyUI.open();
    };
    $('lk-join').onclick = async () => {
      const n = nameOk(); if (!n) return;
      const code = $('lk-in').value.trim();
      if (!code) { G.UI.toast('請先貼上房主的邀請碼', 2200); return; }
      $('lk-status').textContent = '產生回覆碼中…';
      try {
        $('lk-out').value = await G.Link.answer(code, n);
        $('lk-out').classList.remove('hidden'); $('lk-copy').classList.remove('hidden');
        $('lk-status').textContent = '把上面的回覆碼傳給房主。房主按「連線」後，這裡會自動進入大廳。';
      } catch (e) { $('lk-status').textContent = err(e); }
    };
    $('lk-copy').onclick = () => copy($('lk-out'));
    // 房主的大廳面板
    $('lk-gen').onclick = async () => {
      $('lk-msg').textContent = '產生中…';
      try {
        $('lk-offer').value = await G.Link.invite();
        for (const id of ['lk-offer', 'lk-offer-copy', 'lk-answer', 'lk-accept']) $(id).classList.remove('hidden');
        $('lk-answer').value = '';
        $('lk-msg').textContent = '① 把邀請碼傳給朋友  ② 朋友回傳回覆碼後貼在下方  ③ 按「連線」';
      } catch (e) { $('lk-msg').textContent = err(e); }
    };
    $('lk-offer-copy').onclick = () => copy($('lk-offer'));
    $('lk-accept').onclick = async () => {
      const v = $('lk-answer').value.trim();
      if (!v) { G.UI.toast('請貼上朋友的回覆碼', 2200); return; }
      try {
        await G.Link.accept(v);
        $('lk-msg').textContent = '連線中…成功後朋友會出現在上方。';
        for (const id of ['lk-offer', 'lk-offer-copy', 'lk-answer', 'lk-accept']) $(id).classList.add('hidden');
      } catch (e) { $('lk-msg').textContent = err(e); }
    };
    // 朋友（被邀請者）成功進入房間 → 直接到大廳
    G.Social.on(what => {
      const room = G.Social.room;
      if (what === 'room' && room && room.local && !room.isHost && G.UI.isOpen('scr-link')) G.LobbyUI.open();
    });
  }

  function open() {
    init();
    if (G.Social.room) { G.LobbyUI.open(); return; }
    $('lk-name').value = savedName();
    $('lk-in').value = ''; $('lk-out').value = '';
    $('lk-out').classList.add('hidden'); $('lk-copy').classList.add('hidden');
    $('lk-status').textContent = '';
    G.UI.show('scr-link', true);
  }

  /** Vestíbulo: panel de invitar (sólo el anfitrión de una sala sin servidor). */
  function panel(room) {
    const box = $('lobby-link');
    if (!box) return;
    const show = !!(room && room.local && room.isHost && room.members.length < G.Social.MAX_PLAYERS);
    box.classList.toggle('hidden', !show);
  }

  return { init, open, panel };
})();
