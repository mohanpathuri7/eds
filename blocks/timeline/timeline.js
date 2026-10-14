/**
 * Timeline block — matches the Google Docs format:
 * Table "Timeline", one row per role: [date | bold title + bullet list]
 */
export default function decorate(block) {
  const list = document.createElement('ol');
  const titleLevel = block.closest('.section')
    ?.querySelector(':scope > .default-content-wrapper h2') ? 3 : 2;

  [...block.children].forEach((row) => {
    const [dateCell, bodyCell] = row.children;
    const li = document.createElement('li');

    const date = document.createElement('p');
    date.className = 'timeline-date';
    date.textContent = dateCell?.textContent.trim() || '';

    const body = document.createElement('div');
    body.className = 'timeline-body';
    if (bodyCell) body.append(...bodyCell.childNodes);

    // A paragraph that only holds bold text becomes the role title
    const titleP = [...body.querySelectorAll('p')].find(
      (p) => p.children.length === 1 && p.firstElementChild.tagName === 'STRONG'
        && p.textContent.trim() === p.firstElementChild.textContent.trim(),
    );
    if (titleP) {
      const heading = document.createElement(`h${titleLevel}`);
      heading.textContent = titleP.textContent.trim();
      titleP.replaceWith(heading);
    }

    li.append(date, body);
    list.append(li);
  });

  block.replaceChildren(list);
}
