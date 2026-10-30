#!/usr/bin/env python3
"""Génère pwa/index.html à partir de artefact-pilotage.html (à relancer après chaque évolution de l'artefact)."""
import re, pathlib
here = pathlib.Path(__file__).resolve().parent
src = (here.parent / 'artefact-pilotage.html').read_text(encoding='utf-8')
head = ('<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#2B2F33">'
        '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Pilotage">'
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><link rel="apple-touch-icon" href="icons/icon-192.png">'
        '<script src="config.js"></script><script>window.OCR_LOCAL="ocr/";</script>'
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>'
        '<script src="supabase-adapter.js"></script>')
# --- Retire toutes les données réelles du chantier : la version hébergée démarre vide, les données viennent de Supabase ---
lines = src.split('\n')
def vide(name, repl):
    for i,l in enumerate(lines):
        if l.startswith('const '+name+' = ['):
            j = i
            while not lines[j].startswith('];'): j += 1
            lines[i:j+1] = ['const '+name+' = '+repl+';']; return
    raise SystemExit('introuvable: '+name)
for n in ['ORCH_REPOS','ORCH_PREP','ORCH_PHOTOS','ORCH_INBOX','ORCH_MAJ','ORCH_FICHES','ORCH_DEPS','ORCH_UPDATES','CLAUDE_RECENTS']: vide(n,'[]')
for i,l in enumerate(lines):
    if l.startswith('const SEED_STATE = '): lines[i] = 'const SEED_STATE = {};'
    elif l.startswith('const T145_PHOTO = ') or l.startswith('const T1456_PHOTO = '): lines[i] = l.split(' = ')[0]+' = "";'
    elif l.startswith('const RT_SEED = '):
        import json
        o = json.loads(l[l.index('{'):l.rindex('}')+1]); o['travaux'] = []
        lines[i] = 'const RT_SEED = ' + json.dumps(o, ensure_ascii=False) + l[l.rindex('}')+1:]
    elif l.startswith('const PLAN_SRC=window.RT_PLAN_SRC="data:'): lines[i] = 'const PLAN_SRC=window.RT_PLAN_SRC="";'
src = '\n'.join(lines).replace('AI_SEED.forEach(','[].forEach(')
out = src.replace('</head>', head + '</head>', 1)
sw = "<script>if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); }</script>"
out = out.replace('</body>', sw + '</body>', 1)
(here / 'index.html').write_text(out, encoding='utf-8')
print('index.html', len(out)//1024, 'Ko')
