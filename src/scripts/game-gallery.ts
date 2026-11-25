const gallery = document.querySelector<HTMLElement>('[data-game-gallery]');

if (gallery) {
  const links = [...gallery.querySelectorAll<HTMLAnchorElement>('[data-gallery-image]')];
  const viewer = gallery.querySelector('dialog')!;
  const photo = viewer.querySelector<HTMLElement>('[data-gallery-photo]')!;
  const image = viewer.querySelector<HTMLImageElement>('[data-gallery-full]')!;
  const count = viewer.querySelector<HTMLElement>('[data-gallery-count]')!;
  const error = viewer.querySelector<HTMLElement>('[data-gallery-error]')!;
  const zoom = viewer.querySelector<HTMLButtonElement>('[data-gallery-zoom]')!;
  let opener: HTMLAnchorElement | undefined;
  let index = 0;
  let swipe: { id: number; x: number; y: number } | undefined;

  function resetZoom() {
    photo.removeAttribute('data-zoomed');
    image.style.removeProperty('width');
    image.style.removeProperty('height');
    zoom.setAttribute('aria-label', 'Phóng to ảnh');
    zoom.setAttribute('aria-pressed', 'false');
    photo.scrollTo(0, 0);
  }

  function show(next: number) {
    index = (next + links.length) % links.length;
    resetZoom();
    error.hidden = true;
    zoom.disabled = true;
    image.hidden = false;
    image.alt = links[index].querySelector('img')!.alt;
    image.src = links[index].href;
    count.textContent = `${index + 1} / ${links.length}`;
  }

  for (const [position, link] of links.entries()) {
    if (typeof viewer.showModal !== 'function') break;
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      viewer.showModal();
      show(position);
    });
  }

  image.addEventListener('load', () => { zoom.disabled = false; });
  image.addEventListener('error', () => {
    image.hidden = true;
    error.hidden = false;
    zoom.disabled = true;
  });

  zoom.addEventListener('click', () => {
    if (photo.hasAttribute('data-zoomed')) {
      resetZoom();
      return;
    }
    const box = image.getBoundingClientRect();
    const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
    image.style.width = `${image.naturalWidth * scale * 2}px`;
    image.style.height = `${image.naturalHeight * scale * 2}px`;
    photo.setAttribute('data-zoomed', '');
    zoom.setAttribute('aria-label', 'Thu nhỏ ảnh');
    zoom.setAttribute('aria-pressed', 'true');
    photo.scrollTo((photo.scrollWidth - photo.clientWidth) / 2, (photo.scrollHeight - photo.clientHeight) / 2);
  });

  viewer.querySelector('[data-gallery-close]')!.addEventListener('click', () => viewer.close());
  viewer.querySelectorAll<HTMLButtonElement>('[data-gallery-step]').forEach((button) => {
    button.addEventListener('click', () => show(index + Number(button.dataset.galleryStep)));
  });

  viewer.addEventListener('keydown', (event) => {
    if (links.length < 2 || photo.hasAttribute('data-zoomed')) return;
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (step) {
      event.preventDefault();
      show(index + step);
    }
  });

  photo.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' && links.length > 1 && !photo.hasAttribute('data-zoomed')) {
      swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
  });
  photo.addEventListener('pointercancel', () => { swipe = undefined; });
  photo.addEventListener('pointerup', (event) => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = undefined;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
  });

  viewer.addEventListener('close', () => {
    resetZoom();
    swipe = undefined;
    opener?.focus({ preventScroll: true });
  });
}
