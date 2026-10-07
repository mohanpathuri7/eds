/**
 * Stats block — matches the Google Docs format:
 * Table "Stats", one row per stat: [number | label]
 */
export default function decorate(block) {
  // Lets the CSS style the full-width band behind the block
  block.closest('.section')?.classList.add('stats-container');

  const list = document.createElement('ul');

  [...block.children].forEach((row) => {
    const [numberCell, labelCell] = row.children;
    const li = document.createElement('li');

    const number = document.createElement('span');
    number.className = 'stats-number';
    number.textContent = numberCell?.textContent.trim() || '';

    const label = document.createElement('span');
    label.className = 'stats-label';
    label.textContent = labelCell?.textContent.trim() || '';

    li.append(number, label);
    list.append(li);
  });

  block.replaceChildren(list);
}
