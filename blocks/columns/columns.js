/**
 * Columns block — matches the Google Docs format:
 * Table "Columns", one or more rows, each row = 2+ cells (text and/or image).
 */
export default function decorate(block) {
  const firstRow = block.firstElementChild;
  if (!firstRow) return;

  block.classList.add(`columns-${firstRow.children.length}-cols`);

  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (!pic) return;

      const wrapper = pic.closest('p') || pic.parentElement;
      // Cell that only holds an image gets the image styling
      if (wrapper.children.length === 1 && col.textContent.trim() === '') {
        col.classList.add('columns-img-col');
      }
    });
  });
}
