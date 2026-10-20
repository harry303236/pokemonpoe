/* PokemonPOE — movimientos de apoyo (20-10-2026): nombres, descripciones y mejoras.
 * Español (clave) → chino tradicional y simplificado. El inglés va en lang-en.js.
 * Los nombres de movimientos llevan el contexto 'move'. */
(() => {
  // [español, zh-Hant, zh-Hans]
  const names = [
    ['Recuperación', '自我再生', '自我再生'], ['Pulso Cura', '治癒波動', '治愈波动'], ['Gota Cura', '生命水滴', '生命水滴'],
    ['Campana Cura', '治癒鈴聲', '治愈铃声'], ['Protección', '守住', '守住'], ['Reflejo', '反射壁', '反射壁'],
    ['Pantalla de Luz', '光牆', '光墙'], ['Velo Aurora', '極光幕', '极光幕'], ['Defensa Férrea', '鐵壁', '铁壁'],
    ['Mofa', '挑釁', '挑衅'], ['Señuelo', '看我嘛', '看我嘛'], ['Viento Afín', '順風', '顺风'],
    ['Deseo', '祈願', '祈愿'], ['Día Soleado', '大晴天', '大晴天'], ['Danza Lluvia', '求雨', '求雨'],
    ['Campo de Hierba', '青草場地', '青草场地'], ['Deslumbrar', '惡之眼', '恶之眼'],
    ['Llama Espectral', '鬼火', '鬼火'], ['Arenga', '鼓舞', '鼓舞']
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
    ['+40% potencia', '效果 +40%', '效果 +40%'], ['-25% recarga y +30% potencia', '冷卻 -25%、效果 +30%', '冷却 -25%、效果 +30%'],
    ['Una cura grande que llega unos segundos después, a ti y a quien estuviera cerca al lanzarla.', '延遲的大量治療，施放時在範圍內的自己與隊友稍後會被治癒。', '延迟的大量治疗，施放时在范围内的自己与队友稍后会被治愈。'],
    ['Te curas. Con sol cura más; con lluvia, arena o nieve, menos. Sólo a ti.', '治療自己。大晴天時更多，下雨、沙暴或冰雹時較少。', '治疗自己。大晴天时更多，下雨、沙暴或冰雹时较少。'],
    ['Sale el sol un rato: el Fuego pega más y el Agua menos. Lo aprovecha todo el equipo.', '短時間變成大晴天：火系傷害提高、水系降低。全隊都受影響。', '短时间变成大晴天：火系伤害提高、水系降低。全队都受影响。'],
    ['Llama la lluvia un rato: el Agua y el Eléctrico pegan más, y el Fuego menos.', '短時間求雨：水系與電系傷害提高，火系降低。', '短时间求雨：水系与电系伤害提高，火系降低。'],
    ['Una zona de hierba que va curando a quien se quede dentro.', '留下青草場地，站在裡面會持續回復。', '留下青草场地，站在里面会持续回复。'],
    ['Una zona electrificada: quien esté dentro ataca más rápido.', '留下電氣場地，站在裡面攻擊更快。', '留下电气场地，站在里面攻击更快。'],
    ['Paralizas a los enemigos cercanos un instante, sin hacerles daño (como Onda Trueno).', '讓附近敵人短暫麻痺，不造成傷害（類似電磁波）。', '让附近敌人短暂麻痹，不造成伤害（类似电磁波）。'],
    ['Prendes a los enemigos cercanos. No golpea: sólo quema, como Fuego Fatuo.', '點燃附近敵人。沒有直接傷害，只會灼燒（和輸出分類裡會打人的鬼火一樣）。', '点燃附近敌人。没有直接伤害，只会灼烧（和输出分类里会打人的鬼火一样）。'],
    ['Animas al equipo cercano: atacan más rápido un rato. Correr más es Viento Afín.', '鼓舞附近隊友，一段時間內攻擊更快。跑得更快是順風。', '鼓舞附近队友，一段时间内攻击更快。跑得更快是顺风。'],
    ['Llega un 25% antes', '提早 25% 抵達', '提早 25% 抵达'],
    ['+30% curación', '治療量 +30%', '治疗量 +30%'],
    ['+40% curación y +30% radio', '治療量 +40%、範圍 +30%', '治疗量 +40%、范围 +30%'],
    ['+30% duración', '持續時間 +30%', '持续时间 +30%'],
    ['+40% duración del efecto', '效果持續 +40%', '效果持续 +40%'],
    ['+30% radio y -20% recarga', '範圍 +30%、冷卻 -20%', '范围 +30%、冷却 -20%'],
    ['Ofensivo', '輸出', '输出'], ['Control', '控場', '控场'], ['Provocar', '嘲諷', '嘲讽'],
    ['Curación', '治癒', '治愈'], ['Proteger', '防護', '防护'], ['Terreno', '場地', '场地'],
    ['Ataque rápido', '攻速', '攻速'],
    ['Toca un movimiento para leer qué hace. El apoyo sólo sale si este Pokémon puede aprenderlo.', '點一個招式來看它做什麼。輔助招只有這隻寶可夢真的學得會才會出現。', '点一个招式来看它做什么。辅助招只有这只宝可梦真的学得会才会出现。'],
    ['Más apoyo y la lista de movimientos', '更多輔助，以及招式列表', '更多辅助，以及招式列表'],
    ['Nuevo apoyo, sólo si ese Pokémon puede aprenderlo: Deseo, Síntesis, Día Soleado, Danza Lluvia, Campo de Hierba, Campo Eléctrico, Deslumbrar (paraliza, como Onda Trueno), Llama Espectral (quema, como Fuego Fatuo) y Arenga (el equipo cercano ataca más rápido).',
     '新的輔助，只有這隻寶可夢真的學得會才有：祈願、光合作用、大晴天、求雨、青草場地、電氣場地、惡之眼（麻痺，類似電磁波）、鬼火（灼燒）與鼓舞（附近隊友攻擊更快）。',
     '新的辅助，只有这只宝可梦真的学得会才有：祈愿、光合作用、大晴天、求雨、青草场地、电气场地、恶之眼（麻痹，类似电磁波）、鬼火（灼烧）与鼓舞（附近队友攻击更快）。'],
    ['El apoyo (curar, provocar, clima, terreno...) ya no lo aprende cualquiera: sólo el Pokémon que puede aprender ese movimiento, por nivel, MT o tutor.',
     '輔助（治療、嘲諷、天氣、場地……）不再是人人都會。只有真正能學會的寶可夢才有，包含等級、招式機或教學。',
     '辅助（治疗、嘲讽、天气、场地……）不再是人人都会。只有真正能学会的宝可梦才有，包含等级、招式学习器或教学。'],
    ['En la ficha de un Pokémon que ya tienes se ve todo lo que puede aprender, separado por etiquetas: ofensivo, control, provocar, curación, proteger, terreno, velocidad, ataque rápido y mejora.',
     '已擁有的寶可夢會在資料頁列出所有能學的招式，並分成輸出、控場、嘲諷、治癒、防護、場地、速度、攻速與強化。',
     '已拥有的宝可梦会在资料页列出所有能学的招式，并分成输出、控场、嘲讽、治愈、防护、场地、速度、攻速与强化。'],
    ['Elige qué movimiento va siempre en cada tecla (1-4), para la memoria muscular. Las teclas 1 y 2 son de ataque (también mejoras de ataque, clima y velocidad). Las teclas 3 y 4 son de oficio (curar, proteger, provocar). Una cura sólo puede ser el movimiento principal de la 3 o de la 4.',
     '指定每個按鍵（1–4）固定放哪個招式，方便操作。第 1、2 鍵是輸出（含加攻、天氣與速度）。第 3、4 鍵是職能（治療、防守、挑釁）。治療只能當第 3 或第 4 鍵的主招。',
     '指定每个按键（1–4）固定放哪个招式，方便操作。第 1、2 键是输出（含加攻、天气与速度）。第 3、4 键是职能（治疗、防守、挑衅）。治疗只能当第 3 或第 4 键的主招。'],
    ['Las ranuras ya no son 4 en cada ataque. La tecla 1 tiene 4, la 2 tiene 3 y la 3 y la 4 tienen 2, abiertas del nivel 5 al 20. Curar sólo puede ser el ataque principal de la tecla 3 o 4 (una cura en total) y no se enlaza con un ataque. Danza Espada, el clima que potencia y la prisa van con los ataques.',
     '插槽不再是每個攻擊都 4 格。1 鍵 4 孔、2 鍵 3 孔、3 鍵和 4 鍵各 2 孔，從 5 級開到 20 級。治療只能當第 3 或第 4 鍵的主招（整套只能一個），不能鑲在攻擊上。劍舞、能強化輸出的天氣，以及速度和攻速，跟攻擊放在一起。',
     '插槽不再是每个攻击都 4 格。1 键 4 孔、2 键 3 孔、3 键和 4 键各 2 孔，从 5 级开到 20 级。治疗只能当第 3 或第 4 键的主招（整套只能一个），不能镶在攻击上。剑舞、能强化输出的天气，以及速度和攻速，跟攻击放在一起。']
  ].filter(r => r[1]);
  const pick = i => o => Object.fromEntries(o.map(r => [r[0], r[i]]));
  G.I18n.add(pick(1)(names), 'zh-Hant', 'move');
  G.I18n.add(pick(2)(names), 'zh-Hans', 'move');
  G.I18n.add(pick(1)(text), 'zh-Hant');
  G.I18n.add(pick(2)(text), 'zh-Hans');
})();
