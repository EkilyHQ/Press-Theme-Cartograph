import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
function resolvePressRoot() {
  const candidates = [];
  if (process.env.PRESS_ROOT) candidates.push(resolve(root, process.env.PRESS_ROOT));
  candidates.push(resolve(root, '.press'));
  candidates.push(resolve(root, '..', 'Press'));
  const found = candidates.find((candidate) => existsSync(resolve(candidate, 'assets/js/site-features.js')));
  return found || candidates[0];
}
const pressRoot = resolvePressRoot();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const layout = read('theme/modules/layout.js');
const interactions = read('theme/modules/interactions.js');
const views = read('theme/modules/views.js');
const source = `${layout}\n${interactions}\n${views}`;
const manifest = JSON.parse(read('theme/theme.json'));
const releaseExample = JSON.parse(read('theme-release.example.json'));

assert.equal(manifest.contractVersion, 4);
assert.equal(manifest.engines.press, '>=3.4.130 <4.0.0');
assert.equal(releaseExample.contractVersion, 4);
assert.equal(releaseExample.engines.press, '>=3.4.130 <4.0.0');
assert.doesNotMatch(source, /[?&](?:tab|id)=/, 'v4 packaged source should use router href helpers for public routes');
assert.doesNotMatch(source, /getRouteHref[\s\S]{0,160}\|\|\s*'#'/, 'v4 route helper null results should not become hash dead links');
assert.match(layout, /data-site-home/);
assert.match(interactions, /siteFeatureContextEnabled/);
assert.match(interactions, /function getRouter[\s\S]*ctx\.router/);
assert.match(interactions, /function getRouteHref[\s\S]*routerFunction\(context, params, name\)/);
assert.match(interactions, /function updateHomeLinks[\s\S]*getRouteHref\(context, params, 'getHomeHref'\)[\s\S]*data-site-home/);
assert.match(interactions, /getRouteHref\(context, params, 'getSearchHref'\)/, 'footer search links should use the v4 router search href helper');
assert.ok(releaseExample.files.includes('modules/views.js'), 'example release manifest should include every declared runtime module');
assert.match(
  interactions,
  /function updateHomeLinks[\s\S]*getRouteHref\(context, params, 'getHomeHref'\)[\s\S]*if \(!href\) return false;[\s\S]*data-site-home/,
  'identity refresh should use the v4 home href helper or preserve existing home hrefs'
);

[
  'visitorThemeControls',
  'footerNav',
  'profileLinks',
  'search',
  'tags',
  'toc'
].forEach((key) => {
  assert.match(interactions, new RegExp(`featureEnabled\\([\\s\\S]*['"]${key}['"]`), `${key} should be gated`);
});

