import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  if (navSections) {
    const navDrops = navSections.querySelectorAll('.nav-drop');
    if (isDesktop.matches) {
      navDrops.forEach((drop) => {
        if (!drop.hasAttribute('tabindex')) {
          drop.setAttribute('tabindex', 0);
          drop.addEventListener('focus', focusNavSection);
        }
      });
    } else {
      navDrops.forEach((drop) => {
        drop.removeAttribute('tabindex');
        drop.removeEventListener('focus', focusNavSection);
      });
    }
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

/**
 * Marks the nav item that matches the current page as active.
 * - "/" (Home) matches only the home page
 * - Other links also match their sub-pages (/blog/ stays active on /blog/my-post)
 * - Items without a link (e.g. <u>AI Lab</u>) are skipped
 * @param {Element} navSections The .nav-sections element
 */
function setActiveNavItem(navSections) {
  if (!navSections) return;

  const clean = (path) => {
    const p = path.replace(/\/index(\.html)?$/, '').replace(/\/+$/, '');
    return p === '' ? '/' : p;
  };
  const current = clean(window.location.pathname);

  let matched = null;
  navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((li) => {
    li.classList.remove('active');
    const link = li.querySelector('a');
    if (!link) return;
    link.removeAttribute('aria-current');

    const target = clean(new URL(link.href, window.location.origin).pathname);
    const isMatch = target === '/'
      ? current === '/'
      : current === target || current.startsWith(`${target}/`);

    // Longest match wins
    if (isMatch && (!matched || target.length > matched.target.length)) {
      matched = { li, link, target };
    }
  });

  if (matched) {
    matched.li.classList.add('active');
    matched.link.setAttribute('aria-current', 'page');
  }
}

/**
 * Makes the search results match the mock: result counter, type label
 * (Experience, AI Lab, Blog ...) and an initials badge. Works on top of the
 * existing search block, so search.js does not need to change.
 * @param {Element} panel The .search-wrapper element
 */
function enhanceSearchPanel(panel) {
  const TYPES = [
    ['/experience', 'Experience', 'EX'],
    ['/projects', 'Projects', 'PR'],
    ['/ai-lab', 'AI Lab', 'AI'],
    ['/blog', 'Blog', 'BL'],
    ['/contact', 'Contact', 'CO'],
  ];
  const typeOf = (href) => {
    let path = '/';
    try { path = new URL(href, window.location.origin).pathname; } catch (e) { /* ignore */ }
    return TYPES.find(([p]) => path === p || path.startsWith(`${p}/`)) || ['/', 'Home', 'HM'];
  };

  const run = () => {
    const box = panel.querySelector('.search-box');
    if (box && !box.querySelector('.search-esc')) {
      const esc = document.createElement('span');
      esc.className = 'search-esc';
      esc.textContent = 'Esc';
      box.append(esc);
    }

    const results = panel.querySelector('.search-results');
    if (!results) return;

    let count = results.previousElementSibling;
    if (!count?.classList.contains('search-count')) {
      count = document.createElement('div');
      count.className = 'search-count';
      count.setAttribute('aria-hidden', 'true');
      results.before(count);
    }

    let total = 0;
    results.querySelectorAll(':scope > li').forEach((li) => {
      const link = li.querySelector('a[href]');
      if (!link) return;
      total += 1;
      if (li.dataset.enhanced) return;
      const [, label, initials] = typeOf(link.getAttribute('href'));
      const badge = document.createElement('div');
      badge.className = 'search-initials';
      badge.setAttribute('aria-hidden', 'true');
      const img = li.querySelector('img');
      if (img) {
        // show the result image inside the badge (instead of the initials)
        badge.append(img);
        img.addEventListener('error', () => {
          img.remove();
          badge.textContent = initials;
        });
      } else {
        badge.textContent = initials;
      }
      const tag = document.createElement('span');
      tag.className = 'search-tag';
      tag.textContent = label;
      li.prepend(badge);
      li.append(tag);
      li.dataset.enhanced = 'true';
    });

    const text = total ? `${total} result${total === 1 ? '' : 's'}` : '';
    if (count.textContent !== text) count.textContent = text;
  };

  new MutationObserver(run).observe(panel, { childList: true, subtree: true });
  run();
}

/**
 * Adds a search icon button to the nav (desktop) that opens the search panel.
 * On mobile the search input is shown inside the open hamburger menu.
 * @param {Element} nav The nav element
 * @param {Element} navSections The .nav-sections element
 */
function setupSearchToggle(nav, navSections) {
  const panel = navSections?.querySelector('.search-wrapper');
  const list = navSections?.querySelector('.default-content-wrapper > ul');
  if (!panel || !list) return;
  panel.id = 'nav-search-panel';
  enhanceSearchPanel(panel);

  const icon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  const buttonHtml = `<button type="button" aria-label="Search" aria-expanded="false" aria-controls="nav-search-panel">${icon}</button>`;

  // desktop: icon in the menu, before the last item (Resume)
  const li = document.createElement('li');
  li.className = 'nav-search-toggle';
  li.innerHTML = buttonHtml;
  list.insertBefore(li, list.lastElementChild);

  // mobile: icon on the right of the header (hamburger | title | search)
  let tools = nav.querySelector('.nav-tools');
  if (!tools) {
    tools = document.createElement('div');
    tools.className = 'nav-tools';
    nav.append(tools);
  }
  const mobile = document.createElement('div');
  mobile.className = 'nav-search-mobile';
  mobile.innerHTML = buttonHtml;
  tools.append(mobile);

  // the panel lives directly in the nav so it can open even when the menu is closed
  nav.append(panel);

  const buttons = [li.querySelector('button'), mobile.querySelector('button')];

  const setOpen = (open) => {
    nav.classList.toggle('search-open', open);
    buttons.forEach((b) => b.setAttribute('aria-expanded', String(open)));
    if (open) panel.querySelector('input')?.focus();
  };

  buttons.forEach((button) => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!nav.classList.contains('search-open'));
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && nav.classList.contains('search-open')) {
      setOpen(false);
      const visible = buttons.find((b) => b.offsetParent !== null) || buttons[0];
      visible.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !li.contains(e.target) && !mobile.contains(e.target)) {
      setOpen(false);
    }
  });
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand?.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
      });
    });
  }

  // highlight the menu item for the current page
  setActiveNavItem(navSections);

  // search icon + dropdown panel
  setupSearchToggle(nav, navSections);

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
