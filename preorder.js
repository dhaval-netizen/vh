// Pre-order page: the light-evolution intro, the film's pre-order button, and the form.
import { cave, diya, lantern, bulb, phone, voice, room, lampLines } from './preorder-art.mjs';

// Sign-ups go to the v/h Cloudflare Worker (workers/preorder). On any host other than vh.do
// the page runs in preview mode and nothing is sent.
const ENDPOINT = 'https://vh-preorder.vh-do.workers.dev/preorder';
const LIVE = location.hostname === 'vh.do' || location.hostname === 'www.vh.do';

const $ = (s, root = document) => root.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = v => v * v * (3 - 2 * v);
const clamp = v => Math.max(0, Math.min(1, v));

// ---------- Intro: a quick flash through the history of light ----------
const pair = (a, b) => `<div class="po-pair"><div>${a}</div><div>${b}</div></div>`;
const steps = [
  { era: 'The first light', caption: 'Fire.', art: () => cave(0.85, 0.3) },
  { era: 'Thousands of years ago', caption: 'A flame in our hands.', art: () => diya(0.85, 0.3) },
  { era: 'Centuries of lanterns', caption: 'Glass.', art: () => lantern(0.8, -0.2) },
  { era: '1879', caption: 'A switch.', art: () => bulb(1, 1), flash: true },
  { era: 'The 2010s', caption: 'An app.', art: () => pair(phone(0.8), bulb(0.7, 1)) },
  { era: '2025', caption: 'A voice.', art: () => pair(voice(0.6), bulb(0.8, 1)) },
  { final: true },
];

const hero = $('.po-hero');
const art = $('.po-art'), era = $('.po-era'), caption = $('.po-caption'), flash = $('.po-flash');
const replay = $('.po-replay');
let timers = [], frame = 0;

