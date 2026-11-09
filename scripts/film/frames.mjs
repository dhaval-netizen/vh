// SVG artwork only. Text is outlined from the site's Neue Montreal in render.py.
import { lamp, room } from '../../preorder-art.mjs';
const clamp = v => Math.max(0, Math.min(1, v));
const ease = v => { const x = clamp(v); return x*x*(3-2*x); };
const frames = [];
for (let i = 0; i < 24 * 24; i++) {
  const t = i / 24;
  let art, line, x, y, width, height;
  if (t < 4) {
    art = lamp(.6); line = 'A familiar beginning.'; x=440; y=40; width=400; height=400;
  } else {
    const enter = ease((t-4.2)/2), leave = ease((t-14)/2.3);
    const sit = t < 13 ? ease((t-6.4)/.8) : 1-ease((t-13)/.8);
    const light = t < 15 ? ease((t-7.3)/1.3) : 1-ease((t-15.4)/1.4);
    art = room({enter, sit, leave, light}); x=160; y=40; width=960; height=480;
    line = t < 13 ? 'An idea for evenings with less to do.' : 'Your switch. Your say.';
  }
  frames.push({ art, line, x, y, width, height, end: t >= 18 });
}
process.stdout.write(JSON.stringify(frames));
