/* malkochen R12 art: Topfbert's three Tour poses (waving, pointing, wink).
   Same viewBox (0 -20 140 150), parts and colours as assets/topfbert/topfbert-happy.svg.
   Live → CSS-animated SVG · still → frame 0 (reduced motion) · export → frame 0 + data-loop / data-pivot. */
(function () {
  const INK = '#1F1E1C', SAGE = '#A5C7AE', MINT = '#C7E0CD', BLUSH = '#F4A9A0', TONGUE = '#F08A8A';
  const KF = {
    'r12-wave': '0%,24%,60%,79%,100%{transform:none}4%{transform:rotate(-13deg)}9%{transform:rotate(5deg)}14%{transform:rotate(-13deg)}19%{transform:rotate(4deg)}64%{transform:rotate(-12deg)}69%{transform:rotate(4deg)}74%{transform:rotate(-10deg)}',
    'r12-nudge': '0%,8%,15%,22%,56%,63%,70%,100%{transform:none}12%,18%,60%,66%{transform:translateX(2px)}',
    'r12-tip': '0%,40%,64%,100%{transform:none}46%,54%{transform:translateY(-2.5px) rotate(-4deg)}60%{transform:translateY(.5px) rotate(1deg)}'
  };
  // shared R11 idle keyframes (identical copies, so this file also works without r11-art.js)
  const SHARED = {
    'r11-breathe': '0%,100%{transform:scale(1,1)}50%{transform:scale(.985,1.025)}',
    'r11-steam': '0%{opacity:0;transform:translateY(6px) scaleY(.8)}40%{opacity:1}100%{opacity:0;transform:translateY(-14px) scaleY(1.1)}',
    'r11-ihat': '0%,100%{transform:none}50%{transform:translateY(-1px) rotate(3deg)}',
    'r11-ieo': '0%,33%{opacity:1}33.5%,35.5%{opacity:0}36%,83%{opacity:1}83.5%,85.5%{opacity:0}86%,88%{opacity:1}88.5%,90.5%{opacity:0}91%,100%{opacity:1}',
    'r11-iec': '0%,33%{opacity:0}33.5%,35.5%{opacity:1}36%,83%{opacity:0}83.5%,85.5%{opacity:1}86%,88%{opacity:0}88.5%,90.5%{opacity:1}91%,100%{opacity:0}'
  };
  const ALL = Object.assign({}, SHARED, KF);
  const CSS = Object.entries(KF).map(([k, v]) => `@keyframes ${k}{${v}}`).join('\n');
  const CSS_ALL = Object.entries(ALL).map(([k, v]) => `@keyframes ${k}{${v}}`).join('\n');

  let MODE = 'live';
  const F0 = { 'r11-steam@-1.5': 'opacity:.7;transform:translateY(-7.8px) scaleY(1.01)' };
  function an(kf, dur, ease, delay, pivot) {
    const o = pivot ? `transform-box:view-box;transform-origin:${pivot[0]}px ${pivot[1]}px` : 'transform-box:fill-box;transform-origin:center';
    let f0 = F0[kf + '@' + (delay || 0)];
    if (f0 == null) { const m = ALL[kf].match(/^0%[^{]*\{([^}]*)\}/); f0 = m ? m[1] : ''; }
    f0 = f0.replace(/transform:none;?/, '').replace(/opacity:1;?/, '').trim();
    if (MODE === 'export') return ` data-loop="${kf} ${dur}s ${ease}${delay ? ' ' + delay + 's' : ''} infinite" data-pivot="${pivot ? pivot.join(' ') : 'center'}" style="${[f0, o].filter(Boolean).join(';')}"`;
    if (MODE === 'still') return f0 ? ` style="${f0}"` : '';
    return ` style="animation:${kf} calc(${dur}s * var(--spd, 1)) ${ease} calc(${delay || 0}s * var(--spd, 1)) infinite both;animation-play-state:var(--r11ps, running);${o}"`;
  }

  const L = (name, anim, svg, attr) => ({ name, anim: anim || '', svg, attr: attr || '' });
  const g = l => `<g id="${l.name}"${l.attr}${l.anim}>${l.svg}</g>`;
  const R = (x, y, w, h, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${MINT}" stroke="${INK}" stroke-width="2.5"/>`;
  const S = (d, w) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w || 3}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const eye = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy || 73}" rx="${rx || 4.5}" ry="${ry || 5}" fill="${INK}"/>`;
  const lid = (cx, cy) => { cy = cy || 72.5; return `M${cx - 5} ${cy}Q${cx} ${cy + 5} ${cx + 5} ${cy}`; };
  const cheek = (cx, cy) => `<ellipse cx="${cx}" cy="${cy}" rx="7.5" ry="4" fill="${BLUSH}" opacity=".85"/>`;
  const HAT = `<circle cx="22" cy="6" r="10.75" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="39" cy="1" r="11.75" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="50" cy="8" r="8.75" fill="#fff" stroke="${INK}" stroke-width="2.5"/><rect x="16" y="8" width="40" height="22" fill="#fff"/><rect x="16.25" y="23.25" width="39.5" height="13.5" rx="3" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`;
  const P = {
    handleL: R(9.25, 59.25, 19.5, 10.5, 5.5),
    handleR: R(111.25, 59.25, 19.5, 10.5, 5.5),
    body: `<path d="M21.25 48V88A38.75 34.75 0 0 0 60 122.75H80A38.75 34.75 0 0 0 118.75 88V48Z" fill="${SAGE}" stroke="${INK}" stroke-width="2.5"/>`,
    rim: R(13.25, 41.25, 113.5, 12.5, 6.5),
    hat: (tf) => `<g transform="${tf}">${HAT}</g>`
  };
  const WAVE_PIVOT = [111, 63];
  const LEAN = 'rotate(2 70 123)';
  const lean = s => `<g transform="${LEAN}">${s}</g>`;

  function steam(o, A) {
    if (o.small) return [];
    const c = o.sc || INK;
    return [
      L('steam_1', A('r11-steam', 3, 'ease-out', 0, null), `<rect x="86" y="10" width="4" height="18" rx="2" fill="${c}" opacity=".45"/>`),
      L('steam_2', A('r11-steam', 3, 'ease-out', -1.5, null), `<rect x="102" y="16" width="4" height="14" rx="2" fill="${c}" opacity=".45"/>`)
    ];
  }

  const POSES = {
    waving: (o, A, B) => [
      ...steam(o, A),
      L('handles', '', P.handleL),
      L('body', '', P.body),
      L('eyes', B('r11-ieo', 6, 'linear', 0, null), eye(50.5) + eye(89.5)),
      L('eyes_closed', B('r11-iec', 6, 'linear', 0, null), S(lid(50.5) + lid(89.5)), ' opacity="0"'),
      L('cheeks', '', cheek(41.5, 86) + cheek(98.5, 86)),
      L('mouth', '', `<path d="M59 81.5H81A11 10.5 0 0 1 59 81.5Z" fill="${INK}"/><path d="M62.75 89.4Q70 83.6 77.25 89.4A11 10.5 0 0 1 62.75 89.4Z" fill="${TONGUE}"/><path d="M59 81.5H81A11 10.5 0 0 1 59 81.5Z" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`),
      L('rim', '', P.rim),
      L('arm', A('r12-wave', 6, 'ease-in-out', 0, WAVE_PIVOT), `<g transform="rotate(-52 111 63)">${R(105.75, 57.75, 33, 10.5, 5.25)}</g>`),
      L('hat', A('r11-ihat', 6, 'ease-in-out', 0, [36, 46]), P.hat('rotate(-14 36 46)'))
    ],
    pointing: (o, A, B) => [
      L('handles', '', lean(`<g transform="rotate(-18 21.25 64.5)">${P.handleL}</g>`)),
      L('body', '', lean(P.body)),
      L('eyes', B('r11-ieo', 6, 'linear', 0, null), lean(eye(53.5, 72.5, 4.8, 5.4) + eye(92.5, 72.5, 4.8, 5.4))),
      L('eyes_closed', B('r11-iec', 6, 'linear', 0, null), lean(S(lid(53.5) + lid(92.5))), ' opacity="0"'),
      L('cheeks', '', lean(cheek(43, 86) + cheek(100, 86))),
      L('mouth', '', lean(S('M61.5 82A10 8 0 0 0 81.5 82'))),
      L('rim', '', lean(P.rim)),
      L('arm', A('r12-nudge', 6, 'ease-in-out', 0, null), lean(`<g transform="rotate(-20 110 64.5)">${R(104.75, 59.25, 29, 10.5, 5.25)}</g>`)),
      L('hat', A('r11-ihat', 6, 'ease-in-out', 0, [38.7, 44.9]), lean(P.hat('rotate(-14 36 46)')))
    ],
    wink: (o, A, B) => [
      ...steam(o, A),
      L('handles', '', P.handleL + P.handleR),
      L('body', '', P.body),
      L('eyes', B('r11-ieo', 6, 'linear', 0, null), eye(50.5)),
      L('eyes_closed', B('r11-iec', 6, 'linear', 0, null), S(lid(50.5)), ' opacity="0"'),
      L('wink', '', S('M84 74.5Q89.5 68 95 74.5')),
      L('cheeks', '', cheek(41.5, 86) + cheek(98.5, 84)),
      L('mouth', '', S('M60.5 84Q69 90.5 80.5 79.5') + S('M80.5 79.5L82.6 81.6', 2.6)),
      L('rim', '', P.rim),
      L('hat', A('r12-tip', 6, 'ease-in-out', 0, [18, 36]), P.hat('translate(0 -3) rotate(-8 36 46)'))
    ]
  };

  function build(pose, o) {
    o = o || {};
    const A = (...a) => (o.small ? '' : an(...a));   // below 48px: no steam, no hat / arm motion
    const B = (...a) => an(...a);                     // blink + breathe always (unless reduced motion → MODE still)
    return { layers: POSES[pose](o, A, B), whole: B('r11-breathe', 3, 'ease-in-out', 0, [70, 123]) };
  }
  function withMode(m, fn) { const p = MODE; MODE = m; try { return fn(); } finally { MODE = p; } }
  const open = (extra) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -20 140 150" width="420" height="450"${extra || ''}>`;

  const R12 = {
    INK, KF, SHARED, CSS, CSS_ALL, POSES: Object.keys(POSES),
    svg(pose, o) {
      o = o || {};
      return withMode(o.mode || 'live', () => { const b = build(pose, o); return open(` data-pose="${pose}" style="width:100%;height:100%;display:block;overflow:visible"`) + `<g id="topfbert"${b.whole}>${b.layers.map(g).join('')}</g></svg>`; });
    },
    layerSvg(pose, name) {
      return withMode('still', () => { const l = build(pose, {}).layers.find(x => x.name === name); return open(` style="width:100%;height:100%;display:block;overflow:visible"`) + g({ ...l, attr: '', anim: name === 'steam_2' ? l.anim : '' }) + '</svg>'; });
    },
    full(pose) { return withMode('export', () => { const b = build(pose, {}); return open(` data-pose="${pose}"`) + `<g id="topfbert"${b.whole}>${b.layers.map(g).join('')}</g></svg>`; }); },
    files(pose) {
      return withMode('export', () => build(pose, {}).layers.map((l, i) => {
        const nn = String(i + 1).padStart(2, '0');
        return { z: i + 1, name: l.name, file: `topfbert-${pose}-${nn}-${l.name}.svg`, svg: open(` data-layer="${l.name}"`) + g(l) + '</svg>' };
      }));
    }
  };
  if (typeof window !== 'undefined') {
    window.R12 = R12;
    if (typeof document !== 'undefined' && !document.getElementById('r12-kf')) { const s = document.createElement('style'); s.id = 'r12-kf'; s.textContent = CSS_ALL; document.head.appendChild(s); }
  }
  if (typeof module !== 'undefined') module.exports = R12;
})();
