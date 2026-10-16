/* malkochen R11 art: single source for the 3 new placeholders, the cast, the new clips and Topfbert idle.
   Live mode → CSS-animated SVG (r11-* keyframes); export mode → static frame-0 SVG with data-loop / data-pivot. */
(function () {
  const INK = '#1F1E1C';
  // ---- OKLCH mixing (matches CSS color-mix(in oklch, a p%, b)) ----
  const h2r = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
  const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const gam = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  function toLch(hex) {
    const [r, g, b] = h2r(hex).map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
  }
  function fromLch([L, C, H]) {
    const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
    return '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, gam(v))) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function mix(a, p, b) {
    const A = toLch(a), B = toLch(b), t = p / 100;
    let h1 = A[2], h2 = B[2];
    // near-neutral colours (C < .02, e.g. every theme surface/ink) have a powerless hue, exactly like Chrome/Safari color-mix
    if (A[1] < 0.02) h1 = h2; if (B[1] < 0.02) h2 = h1;
    if (h2 - h1 > 180) h1 += 360; else if (h1 - h2 > 180) h2 += 360;
    return fromLch([A[0] * t + B[0] * (1 - t), A[1] * t + B[1] * (1 - t), ((h1 * t + h2 * (1 - t)) % 360 + 360) % 360]);
  }
  const TH = {
    light: { bg: '#F7F6F2', surface: '#FFFFFF', s2: '#EFEDE8', ink: '#1F1E1C', ink2: '#6F6B65' },
    dark: { bg: '#131211', surface: '#1E1C1A', s2: '#2A2825', ink: '#F3EFE8', ink2: '#A8A298' }
  };
  const HUE = { butter: '#F7B94A', orchid: '#DE8CF2', sage: '#A5C7AE', carrot: '#F08A5D', sky: '#A8BEE3' };
  function pal(hue, acc, theme) {
    const t = TH[theme], S = t.s2, I = t.ink, h = HUE[hue] || hue, a = HUE[acc] || acc;
    return { p0: mix(h, 18, S), p1: mix(h, 34, S), p2: mix(h, 58, S), p3: mix(h, 82, I), a1: mix(a, 62, S), a2: mix(a, 85, I), c: mix('#FFF4DE', 80, S), g1: mix('#8DB596', 74, S), g2: mix('#5E8F6A', 85, I), d: mix('#6B4A34', 85, S), w: mix('#D9A86C', 76, S) };
  }

  // ---- motion ----
  const SO = 'cubic-bezier(.61,1,.88,1)', SIO = 'cubic-bezier(.37,0,.63,1)', SI = 'cubic-bezier(.12,0,.39,0)';
  const UP = 'cubic-bezier(.2,.7,.4,1)', DN = 'cubic-bezier(.6,0,.8,.3)', IO = 'cubic-bezier(.45,0,.55,1)';
  const sine = (a, b) => `0%{transform:${a(0)};animation-timing-function:${SO}}25%{transform:${a(1)};animation-timing-function:${SIO}}75%{transform:${a(-1)};animation-timing-function:${SI}}100%{transform:${a(0)}}`;
  const KF = {
    fork: '0%,100%{transform:none}45%,55%{transform:translateY(-12px) rotate(-6deg)}',
    strand: '0%,100%{transform:scaleY(1)}45%,55%{transform:scaleY(1.75)}',
    leaves: '0%,100%{transform:none}50%{transform:translateY(-2px) rotate(-4deg)}',
    tomato: '0%,50%,100%{transform:none}64%{transform:translateY(-10px)}76%{transform:scale(1.14,.86)}84%{transform:scale(.96,1.04)}90%{transform:none}',
    drip: '0%,8%{transform:scaleY(1)}55%{transform:scaleY(1.9)}68%{transform:scaleY(.9)}78%,100%{transform:scaleY(1)}',
    drop: '0%,55%{opacity:0;transform:translateY(0) scale(.6)}58%{opacity:1;transform:translateY(0) scale(1)}78%{opacity:1;transform:translateY(18px) scale(1)}82%{opacity:1;transform:translateY(19px) scale(1.7,.4)}92%,100%{opacity:0;transform:translateY(19px) scale(1.9,.3)}',
    berry: '0%,46%,100%{transform:rotate(0)}12%{transform:rotate(-10deg)}24%{transform:rotate(7deg)}36%{transform:rotate(-3deg)}',
    roll: sine(k => `translateX(${40 * k}px) rotate(${154 * k}deg)`),
    rock: sine(k => `rotate(${9 * k}deg)`),
    sprout: sine(k => `rotate(${-12 * k}deg)`),
    blink: '0%,46%,50%,100%{transform:scaleY(1)}48%{transform:scaleY(.1)}',
    hop: '0%{transform:none}6%{transform:scale(1.07,.93)}17%{transform:translateY(-16px) scale(.96,1.05)}28%{transform:translateY(0) scale(1.09,.91)}34%{transform:scale(.98,1.02)}40%,100%{transform:none}',
    look: '0%,44%{transform:none}52%,64%{transform:translateX(-1.6px)}72%,86%{transform:translateX(1.6px)}94%,100%{transform:none}',
    breathe: '0%,100%{transform:scale(1,1)}50%{transform:scale(.985,1.025)}',
    steam: '0%{opacity:0;transform:translateY(6px) scaleY(.8)}40%{opacity:1}100%{opacity:0;transform:translateY(-14px) scaleY(1.1)}',
    hattip: '0%,12%{transform:none}20%{transform:translateY(-4px) rotate(-20deg)}24%,60%{transform:translateY(-3px) rotate(-16deg)}68%{transform:rotate(3deg)}72%{transform:rotate(-1deg)}76%,100%{transform:none}',
    peapop: '0%,17%{transform:translateY(30px)}25%{transform:translateY(-3px) scale(.94,1.08)}29%{transform:translateY(0) scale(1.04,.96)}33%,56%{transform:none}64%,100%{transform:translateY(30px)}',
    pealook: '0%,33%{transform:none}37%,45%{transform:translateX(-2px)}49%,55%{transform:translateX(2px)}58%,100%{transform:none}',
    gazehut: '0%,18%{transform:none}24%,58%{transform:translate(1.5px,-3px)}64%,100%{transform:none}',
    eo: '0%,85%{opacity:1}86%,89%{opacity:0}90%,100%{opacity:1}',
    ec: '0%,85%{opacity:0}86%,89%{opacity:1}90%,100%{opacity:0}',
    leapx: `0%,6%{transform:translateX(0);animation-timing-function:${IO}}33%,56%{transform:translateX(54px);animation-timing-function:${IO}}83%,100%{transform:translateX(0)}`,
    leapy: `0%{transform:translateY(0) rotate(0deg) scale(1,1)}6%{transform:translateY(0) rotate(0deg) scale(1.08,.92);animation-timing-function:${UP}}20%{transform:translateY(-34px) rotate(10deg) scale(1,1);animation-timing-function:${DN}}33%{transform:translateY(0) rotate(0deg) scale(1.1,.9)}38%{transform:translateY(0) rotate(0deg) scale(1,1)}44%{transform:translateY(0) rotate(0deg) scale(-1,1)}56%{transform:translateY(0) rotate(0deg) scale(-1.08,.92);animation-timing-function:${UP}}70%{transform:translateY(-34px) rotate(-10deg) scale(-1,1);animation-timing-function:${DN}}83%{transform:translateY(0) rotate(0deg) scale(-1.1,.9)}88%{transform:translateY(0) rotate(0deg) scale(-1,1)}94%,100%{transform:translateY(0) rotate(0deg) scale(1,1)}`,
    duck: '0%,12%,28%,62%,78%,100%{transform:scale(1,1)}20%,70%{transform:scale(1.14,.8)}',
    gazesprung: '0%{transform:translate(-3px,0)}20%{transform:translate(0,-3px)}33%,50%{transform:translate(3px,0)}70%{transform:translate(0,-3px)}83%,100%{transform:translate(-3px,0)}',
    ride: '0%,14%{transform:none}22%{transform:translateY(1px) scale(1.08,.92)}36%{transform:translateY(-22px) rotate(-6deg)}50%{transform:translateY(-26px) rotate(5deg)}62%{transform:translateY(-19px) rotate(-3deg)}74%{transform:translateY(0) scale(1.1,.9)}80%{transform:scale(.97,1.03)}86%,100%{transform:none}',
    puff: '0%,16%{opacity:0;transform:translateY(8px) scale(.4)}26%{opacity:1;transform:translateY(0) scale(1)}50%{opacity:1;transform:translateY(-14px) scale(1.12)}70%,100%{opacity:0;transform:translateY(-28px) scale(1.25)}',
    gazedampf: '0%,22%{transform:none}30%,66%{transform:translate(2px,-3px)}74%,100%{transform:none}',
    wiggle: '0%,100%{transform:rotate(0)}50%{transform:rotate(-12deg)}',
    blink48: '0%,88%,92%,100%{transform:scaleY(1)}90%{transform:scaleY(.1)}',
    ihat: '0%,100%{transform:none}50%{transform:translateY(-1px) rotate(3deg)}',
    ieo: '0%,33%{opacity:1}33.5%,35.5%{opacity:0}36%,83%{opacity:1}83.5%,85.5%{opacity:0}86%,88%{opacity:1}88.5%,90.5%{opacity:0}91%,100%{opacity:1}',
    iec: '0%,33%{opacity:0}33.5%,35.5%{opacity:1}36%,83%{opacity:0}83.5%,85.5%{opacity:1}86%,88%{opacity:0}88.5%,90.5%{opacity:1}91%,100%{opacity:0}'
  };
  const CSS = Object.entries(KF).map(([k, v]) => `@keyframes r11-${k}{${v}}`).join('\n');

  let MODE = 'live';
  // frame-0 state for loops that start mid-cycle (negative delay); everything else uses its 0% keyframe
  const F0 = { 'steam@-1.2': 'opacity:.7;transform:translateY(-7.8px) scaleY(1.01)', 'steam@-1.5': 'opacity:.7;transform:translateY(-7.8px) scaleY(1.01)', 'sprout@-4.1': 'transform:rotate(5.2deg)' };
  // animation attribute: live → inline CSS animation, export → data-loop/data-pivot (frame-0 static)
  function an(name, dur, ease, delay, pivot) {
    const o = pivot ? `transform-box:view-box;transform-origin:${pivot[0]}px ${pivot[1]}px` : 'transform-box:fill-box;transform-origin:center';
    if (MODE === 'export') {
      let f0 = F0[name + '@' + (delay || 0)];
      if (f0 == null) { const m = KF[name].match(/^0%[^{]*\{([^}]*)\}/); f0 = m ? m[1].replace(/;?animation-timing-function:[^;]*/g, '') : ''; }
      if (/transform:none/.test(f0) || /^\s*$/.test(f0)) f0 = f0.replace(/transform:none;?/, '');
      return ` data-loop="${name} ${dur}s ${ease}${delay ? ' ' + delay + 's' : ''} infinite"${pivot ? ` data-pivot="${pivot[0]} ${pivot[1]}"` : ' data-pivot="center"'}${f0 ? ` style="${f0};${o}"` : ''}`;
    }
    const d = delay ? ` calc(${delay}s * var(--spd, 1))` : '';
    const o2 = pivot ? `transform-box:view-box;transform-origin:${pivot[0]}px ${pivot[1]}px` : 'transform-box:fill-box;transform-origin:center';
    return ` style="animation:r11-${name} calc(${dur}s * var(--spd, 1)) ${ease}${d} infinite both;animation-play-state:var(--r11ps, running);${o2}"`;
  }
  const L = (name, anim, svg) => ({ name, anim: anim || '', svg });
  const g = l => `<g id="${l.name}"${l.anim}>${l.svg}</g>`;

  // ---- dishes (viewBox 120×120) ----
  const DISH = {
    pasta: {
      hue: 'butter', acc: 'carrot', dur: 3, label: 'Pasta', group: 'fork, strand', props: 'fork y −12 · rotate −6° (pivot twirl bottom) · strand scaleY 1→1.75 (pivot nest)', ease: 'easeInOut', keys: '0 / 45–55% hold / 100%',
      keywords: ['pasta', 'spaghetti', 'nudel', 'nudeln', 'rigatoni', 'penne', 'linguine', 'tagliatelle', 'gnocchi', 'lasagne', 'carbonara', 'bolognese', 'pesto', 'mac'],
      layers: P => [
        L('plate', '', `<ellipse cx="60" cy="88" rx="46" ry="12" fill="${P.p3}"/><ellipse cx="60" cy="85" rx="46" ry="11" fill="${P.c}"/><ellipse cx="60" cy="85" rx="33" ry="7" fill="${P.p1}"/>`),
        L('nest', '', `<path d="M29 86C31 72 50 65 61 67C75 64 91 72 91 86Z" fill="${P.p2}"/><path d="M35 82q8-8 16-2t16-1 15 3M40 75.5q8-7 15-2t15 0M44 86q8-5 16-1t18 0" fill="none" stroke="${P.p3}" stroke-width="2" stroke-linecap="round"/><path d="M45 71q4-6 12-5q6-4 12 1q6 1 6 6q-3 5-12 4q-8 3-14-1q-6 0-4-5z" fill="${P.a1}"/><circle cx="52" cy="71" r="1.6" fill="${P.a2}"/><circle cx="60" cy="69" r="1.6" fill="${P.a2}"/><circle cx="66" cy="73" r="1.6" fill="${P.a2}"/><ellipse cx="47" cy="68" rx="5" ry="2.6" transform="rotate(-30 47 68)" fill="${P.g1}"/><ellipse cx="52.5" cy="65.5" rx="4.4" ry="2.3" transform="rotate(18 52.5 65.5)" fill="${P.g2}"/>`),
        L('strand', an('strand', 3, 'ease-in-out', 0, [74, 76]), `<path d="M74 60q-3 8 0 16" fill="none" stroke="${P.p2}" stroke-width="2.8" stroke-linecap="round"/>`),
        L('fork', an('fork', 3, 'ease-in-out', 0, [74, 66]), `<rect x="72.5" y="14" width="5" height="40" rx="2.5" transform="rotate(12 75 54)" fill="${P.p3}"/><ellipse cx="74" cy="58" rx="11.5" ry="7.5" fill="${P.p2}"/><path d="M63.5 55q10.5 4 21 0M63 59.5q11 4 22 0M65.5 64q8.5 2.6 17 0" fill="none" stroke="${P.p3}" stroke-width="2" stroke-linecap="round"/>`)
      ]
    },
    bowl: {
      hue: 'sage', acc: 'carrot', dur: 3.2, label: 'Salat / Bowl', group: 'leaves, tomato', props: 'leaves y −2 · rotate −4° (pivot bowl centre) · tomato hop y −10 → squash 1.14/.86', ease: 'easeInOut', keys: 'tomato hops 50–90%',
      keywords: ['salat', 'salad', 'bowl', 'buddha', 'poke', 'quinoa', 'couscous', 'bulgur', 'tabouleh', 'grain', 'reis', 'rice', 'curry', 'dal', 'chili', 'falafel'],
      layers: P => [
        L('leaves', an('leaves', 3.2, 'ease-in-out', 0, [60, 64]), `<ellipse cx="40" cy="55" rx="13" ry="6" transform="rotate(-30 40 55)" fill="${P.g1}"/><ellipse cx="52" cy="49" rx="6" ry="13" transform="rotate(-12 52 49)" fill="${P.g2}"/><ellipse cx="67" cy="48" rx="6" ry="12" transform="rotate(14 67 48)" fill="${P.g1}"/><ellipse cx="80" cy="55" rx="13" ry="6" transform="rotate(28 80 55)" fill="${P.g2}"/>`),
        L('bowl_back', '', `<ellipse cx="60" cy="66" rx="44" ry="8" fill="${P.p3}"/><ellipse cx="60" cy="65.5" rx="40" ry="6.2" fill="${P.g2}"/>`),
        L('toppings', '', `<ellipse cx="36" cy="63" rx="14" ry="5" fill="${P.c}"/><circle cx="31" cy="62" r=".9" fill="${P.w}"/><circle cx="37" cy="61" r=".9" fill="${P.w}"/><circle cx="42" cy="63" r=".9" fill="${P.w}"/><circle cx="34" cy="64.5" r=".9" fill="${P.w}"/><circle cx="50" cy="61" r="3" fill="${P.w}"/><circle cx="55.5" cy="63" r="3" fill="${P.w}"/><circle cx="47" cy="64" r="3" fill="${P.w}"/><path d="M58 64q4-4 8 0t8 0" fill="none" stroke="${P.a1}" stroke-width="3" stroke-linecap="round"/><ellipse cx="83" cy="61.5" rx="11" ry="6" transform="rotate(-8 83 61.5)" fill="${P.g2}"/><ellipse cx="83" cy="61.5" rx="8.6" ry="4.4" transform="rotate(-8 83 61.5)" fill="${P.g1}"/><circle cx="84.5" cy="61.5" r="2.8" fill="${P.d}"/>`),
        L('tomato', an('tomato', 3.2, 'ease-in-out', 0, [68, 62]), `<circle cx="68" cy="57" r="5" fill="${P.a2}"/><path d="M66 52.6l2 1.6 2-1.6" fill="none" stroke="${P.g2}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`),
        L('bowl_front', '', `<path d="M16 66h88a44 30 0 0 1-88 0z" fill="${P.p2}"/><path d="M36 80q24 10 48 0" fill="none" stroke="${P.p1}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`)
      ]
    },
    breakfast: {
      hue: 'orchid', acc: 'butter', dur: 3, label: 'Frühstück', group: 'drip, drop, berry', props: 'drip scaleY 1→1.9 (pivot top) · drop falls y +18 → splat · berry wobble ±10°', ease: 'easeInOut', keys: 'drip 8–55% · drop 55–92% · berry 0–46%',
      keywords: ['pancake', 'pfannkuchen', 'frühstück', 'breakfast', 'porridge', 'oats', 'haferflocken', 'müsli', 'granola', 'waffel', 'french toast', 'overnight', 'chia', 'crêpe', 'brunch'],
      layers: P => [
        L('plate', '', `<ellipse cx="60" cy="95" rx="46" ry="9" fill="${P.p2}"/><ellipse cx="60" cy="93.5" rx="38" ry="6" fill="${P.p1}"/>`),
        L('stack', '', `<rect x="25" y="79" width="70" height="14" rx="7" fill="${P.w}"/><path d="M32 90h56" stroke="${P.d}" stroke-width="2" stroke-linecap="round" opacity=".3"/><rect x="23" y="67" width="72" height="14" rx="7" fill="${P.w}"/><path d="M30 78h58" stroke="${P.d}" stroke-width="2" stroke-linecap="round" opacity=".3"/><rect x="26" y="55" width="69" height="14" rx="7" fill="${P.w}"/><path d="M33 66h56" stroke="${P.d}" stroke-width="2" stroke-linecap="round" opacity=".3"/><ellipse cx="60.5" cy="57" rx="34" ry="6" fill="${P.a1}"/>`),
        L('syrup', '', `<path d="M29 57q31-10 62 0q-4 5-10 3q-5 6-9 1q-14 4-25 0q-7 6-10 1q-6 1-8-5z" fill="${P.a2}"/><path d="M83.5 58v10a3 3 0 0 1-6 0v-9z" fill="${P.a2}"/>`),
        L('drip', an('drip', 3, 'ease-in-out', 0, [36, 58]), `<path d="M33 58v6a3.2 3.2 0 0 0 6.4 0v-7z" fill="${P.a2}"/>`),
        L('drop', an('drop', 3, 'ease-in', 0, [36.2, 79]), `<ellipse cx="36.2" cy="76" rx="2.6" ry="3.2" fill="${P.a2}"/>`),
        L('toppings', '', `<circle cx="51" cy="51.5" r="5.5" fill="${P.p3}"/><circle cx="49.4" cy="49.8" r="1.4" fill="${P.p1}"/><circle cx="74" cy="53" r="5" fill="${P.c}"/><circle cx="74" cy="53" r="1.7" fill="${P.w}"/><circle cx="82" cy="55.5" r="4.2" fill="${P.c}"/><circle cx="82" cy="55.5" r="1.4" fill="${P.w}"/>`),
        L('berry', an('berry', 3, 'ease-in-out', 0, [63, 55]), `<circle cx="63" cy="49" r="6" fill="${P.p3}"/><circle cx="61.2" cy="47" r="1.5" fill="${P.p1}"/><ellipse cx="67" cy="42" rx="4.6" ry="2.2" transform="rotate(-35 67 42)" fill="${P.g1}"/>`)
      ]
    }
  };
  const ground = P => [L('ground_tint', '', `<rect width="120" height="120" fill="${P.p0}"/>`), L('ground_shadow', '', `<ellipse cx="60" cy="101" rx="42" ry="6" fill="${P.p1}"/>`)];

  // ---- characters ----
  const S = (d, w, c) => `<path d="${d}" fill="none" stroke="${c || INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const CH = {
    pea: { vb: [48, 48], name: 'Erbse', parts: o => [
      L('body', '', `<circle cx="24" cy="26" r="16" fill="#8DB596" stroke="${INK}" stroke-width="2.5"/>`),
      L('eyes', o.eyes, `<circle cx="19" cy="24" r="2.2" fill="${INK}"/><circle cx="29" cy="24" r="2.2" fill="${INK}"/>`),
      L('mouth', '', S('M20.5 30Q24 33 27.5 30', 2))
    ] },
    knobi: { vb: [48, 52], name: 'Knobi', parts: o => [
      L('sprout', o.sprout, S('M24 8C24 5 26 2.5 29.5 2', 5.5) + S('M24 8C24 5 26 2.5 29.5 2', 2.4, '#8DB596')),
      L('roots', '', S('M19.5 45l-1.5 3.6M24 45.6v4.2M28.5 45l1.5 3.6', 2)),
      L('body', '', `<path d="M24 6.5C25.5 11 29 14 34 17.5C42 23 43.5 35 38.5 41C34 46.5 14 46.5 9.5 41C4.5 35 6 23 14 17.5C19 14 22.5 11 24 6.5Z" fill="#FBF3E6" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` + S('M24 12C15 20 12.5 32 16 43M24 12C33 20 35.5 32 32 43', 1.8, '#D7B5E6')),
      L('cheeks', '', `<ellipse cx="17" cy="34.5" rx="2.8" ry="1.7" fill="#F4A9A0"/><ellipse cx="31" cy="34.5" rx="2.8" ry="1.7" fill="#F4A9A0"/>`),
      L('eyes', o.eyes, `<circle cx="20" cy="30.5" r="2.2" fill="${INK}"/><circle cx="28" cy="30.5" r="2.2" fill="${INK}"/>`),
      L('mouth', '', S('M21.6 35Q24 37.4 26.4 35', 1.8))
    ] },
    schoti: { vb: [48, 52], name: 'Schoti', parts: o => [
      L('stem', o.stem, S('M24 13.5C24 8.5 26 5 30.5 3.5', 5.5) + S('M24 13.5C24 8.5 26 5 30.5 3.5', 2.4, '#8DB596')),
      L('body', '', `<path d="M13 19Q13 13.5 24 13.5Q35 13.5 35 19C35 32 30 41.5 20 46.5C16.5 48.3 14 46 16.5 44C21 40 13 31 13 19Z" fill="#F08A5D" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`),
      L('cap', '', `<path d="M11.5 19.5Q13.5 13.5 19 14Q21.5 11.5 24 12.5Q26.5 11.5 29 14Q34.5 13.5 36.5 19.5Q31.5 17 28.5 18.5Q26.5 16.2 24 17.8Q21.5 16.2 19.5 18.5Q16.5 17 11.5 19.5Z" fill="#8DB596" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`),
      L('cheeks', '', `<ellipse cx="17.6" cy="31.5" rx="2.6" ry="1.6" fill="#F4A9A0"/><ellipse cx="30.6" cy="31.5" rx="2.6" ry="1.6" fill="#F4A9A0"/>`),
      L('eyes', o.eyes, `<circle cx="20" cy="27.5" r="2.2" fill="${INK}"/><circle cx="28" cy="27.5" r="2.2" fill="${INK}"/>`),
      L('mouth', '', S('M21.6 32Q24 34.4 26.4 32', 1.8))
    ] }
  };
  const chInner = (k, o, pre) => CH[k].parts(o || {}).map(l => g({ ...l, name: (pre || k) + '_' + l.name })).join('');
  const nest = (k, x, y, w, o, pre) => { const [vw, vh] = CH[k].vb; return `<svg x="${x}" y="${y}" width="${w}" height="${+(w * vh / vw).toFixed(2)}" viewBox="0 0 ${vw} ${vh}" overflow="visible">${chInner(k, o, pre)}</svg>`; };

  // ---- Topfbert (viewBox 0 -20 140 150, parts from assets/topfbert/topfbert-happy.svg) ----
  const TB = {
    handles: `<rect x="9.25" y="59.25" width="19.5" height="10.5" rx="5.5" fill="#C7E0CD" stroke="${INK}" stroke-width="2.5"/><rect x="111.25" y="59.25" width="19.5" height="10.5" rx="5.5" fill="#C7E0CD" stroke="${INK}" stroke-width="2.5"/>`,
    body: `<path d="M21.25 48V88A38.75 34.75 0 0 0 60 122.75H80A38.75 34.75 0 0 0 118.75 88V48Z" fill="#A5C7AE" stroke="${INK}" stroke-width="2.5"/>`,
    eyes: `<ellipse cx="50.5" cy="73" rx="4.5" ry="5" fill="${INK}"/><ellipse cx="89.5" cy="73" rx="4.5" ry="5" fill="${INK}"/>`,
    eyesClosed: S('M45.5 72.5Q50.5 77.5 55.5 72.5M84.5 72.5Q89.5 77.5 94.5 72.5', 3),
    cheeks: `<ellipse cx="41.5" cy="86" rx="7.5" ry="4" fill="#F4A9A0" opacity=".85"/><ellipse cx="98.5" cy="86" rx="7.5" ry="4" fill="#F4A9A0" opacity=".85"/>`,
    mouth: S('M61 83A8.5 7 0 0 0 78 83', 3),
    rim: `<rect x="13.25" y="41.25" width="113.5" height="12.5" rx="6.5" fill="#C7E0CD" stroke="${INK}" stroke-width="2.5"/>`,
    hat: `<g transform="rotate(-14 36 46)"><circle cx="22" cy="6" r="10.75" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="39" cy="1" r="11.75" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="50" cy="8" r="8.75" fill="#fff" stroke="${INK}" stroke-width="2.5"/><rect x="16" y="8" width="40" height="22" fill="#fff"/><rect x="16.25" y="23.25" width="39.5" height="13.5" rx="3" fill="#fff" stroke="${INK}" stroke-width="2.5"/></g>`,
    steam1: c => `<rect x="86" y="10" width="4" height="18" rx="2" fill="${c}" opacity=".45"/>`,
    steam2: c => `<rect x="102" y="16" width="4" height="14" rx="2" fill="${c}" opacity=".45"/>`
  };
  function tbLayers(o) {
    const out = [];
    if (o.steam !== false) { out.push(L('steam_1', o.s1, TB.steam1(o.sc || INK)), L('steam_2', o.s2, TB.steam2(o.sc || INK))); }
    if (o.inside) out.push(o.inside);
    out.push(L('handles', '', TB.handles), L('body', '', TB.body));
    out.push(L('gaze', o.gaze, g(L('eyes', o.eo, TB.eyes)) + `<g id="eyes_closed" opacity="0"${o.ec || ''}>${TB.eyesClosed}</g>`));
    out.push(L('cheeks', '', TB.cheeks), L('mouth', '', TB.mouth));
    if (o.behindRim) out.push(o.behindRim);
    out.push(L('rim', '', TB.rim), L('hat', o.hat, TB.hat));
    if (o.top) out.push(o.top);
    return out;
  }
  const tbNest = (o, x, y, w) => `<svg x="${x}" y="${y}" width="${w}" height="${+(w * 150 / 140).toFixed(2)}" viewBox="0 -20 140 150" overflow="visible"><g id="topfbert"${o.whole || ''}>${tbLayers(o).map(g).join('')}</g></svg>`;

  // ---- clips ----
  const BOWL = t => `<path d="M37.25 76A57.75 54.75 0 0 0 152.75 76Z" fill="${t.surface}" stroke="${t.ink}" stroke-width="2.5" stroke-linejoin="round"/><rect x="29.25" y="67.25" width="131.5" height="9.5" rx="4.75" fill="${t.surface}" stroke="${t.ink}" stroke-width="2.5"/>`;
  const EBASE = (t, acc) => [L('background', '', `<rect width="190" height="150" fill="${mix(acc, 24, t.bg)}"/>`), L('blob', '', `<path d="M95 14C134 12 170 34 170 74C170 114 140 142 96 142C52 142 20 118 20 78C20 38 56 16 95 14Z" fill="${mix(acc, 40, t.surface)}"/>`)];
  const NBASE = t => [L('background', '', `<rect width="170" height="118" fill="${t.surface}"/>`), L('blob', '', `<path d="M85 4C126 3 160 24 160 60C160 96 128 114 84 114C42 114 10 94 10 58C10 24 44 5 85 4Z" fill="${mix('#A5C7AE', 36, t.surface)}"/>`)];
  const TBX = 37, TBY = 0.3, TBW = 96;
  const CLIPS = {
    'empty-column': { kind: 'empty', vb: [190, 150], canvas: [570, 450], dur: 4.4, acc: 'butter', label: 'Erbse rollt', char: 'pea',
      story: [[0, 'Pea centred on the bowl rim, upright, eyes front (= still)'], [33, 'Pea right (x +40), rotated +154°'], [66, 'Back through centre'], [99, 'Pea left (x −40), rotated −154°'], [132, '= frame 0']],
      animate: 'pea: translateX 0 → +40 → −40 → 0 with rotate = x / r (154° at ±40), sine (0–25% sine-out, 25–75% sine-in-out, 75–100% sine-in), pivot = pea centre (95, 51)',
      build: (t, acc) => [...EBASE(t, acc), L('bowl', '', BOWL(t)), L('pea', an('roll', 4.4, 'linear', 0, [95, 51]), nest('pea', 72.7, 26.8, 44.6))] },
    'empty-column-knobi': { kind: 'empty', vb: [190, 150], canvas: [570, 450], dur: 4.4, acc: 'orchid', label: 'Knobi schaukelt', char: 'knobi',
      story: [[0, 'Knobi upright in the bowl, bottom tucked behind the rim (= still)'], [33, 'Rocked right +9°; sprout trails −12°'], [63, 'Blink (f62–66)'], [99, 'Rocked left −9°'], [132, '= frame 0']],
      animate: 'knobi: rotate 0 → +9° → −9° → 0, sine, pivot (95, 76) inside the bowl · sprout: rotate 0 → −12° → +12° → 0, same curve, lagging 0.3 s (delay −4.1 s), pivot (24, 8) in character space · eyes: scaleY 1 → .1 → 1 at 46–50%, pivot eye centre',
      build: (t, acc) => [...EBASE(t, acc), L('knobi', an('rock', 4.4, 'linear', 0, [95, 76]), nest('knobi', 65, 14, 60, { sprout: an('sprout', 4.4, 'linear', -4.1, [24, 8]), eyes: an('blink', 4.4, 'ease-in-out', 0, [24, 30.5]) })), L('bowl', '', BOWL(t))] },
    'empty-column-schoti': { kind: 'empty', vb: [190, 150], canvas: [570, 450], dur: 4.4, acc: 'sage', label: 'Schoti hüpft', char: 'schoti',
      story: [[0, 'Schoti standing on the bowl rim (= still)'], [3, 'Crouch: squash 1.07 / .93'], [22, 'Apex: y −16, stretch .96 / 1.05'], [37, 'Land: squash 1.09 / .91, settle by f53'], [69, 'Looks left (f69–84), then right (f95–114)'], [132, '= frame 0']],
      animate: 'schoti: hop at 0–40% (pivot (95, 66), rim contact) then rest · eyes: translateX −1.6 / +1.6 at 52–64% / 72–86%',
      build: (t, acc) => [...EBASE(t, acc), L('bowl', '', BOWL(t)), L('schoti', an('hop', 4.4, 'ease-in-out', 0, [95, 66]), nest('schoti', 66, 11.5, 58, { eyes: an('look', 4.4, 'ease-in-out', 0, null) }))] },
    'never-cooked-hut': { kind: 'never', vb: [170, 118], canvas: [510, 354], dur: 4.8, label: 'Hut ab', 
      story: [[0, 'Topfbert happy, hat on, steam drifting (= still)'], [14, 'Hat tips up to −20° (pivot hat brim left), settles at −16°'], [20, 'Pea pops out of the pot (y +30 → −3 → 0, squash)'], [36, 'Pea looks left (f36–52), right (f59–66); Topfbert looks up at it'], [77, 'Pea ducks back into the pot (f77–92)'], [92, 'Hat drops back with a 3° bounce, done f109'], [124, 'Topfbert blinks (f124–130)'], [144, '= frame 0']],
      animate: 'hat: hattip, pivot (15, 42) · pea: peapop, pivot (66, 41); pea_eyes: pealook · gaze: gazehut · eyes / eyes_closed: opacity swap at 86–89% · topfbert: breathe 2.4s ×2, pivot (70, 123) · steam_1/2: 2.4s, phase −1.2s',
      build: t => [...NBASE(t), L('topfbert_stack', '', tbNest({ whole: an('breathe', 2.4, 'ease-in-out', 0, [70, 123]), sc: t.ink, s1: an('steam', 2.4, 'ease-out', 0, null), s2: an('steam', 2.4, 'ease-out', -1.2, null), gaze: an('gazehut', 4.8, 'ease-in-out', 0, null), eo: an('eo', 4.8, 'linear', 0, null), ec: an('ec', 4.8, 'linear', 0, null), hat: an('hattip', 4.8, 'ease-in-out', 0, [15, 42]), inside: L('pea', an('peapop', 4.8, 'ease-in-out', 0, [66, 41]), nest('pea', 46.5, 6.9, 39, { eyes: an('pealook', 4.8, 'ease-in-out', 0, null) })) }, TBX, TBY, TBW))] },
    'never-cooked-sprung': { kind: 'never', vb: [170, 118], canvas: [510, 354], dur: 4.8, label: 'Bocksprung',
      story: [[0, 'Schoti left of the pea, Topfbert looks at Schoti (= still)'], [3, 'Crouch'], [29, 'Apex over the pea (y −34, lean 10°); pea ducks'], [48, 'Lands right, squash; f63 turns round (scaleX → −1)'], [101, 'Apex back over the pea; pea ducks'], [120, 'Lands left; f135 turns to face right'], [144, '= frame 0; Topfbert\'s eyes follow throughout']],
      animate: 'schoti: leapx (outer group, X) + leapy (inner group: Y, lean, squash, turn), pivot (58, 110) · pea: duck at 20% / 70%, pivot (85, 110) · gaze: gazesprung · topfbert: breathe · steam',
      build: t => [...NBASE(t), L('topfbert_stack', '', tbNest({ whole: an('breathe', 2.4, 'ease-in-out', 0, [70, 123]), sc: t.ink, s1: an('steam', 2.4, 'ease-out', 0, null), s2: an('steam', 2.4, 'ease-out', -1.2, null), gaze: an('gazesprung', 4.8, 'ease-in-out', 0, null) }, TBX, TBY, TBW)), L('pea', an('duck', 4.8, 'ease-in-out', 0, [85, 110]), nest('pea', 70, 83, 30)), L('schoti', an('leapx', 4.8, 'linear', 0, null), `<g id="schoti_hop"${an('leapy', 4.8, 'ease-in-out', 0, [58, 110])}>${nest('schoti', 42, 79, 32)}</g>`)] },
    'never-cooked-dampf': { kind: 'never', vb: [170, 118], canvas: [510, 354], dur: 4.8, label: 'Dampfbad',
      story: [[0, 'Knobi sits on Topfbert\'s rim (= still)'], [7, 'Knobi squashes, three steam puffs rise from the pot (f8–34)'], [17, 'Puffs lift Knobi up to y −26, wobbling ±6°; sprout flutters'], [36, 'Topfbert looks up at him'], [89, 'Knobi lands back on the rim, squash, settles f124'], [129, 'Knobi blinks'], [144, '= frame 0']],
      animate: 'knobi: ride, pivot (96, 41) in Topfbert space · puff_1..3: puff, phase 0 / −0.1 / −0.2 s · gaze: gazedampf · knobi sprout: wiggle 2.4s · knobi eyes: blink48 · topfbert: breathe; no steam rods (puffs replace them)',
      build: t => {
        const pf = (cx, cy, r, d, n) => `<g id="puff_${n}"${an('puff', 4.8, 'ease-out', d, [cx, cy])}><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.5"/></g>`;
        return [...NBASE(t), L('topfbert_stack', '', tbNest({ whole: an('breathe', 2.4, 'ease-in-out', 0, [70, 123]), steam: false, gaze: an('gazedampf', 4.8, 'ease-in-out', 0, null), behindRim: L('puffs', '', pf(86, 38, 8, 0, 1) + pf(104, 39, 7, -0.1, 2) + pf(95, 33, 9, -0.2, 3)), top: L('knobi', an('ride', 4.8, 'ease-in-out', 0, [96, 41]), nest('knobi', 79, 7, 34, { sprout: an('wiggle', 2.4, 'ease-in-out', 0, [24, 8]), eyes: an('blink48', 4.8, 'ease-in-out', 0, [24, 30.5]) })) }, TBX, TBY, TBW))];
      } },
    'topfbert-idle': { kind: 'idle', vb: [140, 150], vbStr: '0 -20 140 150', dur: 6, label: 'Topfbert idle',
      build: (t, acc, o) => tbLayers({ sc: t.ink, steam: !(o && o.small), s1: an('steam', 3, 'ease-out', 0, null), s2: an('steam', 3, 'ease-out', -1.5, null), eo: an('ieo', 6, 'linear', 0, null), ec: an('iec', 6, 'linear', 0, null), hat: (o && o.small) ? '' : an('ihat', 6, 'ease-in-out', 0, [36, 46]) }),
      whole: () => an('breathe', 3, 'ease-in-out', 0, [70, 123]) }
  };

  function withMode(m, fn) { const p = MODE; MODE = m; try { return fn(); } finally { MODE = p; } }
  const svgOpen = (vb, w, h, extra) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}"${extra || ''}>`;

  const R11 = {
    INK, TH, HUE, KF, CSS, DISH, CH, CLIPS, mix, pal,
    dishInner(key, P) { return withMode('live', () => DISH[key].layers(P).map(g).join('')); },
    dishSvg(key, theme, mode) {
      const D = DISH[key], P = pal(D.hue, D.acc, theme);
      return withMode(mode || 'live', () => { const gr = ground(P); return svgOpen('0 0 120 120', 480, 480, ` data-dish="${key}" data-theme="${theme}"`) + gr.map(g).join('') + `<g id="dish">${D.layers(P).map(g).join('')}</g></svg>`; });
    },
    dishFiles(key, theme) {
      const D = DISH[key], P = pal(D.hue, D.acc, theme);
      return withMode('export', () => [...ground(P), ...D.layers(P)].map((l, i) => ({ z: i + 1, name: l.name, anim: l.anim, svg: svgOpen('0 0 120 120', 480, 480, ` data-layer="${l.name}"`) + g(l) + '</svg>' })));
    },
    clipSvg(id, theme, opts) {
      opts = opts || {}; const C = CLIPS[id], t = TH[theme], acc = HUE[opts.acc || C.acc] || opts.acc || '#F7B94A';
      return withMode(opts.mode || 'live', () => {
        const vb = C.vbStr || `0 0 ${C.vb[0]} ${C.vb[1]}`;
        const body = C.build(t, acc, opts).map(g).join('');
        const inner = C.whole ? `<g id="topfbert"${C.whole()}>${body}</g>` : body;
        return svgOpen(vb, C.canvas ? C.canvas[0] : 420, C.canvas ? C.canvas[1] : 450, ` data-clip="${id}" data-theme="${theme}" style="width:100%;height:100%;display:block;overflow:visible"`) + inner + '</svg>';
      });
    },
    clipFiles(id, theme, accKey) {
      const C = CLIPS[id], t = TH[theme], acc = HUE[accKey || C.acc] || '#F7B94A', vb = C.vbStr || `0 0 ${C.vb[0]} ${C.vb[1]}`;
      return withMode('export', () => C.build(t, acc).map((l, i) => ({ z: i + 1, name: l.name, anim: l.anim, svg: svgOpen(vb, C.canvas[0], C.canvas[1], ` data-layer="${l.name}"`) + g(l) + '</svg>' })));
    },
    charSvg(k, mode, opts) { const [w, h] = CH[k].vb; return withMode(mode || 'live', () => svgOpen(`0 0 ${w} ${h}`, w * 3, h * 3, ` data-character="${k}" style="width:100%;height:100%;display:block;overflow:visible"`) + chInner(k, opts && opts(an)) + '</svg>'); },
    charFiles(k) { const [w, h] = CH[k].vb; return withMode('export', () => CH[k].parts({}).map((l, i) => ({ z: i + 1, name: l.name, svg: svgOpen(`0 0 ${w} ${h}`, w * 3, h * 3, ` data-layer="${l.name}"`) + g(l) + '</svg>' }))); },
    eyesClosedSvg() { return svgOpen('0 -20 140 150', 420, 450, ' data-layer="eyes_closed"') + TB.eyesClosed + '</svg>'; },
    an: (...a) => an(...a)
  };
  if (typeof window !== 'undefined') {
    window.R11 = R11;
    if (typeof document !== 'undefined' && !document.getElementById('r11-kf')) { const s = document.createElement('style'); s.id = 'r11-kf'; s.textContent = CSS; document.head.appendChild(s); }
  }
  if (typeof module !== 'undefined') module.exports = R11;
})();
