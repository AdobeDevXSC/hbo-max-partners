import { createModal } from '../modal/modal.js';
import { fetchPlaceholders, loadCSS } from '../../scripts/aem.js';

/*
  Region / language selector, modeled on the Adobe.com "Choose your region" modal.
  Not a traditional authored block: the trigger is injected into the footer via
  addRegionTrigger(), and clicking it opens a modal built with the shared
  createModal() helper. openRegionModal() is also exported for reuse elsewhere
  (e.g. a nav link).

  Region display names are endonyms (native spelling) and are intentionally the
  same regardless of the current page language — this mirrors how region pickers
  work across localized sites.
*/

const GLOBE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5" />
  <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3z"
    fill="none" stroke="currentColor" stroke-width="1.5" />
</svg>`;

/**
 * Region groups and their available localized destinations.
 * `path` is the region home (first two URL segments: /<region>/<language>/).
 */
const REGION_GROUPS = [
  {
    heading: 'Americas',
    regions: [
      { label: 'United States', path: '/us/en/' },
      { label: 'Estados Unidos - Español', path: '/us/es/' },
      { label: 'México', path: '/mx/es/' },
    ],
  },
  {
    heading: 'Europe, Middle East and Africa',
    regions: [
      { label: 'Deutschland', path: '/de/de/' },
      { label: 'France', path: '/fr/fr/' },
      { label: 'Schweiz', path: '/ch/de/' },
      { label: 'Suisse - Français', path: '/ch/fr/' },
    ],
  },
  {
    heading: 'Asia Pacific',
    regions: [
      { label: '中国', path: '/cn/zh-hans/' },
      { label: 'India', path: '/in/hi/' },
      { label: '日本', path: '/jp/ja/' },
    ],
  },
];

/**
 * Loads this block's stylesheet once (the trigger and modal are injected
 * dynamically, so EDS won't auto-load it).
 * @returns {Promise<void>}
 */
function loadStyles() {
  return loadCSS(`${window.hlx.codeBasePath}/blocks/region-selector/region-selector.css`);
}

/**
 * Locale prefix for the current page, without a trailing slash. Handles both the
 * region/language structure (/us/en -> "/us/en") and legacy flat locales
 * (/en -> "/en"). Returns '' at the site root.
 * @returns {string}
 */
function getLocalePrefix() {
  const [region, language] = window.location.pathname.split('/').filter(Boolean);
  if (region && language) return `/${region}/${language}`;
  if (region) return `/${region}`;
  return '';
}

/**
 * The current region path prefix from the URL (/<region>/<language>/), used to
 * mark the active destination. Returns '' when it can't be determined.
 * @returns {string}
 */
function getCurrentRegionPath() {
  const [region, language] = window.location.pathname.split('/').filter(Boolean);
  return region && language ? `/${region}/${language}/` : '';
}

/**
 * Builds the modal body: heading, description, and grouped region links.
 * @param {{title: string, description: string}} labels localized UI strings
 * @returns {HTMLElement}
 */
function buildContent(labels) {
  const current = getCurrentRegionPath();

  const container = document.createElement('div');
  container.className = 'region-selector';

  const title = document.createElement('h2');
  title.className = 'region-selector-title';
  title.textContent = labels.title;
  container.append(title);

  const description = document.createElement('p');
  description.className = 'region-selector-description';
  description.textContent = labels.description;
  container.append(description);

  const groups = document.createElement('div');
  groups.className = 'region-selector-groups';

  REGION_GROUPS.forEach((group) => {
    const col = document.createElement('div');
    col.className = 'region-selector-group';

    const heading = document.createElement('h3');
    heading.className = 'region-selector-group-heading';
    heading.textContent = group.heading;
    col.append(heading);

    const list = document.createElement('ul');
    group.regions.forEach((region) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'region-selector-link';
      link.href = region.path;
      link.textContent = region.label;
      if (region.path === current) {
        link.setAttribute('aria-current', 'true');
        link.classList.add('is-current');
      }
      item.append(link);
      list.append(item);
    });

    col.append(list);
    groups.append(col);
  });

  container.append(groups);
  return container;
}

/**
 * Loads localized UI labels for the picker, with English fallbacks.
 * @returns {Promise<{trigger: string, title: string, description: string}>}
 */
async function getLabels() {
  const prefix = getLocalePrefix();
  const placeholders = await fetchPlaceholders(prefix || 'default');
  return {
    trigger: placeholders.changeRegion || 'Change region',
    title: placeholders.chooseYourRegion || 'Choose your region',
    description: placeholders.regionDescription
      || 'Selecting a region changes the language and/or content.',
  };
}

/**
 * Opens the "Choose your region" modal.
 * @returns {Promise<void>}
 */
export async function openRegionModal() {
  await loadStyles();
  const labels = await getLabels();
  const content = buildContent(labels);
  const { block, showModal } = await createModal([content]);
  const dialog = block.querySelector('dialog');
  if (dialog) {
    dialog.classList.add('region-selector-modal');
    dialog.setAttribute('aria-label', labels.title);
  }
  showModal();
}

/**
 * Injects a globe "Change region" trigger into a footer element.
 * @param {Element} footer the footer container to append the trigger to
 */
export async function addRegionTrigger(footer) {
  if (!footer || footer.querySelector('.region-selector-trigger')) return;
  await loadStyles();
  const { trigger: label } = await getLabels();

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'region-selector-trigger';
  trigger.innerHTML = `${GLOBE_ICON}<span>${label}</span>`;
  trigger.addEventListener('click', openRegionModal);

  const wrapper = document.createElement('div');
  wrapper.className = 'region-selector-trigger-wrapper';
  wrapper.append(trigger);
  footer.append(wrapper);
}

/**
 * Authored-block entry point: renders a standalone "Change region" trigger.
 * @param {Element} block
 */
export default async function decorate(block) {
  block.textContent = '';
  await addRegionTrigger(block);
}
