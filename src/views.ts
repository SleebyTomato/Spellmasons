import {
  containerCharacterSelect,
  addPixiContainersForView,
  recenterStage,
  resizePixi,
} from './PixiUtils';
import * as Units from './units';
import { UnitSubType } from './commonTypes';
import { MESSAGE_TYPES } from './MessageTypes';
import * as Image from './Image';
import { createUpgradeElement, generateUpgrades } from './Upgrade';
import {
  clickHandler,
  contextmenuHandler,
  endTurnBtnListener,
  keydownListener,
  keyupListener,
  mousemoveHandler,
} from './ui/eventListeners';

// A view is not shared between players in the same game, a player could choose any view at any time
export enum View {
  Menu,
  Setup,
  CharacterSelect,
  Game,
  Upgrade,
}
let lastNonMenuView: View | undefined;
function closeMenu() {
  // Change to the last non menu view
  if (lastNonMenuView) {
    setView(lastNonMenuView);
  } else {
    console.log('Cannot close menu yet, no previous view to change to.');
  }

}
// Make 'closeMenu' available to the svelte menu
window.closeMenu = closeMenu;
export function toggleMenu() {
  console.log('toggle menu');
  const elMenu = document.getElementById('menu') as HTMLElement;
  const menuClosed = elMenu.classList.contains('hidden');
  if (menuClosed) {
    // Open it
    setView(View.Menu);
  } else {
    closeMenu();
  }

}
// The "View" is what the client is looking at
// No gamelogic should be executed inside setView
// including setup.
export function setView(v: View) {
  console.log('setView(', View[v], ')');
  for (let view of Object.keys(View)) {
    document.body.classList.remove(`view-${view}`);
  }
  document.body.classList.add(`view-${View[v]}`);
  window.view = v;
  addPixiContainersForView(v);
  recenterStage();
  const elMenu = document.getElementById('menu') as HTMLElement;
  if (v !== View.Menu) {
    elMenu.classList.add('hidden');
    lastNonMenuView = v;
  }
  const elUpgradePicker = document.getElementById('upgrade-picker');
  // Hide the upgrade picker when the view changes
  elUpgradePicker && elUpgradePicker.classList.remove('active');
  switch (v) {
    case View.Menu:
      elMenu.classList.remove('hidden');
      break;
    case View.CharacterSelect:
      // Host or join a game brings client to Character select
      Object.values(Units.allUnits)
        .filter(
          (unitSource) =>
            unitSource.info.subtype === UnitSubType.PLAYER_CONTROLLED,
        )
        .forEach((unitSource, index) => {
          const image = Image.create(
            0,
            0,
            unitSource.info.image,
            containerCharacterSelect,
          );
          Image.setPosition(image, index * image.sprite.width, 0)
          image.sprite.interactive = true;
          image.sprite.on('click', () => {
            // Timeout prevents click from propagating into overworld listener
            // for some reason e.stopPropagation doesn't work :/
            setTimeout(() => {
              clientChooseUnit(unitSource.id);
            }, 0);
          });
        });
      break;
    case View.Upgrade:
      const elUpgradePickerContent = document.getElementById(
        'upgrade-picker-content',
      );
      if (!elUpgradePicker || !elUpgradePickerContent) {
        console.error('elUpgradePicker or elUpgradePickerContent are undefined.');
      }
      // Reveal the upgrade picker
      elUpgradePicker && elUpgradePicker.classList.add('active');
      const player = window.underworld.players.find(
        (p) => p.clientId === window.clientId,
      );
      if (player) {
        const upgrades = generateUpgrades(player);
        const elUpgrades = upgrades.map((upgrade) =>
          createUpgradeElement(upgrade, player),
        );
        if (elUpgradePickerContent) {
          elUpgradePickerContent.innerHTML = '';
          for (let elUpgrade of elUpgrades) {
            elUpgradePickerContent.appendChild(elUpgrade);
          }
        }
      } else {
        console.error('Upgrades cannot be generated, player not found');
      }
      break;
    case View.Game:
      resizePixi();
      addUnderworldEventListeners();
      break;
    default:
      console.error('Cannot set view to', v, 'no such view exists or is not configured');
      break;
  }
}

function clientChooseUnit(unitId: string) {
  // Cleanup container
  containerCharacterSelect.removeChildren();

  // Queue asking for the gamestate
  // from the other players.
  // The reason sending game state is queued and not sent immediately
  // is that if there's a game in progress you don't want to send the
  // state in the middle of an action (which could cause desyncs for
  // code that depends on promises such as resolveDoneMoving)
  console.log("Setup: JOIN_GAME: Ask for latest gamestate from other players")
  window.pie.sendData({
    type: MESSAGE_TYPES.JOIN_GAME,
    unitId
  });
  // Now that user has selected a character, they can enter the game
  setView(View.Game);
}

const menuBtnId = 'menuBtn';
const endTurnBtnId = 'end-turn-btn';
function addUnderworldEventListeners() {
  // Add keyboard shortcuts
  window.addEventListener('keydown', keydownListener);
  window.addEventListener('keyup', keyupListener);
  document.body.addEventListener('contextmenu', contextmenuHandler);
  document.body.addEventListener('click', clickHandler);
  document.body.addEventListener('mousemove', mousemoveHandler);
  // Add button listeners
  const elEndTurnBtn: HTMLButtonElement = document.getElementById(
    endTurnBtnId,
  ) as HTMLButtonElement;
  elEndTurnBtn.addEventListener('click', endTurnBtnListener);
  const elMenuBtn: HTMLButtonElement = document.getElementById(
    menuBtnId,
  ) as HTMLButtonElement;
  elMenuBtn.addEventListener('click', toggleMenu);
  console.log('add event listeners', elMenuBtn);
}

function removeUnderworldEventListeners() {
  // Remove keyboard shortcuts
  window.removeEventListener('keydown', keydownListener);
  window.removeEventListener('keyup', keyupListener);
  // Remove mouse and click listeners
  document.body.removeEventListener('contextmenu', contextmenuHandler);
  document.body.removeEventListener('click', clickHandler);
  document.body.removeEventListener('mousemove', mousemoveHandler);
  // Remove button listeners
  const elEndTurnBtn: HTMLButtonElement = document.getElementById(
    endTurnBtnId,
  ) as HTMLButtonElement;
  elEndTurnBtn.removeEventListener('click', endTurnBtnListener);
  const elMenuBtn: HTMLButtonElement = document.getElementById(
    menuBtnId,
  ) as HTMLButtonElement;
  elMenuBtn.removeEventListener('click', toggleMenu);
}