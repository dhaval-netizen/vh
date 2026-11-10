// Line drawings for the story of light. Original artwork, drawn in the v/h line style.
// Each function returns an SVG string. `glow` (0 to 1) controls the light around the source.
// Used by the pre-order page intro and by the film renderer.

const ink = '#f4f3ed';
const flame = '#f2b24a';
let uid = 0;

function frame(inner, glow, cx, cy, r = 92) {
  const id = `g${++uid}`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs><radialGradient id="${id}"><stop offset="0" stop-color="#ffd58a" stop-opacity=".9"/><stop offset=".35" stop-color="#f2b24a" stop-opacity=".35"/><stop offset="1" stop-color="#f2b24a" stop-opacity="0"/></radialGradient></defs>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})" opacity="${glow.toFixed(3)}"/>
<g fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
}

const flameShape = (x, y, s = 1, flicker = 0) => {
  const w = 11 * s, h = 34 * s + flicker * 3;
  return `<path d="M${x} ${y - h} C${x + w} ${y - h * 0.55} ${x + w * 1.1} ${y - h * 0.2} ${x} ${y} C${x - w * 1.1} ${y - h * 0.2} ${x - w} ${y - h * 0.55} ${x} ${y - h}Z" fill="${flame}" stroke="none"/>`;
};

export function diya(glow = 1, flicker = 0) {
  return frame(`<path d="M38 118 C52 158 148 158 162 118 Z"/><path d="M162 118 C172 112 178 104 180 98"/><path d="M70 152 C80 162 120 162 130 152"/>${flameShape(100, 114, 1, flicker)}`, glow, 100, 92);
}

export function lantern(glow = 1, flicker = 0) {
  return frame(`<path d="M86 34 C86 22 114 22 114 34"/><path d="M76 46 H124 L118 58 H82 Z"/><path d="M80 58 C70 80 70 128 80 150 H120 C130 128 130 80 120 58"/><path d="M80 58 V150 M120 58 V150"/><path d="M72 150 H128 V162 H72 Z"/>${flameShape(100, 120, 0.75, flicker)}`, glow, 100, 104);
}

export function bulb(glow = 1, on = 1) {
  const fil = on > 0.05 ? flame : ink;
  return frame(`<path d="M76 118 C58 104 54 88 54 74 C54 48 75 28 100 28 C125 28 146 48 146 74 C146 88 142 104 124 118 V134 H76 Z"/><path d="M78 142 H122 M80 150 H120 M86 158 H114"/><path d="M90 118 V96 M110 118 V96" stroke-width="1.6"/><path d="M90 96 L94 88 L98 96 L102 88 L106 96 L110 88" stroke="${fil}" stroke-width="2.6" opacity="${(0.4 + on * 0.6).toFixed(2)}"/>`, glow * on, 100, 78);
}

export function phone(level = 0.5) {
  const y = 132 - level * 60;
  return frame(`<rect x="62" y="30" width="76" height="140" rx="14"/><path d="M90 42 H110"/><path d="M100 72 V136" stroke-width="5" stroke-opacity=".25"/><path d="M100 ${y.toFixed(1)} V136" stroke="${flame}" stroke-width="5"/><circle cx="100" cy="${y.toFixed(1)}" r="8" fill="${ink}" stroke="none"/><circle cx="100" cy="156" r="5"/>`, 0, 100, 100);
}

export function voice(pulse = 0) {
  const arc = (r, o) => `<path d="M${100 - r} ${100 - r * 0.9} A${r} ${r} 0 0 1 ${100 + r} ${100 - r * 0.9}" opacity="${o.toFixed(2)}"/>`;
  const a = (k) => Math.max(0, Math.sin((pulse - k) * Math.PI));
  return frame(`<path d="M86 132 C86 150 114 150 114 132 V108 C114 92 86 92 86 108 Z"/><path d="M76 128 C76 154 124 154 124 128 M100 154 V168 M86 168 H114"/>${arc(30, a(0))}${arc(48, a(0.25))}${arc(66, a(0.5))}`, 0, 100, 100);
}

export function cave(glow = 1, flicker = 0) {
  return frame(`<path d="M14 170 C20 92 52 40 100 36 C148 40 180 92 186 170"/><path d="M40 170 C46 120 70 84 100 82 C130 84 154 120 160 170"/><path d="M80 162 L120 150 M80 150 L120 162"/>${flameShape(92, 152, 1.05, flicker)}${flameShape(108, 152, 0.8, -flicker)}${flameShape(100, 150, 1.3, flicker * 0.6)}`, glow, 100, 130, 80);
}

