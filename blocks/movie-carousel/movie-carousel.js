import { createModal } from '../modal/modal.js';
import { fetchPlaceholders } from '../../scripts/aem.js';

const PLAY_ICON = `<svg class="movie-card-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1.5" />
  <path d="M10 8.5 16 12l-6 3.5z" fill="currentColor" />
</svg>`;

const CHEVRON_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/**
 * First path segment of the URL, used as the locale (e.g. /es/... -> "es").
 * @returns {string} locale segment, or '' if none
 */
function getLocale() {
  return window.location.pathname.split('/').filter(Boolean)[0] || '';
}

/**
 * Resolves the locale sheet from the URL path, falling back to `en`.
 * @param {object} workbook Parsed multi-sheet JSON
 * @returns {string} the sheet name to read
 */
function resolveSheet(workbook) {
  const locale = getLocale();
  if (locale && workbook[locale] && Array.isArray(workbook[locale].data)) {
    return locale;
  }
  return 'en';
}

/**
 * Pulls the rows for the current locale out of the workbook (en fallback),
 * filtered to those flagged to show, preserving sheet order.
 * @param {object} workbook Parsed JSON (multi-sheet or single-sheet)
 * @returns {Array<object>} movie rows to render
 */
function getRows(workbook) {
  let rows = [];
  if (Array.isArray(workbook.data)) {
    // single-sheet workbook
    rows = workbook.data;
  } else {
    const sheet = resolveSheet(workbook);
    rows = (workbook[sheet] && workbook[sheet].data) || (workbook.en && workbook.en.data) || [];
  }
  return rows.filter((row) => String(row.show).trim().toUpperCase() === 'TRUE');
}

/**
 * Builds a YouTube/Vimeo/file video embed that autoplays.
 * Mirrors the logic in blocks/video/video.js.
 * @param {string} href The video URL
 * @returns {HTMLElement} wrapper holding the embed
 */
function createVideoEmbed(href) {
  const wrapper = document.createElement('div');
  wrapper.className = 'movie-carousel-video';

  let url;
  try {
    url = new URL(href);
  } catch (e) {
    return wrapper;
  }

  const isYoutube = href.includes('youtube') || href.includes('youtu.be');
  const isVimeo = href.includes('vimeo');

  if (isYoutube) {
    let vid = new URLSearchParams(url.search).get('v') || '';
    if (url.hostname.includes('youtu.be')) [, vid] = url.pathname.split('/');
    wrapper.innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(vid)}?rel=0&autoplay=1"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
      allowfullscreen title="Trailer" loading="lazy"></iframe>`;
  } else if (isVimeo) {
    const [, vid] = url.pathname.split('/');
    wrapper.innerHTML = `<iframe src="https://player.vimeo.com/video/${encodeURIComponent(vid)}?autoplay=1"
      allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Trailer" loading="lazy"></iframe>`;
  } else {
    const video = document.createElement('video');
    video.setAttribute('controls', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.src = href;
    wrapper.append(video);
  }

  return wrapper;
}

/**
 * Opens the trailer in the shared modal/lightbox.
 * @param {string} href video URL
 * @param {string} title used for the modal aria-label
 */
async function openTrailer(href, title) {
  const embed = createVideoEmbed(href);
  const { block, showModal } = await createModal([embed]);
  const dialog = block.querySelector('dialog');
  if (dialog) {
    dialog.classList.add('movie-carousel-modal');
    if (title) dialog.setAttribute('aria-label', `${title} trailer`);
  }
  showModal();
}

/**
 * Builds a single carousel slide for a movie row.
 * @param {object} movie row from the sheet
 * @param {{availableNow: string, watchTrailer: string, learnMore: string}} labels
 *   localized UI labels; a non-empty per-row videoLabel/ctaLabel overrides these
 * @returns {HTMLLIElement}
 */
