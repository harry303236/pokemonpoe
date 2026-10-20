/* ============ evolution.js — evolución de tu Pokémon durante la run (PokemonPOE) ============
 * Empiezas siempre con la forma inicial de la línea evolutiva (si eliges a Raichu,
 * empiezas como Pichu). Evolucionas por nivel de la run:
 *   1.ª evolución: Nv.8 · 2.ª evolución: Nv.15
 * Si la línea se ramifica (Eevee...), eliges la rama. Se conservan nivel, movimientos
 * y ranuras; cambian el aspecto, las estadísticas y (en el siguiente paso) la habilidad.
 * Datos de las líneas: js/data/evolutions.js (G.EVO_FROM / G.EVO_TO).
 */
G.Evolution = (() => {
  const LEVELS = [8, 15];          // nivel al que se pasa de la fase 1 a la 2, y de la 2 a la 3

  const TXT = {
    'zh-Hant': { title: '進化！', sub: n => `${n} 要進化了——選擇進化型態`, hp: '生命', spd: '速度', atk: '攻擊', msg: n => `進化成 ${n}！`, from: '從初始型態開始', lock: '🔒 只能選初始型態，局內進化取得' },
    en: { title: 'Evolution!', sub: n => `${n} is evolving — choose a form`, hp: 'HP', spd: 'Speed', atk: 'Attack', msg: n => `Evolved into ${n}!`, from: 'Starts from the base form', lock: '🔒 Pick the base form; evolve during the run' }
  };
  const lang = () => (window.PS_LOCALES && window.PS_LOCALES.lang) || 'en';
  const t = k => (TXT[lang()] || (String(lang()).startsWith('zh') ? TXT['zh-Hant'] : TXT.en))[k];

  /** Preevolución dentro de nuestra Pokédex (0 si no hay). */
  const prevOf = dex => { const p = G.EVO_FROM && G.EVO_FROM[dex]; return p && G.DEX_BY[p] ? p : 0; };
  /** Evoluciones posibles (sólo las que tienen sprites). */
  const nextOf = dex => ((G.EVO_TO && G.EVO_TO[dex]) || []).filter(d => G.DEX_BY[d] && G.SPRITE_META[d]);

  /** Fase en su línea (1 = inicial). */
  function stageOf(dex) { let s = 1; for (let p = prevOf(dex); p; p = prevOf(p)) s++; return s; }

  /** Forma inicial de la línea (la que usas para empezar la run). */
  function baseOf(dex) {
    let d = dex;
    for (let p = prevOf(d); p && G.SPRITE_META[p]; p = prevOf(d)) d = p;
    return d;
  }

  /** Nivel al que evoluciona desde esta forma (Infinity si es la última). */
  const levelFor = dex => (nextOf(dex).length ? LEVELS[stageOf(dex) - 1] : undefined) || Infinity;

  /** Formas a las que puedes evolucionar ahora mismo ([] si aún no toca). */
  function due(pl) {
    return pl.level >= levelFor(pl.dex) ? nextOf(pl.dex) : [];
  }

  /** Cambia a tu Pokémon por `dex`. */
  function apply(pl, dex) {
    const mon = G.DEX_BY[dex];
    pl.evolveTo(mon);
    G.Audio.sfx('legend');
    G.FX.ring(pl.x, pl.y - G.LIFT * 0.5, 10, pl.r * 5, G.U.TYPE_COLOR[mon.types[0]], 0.8, 6);
    G.Spawner.say(t('msg')(mon.name), 3, true);
    return mon;
  }

  const lockText = () => t('lock');

  return { lockText, LEVELS, prevOf, nextOf, stageOf, baseOf, levelFor, due, apply, t };
})();
