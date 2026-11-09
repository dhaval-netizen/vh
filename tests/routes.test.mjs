import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveRoute } from '../routes.mjs';

const origin = 'https://example.test/';

test('clean paths select the intended existing content', () => {
  for (const [path, page, target] of [
    ['/', 'home', 'top'],
    ['/idea/', 'home', 'idea'],
    ['/approach/', 'home', 'approach'],
    ['/questions/', 'home', 'questions'],
    ['/philosophy/', 'philosophy', 'top'],
    ['/philosophy/owning-it/', 'philosophy', 'owning-it'],
  ]) {
    const route = resolveRoute(new URL(path, origin), new URL(origin));
    assert.equal(route.page, page);
    assert.equal(route.target, target);
    assert.equal(route.url.pathname, path);
    assert.equal(route.url.hash, '');
  }
});

test('old bookmarks retain their section when converted to clean URLs', () => {
  for (const [oldPath, cleanPath, target] of [
    ['/#idea', '/idea/', 'idea'],
    ['/index.html#approach', '/approach/', 'approach'],
    ['/philosophy.html', '/philosophy/', 'top'],
    ['/philosophy.html#owning-it', '/philosophy/owning-it/', 'owning-it'],
    ['/philosophy/#the-first-product', '/philosophy/the-first-product/', 'the-first-product'],
    ['/philosophy/owning-it/#top', '/philosophy/', 'top'],
    ['/#main', '/', 'main'],
  ]) {
    const route = resolveRoute(new URL(oldPath, origin), new URL(origin));
    assert.equal(route.url.pathname, cleanPath);
    assert.equal(route.target, target);
    assert.equal(route.url.hash, '');
  }
});

test('project-hosted pages preserve their repository prefix', () => {
  const route = resolveRoute(new URL('https://example.test/vh/philosophy.html#owning-it'), new URL('https://example.test/vh/'));
  assert.equal(route.url.href, 'https://example.test/vh/philosophy/owning-it/');
  assert.equal(route.page, 'philosophy');
  assert.equal(route.target, 'owning-it');
});

test('queries survive normalization and missing slashes are normalized', () => {
  const route = resolveRoute(new URL('https://example.test/approach?source=linkedin'), new URL(origin));
  assert.equal(route.url.href, 'https://example.test/approach/?source=linkedin');
});

test('external URLs, unknown paths and unknown fragments remain native links', () => {
  for (const path of ['https://other.test/idea/', '/missing/', '/#unknown', '/#%E0%A4%A']) {
    assert.equal(resolveRoute(new URL(path, origin), new URL(origin)), null);
  }
  assert.equal(resolveRoute(new URL('https://example.test/idea/'), new URL('https://example.test/vh/')), null);
});

test('nested static entries resolve styles, fonts and home links at the site root', async () => {
  const file = await readFile(new URL('../philosophy/owning-it/index.html', import.meta.url), 'utf8');
  const base = new URL(file.match(/<base href="([^"]+)"/)[1], 'https://example.test/vh/philosophy/owning-it/');
  assert.equal(new URL('styles.css', base).href, 'https://example.test/vh/styles.css');
  assert.equal(new URL('assets/neuemontreal-medium.otf', base).href, 'https://example.test/vh/assets/neuemontreal-medium.otf');
  assert.equal(new URL('./', base).href, 'https://example.test/vh/');
  const skipHref = file.match(/class="skip-link" href="([^"]+)"/)[1];
  assert.equal(new URL(skipHref, base).href, 'https://example.test/vh/philosophy/owning-it/#main');
  assert.match(file, /id="owning-it"/);
  assert.match(file, /href="https:\/\/vh\.do\/philosophy\/"/);
});

test('the team page has a clean URL', () => {
  const route = resolveRoute(new URL('/team/', origin), new URL(origin));
  assert.equal(route.page, 'team');
  assert.equal(route.target, 'top');
  assert.equal(route.url.pathname, '/team/');
});

// Guard: the team page ships with placeholders until all three people are confirmed.
test('the team page has no unconfirmed placeholders', async () => {
  const html = await readFile(new URL('../team.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /TBC|NEEDED/, 'Replace every [ROLE NEEDED] placeholder in team.html before publishing');
});
