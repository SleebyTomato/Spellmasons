// set window defaults, must be called before setupAll()
import * as Unit from './entity/Unit';
import { setView, View } from './views';
import * as readyState from './readyState';
import { setupPixi } from './graphics/PixiUtils';
import * as Cards from './cards';
import * as Units from './entity/units';
import { initPlanningView } from './graphics/PlanningView';
import { setupAudio, playNextSong, playSFX, playSFXKey, sfx } from './Audio';
import cookieConsentPopup from './cookieConsent';
import { setupMonitoring } from './monitoring';
import * as storage from './storage';
import { version } from '../package.json';
import { Faction, UnitType } from './types/commonTypes';
import * as Vec from './jmath/Vec';
globalThis.SPELLMASONS_PACKAGE_VERSION = version;
import './style.css';
cookieConsentPopup(false);


// This import is critical so that the svelte menu has access to
// the pie globals
import './network/wsPieSetup';
import { ENEMY_ENCOUNTERED_STORAGE_KEY } from './config';
import { MESSAGE_TYPES } from './types/MessageTypes';
import { typeGuardHostApp } from './network/networkUtil';

const YES = 'yes'
const SKIP_TUTORIAL = 'skipTutorial';

// Globalize injected Audio functions
globalThis.playNextSong = playNextSong;
globalThis.playSFX = playSFX;
globalThis.playSFXKey = playSFXKey;
globalThis.sfx = sfx;

globalThis.playerWalkingPromise = Promise.resolve();
globalThis.predictionUnits = [];
globalThis.attentionMarkers = [];
globalThis.resMarkers = [];
globalThis.devMode = location.href.includes('localhost');
globalThis.zoomTarget = 1.3;
// If the code in main runs this is NOT a headless instance, main.ts is the entrypoint for
// the regular game with graphics and audio
globalThis.headless = false;
globalThis.isHost = () => {
  // isHost only if playing singleplayer, otherwise the headless hostApp is the host
  // and this file is the entry point to the non-headless client so it will never be the
  // hostApp
  return typeGuardHostApp(globalThis.pie) ? true : globalThis.pie.soloMode;
}
if (globalThis.devMode) {
  console.log('ADMIN: devMode = true! Character and upgrades will be picked automatically. Animations are sped up');
}

setupAll();

function setupAll() {
  // Start monitoring with development overlay
  setupMonitoring();

  setupAudio();


  // Initialize Assets
  console.log("Setup: Loading Pixi assets...")
  setupPixi().then(() => {
    readyState.set('pixiAssets', true);
    console.log("Setup: Done loading Pixi assets.")
    // Initialize content
    Cards.registerCards();
    Units.registerUnits();
    readyState.set("content", true);
    initPlanningView();
    // if (storage.get(SKIP_TUTORIAL) === YES) {
    globalThis.setMenu?.('PLAY');
    setView(View.Menu);
    globalThis.tryAutoConnect?.();
    // } else {
    //   globalThis.setMenu('TUTORIAL');
    //   startTutorial();
    // }
  }).catch(e => {
    console.error('Setup: Failed to setup pixi', e);
  });

  const elMenu = document.getElementById('menu');
  if (elMenu) {
    // Reveal the menu now that the global variables needed by svelte are set.
    elMenu.classList.add('ready');

  } else {
    // This should never happen
    console.error('Cannot find "menu" element in DOM');
  }

  // Set UI version info
  const elVersionInfo = document.getElementById('version-info')
  if (elVersionInfo && globalThis.SPELLMASONS_PACKAGE_VERSION) {
    elVersionInfo.innerText = `Alpha v${globalThis.SPELLMASONS_PACKAGE_VERSION}\nGraphics may not be final`;
  }
}

// For development, spawns a unit near the player
globalThis.devSpawnUnit = (unitId: string, faction: Faction = Faction.ENEMY) => {
  if (globalThis.player) {
    const coords = underworld.findValidSpawn(globalThis.player.unit, 5)
    const sourceUnit = Units.allUnits[unitId];
    if (coords && sourceUnit) {
      Unit.create(
        unitId,
        // Start the unit at the summoners location
        coords.x,
        coords.y,
        // A unit always summons units in their own faction
        faction,
        sourceUnit.info.image,
        UnitType.AI,
        sourceUnit.info.subtype,
        1,
        sourceUnit.unitProps,
        underworld
      );
    }

  }
}
globalThis.setMMBDown = (isDown: boolean) => {
  // This is the ONLY place that MMBDown should be mutated.
  globalThis.MMBDown = isDown;
  document.body?.classList.toggle('draggingCamera', globalThis.MMBDown);
}
globalThis.setRMBDown = (isDown: boolean) => {
  // This is the ONLY place that RMBDown should be mutated.
  globalThis.RMBDown = isDown;
  // Now that player has stopped moving notify multiplayer clients that player has moved
  if (globalThis.player) {
    globalThis.pie.sendData({
      type: MESSAGE_TYPES.MOVE_PLAYER,
      ...Vec.clone(globalThis.player.unit),
    });
  } else {
    console.error('Cannot send MOVE_PLAYER, globalThis.player is undefined')
  }
  // Reset notifiedOutOfStamina so that when RMB is pressed again, if the 
  // player is out of stamina it will notify them
  globalThis.notifiedOutOfStamina = false;
}
globalThis.skipTutorial = () => {
  storage.set(SKIP_TUTORIAL, YES);
}
globalThis.enemyEncountered = JSON.parse(storage.get(ENEMY_ENCOUNTERED_STORAGE_KEY) || '[]');
console.log('Setup: initializing enemyEncountered as', globalThis.enemyEncountered);

globalThis.showDebug = false;

// Prevent accidental back button only when not in devMode
// In devMode, lots of refreshing happens so it's annoying when it
// asks "are you sure?" every time
if (!globalThis.devMode) {
  globalThis.onbeforeunload = function () { return "Are you sure you want to quit?"; };
}