import { createOptimizedPicture } from '../../scripts/aem.js';

const PAGE_SIZE = 7; // 1 featured + 6 regular
const BULLET = /^(?:•|-|✅)\s+/;

// First match wins, so keep the most specific topics at the top.
const TOPICS = [
  ['AEM and EDS', /edge delivery|\beds\b|\baem\b/i],
  ['Next.js', /next\.js/i],
  ['Design systems', /design token|figma/i],
  ['Performance', /virtuali|10,000|fiber/i],
  ['State', /zustand|redux/i],
  ['React', /react/i],
];

const clean = (s) => s.replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();

/* The authored doc uses typed bullets and **markdown**; turn them into real markup. */
function inline(html) {
  return html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function buildBody(paras) {
  const frag = document.createDocumentFragment();
  let list = null;

  paras.forEach((p) => {
    const copy = p.cloneNode(true);
    copy.querySelectorAll('a').forEach((a) => {
      if (!a.textContent.trim()) {
        a.remove(); // LinkedIn paste leaves empty anchors behind
      } else {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    });

    copy.innerHTML.split(/<br\s*\/?>/i)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const marker = line.match(BULLET);
        if (marker) {
          if (!list) {
            list = document.createElement('ul');
            frag.append(list);
          }
          const li = document.createElement('li');
          li.innerHTML = inline(line.slice(marker[0].length));
          list.append(li);
        } else {
          list = null;
          const el = document.createElement('p');
          el.innerHTML = inline(line);
          frag.append(el);
        }
      });
  });
  return frag;
}

function parseRow(row, index) {
  const [mediaCell, bodyCell] = row.children;
  if (!bodyCell) return null;
  const paras = [...bodyCell.querySelectorAll('p')];
  if (!paras.length) return null;

  const title = clean(paras[0].textContent);
  const rest = paras.slice(1);
  const text = rest.map((p) => p.textContent).join(' ');
  const excerptSource = rest
    .map((p) => p.textContent.trim())
    .find((t) => t.length > 60 && !BULLET.test(t));
  const topic = (TOPICS.find(([, re]) => re.test(title))
    || TOPICS.find(([, re]) => re.test(text))
    || ['General'])[0];
  const words = text.split(/\s+/).filter(Boolean).length;

  return {
    id: `blog-post-${index}`,
    title,
    excerpt: clean(excerptSource || ''),
    topic,
    minutes: Math.max(1, Math.round(words / 200)),
    imgSrc: mediaCell?.querySelector('img')?.src || '',
    paras: rest,
    search: `${title} ${text} ${topic}`.toLowerCase(),
  };
}

function buildCard(post, index) {
  const li = document.createElement('li');
  li.className = 'blog-item';
  if (index === 0) li.classList.add('blog-featured');

  li.innerHTML = `
    <article class="blog-card">
      <div class="blog-card-media"></div>
      <div class="blog-card-body">
        <p class="blog-card-meta">
          <span class="blog-topic"></span>
          <span class="blog-time"></span>
        </p>
        <h3 class="blog-card-title"><button type="button" class="blog-open"></button></h3>
        <p class="blog-card-excerpt"></p>
        <span class="blog-card-cta" aria-hidden="true">Read the article</span>
      </div>
    </article>`;

  li.querySelector('.blog-topic').textContent = post.topic;
  li.querySelector('.blog-time').textContent = `${post.minutes} min read`;
  li.querySelector('.blog-open').textContent = post.title;
  li.querySelector('.blog-card-excerpt').textContent = post.excerpt;

  if (post.imgSrc) {
    // Only the first image is above the fold, so only it loads eagerly.
    li.querySelector('.blog-card-media').append(
      createOptimizedPicture(post.imgSrc, '', index === 0, [{ width: '750' }]),
    );
  }
  return li;
}

