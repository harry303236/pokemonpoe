#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baja de PokeAPI quién puede aprender cada movimiento de apoyo y lo deja en
js/data/support-learn.js. El juego no vuelve a pedir red.

    python tools/fetch_support_learnsets.py

Cuenta cualquier método (nivel, MT, tutor, huevo) de las generaciones que
trae PokeAPI. Sólo entra el número de la forma nacional (1–1025): el juego
no tiene formas regionales aparte.

Llama Espectral (spirit-burn) no existe como movimiento: usa quién aprende
Fuego Fatuo (will-o-wisp), porque en el juego es esa quemadura sin daño.
"""
import json
import os
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = 'https://pokeapi.co/api/v2'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'data', 'support-learn.js')

# id del juego -> nombre en PokeAPI
MOVES = [
    ('recover', 'recover'),
    ('heal-pulse', 'heal-pulse'),
    ('life-dew', 'life-dew'),
    ('heal-bell', 'heal-bell'),
    ('protect', 'protect'),
    ('reflect', 'reflect'),
    ('light-screen', 'light-screen'),
    ('aurora-veil', 'aurora-veil'),
    ('iron-defense', 'iron-defense'),
    ('taunt', 'taunt'),
    ('follow-me', 'follow-me'),
    ('tailwind', 'tailwind'),
    ('wish', 'wish'),
    ('synthesis', 'synthesis'),
    ('sunny-day', 'sunny-day'),
    ('rain-dance', 'rain-dance'),
    ('grassy-terrain', 'grassy-terrain'),
    ('electric-terrain', 'electric-terrain'),
    ('glare', 'glare'),
    ('spirit-burn', 'will-o-wisp'),
    ('coaching', 'coaching'),
]


def get(url):
    last = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'pokemonpoe/1.0'})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def dex_of(url):
    n = url.rstrip('/').rsplit('/', 1)[-1]
    if not n.isdigit():
        return None
    d = int(n)
    return d if 1 <= d <= 1025 else None


def one(pair):
    game_id, api_name = pair
    data = get(f'{API}/move/{api_name}/')
    dexes = sorted({d for p in data.get('learned_by_pokemon', []) if (d := dex_of(p['url']))})
    print(f'  {game_id} <- {api_name}: {len(dexes)}')
    return game_id, dexes


def main():
    print('PokeAPI: learnsets de apoyo')
    with ThreadPoolExecutor(max_workers=4) as ex:
        rows = list(ex.map(one, MOVES))
    body = ',\n'.join(
        '  %s: [%s]' % (json.dumps(gid), ','.join(str(d) for d in dexes))
        for gid, dexes in rows
    )
    text = (
        '/* ============ support-learn.js — GENERADO, no editar a mano ============\n'
        ' * Quién puede aprender cada movimiento de apoyo (número de la Pokédex).\n'
        ' * Lo produce tools/fetch_support_learnsets.py desde PokeAPI.\n'
        ' * Nivel, MT, tutor o huevo cuentan. Llama Espectral usa Fuego Fatuo.\n'
        ' * El juego no hace ninguna petición a internet.\n'
        ' */\n'
        'G.SUPPORT_LEARN = {\n' + body + '\n};\n'
    )
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print('escrito', OUT)


if __name__ == '__main__':
    main()
