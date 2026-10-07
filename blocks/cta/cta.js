/**
 * CTA block — matches the Google Docs format:
 * Table "CTA", ONE cell: H2 heading, short text, bold link (button).
 */
export default function decorate(block) {
  // Lets the CSS style the full-width band behind the block
  block.closest('.section')?.classList.add('cta-container');

  const cell = block.querySelector(':scope > div > div');
  if (!cell) return;
  cell.classList.add('cta-content');

  // Fallback if the global button decoration did not run on this link
  cell.querySelectorAll('p > strong > a, p > em > a').forEach((a) => {
    const p = a.closest('p');
    if (!p.classList.contains('button-container')) {
      const isPrimary = a.parentElement.tagName === 'STRONG';
      a.classList.add('button', isPrimary ? 'primary' : 'secondary');
      p.classList.add('button-container');
      p.replaceChildren(a);
    }
  });
}