export default function decorate(block) {
  const posts = [...block.children].map(parseRow).filter(Boolean);
  block.textContent = '';
  if (!posts.length) return;

  const state = { query: '', topic: 'All', shown: PAGE_SIZE };

  /* ---------- toolbar ---------- */
  const toolbar = document.createElement('div');
  toolbar.className = 'blog-toolbar';

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'blog-search';
  search.placeholder = 'Search articles';
  search.setAttribute('aria-label', 'Search articles');

  const chips = document.createElement('div');
  chips.className = 'blog-chips';
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Filter by topic');
  ['All', ...new Set(posts.map((p) => p.topic))].forEach((topic) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'blog-chip';
    chip.textContent = topic;
    chip.dataset.topic = topic;
    chip.setAttribute('aria-pressed', topic === 'All');
    chips.append(chip);
  });

  const status = document.createElement('p');
  status.className = 'blog-status';
  status.setAttribute('aria-live', 'polite');

  toolbar.append(search, chips, status);

  /* ---------- grid ---------- */
  const grid = document.createElement('ul');
  grid.className = 'blog-grid';
  posts.forEach((post, i) => {
    post.el = buildCard(post, i);
    grid.append(post.el);
  });

  const empty = document.createElement('p');
  empty.className = 'blog-empty';
  empty.textContent = 'No articles match your search. Clear the search or pick another topic.';
  empty.hidden = true;

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'blog-more';
  more.textContent = 'Show more articles';

  /* ---------- reading dialog ---------- */
  const dialog = document.createElement('dialog');
  dialog.className = 'blog-modal';
  dialog.innerHTML = `
    <div class="blog-modal-inner">
      <button type="button" class="blog-close" aria-label="Close article">&times;</button>
      <div class="blog-modal-content"></div>
    </div>`;
  const inner = dialog.querySelector('.blog-modal-inner');
  const content = dialog.querySelector('.blog-modal-content');
  let lastTrigger = null;

  function openPost(post, trigger) {
    lastTrigger = trigger;
    content.textContent = '';

    const meta = document.createElement('p');
    meta.className = 'blog-card-meta';
    meta.innerHTML = '<span class="blog-topic"></span><span class="blog-time"></span>';
    meta.querySelector('.blog-topic').textContent = post.topic;
    meta.querySelector('.blog-time').textContent = `${post.minutes} min read`;

    const heading = document.createElement('h2');
    heading.id = post.id;
    heading.textContent = post.title;
    dialog.setAttribute('aria-labelledby', post.id);

    const article = document.createElement('div');
    article.className = 'blog-article';
    article.append(buildBody(post.paras));

    content.append(meta, heading);
    if (post.imgSrc) {
      const figure = document.createElement('div');
      figure.className = 'blog-modal-media';
      figure.append(createOptimizedPicture(post.imgSrc, post.title, false, [
        { media: '(min-width: 600px)', width: '1200' },
        { width: '750' },
      ]));
      content.append(figure);
    }
    content.append(article);

    document.body.style.overflow = 'hidden';
    dialog.showModal();
    inner.scrollTop = 0;
  }

  dialog.addEventListener('click', (e) => {
    // The inner wrapper fills the dialog, so only backdrop clicks hit the dialog itself.
    if (e.target === dialog) dialog.close();
  });
  dialog.querySelector('.blog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    lastTrigger?.focus();
  });

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.blog-item');
    if (!card) return;
    const post = posts.find((p) => p.el === card);
    openPost(post, card.querySelector('.blog-open'));
  });

  /* ---------- filtering ---------- */
  function render() {
    const q = state.query.trim().toLowerCase();
    const matches = posts.filter((p) => (state.topic === 'All' || p.topic === state.topic)
      && (!q || p.search.includes(q)));

    posts.forEach((p) => { p.el.hidden = true; });
    matches.slice(0, state.shown).forEach((p) => { p.el.hidden = false; });

    // The first visible card is always the featured one.
    grid.querySelectorAll('.blog-featured').forEach((el) => el.classList.remove('blog-featured'));
    const first = matches[0]?.el;
    if (first && state.topic === 'All' && !q) first.classList.add('blog-featured');

    more.hidden = matches.length <= state.shown;
    empty.hidden = matches.length > 0;
    status.textContent = `${matches.length} ${matches.length === 1 ? 'article' : 'articles'}`;
  }

  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.query = search.value;
      state.shown = PAGE_SIZE;
      render();
    }, 150);
  });

  chips.addEventListener('click', (e) => {
    const chip = e.target.closest('.blog-chip');
    if (!chip) return;
    state.topic = chip.dataset.topic;
    state.shown = PAGE_SIZE;
    chips.querySelectorAll('.blog-chip').forEach((c) => {
      c.setAttribute('aria-pressed', c === chip);
    });
    render();
  });

  more.addEventListener('click', () => {
    state.shown += PAGE_SIZE;
    render();
  });

  block.append(toolbar, grid, empty, more, dialog);
  render();
}
