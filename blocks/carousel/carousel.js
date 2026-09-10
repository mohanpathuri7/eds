export default function decorate(block) {
  const slides = [...block.children];
  let current = 0;

  // Create viewport
  const viewport = document.createElement('div');
  viewport.className = 'carousel-viewport';

  const track = document.createElement('div');
  track.className = 'carousel-track';

  slides.forEach((slide) => {
    slide.classList.add('carousel-slide');

    // Wrap text inside container
    const text = slide.children[1];

    if (text) {
      const container = document.createElement('div');
      container.className = 'carousel-content';

      while (text.firstChild) {
        container.append(text.firstChild);
      }

      text.append(container);
    }

    track.append(slide);
  });

  viewport.append(track);
  block.innerHTML = '';
  block.append(viewport);

  // Prev Button
  const prev = document.createElement('button');
  prev.className = 'carousel-btn prev';
  prev.innerHTML = '<';

  // Next Button
  const next = document.createElement('button');
  next.className = 'carousel-btn next';
  next.innerHTML = '>';

  block.append(prev, next);

  // Dots
  const dots = document.createElement('div');
  dots.className = 'carousel-dots';

  const update = () => {
    track.style.transform = `translateX(-${current * 100}%)`;

    dots.querySelectorAll('.carousel-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === current);
    });
  };

  slides.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';

    dot.addEventListener('click', () => {
      current = index;
      update();
    });

    dots.append(dot);
  });

  block.append(dots);

  next.addEventListener('click', () => {
    current = (current + 1) % slides.length;
    update();
  });

  prev.addEventListener('click', () => {
    current = (current - 1 + slides.length) % slides.length;
    update();
  });

  setInterval(() => {
    current = (current + 1) % slides.length;
    update();
  }, 5000);

  update();
}
