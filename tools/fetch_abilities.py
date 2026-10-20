#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PokemonPOE — 整理每隻寶可夢的特性(Ability)與進化階段。

    python tools/fetch_abilities.py

產出:
  js/data/abilities.js         G.ABILITIES(特性本身)與 G.DEX_ABILITIES(每隻寶可夢的特性與進化階段)
  tools/out/abilities-review.csv   特性審查表(有多少隻寶可夢用、是否已實作)

資料來源是 PokeAPI(只讀)。下載過的內容放在 tools/.cache/ 裡,中途失敗再跑一次會接著下載。
圖鑑名單取自 js/data/pokedex.js(不改動它)。

G.DEX_ABILITIES[dex] = {
  "a": [特性編號...],  // 依官方順序:一般特性 1、一般特性 2、隱藏特性(去重)
  "h": 隱藏特性編號或 0,
  "s": 進化階段(1 = 初階),
  "n": 這條進化線(該分支)一共幾階,
  "f": 1 若是最終型態(不會再進化)
}
"""
import csv
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = 'https://pokeapi.co/api/v2'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEX_JS = os.path.join(ROOT, 'js', 'data', 'pokedex.js')
OUT_JS = os.path.join(ROOT, 'js', 'data', 'abilities.js')
OUT_CSV = os.path.join(ROOT, 'tools', 'out', 'abilities-review.csv')
CACHE = os.path.join(ROOT, 'tools', '.cache')


def get(path):
    """下載 JSON(有快取、會重試)。path 例如 'pokemon/25'。"""
    fn = os.path.join(CACHE, path.replace('/', '_') + '.json')
    if os.path.exists(fn):
        with open(fn, encoding='utf-8') as f:
            return json.load(f)
    last = None
    for i in range(5):
        try:
            req = urllib.request.Request(f'{API}/{path}', headers={'User-Agent': 'pokemonpoe-tools'})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode('utf-8'))
            os.makedirs(CACHE, exist_ok=True)
            with open(fn, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False)
            return data
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f'下載失敗 {path}: {last}')


CSV_BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'


def get_csv(name):
    """PokeAPI 的原始資料表(GitHub)。API 的特性中文欄位是空的,中文要從這裡補。"""
    fn = os.path.join(CACHE, 'csv_' + name)
    if not os.path.exists(fn):
        last = None
        for i in range(5):
            try:
                req = urllib.request.Request(CSV_BASE + name, headers={'User-Agent': 'pokemonpoe-tools'})
                with urllib.request.urlopen(req, timeout=60) as r:
                    raw = r.read()
                os.makedirs(CACHE, exist_ok=True)
                with open(fn, 'wb') as f:
                    f.write(raw)
                break
            except Exception as e:  # noqa: BLE001
                last = e
                time.sleep(1.5 * (i + 1))
        else:
            raise RuntimeError(f'下載失敗 {name}: {last}')
    with open(fn, encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def fill_chinese(abilities):
    """用原始資料表補繁中(語言 4)/簡中(語言 12)的特性名稱與說明;缺繁中就用簡中。"""
    names = {4: {}, 12: {}}
    for r in get_csv('ability_names.csv'):
        lang = int(r['local_language_id'])
        if lang in names:
            names[lang][int(r['ability_id'])] = r['name'].strip()
    text = {4: {}, 12: {}}            # 取最新的版本群組
    for r in get_csv('ability_flavor_text.csv'):
        lang = int(r['language_id'])
        if lang in text:
            aid, vg = int(r['ability_id']), int(r['version_group_id'])
            if aid not in text[lang] or vg >= text[lang][aid][0]:
                text[lang][aid] = (vg, r['flavor_text'].replace('\n', '').replace('\f', '').strip())
    for aid, a in abilities.items():
        a['zh'] = names[4].get(aid) or names[12].get(aid) or a.get('zh', '')
        a['zhs'] = names[12].get(aid) or a.get('zhs', '')
        t4, t12 = text[4].get(aid), text[12].get(aid)
        a['descZh'] = (t4 or t12 or ('', a.get('descZh', '')))[1]


def pmap(fn, items, workers=8):
    with ThreadPoolExecutor(max_workers=workers) as ex:
        return list(ex.map(fn, items))


def read_dex():
    with open(DEX_JS, encoding='utf-8') as f:
        return [int(x) for x in re.findall(r'"dex":(\d+)', f.read())]


def pick(entries, lang, key):
    """取某語言的文字;PokeAPI 同語言可能有多筆,取最後一筆(最新版本)。"""
    out = None
    for e in entries:
        if e['language']['name'] == lang and e.get(key):
            out = e[key]
    return (out or '').replace('\n', ' ').replace('\f', ' ').strip()


def name_of(names, lang):
    for n in names:
        if n['language']['name'] == lang:
            return n['name']
    return ''


# ---------------- 進化階段 ----------------

def chain_stages(chain):
    """把進化樹攤平:species 名 -> (深度 1 起算, 往下還有幾階)。"""
    info = {}

    def walk(node, depth):
        kids = node.get('evolves_to', [])
        heights = [walk(k, depth + 1) for k in kids]
        h = 1 + max(heights) if heights else 0     # 往下還有幾階(0 = 最終型態)
        info[node['species']['name']] = (depth, h)
        return h

    walk(chain, 1)
    return info


def main():
    dexes = read_dex()
    print(f'圖鑑 {len(dexes)} 隻,開始下載(第一次約數分鐘)…')

    def load_mon(d):
        p = get(f'pokemon/{d}')
        sp = get(f'pokemon-species/{d}')
        return d, p, sp

    mons = pmap(load_mon, dexes)

    chains = {}
    chain_ids = sorted({int(sp['evolution_chain']['url'].rstrip('/').split('/')[-1]) for _, _, sp in mons})
    for cid, data in zip(chain_ids, pmap(lambda c: get(f'evolution-chain/{c}'), chain_ids)):
        chains[cid] = chain_stages(data['chain'])

    dex_abl, ability_ids, users = {}, set(), {}
    for d, p, sp in mons:
        cid = int(sp['evolution_chain']['url'].rstrip('/').split('/')[-1])
        depth, height = chains[cid].get(sp['name'], (1, 0))
        slots = sorted(p['abilities'], key=lambda a: a['slot'])
        ids, hidden = [], 0
        for a in slots:
            aid = int(a['ability']['url'].rstrip('/').split('/')[-1])
            if a['is_hidden']:
                hidden = aid
            if aid not in ids:
                ids.append(aid)
        # 隱藏特性固定排最後
        if hidden and ids and ids[-1] != hidden:
            ids.remove(hidden)
            ids.append(hidden)
        rec = {'a': ids, 'h': hidden, 's': depth, 'n': depth + height}
        if height == 0:
            rec['f'] = 1
        dex_abl[d] = rec
        for aid in ids:
            ability_ids.add(aid)
            users.setdefault(aid, []).append(d)

    ids = sorted(ability_ids)
    print(f'共用到 {len(ids)} 種特性,下載特性內容…')
    abilities = {}
    for aid, a in zip(ids, pmap(lambda i: get(f'ability/{i}'), ids)):
        eff = next((e.get('short_effect') for e in a['effect_entries'] if e['language']['name'] == 'en'), '') or ''
        abilities[aid] = {
            'id': aid,
            'key': a['name'],
            'en': name_of(a['names'], 'en'),
            'zh': name_of(a['names'], 'zh-Hant') or name_of(a['names'], 'zh-Hans'),
            'zhs': name_of(a['names'], 'zh-Hans'),
            'ja': name_of(a['names'], 'ja'),
            'desc': eff.replace('\n', ' ').strip(),
            'descZh': pick(a['flavor_text_entries'], 'zh-Hant', 'flavor_text') or pick(a['flavor_text_entries'], 'zh-Hans', 'flavor_text'),
            'descEn': pick(a['flavor_text_entries'], 'en', 'flavor_text'),
        }

    fill_chinese(abilities)

    # ---- 寫 js/data/abilities.js ----
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('/* 自動產生,請勿手改:python tools/fetch_abilities.py (資料來源 PokeAPI) */\n')
        f.write('G.ABILITIES = ' + json.dumps({str(k): v for k, v in abilities.items()}, ensure_ascii=False, separators=(',', ':')) + ';\n')
        f.write('G.DEX_ABILITIES = ' + json.dumps({str(k): v for k, v in dex_abl.items()}, ensure_ascii=False, separators=(',', ':')) + ';\n')

    # ---- 審查表 ----
    os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
    impl = {}
    impl_path = os.path.join(ROOT, 'tools', 'abilities-impl.json')   # 手動維護:{"65": "done"|"todo"|"skip"}
    if os.path.exists(impl_path):
        with open(impl_path, encoding='utf-8') as f:
            impl = json.load(f)
    with open(OUT_CSV, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['id', 'key', '中文', 'English', '使用的寶可夢數', '實作狀態(done/todo/skip)', '效果(英文)', '說明(中文)'])
        for aid in sorted(ids, key=lambda i: -len(users[i])):
            a = abilities[aid]
            w.writerow([aid, a['key'], a['zh'], a['en'], len(users[aid]), impl.get(str(aid), ''), a['desc'], a['descZh']])

    # ---- 摘要 ----
    n_abl = [len(v['a']) for v in dex_abl.values()]
    finals = sum(1 for v in dex_abl.values() if v.get('f'))
    single = sum(1 for v in dex_abl.values() if v['n'] == 1)
    print(f'完成:{OUT_JS}')
    print(f'審查表:{OUT_CSV}')
    print(f'特性數量分布:1 個={n_abl.count(1)} 隻 · 2 個={n_abl.count(2)} 隻 · 3 個={n_abl.count(3)} 隻')
    print(f'最終型態 {finals} 隻(其中不進化的 {single} 隻)')
    print('下一步:告訴 Claude 已經產生,我會把 abilities.js 接進 dev.html。')


if __name__ == '__main__':
    sys.exit(main())
