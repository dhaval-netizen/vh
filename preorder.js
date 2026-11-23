import { submitInterest } from './preorder-submit.mjs';
const ENDPOINT = 'https://vh-preorder.vh-do.workers.dev/preorder';
const LIVE = location.protocol === 'https:' && ['vh.do', 'www.vh.do'].includes(location.hostname);
const dialog = document.querySelector('.po-dialog');
const form = dialog.querySelector('form');
const error = dialog.querySelector('.po-error');
const submit = form.querySelector('.po-submit');
const fields = form.elements;
let opener, submitting = false, complete = false;
// Referral code from a shared link (vh.do/lamp/?r=code). Invalid codes are dropped.
const REF_PATTERN = /^[a-z2-7]{10}$/;
const incomingRef = (() => { const r = new URLSearchParams(location.search).get('r') || ''; return REF_PATTERN.test(r) ? r : ''; })();
function showShare(ref) {
  const share = dialog.querySelector('.po-share');
  if (!share || !REF_PATTERN.test(ref)) return;
  const link = `https://vh.do/lamp/?r=${ref}`;
  const input = share.querySelector('.po-share-link');
  const copy = share.querySelector('.po-share-copy');
  // The panel sits inside the form, and the form is reset after success. Setting the
  // default value keeps the link visible through that reset.
  input.defaultValue = link;
  input.value = link;
  share.hidden = false;
  copy.addEventListener('click', async () => {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'The v/h lamp', url: link });
      else { await navigator.clipboard.writeText(link); copy.textContent = 'Copied'; }
    } catch { input.select(); }
  });
}
if (!LIVE) dialog.querySelector('.po-preview-note').hidden = false;

for (const button of document.querySelectorAll('[data-open-preorder]')) {
  button.hidden = false;
  button.addEventListener('click', () => {
    opener = button;
    document.querySelector('.po-video').pause();
    dialog.showModal();
    if (complete) dialog.querySelector('.po-done h2').focus();
    else fields.email.focus();
  });
}
for (const button of dialog.querySelectorAll('[data-close]')) button.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
dialog.addEventListener('close', () => opener?.focus());
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || complete || !form.reportValidity()) return;
  error.hidden = true;
  submitting = true; submit.disabled = true; submit.textContent = 'Joining…';
  form.setAttribute('aria-busy', 'true');
  const data = { email: fields.email.value.trim(), consent: fields.consent.checked, price: fields.price.value || '', size: fields.size.value || '', company: fields.company.value, ...(incomingRef ? { ref: incomingRef } : {}) };
  try {
    if (LIVE) showShare((await submitInterest(ENDPOINT, data)).ref);
    else {
      dialog.querySelector('.po-done h2').textContent = 'Preview complete.';
      dialog.querySelector('.po-done-message').textContent = 'Nothing was saved or sent. The live interest list is on vh.do.';
    }
    complete = true;
    dialog.querySelector('.po-form-body').hidden = true;
    dialog.querySelector('.po-done').hidden = false;
    dialog.querySelector('.po-done h2').id = 'form-done-title';
    dialog.setAttribute('aria-labelledby', 'form-done-title');
    dialog.removeAttribute('aria-describedby');
    form.reset();
    if (dialog.open) dialog.querySelector('.po-done h2').focus();
  } catch (issue) {
    error.textContent = issue.status === 429 ? 'Please wait a minute, then try again.' : issue.status === 400 ? 'Please check your email address and try again.' : "We couldn't confirm your signup. Check your connection and try again. A retry won't add you twice.";
    error.hidden = false;
    if (dialog.open) error.focus();
  } finally {
    submitting = false; submit.disabled = false; submit.textContent = 'Join the interest list';
    form.removeAttribute('aria-busy');
  }
});
