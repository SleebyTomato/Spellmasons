import { Spell, effect, getImage } from './Spell';
import * as config from './config';
import * as Unit from './Unit';
import * as Pickup from './Pickup';
import * as Player from './Player';
import type * as Upgrade from './Upgrade';
import * as math from './math';
import * as Card from './Card';
import Image from './Image';
import * as GameBoardInput from './ui/GameBoardInput';
import { MESSAGE_TYPES } from './MessageTypes';
import {
  addPixiSprite,
  app,
  containerBoard,
  containerSpells,
} from './PixiUtils';
import type { Random } from 'random';
import makeSeededRandom from './rand';
import floatingText from './FloatingText';
import { generateEnemy } from './EnemyUnit';
import type { Coords } from './commonTypes';
import { drawDangerOverlay } from './ui/UserInterface';
import { createUpgradeElement, generateUpgrades } from './Upgrade';

export enum game_state {
  Lobby,
  WaitingForPlayerReconnect,
  Playing,
  Upgrade,
  GameOver,
}
export enum turn_phase {
  PlayerTurns,
  NPC,
}
interface Bounds {
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
}
const elPlayerTurnIndicatorHolder = document.getElementById(
  'player-turn-indicator-holder',
);
const elPlayerTurnIndicator = document.getElementById('player-turn-indicator');
const elTurnTimeRemaining = document.getElementById('turn-time-remaining');
const elLevelIndicator = document.getElementById('level-indicator');
export default class Game {
  state: game_state;
  seed: string;
  random: Random;
  turn_phase: turn_phase;
  height: number = config.BOARD_HEIGHT;
  width: number = config.BOARD_WIDTH;
  players: Player.IPlayer[] = [];
  units: Unit.IUnit[] = [];
  pickups: Pickup.IPickup[] = [];
  // The number of the current level
  level = 1;
  // The index of which player's turn it is
  playerTurnIndex: number = 0;
  secondsLeftForTurn: number = config.SECONDS_PER_TURN;
  yourTurn: boolean;
  turnInterval: any;
  hostClientId: string;
  // A set of clientIds who have ended their turn
  // Being a Set prevents a user from ending their turn more than once
  endedTurn = new Set<string>();
  choseUpgrade = new Set<string>();
  constructor(seed: string) {
    window.game = this;
    this.seed = seed;
    this.random = makeSeededRandom(this.seed);
    this.setGameState(game_state.Lobby);

    // Make sprites for the board tiles
    let cell;
    for (let x = 0; x < config.BOARD_WIDTH; x++) {
      for (let y = 0; y < config.BOARD_HEIGHT; y++) {
        cell = addPixiSprite('images/tiles/ground.png', containerBoard);
        cell.x = x * config.CELL_SIZE;
        cell.y = y * config.CELL_SIZE;
      }
    }

    // Limit turn duration
    this.turnInterval = setInterval(() => {
      if (this.turn_phase === turn_phase.PlayerTurns) {
        this.secondsLeftForTurn--;
        if (this.secondsLeftForTurn <= 10) {
          elPlayerTurnIndicatorHolder.classList.add('low-time');
        }
        elTurnTimeRemaining.innerText = `0:${
          this.secondsLeftForTurn < 10
            ? '0' + this.secondsLeftForTurn
            : this.secondsLeftForTurn
        }`;
        // Skip your turn if you run out of time
        if (this.yourTurn && this.secondsLeftForTurn <= 0) {
          console.log('Out of time, turn ended');
          this.endMyTurn();
        }
      } else {
        elTurnTimeRemaining.innerText = '';
      }
    }, 1000);
  }
  cleanup() {
    clearInterval(this.turnInterval);
    for (let u of this.units) {
      u.image.cleanup();
    }
    for (let x of this.pickups) {
      x.image.cleanup();
    }
  }
  moveToNextLevel() {
    // Reset player turn index so all players can take their turns
    this.playerTurnIndex = 0;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      // Clear all remaining AI units
      if (u.unitType === Unit.UnitType.AI) {
        Unit.cleanup(u);
        this.units.splice(i, 1);
      }
    }
    for (let p of this.players) {
      Player.resetPlayerForNextLevel(p);
    }
    // Clear all pickups
    for (let p of this.pickups) {
      Pickup.removePickup(p);
    }
    this.level++;
    // Show text in center of screen for the new level
    floatingText({
      cellX: config.BOARD_WIDTH / 2 - 0.5,
      cellY: config.BOARD_HEIGHT / 2,
      text: `Level ${this.level}`,
      style: {
        fill: 'white',
        fontSize: '60px',
      },
    });
    this.initLevel();
    this.setGameState(game_state.Playing);
  }

  initLevel() {
    // Update level indicator UI at top of screen
    elLevelIndicator.innerText = `Level ${this.level}`;
    // Add cards to hand
    for (let p of this.players) {
      for (let i = 0; i < config.GIVE_NUM_CARDS_PER_LEVEL; i++) {
        const card = Card.generateCard();
        Card.addCardToHand(card, p);
      }
    }
    for (let i = 0; i < config.NUM_PICKUPS_PER_LEVEL; i++) {
      const coords = this.getRandomEmptyCell({ xMin: 2 });
      if (coords) {
        const randomPickupIndex = this.random.integer(
          0,
          Object.values(Pickup.pickups).length - 1,
        );
        const pickup = Pickup.pickups[randomPickupIndex];
        Pickup.create(
          coords.x,
          coords.y,
          true,
          pickup.imagePath,
          true,
          pickup.effect,
        );
      } else {
        console.error('Pickup not spawned due to no empty cells');
      }
    }
    const portalPickup = Pickup.specialPickups['images/portal.png'];
    Pickup.create(
      config.BOARD_WIDTH - 1,
      Math.floor(config.BOARD_HEIGHT / 2),
      false,
      portalPickup.imagePath,
      true,
      portalPickup.effect,
    );
    // Spawn units at the start of the level
    for (
      let i = 0;
      i < config.NUMBER_OF_UNITS_SPAWN_PER_LEVEL * this.level;
      i++
    ) {
      const coords = this.getRandomEmptyCell({ xMin: 2 });
      if (coords) {
        const sourceUnit = generateEnemy();
        const unit = Unit.create(
          coords.x,
          coords.y,
          sourceUnit.image,
          Unit.UnitType.AI,
          sourceUnit.subtype,
        );
        const roll = this.random.integer(0, 100);
        if (roll <= config.PERCENT_CHANCE_OF_HEAVY_UNIT) {
          unit.healthMax = 3;
          unit.health = unit.healthMax;
          unit.image.scale(1.0);
        }
      } else {
        console.error('Unit not spawned due to no empty cells');
      }
    }
  }
  checkPickupCollisions(unit: Unit.IUnit) {
    for (let pu of this.pickups) {
      if (unit.x == pu.x && unit.y == pu.y) {
        Pickup.triggerPickup(pu, unit);
      }
    }
  }
  getCellFromCurrentMousePos() {
    const { x, y } = containerBoard.toLocal(
      app.renderer.plugins.interaction.mouse.global,
    );
    return {
      x: Math.floor(x / config.CELL_SIZE),
      y: Math.floor(y / config.CELL_SIZE),
    };
  }
  goToNextPhaseIfAppropriate() {
    if (this.turn_phase === turn_phase.PlayerTurns) {
      // If all players that CAN take turns HAVE taken turns, then...
      if (
        this.endedTurn.size >=
        this.players.filter((p) => Player.ableToTakeTurn(p)).length
      ) {
        // Reset the endedTurn set so both players can take turns again next Cast phase
        this.endedTurn.clear();
        // Move onto next phase
        this.setTurnPhase(turn_phase.NPC);
      }
    }
  }
  setYourTurn(yourTurn: boolean, message: string) {
    elPlayerTurnIndicator.innerText = message;
    document.body.classList.toggle('your-turn', yourTurn);
    this.yourTurn = yourTurn;
    window.updateTurnAbilitiesLeft(this.players[this.playerTurnIndex]);
  }
  incrementPlayerTurn() {
    // Set current player actions used back to 0 now that their turn has ended
    const currentTurnPlayer = this.players[this.playerTurnIndex];
    // Reset action flags
    currentTurnPlayer.thisTurnSpellCast = false;

    // If there are players who are able to take their turn
    if (this.players.filter(Player.ableToTakeTurn).length) {
      // If there are players who are able to take their turns, increment to the next
      this.playerTurnIndex = (this.playerTurnIndex + 1) % this.players.length;
      const nextTurnPlayer = this.players[this.playerTurnIndex];
      // If this current player is able to take their turn...
      if (Player.ableToTakeTurn(nextTurnPlayer)) {
        this.secondsLeftForTurn = config.SECONDS_PER_TURN;
        elPlayerTurnIndicatorHolder.classList.remove('low-time');
        this.syncYourTurnState();
        this.goToNextPhaseIfAppropriate();
      } else {
        // otherwise, skip them
        this.incrementPlayerTurn();
      }
    } else {
      this.checkForEndOfLevel();
    }
  }
  syncYourTurnState() {
    if (this.players[this.playerTurnIndex].clientId === window.clientId) {
      this.setYourTurn(true, 'Your Turn');
      // In the event that it becomes your turn but the mouse hasn't moved,
      // syncMouseHoverIcon needs to be called so that the icon ("footprints" for example)
      // will be shown in the tile that the mouse is hovering over
      GameBoardInput.syncMouseHoverIcon();
    } else {
      this.setYourTurn(false, "Other Player's Turn");
    }
  }
  // Sends a network message to end turn
  endMyTurn() {
    // Turns can only be manually ended during the PlayerTurns phase
    if (this.turn_phase === turn_phase.PlayerTurns) {
      window.pie.sendData({ type: MESSAGE_TYPES.END_TURN });
    }
  }
  endPlayerTurn(clientId: string) {
    // Turns can only be ended when the game is in Playing state
    // and not, for example, in Upgrade state
    if (this.state === game_state.Playing) {
      const currentTurnPlayer = this.players[this.playerTurnIndex];
      if (!currentTurnPlayer.unit.thisTurnMoved) {
        // If the user didn't move and just ended their turn, decrement the frozen modifier
        // because it is meant to decrement every turn and it automatically decrements when they
        // try to move, but since they didn't, decrement it here.
        Unit.decrementModifier(currentTurnPlayer.unit, 'frozen');
      }
      // Ensure players can only end the turn when it IS their turn
      if (currentTurnPlayer.clientId === clientId) {
        this.endedTurn.add(clientId);
        this.incrementPlayerTurn();
      }
    }
  }
  chooseUpgrade(player: Player.IPlayer, upgrade: Upgrade.IUpgrade) {
    console.log(
      'TODO implement how the player is modified when an upgrade is added',
    );
    player.upgrades.push(upgrade);
    this.choseUpgrade.add(player.clientId);

    if (this.choseUpgrade.size >= this.players.length) {
      this.moveToNextLevel();
      this.choseUpgrade.clear();
    }
  }
  checkForEndOfLevel() {
    const areAllPlayersDead =
      this.players.filter((p) => p.unit.alive).length === 0;
    if (areAllPlayersDead) {
      this.setGameState(game_state.GameOver);
      return;
    }
    // Advance the level if all living players have entered the portal:
    const areAllLivingPlayersInPortal =
      this.players.filter((p) => p.unit.alive && p.inPortal).length ===
      this.players.filter((p) => p.unit.alive).length;
    if (areAllLivingPlayersInPortal) {
      // Now that level is complete, move to the Upgrade gamestate where players can choose upgrades
      // before moving on to the next level
      this.setGameState(game_state.Upgrade);
    }
  }
  // Clean up resources of dead units
  bringOutYerDead() {
    // Note: This occurs in the first phase so that "dead" units can animate to death
    // after they take mortally wounding damage without their html elements being removed before
    // the animation takes place
    for (let u of this.units) {
      // Remove dead, non-player character images
      if (!u.alive && u.unitType !== Unit.UnitType.PLAYER_CONTROLLED) {
        u.image.cleanup();
      }
    }
    // Remove dead units
    this.units = this.units.filter((u) => u.alive);
  }
  // Generate an array of cell coordinates in shuffled order
  // between optional boundaries
  _getShuffledCoordinates({ xMin, xMax, yMin, yMax }: Bounds): Coords[] {
    const numberOfIndices = config.BOARD_WIDTH * config.BOARD_HEIGHT;
    const indices: number[] = [];
    // Populate an array with the 1-dimentional indices of the board
    // so if the board is 2x2, the array will be [0,1,2,3]
    for (let i = 0; i < numberOfIndices; i++) {
      indices.push(i);
    }
    // Now randomly remove indicies from that array and add them to a new array
    const shuffledIndices: Coords[] = [];
    for (let i = 0; i < numberOfIndices; i++) {
      const metaIndex = this.random.integer(0, indices.length);
      // pull chosen index out of the indices array so that it wont be picked next loop
      const pluckedIndex = indices.splice(metaIndex, 1)[0];
      if (pluckedIndex === undefined) {
        continue;
      }
      const coords = math.indexToXY(pluckedIndex, config.BOARD_WIDTH);
      // If plucked index is not within specified bounds continue
      if (xMin !== undefined && coords.x < xMin) {
        continue;
      }
      if (xMax !== undefined && coords.x > xMax) {
        continue;
      }
      if (yMin !== undefined && coords.y < yMin) {
        continue;
      }
      if (yMax !== undefined && coords.y > yMax) {
        continue;
      }
      // If coordinates are within specified bounds, or if there are not specified bounds,
      // add it to the list of shuffled coordinates
      shuffledIndices.push(coords);
    }
    // Resulting in an array of shuffled indicies (e.g. [2,1,0,3])
    // This new array can now be used to randomly access cell coordinates
    // using (math.indexToXY) multiple times without getting the same index more than once
    return shuffledIndices;
  }
  _isCellEmpty({ x, y }: Coords): boolean {
    // Test for units in cell
    for (let u of this.units) {
      if (u.alive && u.x === x && u.y === y) {
        return false;
      }
    }
    // Test for pickups
    for (let u of this.pickups) {
      if (u.x === x && u.y === y) {
        return false;
      }
    }
    return true;
  }
  getRandomEmptyCell(bounds: Bounds): Coords | undefined {
    const shuffledCoords = this._getShuffledCoordinates(bounds);
    for (let coords of shuffledCoords) {
      const isEmpy = this._isCellEmpty(coords);
      // if cell if empty return the coords, if it's not loop to the next coords that may be empty
      if (isEmpy) {
        return coords;
      }
    }
    // Returns undefined if there are no empty cells
    return undefined;
  }
  canUnitMoveIntoCell(cellX: number, cellY: number): boolean {
    for (let u of this.units) {
      // If a living unit is obstructing, do not allow movement
      if (u.alive && u.x === cellX && u.y === cellY) {
        return false;
      }
    }
    return true;
  }
  setTurnPhase(p: turn_phase) {
    this.turn_phase = p;

    // Remove all phase classes from body
    for (let phaseClass of document.body.classList.values()) {
      if (phaseClass.includes('phase-')) {
        document.body.classList.remove(phaseClass);
      }
    }

    const phase = turn_phase[this.turn_phase];
    // Add current phase class to body
    document.body.classList.add('phase-' + phase.toLowerCase());
    switch (phase) {
      case 'PlayerTurns':
        for (let u of this.units) {
          // Reset thisTurnMoved flag now that it is a new turn
          // Because no units have moved yet this turn
          u.thisTurnMoved = false;
          u.intendedNextMove = undefined;
        }
        this.syncYourTurnState();
        this.bringOutYerDead();
        break;
      case 'NPC':
        this.setYourTurn(false, "NPC's Turn");
        const animationPromises = [];
        // Move units
        for (let u of this.units.filter(
          (u) => u.unitType === Unit.UnitType.AI,
        )) {
          const promise = Unit.moveAI(u);
          animationPromises.push(promise);
        }
        this.initiateIntelligentAIMovement();
        // When all animations are done, set turn phase to player turn
        Promise.all(animationPromises).then(() => {
          this.setTurnPhase(turn_phase.PlayerTurns);
        });

        // Since NPC turn is over, update the danger overlay
        // They may have moved or unfrozen which would update
        // which cells they can attack next turn
        drawDangerOverlay();
        break;
      default:
        break;
    }
  }
  initiateIntelligentAIMovement() {
    // This function ensures that all units who can move, do move, in the proper order
    // so, for example, three units next to each other all trying to move left can
    // all do so, regardless of the order that they are in in the units array
    const AIUnits = this.units.filter((u) => u.unitType === Unit.UnitType.AI);
    // Move all units who intend to move
    // Units who are obstructed will not move due to collision checks in Unit.moveTo
    AIUnits.filter((u) => !!u.intendedNextMove).forEach((u) => {
      Unit.moveTo(u, u.intendedNextMove);
    });
    // While there are units who intend to move but havent yet
    let remainingUnitsWhoIntendToMove = [];
    let previousUnmovedUnitCount = 0;
    do {
      previousUnmovedUnitCount = remainingUnitsWhoIntendToMove.length;
      remainingUnitsWhoIntendToMove = AIUnits.filter(
        (u) => !!u.intendedNextMove && !u.thisTurnMoved,
      );
      // Try moving them again
      remainingUnitsWhoIntendToMove.forEach((u) => {
        Unit.moveTo(u, u.intendedNextMove);
      });
    } while (
      remainingUnitsWhoIntendToMove.length &&
      // So long as the number of units who intend to move continues to change on the loop,
      // keep looping.  This will ensure that units that CAN move do, and as they move
      // they may free up space for other units to move.  But once these numbers are equal,
      // the units left that intend to move truly cannot.
      remainingUnitsWhoIntendToMove.length !== previousUnmovedUnitCount
    );
  }
  setGameState(g: game_state) {
    this.state = g;
    const state = game_state[this.state];
    const elBoard = document.getElementById('board');
    const elUpgradePicker = document.getElementById('upgrade-picker');
    elUpgradePicker.classList.remove('active');
    switch (state) {
      case 'GameOver':
        alert('GameOver');
        break;
      case 'Playing':
        if (elBoard) {
          elBoard.style.visibility = 'visible';
        }
        // Initialize the player turn state
        this.syncYourTurnState();
        // Set the first turn phase
        this.setTurnPhase(turn_phase.PlayerTurns);
        break;
      case 'Upgrade':
        if (elBoard) {
          elBoard.style.visibility = 'hidden';
        }
        elUpgradePicker.classList.add('active');
        const upgrades = generateUpgrades(
          this.players.find((p) => p.clientId === window.clientId),
        );
        const elUpgrades = upgrades.map(createUpgradeElement);
        elUpgradePicker.innerHTML = '';
        for (let elUpgrade of elUpgrades) {
          elUpgradePicker.appendChild(elUpgrade);
        }
        break;
      default:
        if (elBoard) {
          elBoard.style.visibility = 'hidden';
        }
    }
  }
  getTargetsOfSpell(spell: Spell): Coords[] {
    let coords: Coords[] = [];
    if (spell.area_of_effect) {
      const withinRadius = this.getCoordsWithinDistanceOfTarget(
        spell.x,
        spell.y,
        spell.area_of_effect,
      );
      coords = coords.concat(withinRadius);
    }
    let units: Unit.IUnit[] = coords
      // Find units at coordinates
      .map((coord) => this.getUnitAt(coord.x, coord.y))
      // Filter out dead units
      .filter((x) => x && x.alive);
    if (spell.chain) {
      if (units.length === 0) {
        const origin_unit = this.getUnitAt(spell.x, spell.y);
        // Only chain if the spell is cast directly on a unit
        // otherwise the chain will reach too far (1 distance away from empty cell)
        if (origin_unit) {
          // Find all units touching the spell origin
          const chained_units = this.getTouchingUnitsRecursive(
            spell.x,
            spell.y,
          );
          units = units.concat(chained_units);
        }
      } else {
        // Find all units touching targeted units
        // This supports area_of_effect + chain combo for example where all units within the area_of_effect blast will
        // chain to units touching them
        for (let alreadyTargetedUnit of units) {
          const chained_units = this.getTouchingUnitsRecursive(
            alreadyTargetedUnit.x,
            alreadyTargetedUnit.y,
            units,
          );
          units = units.concat(chained_units);
        }
      }
    }
    coords = coords.concat(units.map((u) => ({ x: u.x, y: u.y })));
    if (coords.length == 0) {
      coords = [
        {
          x: spell.x,
          y: spell.y,
        },
      ];
    }
    return coords;
  }
  getCoordsWithinDistanceOfTarget(
    targetX: number,
    targetY: number,
    distance: number,
  ): Coords[] {
    const coords: Coords[] = [];
    for (let cellX = 0; cellX < config.BOARD_WIDTH; cellX++) {
      for (let cellY = 0; cellY < config.BOARD_HEIGHT; cellY++) {
        if (
          cellX <= targetX + distance &&
          cellX >= targetX - distance &&
          cellY <= targetY + distance &&
          cellY >= targetY - distance
        ) {
          coords.push({ x: cellX, y: cellY });
        }
      }
    }
    return coords;
  }
  getTouchingUnitsRecursive(
    x: number,
    y: number,
    ignore: Unit.IUnit[] = [],
  ): Unit.IUnit[] {
    const touchingDistance = 1;
    let touching = this.units.filter((u) => {
      return (
        u.alive &&
        u.x <= x + touchingDistance &&
        u.x >= x - touchingDistance &&
        u.y <= y + touchingDistance &&
        u.y >= y - touchingDistance &&
        !ignore.includes(u)
      );
    });
    ignore = ignore.concat(touching);
    for (let u of touching) {
      touching = touching.concat(
        this.getTouchingUnitsRecursive(u.x, u.y, ignore),
      );
    }
    return touching;
  }
  getUnitAt(x: number, y: number): Unit.IUnit | undefined {
    return this.units.find((u) => u.alive && u.x === x && u.y === y);
  }
  getPickupAt(x: number, y: number): Pickup.IPickup | undefined {
    return this.pickups.find((p) => p.x === x && p.y === y);
  }
  addUnitToArray(unit: Unit.IUnit) {
    this.units.push(unit);
  }
  removePickupFromArray(pickup: Pickup.IPickup) {
    this.pickups = this.pickups.filter((p) => p !== pickup);
  }
  addPickupToArray(pickup: Pickup.IPickup) {
    this.pickups.push(pickup);
  }
  isCellObstructed(coordinates: Coords): boolean {
    const { x, y } = coordinates;
    // Out of map bounds is considered "obstructed"
    if (x < 0 || y < 0 || x >= config.BOARD_WIDTH || y >= config.BOARD_HEIGHT) {
      return true;
    }
    // Cell is obstructed if it is already occupied by a unit
    for (let unit of this.units) {
      if (unit.alive && unit.x === x && unit.y === y) {
        return true;
      }
    }
    return false;
  }
  cast(spell: Spell) {
    if (spell.swap) {
      const unitToSwapWith = this.getUnitAt(spell.x, spell.y);
      // Physically swap with target
      if (unitToSwapWith) {
        Unit.setLocation(unitToSwapWith, spell.caster.unit);
      }
      // Physically swap with pickups
      const pickupToSwapWith = this.getPickupAt(spell.x, spell.y);
      if (pickupToSwapWith) {
        Pickup.setPosition(
          pickupToSwapWith,
          spell.caster.unit.x,
          spell.caster.unit.y,
        );
      }
      const newTargetX = spell.caster.unit.x;
      const newTargetY = spell.caster.unit.y;
      Unit.setLocation(spell.caster.unit, spell).then(() => {
        this.cast(
          Object.assign({}, spell, {
            // Cast the spell on the location that the caster WAS in
            x: newTargetX,
            y: newTargetY,
            // Disable swap so it doesn't recurse forever
            swap: false,
          }),
        );
      });
      return;
    }
    if (spell.trap) {
      Pickup.create(
        spell.x,
        spell.y,
        true,
        'images/spell/trap.png',
        false,
        ({ unit }) => {
          // Trigger the spell held in the trap on the unit that activated it
          // Override trap property so it doesn't simply place another trap
          this.cast(Object.assign({}, spell, { trap: false }));
        },
      );
      return;
    }
    // Get all units targeted by spell
    const targetCoords = this.getTargetsOfSpell(spell);
    // Convert targets to list of units
    let unitsAtTargets = [];
    for (let t of targetCoords) {
      const { x, y } = t;
      const unitAtCoords = this.getUnitAt(x, y);
      if (unitAtCoords) {
        unitsAtTargets.push(unitAtCoords);
      }
    }

    if (unitsAtTargets.length) {
      // Cast on each unit targeted
      for (let unit of unitsAtTargets) {
        effect(spell, { unit });
      }
      this.animateSpellEffects(
        unitsAtTargets.map((u) => ({ x: u.x, y: u.y, spell })),
      );
    } else {
      // If no units were targeted,
      // Cast on the tile that was clicked on
      effect(spell);
      this.animateSpellEffects([{ x: spell.x, y: spell.y, spell }]);
    }
    // Since units may have moved or become frozen, redraw the danger overlay which takes these
    // changes into consideration
    drawDangerOverlay();
  }
  animateSpellEffects(castInstances: { x: number; y: number; spell: Spell }[]) {
    // Show an image when cast occurs
    const images = castInstances.map(
      (i) => new Image(i.x, i.y, getImage(i.spell), containerSpells),
    );

    window.animationTimeline
      .addAnimation(
        images.map((i) => ({
          sprite: i.sprite,
          target: {
            scale: 1.5,
            alpha: 0,
          },
        })),
      )
      .then(() => {
        images.forEach((i) => i.cleanup());
      });
  }
  sanitizeForSaving(): Game {
    return {
      ...this,
      players: this.players.map((p) => ({
        ...p,
        unit: {
          ...p.unit,
          image: {
            ...p.unit.image,
            subSprites: {
              // TODO, restore subSprites on load
            },
            sprite: null,
          },
          healthText: null,
          agroOverlay: null,
        },
      })),
      units: this.units.map((u) => ({
        ...u,
        image: {
          ...u.image,
          subSprites: {
            // TODO, restore subSprites on load
          },
          sprite: null,
        },
        healthText: null,
        agroOverlay: null,
      })),
      pickups: this.pickups.map((p) => ({
        ...p,
        image: {
          ...p.image,
          sprite: null,
        },
      })),
    };
  }
}
