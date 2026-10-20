/* PokemonPOE — movimientos de apoyo (20-10-2026): nombres, descripciones y mejoras.
 * Español (clave) → chino tradicional y simplificado. El inglés va en lang-en.js.
 * Los nombres de movimientos llevan el contexto 'move'. */
(() => {
  // [español, zh-Hant, zh-Hans]
  const names = [
    ['Recuperación', '自我再生', '自我再生'], ['Pulso Cura', '治癒波動', '治愈波动'], ['Gota Cura', '生命水滴', '生命水滴'],
    ['Campana Cura', '治癒鈴聲', '治愈铃声'], ['Protección', '守住', '守住'], ['Reflejo', '反射壁', '反射壁'],
    ['Pantalla de Luz', '光牆', '光墙'], ['Velo Aurora', '極光幕', '极光幕'], ['Defensa Férrea', '鐵壁', '铁壁'],
    ['Mofa', '挑釁', '挑衅'], ['Señuelo', '看我嘛', '看我嘛'], ['Viento Afín', '順風', '顺风']
  ];
  const text = [
    ['Apoyo', '輔助', '辅助'],
    ['Te curas un buen trozo de vida de golpe. Sólo a ti.', '一次回復大量生命，只有自己。', '一次回复大量生命，只有自己。'],
    ['Una onda que cura a ti y a los compañeros que tengas cerca.', '一道波動，治療你與附近的隊友。', '一道波动，治疗你与附近的队友。'],
    ['Un rocío que cura poco pero muy a menudo a los de alrededor.', '回復量少但很頻繁的露水，治療周圍的人。', '回复量少但很频繁的露水，治疗周围的人。'],
    ['Una campana que cura a tu equipo y quita la lentitud.', '鈴聲治療隊伍，並解除減速。', '铃声治疗队伍，并解除减速。'],
    ['Te vuelves invulnerable un instante. Sólo con enemigos cerca.', '短暫無敵。只有附近有敵人時才會發動。', '短暂无敌。只有附近有敌人时才会发动。'],
    ['Un muro que baja el daño FÍSICO que reciben tú y tus compañeros cercanos.', '屏障：降低你與附近隊友受到的物理傷害。', '屏障：降低你与附近队友受到的物理伤害。'],
    ['Un muro que baja el daño ESPECIAL que reciben tú y tus compañeros cercanos.', '屏障：降低你與附近隊友受到的特殊傷害。', '屏障：降低你与附近队友受到的特殊伤害。'],
    ['Un velo que baja un poco todo el daño que recibe el equipo cercano.', '光幕：小幅降低附近隊伍受到的所有傷害。', '光幕：小幅降低附近队伍受到的所有伤害。'],
    ['Un escudo que absorbe daño. Sólo para ti.', '吸收傷害的護盾，只有自己。', '吸收伤害的护盾，只有自己。'],
    ['Los enemigos cercanos van a por ti y tú recibes menos daño mientras dura.', '附近的敵人會改追你，期間你受到的傷害降低。', '附近的敌人会改追你，期间你受到的伤害降低。'],
    ['Atraes a los enemigos de una zona enorme durante bastante rato (y resistes más).', '在很大的範圍內長時間吸引敵人（自己也更耐打）。', '在很大的范围内长时间吸引敌人（自己也更耐打）。'],
    ['Un viento a favor: sube la velocidad de todo el equipo cercano un rato.', '順風：一段時間內提升附近全隊的移動速度。', '顺风：一段时间内提升附近全队的移动速度。'],
    ['+40% curación', '治療量 +40%', '治疗量 +40%'], ['+50% curación y -15% recarga', '治療量 +50%、冷卻 -15%', '治疗量 +50%、冷却 -15%'],
    ['+40% escudo', '護盾 +40%', '护盾 +40%'], ['+50% escudo y -15% recarga', '護盾 +50%、冷卻 -15%', '护盾 +50%、冷却 -15%'],
    ['+30% reducción de daño', '減傷 +30%', '减伤 +30%'], ['+25% reducción y -20% recarga', '減傷 +25%、冷卻 -20%', '减伤 +25%、冷却 -20%'],
    ['+40% reducción de daño propia', '自身減傷 +40%', '自身减伤 +40%'], ['-25% recarga y +30% radio', '冷卻 -25%、範圍 +30%', '冷却 -25%、范围 +30%'],
    ['+40% potencia', '效果 +40%', '效果 +40%'], ['-25% recarga y +30% potencia', '冷卻 -25%、效果 +30%', '冷却 -25%、效果 +30%']
  ].filter(r => r[1]);
  const pick = i => o => Object.fromEntries(o.map(r => [r[0], r[i]]));
  G.I18n.add(pick(1)(names), 'zh-Hant', 'move');
  G.I18n.add(pick(2)(names), 'zh-Hans', 'move');
  G.I18n.add(pick(1)(text), 'zh-Hant');
  G.I18n.add(pick(2)(text), 'zh-Hans');
})();