export function deskLamp(glow = 1) {
  return frame(`<path d="M60 168 H120"/><path d="M90 168 L72 112 L118 70"/><circle cx="72" cy="112" r="4"/><circle cx="118" cy="70" r="4"/><path d="M118 70 L150 76 L134 104 Z"/><path d="M60 168 C60 160 120 160 120 168"/>`, glow, 146, 112, 70);
}

// A room, side on: an armchair, a person who walks in (enter 0 to 1) and sits down (sit 0 to 1),
// the v/h lamp beside the chair (light 0 to 1), and an optional phone glow in their hand.
// Wide 400 x 200 viewBox, floor at y = 170, person faces right towards the lamp.
const SEATED = { head: [150, 72], sh: [155, 88], hip: [162, 124], knee: [198, 119], ankle: [202, 166], toe: [214, 168], elbow: [176, 110], hand: [190, 98] };
const STANDING = { head: [0, 60], sh: [0, 76], hip: [0, 117], knee: [3, 142], ankle: [0, 166], toe: [12, 168], elbow: [3, 97], hand: [6, 116] };
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const pt = p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

function pose(enter, sit, leave) {
  // Walks in from the left past the chair, stops in front of the seat, then steps back into it.
  // Leaving, they stand and walk on to the right, past the lamp.
  const x0 = leave > 0 ? 214 + leave * 230 : 34 + enter * 180;
  const walking = leave > 0 ? Math.sin(leave * Math.PI * 9) : enter < 1 ? Math.sin(enter * Math.PI * 8) : 0;
  const stand = {};
  for (const [k, [dx, y]] of Object.entries(STANDING)) stand[k] = [x0 + dx, y];
  // Stride: swing knee and ankle of the leading leg; the other leg mirrors it.
  const leg = d => ({ knee: [stand.knee[0] + 7 * d, stand.knee[1]], ankle: [stand.ankle[0] + 15 * d, stand.ankle[1] - Math.max(0, d) * 3], toe: [stand.toe[0] + 15 * d, stand.toe[1] - Math.max(0, d) * 3] });
  const a = leg(walking), b = leg(-walking);
  stand.elbow = [stand.elbow[0] - 5 * walking, stand.elbow[1]];
  stand.hand = [stand.hand[0] - 9 * walking, stand.hand[1]];
  const blend = {};
  for (const k of Object.keys(SEATED)) blend[k] = mix(k in a ? a[k] : stand[k], SEATED[k], sit);
  const back = { knee: mix(b.knee, [SEATED.knee[0] - 4, SEATED.knee[1] + 1], sit), ankle: mix(b.ankle, [SEATED.ankle[0] - 6, SEATED.ankle[1]], sit), toe: mix(b.toe, [SEATED.toe[0] - 6, SEATED.toe[1]], sit) };
  return { p: blend, back };
}

