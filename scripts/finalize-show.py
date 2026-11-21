#!/usr/bin/env python3
"""Finalize a verified show file for performance.

Takes a show built by build-verified-show.ts plus a SECOND, independent audit of
that exact show (final palettes applied, music playing) and:
  - drops every scene that fails the second audit (photosensitivity, black/blown,
    static/frozen, flat structure, flat to music)
  - drops scenes vetoed by eye from the contact sheet (--veto names file)
  - sets the DJ title overlay text (--title) and clears stale now-playing text
  - re-ids scenes, fills the 16 Live scene pads with the strongest scenes
  - writes the show + a report next to it

Usage:
  finalize-show.py --show show.json --verify a.json,b.json --title "@djtim.aka.i.sed" \
      --veto veto.txt --out ~/Documents/visualsynth-show-2026-11-21.json
"""
import argparse, json, statistics

ap = argparse.ArgumentParser()
ap.add_argument('--show', required=True)
ap.add_argument('--verify', required=True)
ap.add_argument('--title', required=True)
ap.add_argument('--veto', default=None)
ap.add_argument('--out', required=True)
ap.add_argument('--max-noise', type=int, default=2, help='keep at most N names in --noise list')
ap.add_argument('--noise', default=None, help='file of grainy-noise scene names (look-alike family)')
args = ap.parse_args()

show = json.load(open(args.show))
rows = {}
for f in args.verify.split(','):
    for r in json.load(open(f)):
        rows[r['name']] = r
veto = set(l.strip() for l in open(args.veto)) if args.veto else set()
noise = [l.strip() for l in open(args.noise)] if args.noise else []

def structure(fp):
    if not fp: return 0.0
    m = fp['mean']; lum = [(m[i] + m[i + 1] + m[i + 2]) / 3 for i in range(0, len(m), 3)]
    return statistics.pstdev(lum)

def fails(r):
    if r is None: return ['not verified']
    if r.get('crashed') or 'meanLuma' not in r: return ['crash']
    w = []
    reg = r.get('region') or ''
    big = reg == 'full' or reg.startswith('q-')
    if (big and r['perSec60'] > 3) or r['perSec60'] >= 8: w.append(f"flashing {r['perSec60']}/s")
    late = r['lateLuma'] if r.get('lateLuma') is not None else r['meanLuma']
    lm = r['lateMotion'] if r.get('lateMotion') is not None else r['motion']
    if min(r['meanLuma'], late) < 14: w.append('black')
    if max(r['meanLuma'], late) > 225: w.append('blown out')
    if min(r['motion'], lm) < 0.25: w.append('static/freezes')
    if min(structure(r.get('fp')), structure(r.get('lateFp')) if r.get('lateFp') else 999) < 11: w.append('flat')
    rx = r.get('react')
    if rx and rx['corr'] < 0.15 and rx['ratio'] < 1.15: w.append('flat to music')
    return w

kept, dropped, noise_kept = [], [], 0
for s in show['scenes']:
    why = fails(rows.get(s['name']))
    if s['name'] in veto: why.append('vetoed by eye (contact sheet)')
    if s['name'] in noise:
        if noise_kept >= args.max_noise: why.append('look-alike noise texture')
        elif not why: noise_kept += 1
    (dropped if why else kept).append((s, why))

def strength(s):
    r = rows.get(s['name']) or {}
    rx = r.get('react') or {}
    return min(r.get('lateMotion') or 0, 6) * 0.4 + structure(r.get('fp')) / 20 + (rx.get('corr') or 0) * 2

scenes = []
for i, (s, _) in enumerate(kept):
    s = dict(s); s['id'] = s['scene_id'] = f'scene-{i + 1}'
    scenes.append(s)

out = dict(show)
out['scenes'] = scenes
out['activeSceneId'] = scenes[0]['id'] if scenes else ''
out['livePads'] = [s['id'] for s in sorted(scenes, key=strength, reverse=True)[:16]]
for o in out.get('overlays', []):
    if o.get('id') == 'now-playing-title': o['text'] = ''
    elif o.get('type') == 'text' and o.get('text', '').startswith('@'): o['text'] = args.title
if not any(o.get('type') == 'text' and o.get('text') == args.title for o in out.get('overlays', [])):
    raise SystemExit(f'title overlay {args.title!r} not present — refusing to write')
json.dump(out, open(args.out, 'w'), indent=2)
report = {'kept': [s['name'] for s, _ in kept], 'dropped': [{'name': s['name'], 'why': w} for s, w in dropped]}
json.dump(report, open(args.out.replace('.json', '.report.json'), 'w'), indent=2)
print(f"show: {len(scenes)} scenes kept, {len(dropped)} dropped -> {args.out}")
for s, w in dropped: print(f"  dropped {s['name'][:46]:46} {', '.join(w)}")
