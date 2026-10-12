import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Certificates block — Google Docs format:
 * Table "Certificates", one row per certificate, 3 cells:
 *   [image | details | category]
 * details cell, top to bottom:
 *   bold title / issuer / date and length / bullet list (skills) / link or note
 * Clicking a thumbnail opens the full-size certificate.
 */
const isTitle = (p) => p.children.length === 1
  && p.firstElementChild.tagName === 'STRONG'
  && p.textContent.trim() === p.firstElementChild.textContent.trim();

function createDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'certificates-dialog';
  dialog.setAttribute('aria-label', 'Certificate');
  dialog.innerHTML = `<button type="button" class="certificates-close" aria-label="Close">×</button>
    <div class="certificates-dialog-body"></div>`;
  // Click on the backdrop or the close button closes it
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('.certificates-close')) dialog.close();
  });
  return dialog;
}

export default function decorate(block) {
  const list = document.createElement('ul');
  list.className = 'certificates-grid';
  const categories = [];
  const dialog = createDialog();
  const dialogBody = dialog.querySelector('.certificates-dialog-body');

  [...block.children].forEach((row) => {
    const [imageCell, detailsCell, categoryCell] = row.children;
    const category = categoryCell?.textContent.trim() || '';
    if (category && !categories.includes(category)) categories.push(category);

    const li = document.createElement('li');
    li.className = 'certificates-card';
    li.dataset.category = category;

    // Details
    const paragraphs = [...(detailsCell?.querySelectorAll(':scope > p') || [])];
    const titleP = paragraphs.find(isTitle);
    const title = titleP?.textContent.trim() || 'Certificate';
    const [issuerP, metaP, footP] = paragraphs.filter((p) => p !== titleP);

    // Thumbnail (full certificate, never cropped) + category badge
    const thumb = document.createElement('div');
    thumb.className = 'certificates-thumb';
    const img = imageCell?.querySelector('img');
    if (img) {
      const zoom = document.createElement('button');
      zoom.type = 'button';
      zoom.className = 'certificates-zoom';
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
      badge.className = 'certificates-category';
      badge.textContent = category;
      thumb.append(badge);
    }

    const body = document.createElement('div');
    body.className = 'certificates-body';
    if (metaP) { metaP.className = 'certificates-meta'; body.append(metaP); }
    const h3 = document.createElement('h3');
    h3.textContent = title;
    body.append(h3);
    if (issuerP) { issuerP.className = 'certificates-issuer'; body.append(issuerP); }
    const tags = detailsCell?.querySelector('ul');
    if (tags) { tags.className = 'certificates-tags'; body.append(tags); }
    if (footP) {
      footP.className = footP.querySelector('a') ? 'certificates-link' : 'certificates-note';
      body.append(footP);
    }

    li.append(thumb, body);
    list.append(li);
  });

  // Filter bar + count
  const bar = document.createElement('div');
  bar.className = 'certificates-filters';
  const count = document.createElement('span');
  count.className = 'certificates-count';

  const update = (selected) => {
    let visible = 0;
    list.querySelectorAll('.certificates-card').forEach((card) => {
      const show = selected === 'All' || card.dataset.category === selected;
      card.hidden = !show;
      if (show) visible += 1;
    });
    count.textContent = `${visible} certificate${visible === 1 ? '' : 's'}`;
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