export function room({ enter = 1, sit = 1, leave = 0, light = 0, phoneGlow = 0, vh = true } = {}) {
  const id = `r${++uid}`;
  const { p, back } = pose(enter, sit, leave);
  const chair = `<path d="M148 170 L150 130 M196 170 L194 130" stroke-opacity=".85"/>`
    + `<path d="M142 130 H204 V136 C204 139 142 139 142 136 Z" stroke-opacity=".85"/>`
    + `<path d="M144 130 C140 112 136 92 132 74 C131 70 137 68 139 72 C143 90 148 110 152 126" stroke-opacity=".85"/>`
    + `<path d="M150 112 H196 C199 112 199 118 196 118 H194 V130" stroke-opacity=".85"/>`;
  const farLeg = `<path d="M${pt(p.hip)} L${pt(back.knee)} L${pt(back.ankle)} L${pt(back.toe)}" stroke-opacity=".55"/>`;
  const body = `<circle cx="${p.head[0].toFixed(1)}" cy="${p.head[1].toFixed(1)}" r="10"/>`
    + `<path d="M${pt(p.sh)} L${pt(p.hip)}" stroke-width="2.6"/>`
    + `<path d="M${pt(p.hip)} L${pt(p.knee)} L${pt(p.ankle)} L${pt(p.toe)}"/>`
    + `<path d="M${pt(p.sh)} L${pt(p.elbow)} L${pt(p.hand)}"/>`;
  // Seated, they read a book (or, in the "before" scene, look at a phone).
  const held = sit > 0.85
    ? (phoneGlow > 0
      ? `<circle cx="${p.hand[0] + 4}" cy="${p.hand[1] - 2}" r="${10 + phoneGlow * 8}" fill="url(#${id}p)" stroke="none"/><rect x="${p.hand[0]}" y="${p.hand[1] - 9}" width="7" height="11" rx="1.5" stroke-width="1.6"/>`
      : `<path d="M${p.hand[0] - 2} ${p.hand[1] + 3} L${p.hand[0] + 6} ${p.hand[1] - 13} M${p.hand[0] - 2} ${p.hand[1] + 3} L${p.hand[0] + 12} ${p.hand[1] - 6}" stroke-width="1.8" opacity="${((sit - 0.85) / 0.15).toFixed(2)}"/>`)
    : '';
  const lampShape = vh
    ? `<g stroke-width="1.9">${lampLines(262, 0.62, 65)}</g>`
    : `<path d="M244 170 H280 M262 170 L252 122 L276 94 L294 100 L284 116 Z"/>`;
  return `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs><radialGradient id="${id}"><stop offset="0" stop-color="#ffd58a" stop-opacity=".95"/><stop offset=".4" stop-color="#f2b24a" stop-opacity=".35"/><stop offset="1" stop-color="#f2b24a" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}p"><stop offset="0" stop-color="#cfe0ff" stop-opacity=".8"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="250" cy="112" rx="155" ry="88" fill="url(#${id})" opacity="${light.toFixed(3)}"/>
<g fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<path d="M14 170 H386" stroke-opacity=".35"/>
${chair}${lampShape}<g stroke="#252720" stroke-width="7">${farLeg}${body}</g>${farLeg}${body}${held}</g></svg>`;
}

// The v/h lamp, drawn from the design sketch (9 Nov 2026): a wide shallow dome with a top knob,
// a slim stem with a collar, a round base with a button on top and a sensor window at the front,
// and a power cable from the back of the base.
export function lamp(glow = 1) {
  return frame(lampLines(100, 1), glow, 100, 92, 96);
}

// Lamp outline centred on cx, base resting at y = 170 * s. Shared by the hero, room scene and icons.
export function lampLines(cx = 100, s = 1, dy = 0) {
  const X = v => (cx + v * s).toFixed(1), Y = v => (dy + v * s).toFixed(1);
  return `<path d="M${X(-62)} ${Y(78)} C${X(-58)} ${Y(52)} ${X(-30)} ${Y(40)} ${X(0)} ${Y(40)} C${X(30)} ${Y(40)} ${X(58)} ${Y(52)} ${X(62)} ${Y(78)}"/>`
    + `<path d="M${X(-62)} ${Y(78)} C${X(-40)} ${Y(86)} ${X(40)} ${Y(86)} ${X(62)} ${Y(78)}"/>`
    + `<path d="M${X(-62)} ${Y(78)} C${X(-40)} ${Y(72)} ${X(40)} ${Y(72)} ${X(62)} ${Y(78)}" stroke-opacity=".45"/>`
    + `<path d="M${X(-5)} ${Y(40)} V${Y(34)} H${X(5)} V${Y(40)}"/>`
    + `<path d="M${X(-6)} ${Y(80)} H${X(6)} M${X(-3)} ${Y(81)} V${Y(146)} M${X(3)} ${Y(81)} V${Y(146)}"/>`
    + `<path d="M${X(-42)} ${Y(150)} C${X(-42)} ${Y(142)} ${X(42)} ${Y(142)} ${X(42)} ${Y(150)} V${Y(162)} C${X(42)} ${Y(172)} ${X(-42)} ${Y(172)} ${X(-42)} ${Y(162)} Z"/>`
    + `<path d="M${X(-42)} ${Y(150)} C${X(-42)} ${Y(158)} ${X(42)} ${Y(158)} ${X(42)} ${Y(150)}" stroke-opacity=".45"/>`
    + `<path d="M${X(10)} ${Y(149)} H${X(20)}"/>`
    + `<path d="M${X(42)} ${Y(160)} C${X(54)} ${Y(162)} ${X(58)} ${Y(170)} ${X(72)} ${Y(170)} H${X(96)}" stroke-opacity=".7"/>`
    + `<rect x="${X(-9)}" y="${Y(160)}" width="${(18 * s).toFixed(1)}" height="${(7 * s).toFixed(1)}" rx="${(1.5 * s).toFixed(1)}" fill="#f4f3ed" fill-opacity=".25"/>`;
}
