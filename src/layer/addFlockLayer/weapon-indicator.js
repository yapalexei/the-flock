/** Small HUD label showing which weapon the "s" key has selected. */
export default function createWeaponIndicator() {
  const element = document.createElement('div');
  element.className = 'weapon-indicator';
  document.body.appendChild(element);

  function update(torpedoesArmed) {
    element.textContent = torpedoesArmed ? 'TORPEDOES ARMED  [S] lasers' : 'Lasers  [S] arm torpedoes';
    element.classList.toggle('is-armed', torpedoesArmed);
  }
  update(false);

  return { update, remove: () => element.remove() };
}
