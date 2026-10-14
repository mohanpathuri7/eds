import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Badges block — Google Docs format:
 * Table "Badges", one row per certificate, 4 cells:
 *   [image | details | category | medal (Gold, Silver or Bronze)]
 * details cell, top to bottom:
 *   bold title / issuer / date and length / bullet list (skills) / link or note
 * Clicking a thumbnail opens the full-size certificate.
 */
const isTitle = (p) => p.children.length === 1
  && p.firstElementChild.tagName === 'STRONG'
  && p.textContent.trim() === p.firstElementChild.textContent.trim();

// Medal colours: [main, dark, light]
const MEDALS = {
  gold: ['#f7d046', '#b8860b', '#fff3b0'],
  silver: ['#dfe4ee', '#7d8799', '#ffffff'],
  bronze: ['#d98f55', '#7a4a22', '#f3c9a0'],
};

function createMedal(level) {
  const colors = MEDALS[level];
  if (!colors) return null;
  const [main, dark, light] = colors;
  const medal = document.createElement('span');
  medal.className = 'badges-medal';
  medal.innerHTML = `<svg width="44" height="58" viewBox="0 0 44 58" role="img" aria-label="${level} badge">
    <path d="M10 0h11l6 22H16z" fill="#6366f1"/><path d="M34 0H23l-6 22h11z" fill="#4f46e5"/>
    <circle cx="22" cy="36" r="16" fill="${main}" stroke="${dark}" stroke-width="2.5"/>
    <circle cx="22" cy="36" r="10.5" fill="none" stroke="${light}" stroke-width="1.5"/>
    <path d="M22 29.5l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="${dark}"/></svg>`;
  return medal;
}

function createDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'badges-dialog';
  dialog.setAttribute('aria-label', 'Certificate');
  dialog.innerHTML = `<button type="button" class="badges-close" aria-label="Close">×</button>
    <div class="badges-dialog-body"></div>`;
  // Click on the backdrop or the close button closes it
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('.badges-close')) dialog.close();
  });
  return dialog;
}

export default function decorate(block) {
  const list = document.createElement('ul');
  list.className = 'badges-grid';
  const categories = [];
  const dialog = createDialog();
  const dialogBody = dialog.querySelector('.badges-dialog-body');

  [...block.children].forEach((row) => {
    const [imageCell, detailsCell, categoryCell, medalCell] = row.children;
    const category = categoryCell?.textContent.trim() || '';
    if (category && !categories.includes(category)) categories.push(category);

    const li = document.createElement('li');
    li.className = 'badges-card';
    li.dataset.category = category;

    // Details
    const paragraphs = [...(detailsCell?.querySelectorAll(':scope > p') || [])];
    const titleP = paragraphs.find(isTitle);
    const title = titleP?.textContent.trim() || 'Certificate';
    const [issuerP, metaP, footP] = paragraphs.filter((p) => p !== titleP);

    // Thumbnail (full certificate, never cropped) + category badge
    const thumb = document.createElement('div');
    thumb.className = 'badges-thumb';
    const img = imageCell?.querySelector('img');
    if (img) {
      const zoom = document.createElement('button');
      zoom.type = 'button';
      zoom.className = 'badges-zoom';
      zoom.setAttribute('aria-label', `View full certificate: ${title}`);
      zoom.append(createOptimizedPicture(img.src, img.alt || title, false, [
        { media: '(min-width: 600px)', width: '1000' },
        { width: '1400' },
      ]));
      zoom.addEventListener('click', () => {
        dialogBody.replaceChildren(
          createOptimizedPicture(img.src, img.alt || title, false, [{ width: '2200' }]),
        );
        dialog.showModal();
      });
      thumb.append(zoom);
    }
    if (category) {
      const badge = document.createElement('span');
      badge.className = 'badges-category';
      badge.textContent = category;
      thumb.append(badge);
    }
    const medal = createMedal(medalCell?.textContent.trim().toLowerCase());
    if (medal) thumb.append(medal);

    const body = document.createElement('div');
    body.className = 'badges-body';
    if (metaP) { metaP.className = 'badges-meta'; body.append(metaP); }
    const heading = document.createElement('h2');
    heading.textContent = title;
    body.append(heading);
    if (issuerP) { issuerP.className = 'badges-issuer'; body.append(issuerP); }
    const tags = detailsCell?.querySelector('ul');
    if (tags) { tags.className = 'badges-tags'; body.append(tags); }
    if (footP) {
      footP.className = footP.querySelector('a') ? 'badges-link' : 'badges-note';
      body.append(footP);
    }

    li.append(thumb, body);
    list.append(li);
  });

  // Filter bar + count
  const bar = document.createElement('div');
  bar.className = 'badges-filters';
  const count = document.createElement('span');
  count.className = 'badges-count';

  const update = (selected) => {
    let visible = 0;
    list.querySelectorAll('.badges-card').forEach((card) => {
      const show = selected === 'All' || card.dataset.category === selected;
      card.hidden = !show;
      if (show) visible += 1;
    });
    count.textContent = `${visible} badge${visible === 1 ? '' : 's'}`;
    bar.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', b.textContent === selected ? 'true' : 'false');
    });
  };

  ['All', ...categories].forEach((name) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.addEventListener('click', () => update(name));
    bar.append(button);
  });
  bar.append(count);

  block.replaceChildren(bar, list, dialog);
  update('All');
}
