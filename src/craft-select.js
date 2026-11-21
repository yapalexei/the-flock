import { crafts, MAX_SHIELD } from './layer/addFlockLayer/crafts';

const STATS = [
  { key: 'speed', label: 'Speed', max: 10 },
  { key: 'agility', label: 'Agility', max: 10 },
  { key: 'shield', label: 'Shields', max: MAX_SHIELD },
];

const statRow = ({ key, label }) => `
  <div class="cs-stat">
    <span class="cs-stat__label">${label}</span>
    <span class="cs-stat__bar" role="meter" aria-label="${label}" data-stat="${key}"><i></i></span>
    <span class="cs-stat__value" data-value="${key}"></span>
  </div>`;

const craftOption = (craft) => `
  <label class="cs-option">
    <input type="radio" name="craft" value="${craft.id}">
    <img src="${craft.image}" alt="">
    <span class="cs-option__name">${craft.name}</span>
    <span class="cs-option__role">${craft.role}</span>
  </label>`;

/**
 * Shows the craft picker over `blur` (the map container, blurred and inert while open).
 * Resolves with the chosen craft once the player presses "Start!".
 * `initialId` preselects a craft; `title` replaces the heading.
 */
export default function selectCraft({ blur, initialId, title = 'Choose your craft' }) {
  const initial = crafts.find((c) => c.id === initialId) || crafts[0];
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'cs-overlay';
    overlay.innerHTML = `
      <form class="cs-card" role="dialog" aria-modal="true" aria-labelledby="cs-title">
        <h1 id="cs-title"></h1>
        <div class="cs-body">
          <div class="cs-list" role="radiogroup" aria-label="Spacecraft">
            ${crafts.map(craftOption).join('')}
          </div>
          <section class="cs-detail" aria-live="polite">
            <img class="cs-detail__image" alt="">
            <h2 class="cs-detail__name"></h2>
            <p class="cs-detail__role"></p>
            ${STATS.map(statRow).join('')}
            <p class="cs-detail__weapons"></p>
          </section>
        </div>
        <button type="submit" class="cs-start">Start!</button>
      </form>`;

    const form = overlay.querySelector('form');
    const $ = (selector) => overlay.querySelector(selector);
    $('#cs-title').textContent = title;

    const show = (craft) => {
      const image = $('.cs-detail__image');
      image.src = craft.image;
      $('.cs-detail__name').textContent = craft.name;
      $('.cs-detail__role').textContent = craft.role;
      $('.cs-detail__weapons').textContent = `Weapons: ${craft.weapons}`;
      STATS.forEach(({ key, max }) => {
        const bar = $(`[data-stat="${key}"]`);
        bar.setAttribute('aria-valuemin', 0);
        bar.setAttribute('aria-valuemax', max);
        bar.setAttribute('aria-valuenow', craft[key]);
        bar.firstElementChild.style.width = `${(craft[key] / max) * 100}%`;
        $(`[data-value="${key}"]`).textContent = craft[key];
      });
    };

    const selected = () => crafts.find((c) => c.id === form.elements.craft.value);

    form.addEventListener('change', () => show(selected()));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const craft = selected();
      overlay.remove();
      blur.classList.remove('is-blurred');
      blur.inert = false;
      resolve(craft);
    });

    blur.classList.add('is-blurred');
    blur.inert = true;
    document.body.appendChild(overlay);
    show(initial);
    form.elements.craft.value = initial.id;
    overlay.querySelector('input:checked').focus();
  });
}