function buildSlide(movie, labels) {
  const slide = document.createElement('li');
  slide.className = 'movie-carousel-slide';

  const card = document.createElement('article');
  card.className = 'movie-card';

  if (movie.posterImage) {
    const img = document.createElement('img');
    img.className = 'movie-card-poster';
    img.src = movie.posterImage;
    img.alt = movie.title || '';
    img.loading = 'lazy';
    card.append(img);
  }

  // "Available Now" badge (localized; uppercased + flare background via CSS).
  const badge = document.createElement('div');
  badge.className = 'movie-card-badge';
  badge.textContent = labels.availableNow;
  card.append(badge);

  // Hover content: category, description, optional button.
  const content = document.createElement('div');
  content.className = 'movie-card-content';

  if (movie.category) {
    const category = document.createElement('p');
    category.className = 'movie-card-category';
    category.textContent = movie.category;
    content.append(category);
  }

  if (movie.description) {
    const description = document.createElement('p');
    description.className = 'movie-card-description';
    description.textContent = movie.description;
    content.append(description);
  }

  // Button logic: video wins, else CTA, else none.
  const videoUrl = (movie.videoUrl || '').trim();
  const ctaUrl = (movie.ctaUrl || '').trim();

  if (videoUrl) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'movie-card-button movie-card-button-video';
    const label = document.createElement('span');
    label.textContent = (movie.videoLabel || '').trim() || labels.watchTrailer;
    button.append(label);
    button.insertAdjacentHTML('beforeend', PLAY_ICON);
    button.addEventListener('click', () => openTrailer(videoUrl, movie.title));
    content.append(button);
  } else if (ctaUrl) {
    const cta = document.createElement('a');
    cta.className = 'movie-card-button movie-card-button-cta';
    cta.href = ctaUrl;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
    cta.textContent = (movie.ctaLabel || '').trim() || labels.learnMore;
    content.append(cta);
  }

  card.append(content);
  slide.append(card);
  return slide;
}

/**
 * Distance (px) to advance per nav click: one card plus the inter-card gap.
 * @param {HTMLElement} track
 * @returns {number}
 */
function getStep(track) {
  const slide = track.querySelector('.movie-carousel-slide');
  if (!slide) return track.clientWidth;
  const styles = getComputedStyle(track);
  const gap = parseFloat(styles.columnGap || styles.gap) || 0;
  return slide.getBoundingClientRect().width + gap;
}

/**
 * Enables/disables the prev/next buttons based on scroll position.
 */
function updateNav(track, prev, next) {
  const maxScroll = track.scrollWidth - track.clientWidth;
  prev.disabled = track.scrollLeft <= 1;
  next.disabled = track.scrollLeft >= maxScroll - 1;
}

export default async function decorate(block) {
  // The block's authored cell holds a link to the sheet JSON.
  const link = block.querySelector('a[href]');
  const dataUrl = link ? link.href : '/new-movies.json';

  let workbook;
  try {
    // Fetch same-origin by path so it works on localhost, preview, live, and prod.
    const { pathname, search } = new URL(dataUrl, window.location.origin);
    const resp = await fetch(`${pathname}${search}`);
    if (!resp.ok) throw new Error(`Failed to fetch ${pathname}: ${resp.status}`);
    workbook = await resp.json();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('movie-carousel: could not load data', error);
    block.textContent = '';
    return;
  }

  const movies = getRows(workbook);
  block.textContent = '';
  if (!movies.length) return;

  // Localized UI labels from per-locale placeholders (with fallbacks).
  // Per-row videoLabel/ctaLabel override these when set.
  const locale = getLocale();
  const placeholders = await fetchPlaceholders(locale ? `/${locale}` : 'default');
  const labels = {
    availableNow: placeholders.availableNow || 'Available Now',
    watchTrailer: placeholders.watchTrailer || 'Watch Trailer',
    learnMore: placeholders.learnMore || 'Learn More',
  };

  const track = document.createElement('ul');
  track.className = 'movie-carousel-track';
  movies.forEach((movie) => track.append(buildSlide(movie, labels)));

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'movie-carousel-nav movie-carousel-prev';
  prev.setAttribute('aria-label', 'Previous');
  prev.innerHTML = CHEVRON_ICON;

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'movie-carousel-nav movie-carousel-next';
  next.setAttribute('aria-label', 'Next');
  next.innerHTML = CHEVRON_ICON;

  prev.addEventListener('click', () => track.scrollBy({ left: -getStep(track), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: getStep(track), behavior: 'smooth' }));

  let ticking = false;
  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateNav(track, prev, next);
      ticking = false;
    });
  });

  block.append(prev, track, next);

  // Recompute nav state once layout/CSS has settled, and on every resize.
  // (Fires after the initial layout, avoiding a race where the row isn't yet measurable.)
  const resizeObserver = new ResizeObserver(() => updateNav(track, prev, next));
  resizeObserver.observe(track);

  // scroll-snap can nudge scrollLeft after layout; recompute once it settles.
  setTimeout(() => updateNav(track, prev, next), 80);
}
