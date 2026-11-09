export const pages = {
  home: {
    source: 'index.html',
    path: '',
    sections: ['idea', 'approach', 'principles', 'ownership', 'building', 'story', 'questions'],
  },
  philosophy: {
    source: 'philosophy.html',
    path: 'philosophy/',
    sections: ['a-useful-purpose', 'under-the-hood', 'owning-it', 'a-familiar-feeling', 'the-first-product'],
  },
  team: {
    source: 'team.html',
    path: 'team/',
    sections: [],
  },
};

export const routes = Object.entries(pages).flatMap(([page, definition]) => [
  { page, path: definition.path, target: 'top' },
  ...definition.sections.map(target => ({ page, path: `${definition.path}${target}/`, target })),
]);

// The base URL comes from each static entry's <base> tag, so project sites
// and custom domains use the same route definitions.
export function resolveRoute(url, baseURL) {
  if (url.origin !== baseURL.origin || !url.pathname.startsWith(baseURL.pathname)) return null;
  const relativePath = url.pathname.slice(baseURL.pathname.length);
  let path = relativePath.replace(/(^|\/)index\.html$/, '$1').replace(/\/+$/, '');
  if (path === 'philosophy.html') path = 'philosophy';
  let route = routes.find(candidate => candidate.path.replace(/\/$/, '') === path);
  if (!route) return null;

  if (url.hash) {
    let target;
    try { target = decodeURIComponent(url.hash.slice(1)); } catch { return null; }
    const page = pages[route.page];
    if (target === 'top' || target === 'main') {
      route = { page: route.page, path: page.path, target };
    } else if (page.sections.includes(target)) {
      route = { page: route.page, path: `${page.path}${target}/`, target };
    } else {
      return null;
    }
  }

  const cleanURL = new URL(route.path || './', baseURL);
  cleanURL.search = url.search;
  return { ...route, url: cleanURL };
}