// Final state: someone sits down and the v/h lamp comes on by itself.
function sitDown(instant) {
  art.classList.add('is-wide');
  if (instant) { art.innerHTML = room({ enter: 1, sit: 1, light: 1 }); return; }
  const start = performance.now();
  const tick = now => {
    const t = (now - start) / 1000;
    art.innerHTML = room({ enter: ease(clamp(t / 1.1)), sit: ease(clamp((t - 1.15) / 0.4)), light: ease(clamp((t - 1.4) / 0.6)) });
    if (t < 2.1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

function show(step) {
  if (step.final) {
    era.textContent = caption.textContent = '';
    hero.classList.add('is-final');
    sitDown(reduceMotion);
    return;
  }
  art.classList.remove('is-wide');
  art.innerHTML = step.art();
  era.textContent = step.era;
  caption.textContent = step.caption;
  if (step.flash && !reduceMotion) { flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on'); }
}

function play() {
  timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(frame);
  replay.hidden = true;
  hero.classList.remove('is-final');
  if (reduceMotion) { show(steps.at(-1)); return; }
  steps.forEach((step, i) => timers.push(setTimeout(() => {
    art.classList.remove('is-in'); void art.offsetWidth; art.classList.add('is-in');
    show(step);
    if (step.final) replay.hidden = false;
  }, 300 + i * 950)));
}
replay.addEventListener('click', play);
play();

// ---------- Film: pre-order button inside the video, and an end card ----------
const video = $('.po-video');
const endCard = $('.po-video-end');
video.addEventListener('ended', () => { endCard.hidden = false; });
video.addEventListener('play', () => { endCard.hidden = true; });
$('[data-film-replay]').addEventListener('click', () => { video.currentTime = 0; video.play(); });

// ---------- Local currency ----------
// Price bands are set in US dollars. Visitors see rough local equivalents, rounded to friendly numbers,
// chosen from their time zone (where they are), falling back to their browser language, then USD.
const BANDS = { // the three thresholds between "under", "between" and "over"
  USD: [50, 100, 200], GBP: [40, 80, 160], EUR: [45, 90, 180], INR: [4000, 8000, 16000], CAD: [70, 140, 280],
  AUD: [75, 150, 300], NZD: [80, 160, 320], SGD: [65, 130, 260], AED: [180, 360, 720], JPY: [7500, 15000, 30000], CHF: [45, 90, 180],
};
const EURO_ZONES = ['Dublin','Paris','Berlin','Madrid','Rome','Amsterdam','Brussels','Vienna','Lisbon','Helsinki','Athens','Luxembourg','Bratislava','Ljubljana','Tallinn','Riga','Vilnius','Valletta','Nicosia','Zagreb','Monaco','Andorra'];
const ZONE_CURRENCY = { 'Europe/London': 'GBP', 'Europe/Jersey': 'GBP', 'Europe/Guernsey': 'GBP', 'Europe/Isle_of_Man': 'GBP', 'Europe/Belfast': 'GBP', 'Asia/Kolkata': 'INR', 'Asia/Calcutta': 'INR', 'Asia/Singapore': 'SGD', 'Asia/Dubai': 'AED', 'Asia/Tokyo': 'JPY', 'Europe/Zurich': 'CHF', 'Pacific/Auckland': 'NZD' };
const REGION_CURRENCY = { GB: 'GBP', IE: 'EUR', FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', IN: 'INR', CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD', AE: 'AED', JP: 'JPY', CH: 'CHF', US: 'USD' };

function localCurrency() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (ZONE_CURRENCY[zone]) return ZONE_CURRENCY[zone];
  if (zone.startsWith('Europe/') && EURO_ZONES.includes(zone.slice(7))) return 'EUR';
  if (zone.startsWith('Australia/')) return 'AUD';
  if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Montreal|Regina|St_Johns)/.test(zone)) return 'CAD';
  if (zone.startsWith('America/') && /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana)/.test(zone)) return 'USD';
  for (const lang of navigator.languages || []) {
    const region = lang.split('-')[1]?.toUpperCase();
    if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return 'USD';
}

const currency = localCurrency();
{
  const money = new Intl.NumberFormat(navigator.language || 'en', { style: 'currency', currency, maximumFractionDigits: 0 });
  const [a, b, c] = BANDS[currency].map(v => money.format(v));
  const labels = { 'under-50': `Under ${a}`, '50-100': `${a} to ${b}`, '100-200': `${b} to ${c}`, 'over-200': `Over ${c}` };
  document.querySelectorAll('input[name="price"]').forEach(input => { input.nextElementSibling.textContent = labels[input.value]; });
  if (currency !== 'USD') {
    const note = $('[data-currency-note]');
    note.textContent = `Shown in ${currency}, roughly converted from US dollars.`;
    note.hidden = false;
  }
}

// Size icons: the same lamp drawn at three scales, so the choice is visual.
document.querySelectorAll('.po-size-icon').forEach(icon => {
  const s = Number(icon.dataset.scale);
  icon.innerHTML = `<svg viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="${(7 / s).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round">${lampLines(100, s, 192 - 172 * s)}</g></svg>`;
});

// ---------- Pre-order form ----------
const dialog = $('.po-dialog');
const form = $('.po-form');
const error = $('.po-error');
let opener = null;

document.querySelectorAll('[data-open-preorder]').forEach(button => button.addEventListener('click', () => {
  opener = button;
  if (!video.paused) video.pause();
  dialog.showModal();
  $('input[name="email"]', form).focus();
}));
dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => opener?.focus());

function problem() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())) return ['email', 'Please enter a valid email address.'];
  if (!form.price.value) return ['price', 'Choose the price you would expect to pay.'];
  if (!form.size.value) return ['size', 'Choose a size.'];
  return null;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const issue = problem();
  if (issue) {
    error.textContent = issue[1]; error.hidden = false;
    form.querySelector(`[name="${issue[0]}"]`).focus();
    return;
  }
  error.hidden = true;
  const submit = $('.po-submit', form);
  submit.disabled = true; submit.textContent = 'Reserving…';
  const data = { email: form.email.value.trim(), price: form.price.value, size: form.size.value, currency, company: form.company.value, source: 'vh.do/preorder' };
  try {
    if (LIVE) {
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!response.ok) throw new Error(String(response.status));
    } else {
      console.info('Preview mode, not saved:', data);
      $('.po-preview-note').hidden = false;
    }
    $('.po-form-body').hidden = true;
    $('.po-done').hidden = false;
  } catch {
    error.textContent = "We couldn't save your pre-order. Check your connection and try again.";
    error.hidden = false;
  } finally {
    submit.disabled = false; submit.textContent = 'Reserve my lamp';
  }
});
