/**
 * Decorates the page title and its introductory copy.
 * @param {Element} block The page header block
 */
export default function decorate(block) {
  const title = block.querySelector('h1');
  if (title) title.classList.add('page-header-title');

  block.querySelectorAll('p').forEach((paragraph) => {
    paragraph.classList.add('page-header-description');
  });
}
