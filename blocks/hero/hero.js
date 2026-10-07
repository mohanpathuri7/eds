/**
 * Hero block — matches the Google Docs format:
 * Table "Hero", ONE row, ONE cell:
 *   picture, [eyebrow paragraph], H1, description, buttons
 * Desktop: text left, picture right. Mobile: picture on top.
 */
export default function decorate(block) {
  const cell = block.querySelector(':scope > div > div');
  if (!cell) return;

  const picture = cell.querySelector('picture');
  const pictureP = picture?.closest('p') || picture;

  // Media wrapper
  const media = document.createElement('div');
  media.className = 'hero-media';
  if (picture) media.append(picture);
  if (pictureP && pictureP !== picture && !pictureP.children.length) pictureP.remove();

  // Content wrapper = everything else in the cell
  const content = document.createElement('div');
  content.className = 'hero-content';
  content.append(...cell.childNodes);

  // Paragraph directly before the H1 (plain text, no link) = eyebrow
  const h1 = content.querySelector('h1');
  const prev = h1?.previousElementSibling;
  if (prev && prev.tagName === 'P' && !prev.querySelector('a, picture')) {
    prev.classList.add('hero-eyebrow');
  }

  cell.replaceChildren(content, media);

  // Hero image is the LCP element
  const img = media.querySelector('img');
  if (img) {
    img.loading = 'eager';
    img.setAttribute('fetchpriority', 'high');
  }
}
