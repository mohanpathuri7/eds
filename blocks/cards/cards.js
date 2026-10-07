import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Cards block — matches the Google Docs format (same as your Carousel sample):
 * Table "Cards (variant)", one row per card.
 *  - 2 cells: [image | bold title, description, bullet tags]
 *  - 1 cell (skills): [bold title, bullet tags]
 * Variants: skills, projects, ai lab, posts
 */
export default function decorate(block) {
  const list = document.createElement('ul');

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    const cells = [...row.children];

    // Cells that contain a picture are image cells, the rest is body
    const imageCell = cells.find((cell) => cell.querySelector('picture'));
    const bodyCell = cells.find((cell) => cell !== imageCell) || imageCell;

    if (imageCell && imageCell !== bodyCell) {
      const imageWrap = document.createElement('div');
      imageWrap.className = 'cards-card-image';
      imageWrap.append(...imageCell.childNodes);
      li.append(imageWrap);
    }

    const body = document.createElement('div');
    body.className = 'cards-card-body';
    body.append(...bodyCell.childNodes);

    // A paragraph that only holds bold text becomes the card title
    const titleP = [...body.querySelectorAll('p')].find(
      (p) => p.children.length === 1 && p.firstElementChild.tagName === 'STRONG'
        && p.textContent.trim() === p.firstElementChild.textContent.trim(),
    );
    if (titleP) {
      const h3 = document.createElement('h3');
      h3.textContent = titleP.textContent.trim();
      titleP.replaceWith(h3);
    }

    // Bullets are tags
    body.querySelectorAll('ul').forEach((ul) => ul.classList.add('cards-tags'));

    li.append(body);
    list.append(li);
  });

  // Optimised, responsive images
  list.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]),
    );
  });

  block.replaceChildren(list);
}