assert.match(views, /featureEnabled\(params, 'postMeta'\)/);
assert.match(
  views,
  /function buildCard\(\[title, meta\][\s\S]*const showPostMeta = featureEnabled\(params, 'postMeta'\);[\s\S]*const date = showPostMeta && meta && meta\.date \? formatDisplayDate\(meta\.date\) : '';[\s\S]*const versions = showPostMeta && Array\.isArray\(meta && meta\.versions\)[\s\S]*const draft = showPostMeta && meta && meta\.draft \? t\('ui\.draftBadge'\) : '';/,
  'index/search cards should hide date, version, and draft metadata when postMeta is disabled'
);
assert.match(views, /featureEnabled\(params, 'tags'\)/);
assert.match(
  views,
  /const showTags = featureEnabled\(params, 'tags'\) && featureEnabled\(params, 'search'\);[\s\S]*renderPostMetaCard\(title, metadata \|\| \{\}, params\.markdown \|\| content\.rawMarkdown \|\| '', \{ showTags \}\)/,
  'shared post meta card should receive the tags and search feature gates'
);
assert.match(
  views,
  /function buildCard\(\[title, meta\][\s\S]*if \(!href\) return '';[\s\S]*const showTags = featureEnabled\(params, 'tags'\) && featureEnabled\(params, 'search'\);[\s\S]*const tags = showTags && meta \? renderTags\(meta\.tag \|\| meta\.tags\) : '';/,
  'index/search cards should hide tags when tags or search are disabled'
);
assert.match(
  views,
  /function buildPagination\([\s\S]*renderPageControl[\s\S]*<span class="\$\{safe\(`\$\{className\} is-disabled`\.trim\(\)\)\}" aria-disabled="true">/,
  'pagination should render disabled spans rather than hash links when route helpers return null'
);
assert.match(views, /featureEnabled\(params, 'toc'\)/);
assert.match(
  views,
  /renderContentLegend\(\{[\s\S]*tocHtml: featureEnabled\(params, 'toc'\) \? \(params\.tocHtml \|\| content\.tocHtml \|\| ''\) : ''[\s\S]*\}\);/,
  'disabled toc should suppress only TOC content while preserving other legend panels'
);
assert.match(interactions, /renderFooterLinks/);
assert.match(
  interactions,
  /if \(!featureEnabled\(\{ features \}, 'tags', localContext\) \|\| !featureEnabled\(\{ features \}, 'search', localContext\)\) \{/,
  'tag sidebar should hide when either tags or search is disabled'
);
assert.match(
  interactions,
  /if \(featureEnabled\(params, 'tags', localContext\) && featureEnabled\(params, 'search', localContext\) && typeof params\.renderTagSidebar === 'function'\) \{[\s\S]*\} else \{[\s\S]*getRegion\(localContext, \['tags', 'tagBand'\], '\.cartograph-tagband'\)[\s\S]*setChromeHidden\(tagBox, true\);/,
  'index enhancement should clear and hide tag band unless both tags and search are enabled'
);
assert.match(
  interactions,
  /function renderNavLinks[\s\S]*getRouteHref\(context, params, 'getPostsHref'\)[\s\S]*getRouteHref\(context, params, 'getTabHref', slug\)/,
  'nav rendering should use v4 posts and tab href helpers'
);
assert.match(
  interactions,
  /renderSiteIdentity\(params = \{\}\)[\s\S]*updateHomeLinks\(localContext, params\)/,
  'identity rendering should preserve context router helpers when refreshing home links'
);
assert.match(
  views,
  /function getRouteHref\(params = \{\}, name[\s\S]*router\[name\]/,
  'view rendering should resolve route href helpers from params.context.router'
);

class TestClassList {
  constructor(element) {
    this.element = element;
  }

  _values() {
    return new Set(String(this.element.className || '').split(/\s+/).filter(Boolean));
  }

  _set(values) {
    this.element.className = Array.from(values).join(' ');
  }

  add(...classes) {
    const values = this._values();
    classes.forEach((cls) => { if (cls) values.add(String(cls)); });
    this._set(values);
  }

  remove(...classes) {
    const values = this._values();
    classes.forEach((cls) => values.delete(String(cls)));
    this._set(values);
  }

  toggle(cls, force) {
    const values = this._values();
    const name = String(cls || '');
    const shouldAdd = force == null ? !values.has(name) : !!force;
    if (shouldAdd) values.add(name);
    else values.delete(name);
    this._set(values);
    return shouldAdd;
  }

  contains(cls) {
    return this._values().has(String(cls || ''));
  }
}

function dataKey(name) {
  return String(name || '').slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function matchesSelector(element, selector) {
  const raw = String(selector || '').trim();
  if (!raw || !element) return false;
  const tagClassMatch = raw.match(/^([a-z0-9-]+)((?:\.[a-z0-9_-]+)+)$/i);
  if (tagClassMatch) {
    const [, tag, classPart] = tagClassMatch;
    const classes = classPart.split('.').filter(Boolean);
    return String(element.tagName || '').toLowerCase() === tag.toLowerCase()
      && classes.every((cls) => String(element.className || '').split(/\s+/).includes(cls));
  }
  if (raw.startsWith('.')) return String(element.className || '').split(/\s+/).includes(raw.slice(1));
  if (raw.startsWith('#')) return element.id === raw.slice(1);
  const attrMatch = raw.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (attrMatch) {
    const [, name, expected] = attrMatch;
    const actual = element.getAttribute(name);
    return expected == null ? actual != null : actual === expected;
  }
  return String(element.tagName || '').toLowerCase() === raw.toLowerCase();
}

function findFirst(rootElement, selector) {
  for (const child of rootElement.children || []) {
    if (matchesSelector(child, selector)) return child;
    const nested = findFirst(child, selector);
    if (nested) return nested;
  }
  return null;
}

function findAll(rootElement, selector, out = []) {
  for (const child of rootElement.children || []) {
    if (matchesSelector(child, selector)) out.push(child);
    findAll(child, selector, out);
  }
  return out;
}

class TestElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.className = '';
    this.id = '';
    this.hidden = false;
    this.textContent = '';
    this.value = '';
    this.clientWidth = 1000;
    this.scrollWidth = 1000;
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.scrollHeight = 1000;
    this.style = {
      setProperty(name, value) {
        this[String(name)] = String(value);
      },
      removeProperty(name) {
        delete this[String(name)];
      }
    };
    this.classList = new TestClassList(this);
    this._innerHTML = '';
  }

  get firstChild() {
    return this.children[0] || null;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || '');
    this.children = [];
  }

  appendChild(child) {
    if (!child) return child;
    child.parentElement = this;
    child.parentNode = this;
    child.ownerDocument = child.ownerDocument || this.ownerDocument;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    if (child) {
      child.parentElement = null;
      child.parentNode = null;
    }
    return child;
  }

  setAttribute(name, value) {
    const key = String(name);
    const text = String(value);
    this.attributes.set(key, text);
    if (key === 'id') this.id = text;
    if (key === 'class') this.className = text;
    if (key.startsWith('data-')) this.dataset[dataKey(key)] = text;
  }

  getAttribute(name) {
    const key = String(name);
    if (key === 'id') return this.id || null;
    if (key === 'class') return this.className || null;
    return this.attributes.has(key) ? this.attributes.get(key) : null;
  }

  removeAttribute(name) {
    const key = String(name);
    this.attributes.delete(key);
    if (key === 'id') this.id = '';
    if (key === 'class') this.className = '';
    if (key.startsWith('data-')) delete this.dataset[dataKey(key)];
  }

  querySelector(selector) {
    return findFirst(this, selector);
  }

  querySelectorAll(selector) {
    return findAll(this, selector);
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (matchesSelector(current, selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  addEventListener() {}
  removeEventListener() {}
  scrollTo({ top = 0, left = 0 } = {}) {
    this.scrollTop = top;
    this.scrollLeft = left;
  }
  getBoundingClientRect() {
    return { width: this.clientWidth };
  }
}

class TestDocument {
  constructor() {
    this.nodeType = 9;
    this.body = new TestElement('body', this);
    this.documentElement = new TestElement('html', this);
    this.defaultView = {
      location: { href: 'https://example.test/?tab=about', origin: 'https://example.test', pathname: '/' },
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      requestAnimationFrame: (fn) => setTimeout(fn, 0),
      cancelAnimationFrame: (id) => clearTimeout(id),
      addEventListener() {},
      removeEventListener() {},
      scrollTo() {}
    };
  }

  createElement(tagName) {
    return new TestElement(tagName, this);
  }

  querySelector(selector) {
    if (matchesSelector(this.body, selector)) return this.body;
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    const out = [];
    if (matchesSelector(this.body, selector)) out.push(this.body);
    out.push(...this.body.querySelectorAll(selector));
    return out;
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }
}

function disabledChromeFeatures() {
  return {
    isEnabled(key) {
      return !['visitorThemeControls', 'footerNav', 'profileLinks', 'search', 'tags', 'toc', 'postMeta'].includes(String(key || ''));
    }
  };
}

function createCartographHarness() {
  const doc = new TestDocument();
  const regions = new Map();
  const add = (name, element) => {
    regions.set(name, element);
    return element;
  };
  const container = add('container', doc.createElement('div'));
  container.className = 'cartograph-shell';
  const scrollContainer = add('scrollContainer', doc.createElement('div'));
  const nav = add('nav', doc.createElement('nav'));
  const search = add('search', doc.createElement('press-search'));
  search.className = 'cartograph-search';
  search.setPlaceholder = (value) => { search.placeholder = value; };
  const tools = add('toolsPanel', doc.createElement('section'));
  tools.className = 'cartograph-tools';
  const footerNav = add('footerNav', doc.createElement('nav'));
  footerNav.className = 'cartograph-footer__nav';
  const tags = add('tags', doc.createElement('section'));
  tags.className = 'cartograph-tagband';
  const toc = add('toc', doc.createElement('press-toc'));
  toc.className = 'cartograph-toc';
  toc.renderToc = ({ tocHtml } = {}) => { toc.innerHTML = String(tocHtml || ''); };
  toc.clear = () => { toc.innerHTML = ''; };
  const routeMap = add('routeMap', doc.createElement('section'));
  routeMap.setAttribute('data-cartograph-route-map', '');
  const mediaPanel = add('mediaPanel', doc.createElement('section'));
  mediaPanel.setAttribute('data-cartograph-media', '');
  const linksPanel = add('linksPanel', doc.createElement('section'));
  linksPanel.setAttribute('data-cartograph-links', '');
  const main = add('main', doc.createElement('main'));
  main.className = 'cartograph-mainview';
  const content = add('content', doc.createElement('div'));

  const home = doc.createElement('a');
  home.setAttribute('data-site-home', '');
  doc.body.appendChild(home);
  const linkHost = doc.createElement('section');
  linkHost.className = 'cartograph-rail__card--links';
  const linkList = doc.createElement('ul');
  linkList.setAttribute('data-site-links', '');
  linkHost.appendChild(linkList);
  doc.body.appendChild(linkHost);
  [container, scrollContainer, nav, search, tools, footerNav, tags, toc, routeMap, mediaPanel, linksPanel, main, content].forEach((element) => doc.body.appendChild(element));

  const regionApi = {
    get(name) {
      return regions.get(name) || null;
    }
  };
  return { doc, regions: regionApi, elements: { container, scrollContainer, nav, search, tools, footerNav, tags, toc, routeMap, mediaPanel, linksPanel, main, linkHost, linkList, home } };
}

async function importCartographModules() {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'cartograph-feature-test-'));
  const tempModuleDir = resolve(tempRoot, 'assets/themes/cartograph/modules');
  mkdirSync(tempModuleDir, { recursive: true });
  mkdirSync(resolve(tempRoot, 'assets'), { recursive: true });
  symlinkSync(resolve(pressRoot, 'assets/js'), resolve(tempRoot, 'assets/js'), 'dir');
  writeFileSync(resolve(tempModuleDir, 'interactions.js'), interactions);
  writeFileSync(resolve(tempModuleDir, 'views.js'), views);
  const suffix = `feature-test=${Date.now()}-${Math.random()}`;
  const interactionsModule = await import(`${pathToFileURL(resolve(tempModuleDir, 'interactions.js')).href}?${suffix}`);
  const viewsModule = await import(`${pathToFileURL(resolve(tempModuleDir, 'views.js')).href}?${suffix}`);
  return { interactionsModule, viewsModule };
}

const { interactionsModule, viewsModule } = await importCartographModules();
const harness = createCartographHarness();
globalThis.document = harness.doc;
globalThis.window = harness.doc.defaultView;
globalThis.localStorage = harness.doc.defaultView.localStorage;

const features = disabledChromeFeatures();
const context = {
  document: harness.doc,
  window: harness.doc.defaultView,
  regions: harness.regions,
  features,
  router: {
    getHomeHref: () => '?tab=about',
    getHomeSlug: () => 'about',
    getHomeLabel: () => 'About',
    getTabHref: (slug) => `?tab=${slug}`,
    getPostHref: (location) => `?id=${location}`,
    getPostsHref: () => null,
    getSearchHref: () => null,
    postsEnabled: () => false,
    searchEnabled: () => false
  },
  i18n: {
    t: (key, value) => (value ? `${key}:${value}` : key),
    withLangParam: (href) => href
  }
};
const api = interactionsModule.mount(context);
assert.equal(harness.elements.search.hidden, true, 'mounted Cartograph search chrome should hide when search is disabled');
assert.equal(harness.elements.tools.hidden, true, 'mounted Cartograph tools should hide when visitor controls are disabled');

api.effects.renderFooterNav({
  features,
  tabsBySlug: { about: { title: 'About' } },
  postsEnabled: () => false,
  getHomeSlug: () => 'about',
  getHomeLabel: () => 'About',
  withLangParam: (href) => href
});
assert.equal(harness.elements.footerNav.hidden, true, 'disabled footer nav should stay hidden');
assert.equal(harness.elements.footerNav.innerHTML, '', 'disabled footer nav should stay empty');

api.effects.renderTabs({
  features,
  tabsBySlug: { about: { title: 'About' } },
  activeSlug: 'about',
  postsEnabled: () => false,
  getHomeSlug: () => 'about',
  withLangParam: (href) => href
});
assert.equal(harness.elements.home.getAttribute('href'), '?tab=about', 'tab rendering should set home links from the runtime home helper');
api.effects.renderSiteIdentity({
  features,
  config: { siteTitle: 'Product refreshed' },
  withLangParam: (href) => href
});
assert.equal(harness.elements.home.getAttribute('href'), '?tab=about', 'identity refresh without home helpers should preserve home href');
harness.elements.home.setAttribute('href', '#');
api.effects.renderSiteIdentity({
  features,
  config: { siteTitle: 'Product localized' },
  context: {
    router: {
      getHomeHref: () => '?tab=localized-home&lang=ja'
    }
  }
});
assert.equal(harness.elements.home.getAttribute('href'), '?tab=localized-home&lang=ja', 'identity refresh should use params.context router helpers');

api.effects.renderSiteLinks({
  features,
  config: {
    profileLinks: [{ label: 'GitHub', href: 'https://github.com/example/product' }]
  }
});
assert.equal(harness.elements.linkHost.hidden, true, 'disabled profile links should hide the links card');
assert.equal(harness.elements.linkList.innerHTML, '', 'disabled profile links should not render link content');

let tagRendererCalled = false;
api.effects.renderTagSidebar({
  features,
  postsIndex: { Alpha: { tag: ['alpha'] } },
  utilities: {
    renderTagSidebar() {
      tagRendererCalled = true;
    }
  }
});
assert.equal(tagRendererCalled, false, 'disabled search/tags should not call tag sidebar renderer');
assert.equal(harness.elements.tags.hidden, true, 'disabled search/tags should hide tag band');
assert.equal(harness.elements.tags.innerHTML, '', 'disabled search/tags should clear tag band');

harness.elements.tags.hidden = false;
harness.elements.tags.innerHTML = '<button>alpha</button>';
harness.elements.tags.removeAttribute('aria-hidden');
let enhanceTagRendererCalled = false;
api.effects.enhanceIndexLayout({
  features: {
    isEnabled(key) {
      return String(key || '') !== 'search';
    }
  },
  postsIndexMap: { Alpha: { tag: ['alpha'] } },
  setupSearch() {
    throw new Error('disabled search should not set up search during index enhancement');
  },
  renderTagSidebar() {
    enhanceTagRendererCalled = true;
  },
  applyLazyLoadingIn() {},
  hydrateCardCovers() {}
});
assert.equal(enhanceTagRendererCalled, false, 'search=false tags=true should not render tag band during index enhancement');
assert.equal(harness.elements.tags.hidden, true, 'search=false tags=true should hide stale tag band during index enhancement');
assert.equal(harness.elements.tags.innerHTML, '', 'search=false tags=true should clear stale tag band during index enhancement');
assert.equal(harness.elements.tags.getAttribute('aria-hidden'), 'true', 'search=false tags=true should mark stale tag band aria-hidden');

api.effects.renderPostTOC({
  features,
  tocHtml: '<a href="#intro">Intro</a>'
});
assert.equal(harness.elements.toc.hidden, true, 'disabled TOC should hide the TOC region');
assert.equal(harness.elements.toc.innerHTML, '', 'disabled TOC should not leave TOC content');

viewsModule.renderPostView({
  ctx: {
    document: harness.doc,
    window: harness.doc.defaultView,
    regions: harness.regions,
    i18n: context.i18n
  },
  containers: {
    mainElement: harness.elements.main
  },
  features,
  markdownHtml: '<p>Body</p>',
  markdown: '# Product',
  content: {
    assets: [{ type: 'image', alt: 'Hero shot', url: 'https://example.test/hero.png' }],
    links: [{ label: 'Docs', url: 'https://example.test/docs' }],
    headings: [{ level: 2, id: 'intro', text: 'Intro' }],
    blocks: 3
  },
  postMetadata: {
    title: 'Product',
    tag: ['alpha'],
    date: '2026-07-02'
  },
  tocHtml: '<a href="#intro">Intro</a>',
  siteConfig: {},
  utilities: {
    renderPostNav() {}
  }
});
assert.doesNotMatch(harness.elements.main.innerHTML, /post-meta-card|cartograph-stats|alpha/, 'disabled post meta/tags should leave no post meta or tag chrome');
assert.equal(harness.elements.toc.hidden, true, 'post render with disabled TOC should keep TOC hidden');
assert.match(harness.elements.routeMap.innerHTML, /Map|Intro/, 'disabled TOC should not clear the route-map panel');
assert.equal(harness.elements.mediaPanel.hidden, false, 'disabled TOC should not hide the media panel');
assert.match(harness.elements.mediaPanel.innerHTML, /Hero shot/, 'disabled TOC should keep media panel content');
assert.equal(harness.elements.linksPanel.hidden, false, 'disabled TOC should not hide the links panel');
assert.match(harness.elements.linksPanel.innerHTML, /Docs/, 'disabled TOC should keep link panel content');

viewsModule.renderIndexView({
  ctx: {
    document: harness.doc,
    window: harness.doc.defaultView,
    regions: harness.regions,
    i18n: context.i18n
  },
  containers: {
    mainElement: harness.elements.main
  },
  features,
  pageEntries: [['Product', {
    location: 'product.md',
    date: '2026-07-02',
    versions: [{}, {}],
    draft: true,
    tag: ['alpha']
  }]],
  siteConfig: {}
});
assert.doesNotMatch(harness.elements.main.innerHTML, /2026|versionsCount|draftBadge|alpha/, 'disabled postMeta/tags should hide index card metadata and tags');

viewsModule.renderIndexView({
  ctx: {
    document: harness.doc,
    window: harness.doc.defaultView,
    regions: harness.regions,
    i18n: context.i18n
  },
  context: {
    router: {
      getPostHref: (location) => `?id=${location}&lang=ja`,
      getPostsHref: ({ page } = {}) => `?tab=posts&page=${page || 1}&lang=ja`
    }
  },
  containers: {
    mainElement: harness.elements.main
  },
  features,
  pageEntries: [['Product', {
    location: 'product.md'
  }]],
  siteConfig: {}
});
assert.match(harness.elements.main.innerHTML, /href="\?id=product\.md&amp;lang=ja"/, 'index cards should use params.context router language helper');

viewsModule.renderSearchResults({
  ctx: {
    document: harness.doc,
    window: harness.doc.defaultView,
    regions: harness.regions,
    i18n: context.i18n
  },
  containers: {
    mainElement: harness.elements.main
  },
  features,
  entries: [['Product', {
    location: 'product.md',
    date: '2026-07-02',
    versions: [{}, {}],
    draft: true,
    tag: ['alpha']
  }]],
  siteConfig: {}
});
assert.doesNotMatch(harness.elements.main.innerHTML, /2026|versionsCount|draftBadge|alpha/, 'disabled postMeta/tags should hide search card metadata and tags');

viewsModule.renderIndexView({
  ctx: {
    document: harness.doc,
    window: harness.doc.defaultView,
    regions: harness.regions,
    i18n: context.i18n,
    router: {
      getPostHref: () => null,
      getPostsHref: () => null
    }
  },
  containers: {
    mainElement: harness.elements.main
  },
  features,
  page: 1,
  totalPages: 2,
  pageEntries: [['Product', {
    location: 'product.md'
  }]],
  siteConfig: {}
});
assert.doesNotMatch(harness.elements.main.innerHTML, /href="(?:#|)"/, 'null route helpers should not render empty or hash links');
assert.match(harness.elements.main.innerHTML, /aria-disabled="true"/, 'null pagination helpers should render disabled text controls');

viewsModule.renderSearchResults({
  ctx: {
    document: harness.doc,
    window: harness.doc.defaultView,
    regions: harness.regions,
    i18n: context.i18n,
    router: {
      getPostHref: () => null,
      getSearchHref: () => null
    }
  },
  containers: {
    mainElement: harness.elements.main
  },
  features,
  page: 2,
  totalPages: 3,
  query: 'Product',
  entries: [['Product', {
    location: 'product.md'
  }]],
  siteConfig: {}
});
assert.doesNotMatch(harness.elements.main.innerHTML, /href="(?:#|)"/, 'null search route helpers should not render empty or hash links');
assert.match(harness.elements.main.innerHTML, /aria-disabled="true"/, 'null search pagination helpers should render disabled text controls');

console.log('ok - Cartograph public chrome feature gates');
