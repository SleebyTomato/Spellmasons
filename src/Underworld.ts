import seedrandom from 'seedrandom';
import * as config from './config';
import * as Unit from './entity/Unit';
import * as Units from './entity/units';
import * as Pickup from './entity/Pickup';
import * as Obstacle from './entity/Obstacle';
import * as Player from './entity/Player';
import * as Upgrade from './Upgrade';
import * as math from './jmath/math';
import * as Cards from './cards';
import * as CardUI from './graphics/ui/CardUI';
import * as Image from './graphics/Image';
import * as storage from './storage';
import * as ImmediateMode from './graphics/ImmediateModeSprites';
import * as colors from './graphics/ui/colors';
import { MESSAGE_TYPES } from './types/MessageTypes';
import {
  app,
  containerBoard,
  containerDoodads,
  containerSpells,
  containerUI,
  containerUnits,
  updateCameraPosition,
  cameraAutoFollow,
  getCamera,
  withinCameraBounds,
  containerPlayerThinking,
  containerWalls,
  addPixiSprite,
  graphicsBloodSmear,
  containerLiquid,
  setupLiquidFilter,
  cleanUpLiquidFilter,
  BloodParticle,
} from './graphics/PixiUtils';
import floatingText, { queueCenteredFloatingText } from './graphics/FloatingText';
import { UnitType, Faction, UnitSubType } from './types/commonTypes';
import type { Vec2 } from "./jmath/Vec";
import * as Vec from "./jmath/Vec";
import Events from './Events';
import { allUnits } from './entity/units';
import { drawTarget, getUIBarProps, setPredictionGraphicsLineStyle, updateManaCostUI, updatePlanningView } from './graphics/PlanningView';
import { chooseObjectWithProbability, prng, randInt, SeedrandomState } from './jmath/rand';
import { calculateCost } from './cards/cardUtils';
import { lineSegmentIntersection, LineSegment, findWherePointIntersectLineSegmentAtRightAngle, closestLineSegmentIntersection } from './jmath/lineSegment';
import { expandPolygon, mergePolygon2s, Polygon2, Polygon2LineSegment, toLineSegments, toPolygon2LineSegments } from './jmath/Polygon2';
import { calculateDistanceOfVec2Array, findPath } from './jmath/Pathfinding';
import { addUnderworldEventListeners, setView, View } from './views';
import { mouseMove } from './graphics/ui/eventListeners';
import Jprompt from './graphics/Jprompt';
import { collideWithLineSegments, ForceMove, isVecIntersectingVecWithCustomRadius, moveWithCollisions } from './jmath/moveWithCollision';
import { ENEMY_ENCOUNTERED_STORAGE_KEY } from './config';
import { getBestRangedLOSTarget } from './entity/units/actions/rangedAction';
import { getClients, hostGiveClientGameState, IHostApp } from './network/networkUtil';
import { healthAllyGreen, healthHurtRed, healthRed } from './graphics/ui/colors';
import objectHash from 'object-hash';
import { withinMeleeRange } from './entity/units/actions/gruntAction';
import { all_ground, baseTiles, caveSizes, convertBaseTilesToFinalTiles, generateCave, getLimits, Limits as Limits, Tile, toObstacle } from './MapOrganicCave';
import { Material } from './Conway';
import { oneDimentionIndexToVec2, vec2ToOneDimentionIndexPreventWrap } from './jmath/ArrayUtil';
import { raceTimeout } from './Promise';
import { updateParticlees } from './graphics/Particles';
import { processNextInQueueIfReady, setupNetworkHandlerGlobalFunctions } from './network/networkHandler';
import { setupDevGlobalFunctions } from './devUtils';
import type PieClient from '@websocketpie/client';
import { forcePush, makeForcePush } from './cards/push';

export enum turn_phase {
  PlayerTurns,
  NPC_ALLY,
  NPC_ENEMY,
}
const smearJitter = [
  { x: -3, y: -3 },
  { x: 3, y: -3 },
  { x: 0, y: 3 },
]
const elPlayerTurnIndicator = document.getElementById('player-turn-indicator');
const elLevelIndicator = document.getElementById('level-indicator');
const elUpgradePicker = document.getElementById('upgrade-picker') as (HTMLElement | undefined);
const elUpgradePickerContent = document.getElementById('upgrade-picker-content') as (HTMLElement | undefined);
const elSeed = document.getElementById('seed') as (HTMLElement | undefined);
const elUpgradePickerLabel = document.getElementById('upgrade-picker-label') as (HTMLElement | undefined);

let showUpgradesQueue: boolean[] = [];

let lastTime = 0;
let requestAnimationFrameGameLoopId: number;
export default class Underworld {
  seed: string;
  random: prng;
  pie: PieClient | IHostApp;
  // The index of the level the players are on
  levelIndex: number = -1;
  // for serializing random: prng
  RNGState?: SeedrandomState;
  turn_phase: turn_phase = turn_phase.PlayerTurns;
  // An id incrementor to make sure no 2 units share the same id
  lastUnitId: number = -1;
  // A count of which turn it is, this is useful for
  // governing AI actions that occur every few turns
  // instead of every turn.  A "turn" is a full cycle,
  // meaning, players take their turn, npcs take their
  // turn, then it resets to player turn, that is a full "turn"
  turn_number: number = -1;
  limits: Limits = { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  players: Player.IPlayer[] = [];
  units: Unit.IUnit[] = [];
  pickups: Pickup.IPickup[] = [];
  imageOnlyTiles: Tile[] = [];
  // line segments that prevent sight and movement
  walls: LineSegment[] = [];
  // line segments that prevent movement under certain circumstances
  liquidBounds: LineSegment[] = [];
  liquidPolygons: Polygon2[] = [];
  pathingPolygons: Polygon2[] = [];
  // pathingLineSegments shall always be exactly pathingPolygons converted to LineSegments.
  // It is kept up to date whenever pathingPolygons changes in cachedWalls
  pathingLineSegments: Polygon2LineSegment[] = [];
  // Keeps track of how many messages have been processed so that clients can
  // know when they've desynced.  Only used for syncronous message processing
  // since only the syncronous messages affect gamestate.
  processedMessageCount: number = 0;
  validPlayerSpawnCoords: Vec2[] = [];
  cardDropsDropped: number = 0;
  enemiesKilled: number = 0;
  // Not to be synced between clients but should belong to the underworld as they are unique
  // to each game lobby:
  // A list of units and pickups and an endPosition that they are moved to via a "force",
  // like a push or pull or explosion.
  forceMove: ForceMove[] = [];
  // forceMovePrediction: ForceMove[] = [];
  // A hash of the last thing this client was thinking
  // Used with MESSAGE_TYPES.PLAYER_THINKING so other clients 
  // can see what another client is planning.
  // The hash is used to prevent sending the same data more than once
  lastThoughtsHash: string = '';
  playerThoughts: { [clientId: string]: { target: Vec2, cardIds: string[] } } = {};
  // Keep track of the LevelData from the last level that was created in
  // case it needs to be sent to another client
  lastLevelCreated: LevelData | undefined;
  removeEventListeners: undefined | (() => void);
  bloods: BloodParticle[] = [];

  constructor(pie: PieClient | IHostApp, seed: string, RNGState: SeedrandomState | boolean = true) {
    this.pie = pie;
    this.seed = globalThis.seedOverride || seed;

    // Initialize content
    Cards.registerCards(this);
    Units.registerUnits();
    // Add event listeners
    this.removeEventListeners = addUnderworldEventListeners(this);

    // Setup global functions that need access to underworld:
    setupNetworkHandlerGlobalFunctions(this);
    setupDevGlobalFunctions(this);

    // Setup UI event listeners
    CardUI.setupCardUIEventListeners(this);

    this.random = this.syncronizeRNG(RNGState);
    this.ensureAllClientsHaveAssociatedPlayers(getClients());

    // Start the gameloop
    requestAnimationFrameGameLoopId = requestAnimationFrame(this.gameLoop);
    // When the game is ready to process wsPie messages, begin
    // processing them
    // The game is ready when the following have been loaded
    // - wsPieConnection
    // - wsPieRoomJoined 
    // - pixiAssets 
    // - content (register cards and untis)
    // - underworld
    processNextInQueueIfReady(this);
  }
  reportEnemyKilled(enemyKilledPos: Vec2) {
    this.enemiesKilled++;
    // Check if should drop cards
    let numberOfEnemiesKilledNeededForNextDrop = 0;
    const startNumberOfEnemiesNeededToDrop = 2;
    for (let i = startNumberOfEnemiesNeededToDrop; i < 1 + this.cardDropsDropped + startNumberOfEnemiesNeededToDrop; i++) {
      numberOfEnemiesKilledNeededForNextDrop += i;
    }
    if (numberOfEnemiesKilledNeededForNextDrop <= this.enemiesKilled) {
      this.cardDropsDropped++;
      const pickupSource = Pickup.pickups.find(p => p.name == Pickup.CARDS_PICKUP_NAME)
      if (pickupSource) {
        Pickup.create({ pos: enemyKilledPos, pickupSource }, this, false);
      } else {
        console.error('pickupSource for', Pickup.CARDS_PICKUP_NAME, ' not found');
        return
      }
    }

  }
  syncPlayerPredictionUnitOnly() {
    if (globalThis.predictionUnits && globalThis.player !== undefined) {
      const predictionUnitIndex = globalThis.predictionUnits.findIndex(u => u.id == globalThis.player?.unit.id);
      globalThis.predictionUnits[predictionUnitIndex] = Unit.copyForPredictionUnit(globalThis.player.unit, this);
    }
  }
  // Assigns globalThis.predictionUnits a copy of this.units
  // for the sake of prediction
  syncPredictionEntities() {
    // Headless does not use predictions because predictions are only for display
    if (globalThis.headless) { return; }
    globalThis.predictionUnits = this.units.map(u => Unit.copyForPredictionUnit(u, this));
    globalThis.predictionPickups = this.pickups.map(Pickup.copyForPredictionPickup);
  }
  syncronizeRNG(RNGState: SeedrandomState | boolean) {
    if (elSeed) {
      elSeed.innerText = `Seed: ${this.seed}`;
    }
    console.log("RNG create with seed:", this.seed, ", state: ", RNGState);
    // state of "true" initializes the RNG with the ability to save it's state,
    // state of a state object, rehydrates the RNG to a particular state
    this.random = seedrandom(this.seed, { state: RNGState })
    return this.random;
  }
  // Returns true when forceMove is complete
  runForceMove(forceMoveInst: ForceMove, prediction: boolean): boolean {
    const { pushedObject, id, endPoint } = forceMoveInst;
    if (math.distance(pushedObject, endPoint) <= 1) {
      // It's close enough, set final position to endPoint
      pushedObject.x = endPoint.x;
      pushedObject.y = endPoint.y;
      return true;
    }
    const lastPosition = Vec.clone(pushedObject);
    const aliveUnits = ((prediction && globalThis.predictionUnits) ? globalThis.predictionUnits : this.units).filter(u => u.alive);
    const distanceToEndPoint = math.distance(pushedObject, endPoint);
    const travelDistancePerTick = distanceToEndPoint * 0.1;
    const newPosition = Vec.add(pushedObject, math.similarTriangles(endPoint.x - pushedObject.x, endPoint.y - pushedObject.y, distanceToEndPoint, travelDistancePerTick))
    pushedObject.x = newPosition.x;
    pushedObject.y = newPosition.y;
    for (let other of aliveUnits) {
      if (other == forceMoveInst.pushedObject) {
        // Don't collide with self
        continue;
      }
      // The units' regular radius is for "crowding". It is much smaller than their actual size and it is used
      // to ensure they can crowd together but not overlap perfect, so here we use a custom radius to detect
      // forcePush collisions.
      // Only allow instances that are flagged as able to create second order pushes create new pushes on collision or else you risk infinite
      // recursion
      if (forceMoveInst.canCreateSecondOrderPushes && isVecIntersectingVecWithCustomRadius(pushedObject, other, config.COLLISION_MESH_RADIUS)) {
        // If they collide transfer force:
        // () => {}: No resolver needed for second order force pushes
        // All pushable objects have the same mass so when a collision happens they'll split the distance
        const fullDist = math.distance(forceMoveInst.pushedObject, forceMoveInst.endPoint);
        const halfDist = fullDist / 2;
        // This is a second order push and second order pushes CANNOT create more pushes or else you risk infinite recursion in prediction mode
        const canCreateSecondOrderPushes = false;
        makeForcePush({ pushedObject: other, awayFrom: forceMoveInst.pushedObject, pushDistance: halfDist, resolve: () => { }, canCreateSecondOrderPushes }, this, prediction);
        // Affect the endpoint of the current mover since it just collided
        forceMoveInst.endPoint = Vec.add(forceMoveInst.pushedObject, math.similarTriangles(forceMoveInst.endPoint.x - forceMoveInst.pushedObject.x, forceMoveInst.endPoint.y - forceMoveInst.pushedObject.y, fullDist, halfDist));

      }
    }
    // TODO: WARN: If the endpoint is beyond a barrier it will never get close enough and enter an infinite loop:
    // collideWithLineSegments(pushedObject, this.walls, this);
    const wallCollisionIntersection = closestLineSegmentIntersection({ p1: pushedObject, p2: endPoint }, this.walls);
    if (wallCollisionIntersection) {
      console.log('TODO collided with walls, take damage?')
      forceMoveInst.endPoint = wallCollisionIntersection
    }
    Obstacle.checkLiquidInteractionDueToForceMovement(forceMoveInst, lastPosition, this, prediction);
    if (Unit.isUnit(forceMoveInst.pushedObject)) {
      // If the pushed object is a unit, check if it collides with any pickups
      // as it is pushed
      this.checkPickupCollisions(forceMoveInst.pushedObject, prediction);
    } else if (Pickup.isPickup(forceMoveInst.pushedObject)) {
      // If the pushed object is a pickup, check if it collides with any units
      // as it is pushed
      ((prediction && globalThis.predictionUnits) ? globalThis.predictionUnits : this.units).forEach(u => {
        this.checkPickupCollisions(u, prediction);
      })
    }
    return false;

  }
  gameLoop = (timestamp: number) => {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    const { zoom } = getCamera();

    ImmediateMode.loop();

    Unit.syncPlayerHealthManaUI();
    globalThis.unitOverlayGraphics?.clear();

    // Draw cast line:
    if (globalThis.player) {
      if (CardUI.areAnyCardsSelected()) {
        const mouseTarget = this.getMousePos();
        // Players can only cast within their attack range
        const castLine = { p1: globalThis.player.unit, p2: mouseTarget };
        globalThis.unitOverlayGraphics?.lineStyle(3, colors.targetBlue, 0.7);
        globalThis.unitOverlayGraphics?.moveTo(castLine.p1.x, castLine.p1.y);
        if (math.distance(castLine.p1, castLine.p2) > globalThis.player.unit.attackRange) {
          const endOfRange = math.getCoordsAtDistanceTowardsTarget(castLine.p1, castLine.p2, globalThis.player.unit.attackRange);
          globalThis.unitOverlayGraphics?.lineTo(endOfRange.x, endOfRange.y);
          // Draw a red line the rest of the way shoing that you cannot cast
          globalThis.unitOverlayGraphics?.lineStyle(3, 0x333333, 0.7);
          globalThis.unitOverlayGraphics?.lineTo(castLine.p2.x, castLine.p2.y);
          globalThis.unitOverlayGraphics?.drawCircle(castLine.p2.x, castLine.p2.y, 3);
          // Draw a circle where the cast stops
          globalThis.unitOverlayGraphics?.moveTo(castLine.p2.x, castLine.p2.y);//test
          globalThis.unitOverlayGraphics?.lineStyle(3, colors.targetBlue, 0.7);
          globalThis.unitOverlayGraphics?.drawCircle(endOfRange.x, endOfRange.y, 3);
        } else {
          globalThis.unitOverlayGraphics?.lineTo(castLine.p2.x, castLine.p2.y);
          globalThis.unitOverlayGraphics?.drawCircle(castLine.p2.x, castLine.p2.y, 3);
        }
      }
    }

    const aliveNPCs = this.units.filter(u => u.alive && u.unitType == UnitType.AI);
    // Run all forces in this.forceMove
    for (let i = this.forceMove.length - 1; i >= 0; i--) {
      const forceMoveInst = this.forceMove[i];
      if (forceMoveInst) {
        // Ensure blood is at unit feet, not center
        const unitImageYOffset = config.COLLISION_MESH_RADIUS / 2;
        const startPos = Vec.clone(forceMoveInst.pushedObject);
        startPos.y += unitImageYOffset;
        const done = this.runForceMove(forceMoveInst, false);
        const endPos = { x: forceMoveInst.pushedObject.x, y: forceMoveInst.pushedObject.y + unitImageYOffset };
        // Note bug: this will leavee a smear on pickups since pickups aren't alive
        if (graphicsBloodSmear && forceMoveInst.pushedObject.health !== undefined && forceMoveInst.pushedObject.health <= 0) {
          const size = 3;
          for (let j of smearJitter) {
            // Multiple blood trails
            graphicsBloodSmear.beginFill(forceMoveInst.pushedObject.bloodColor, 1.0);
            graphicsBloodSmear.lineStyle(1, forceMoveInst.pushedObject.bloodColor, 1.0);
            const bloodDrop = Vec.jitter(endPos, 5, this.random);
            // Draw a blood drop
            graphicsBloodSmear.drawCircle(bloodDrop.x, bloodDrop.y, randInt(this.random, 2, 4));

            const startWithJitter = Vec.add(startPos, j);
            const endWithJitter = Vec.add(endPos, j);
            // Draw circle at the ends of the smear line line so the smear lines don't look like rectangles
            graphicsBloodSmear.drawCircle(startWithJitter.x, startWithJitter.y, size);
            graphicsBloodSmear.drawCircle(endWithJitter.x, endWithJitter.y, size);
            graphicsBloodSmear.endFill();
            // Draw a smear line
            graphicsBloodSmear.lineStyle(size, forceMoveInst.pushedObject.bloodColor, 1.0);
            graphicsBloodSmear.moveTo(startWithJitter.x, startWithJitter.y);
            graphicsBloodSmear.lineTo(endWithJitter.x, endWithJitter.y);
          }
        }
        // Remove it from forceMove array once the distance has been covers
        // This works even if collisions prevent the unit from moving since
        // distance is modified even if the unit doesn't move each loop
        if (done) {
          forceMoveInst.resolve();
          this.forceMove.splice(i, 1);
        }
      }
    }

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (u) {
        const predictionUnit = !globalThis.predictionUnits ? undefined : globalThis.predictionUnits[i];
        if (u.alive) {

          while (u.path && u.path.points[0] && Vec.equal(Vec.round(u), u.path.points[0])) {
            // Remove next points until the next point is NOT equal to the unit's current position
            // This prevent's "jittery" "slow" movement where it's moving less than {x:1.0, y:1.0}
            // because the unit's position may have a decimal while the path does not so it'll stop
            // moving when it reaches the target which may be less than 1.0 and 1.0 away.
            u.path.points.shift();
          }
          // Only allow movement if the unit has stamina
          if (u.path && u.path.points[0] && u.stamina > 0 && Unit.isUnitsTurnPhase(u, this)) {
            const lastPosition = Vec.clone(u);
            // Move towards target
            const stepTowardsTarget = math.getCoordsAtDistanceTowardsTarget(u, u.path.points[0], u.moveSpeed * deltaTime)
            let moveDist = 0;
            // For now, only AI units will collide with each other
            // This is because the collisions were causing issues with player movement that I don't
            // have time to solve at the moment.
            if (u.unitType == UnitType.PLAYER_CONTROLLED) {
              // Player units don't collide, they just move, and pathfinding keeps
              // them from moving through walls
              moveDist = math.distance(u, stepTowardsTarget);
              u.x = stepTowardsTarget.x;
              u.y = stepTowardsTarget.y;
            } else {
              // AI collide with each other and walls
              const originalPosition = Vec.clone(u);
              // Only move other NPCs out of the way, never move player units
              moveWithCollisions(u, stepTowardsTarget, aliveNPCs, this);
              moveDist = math.distance(originalPosition, u);
            }
            u.stamina -= moveDist;
            Obstacle.checkLiquidInteractionDueToMovement(u, lastPosition, this, false);
            // If unit is MELEE and only has the final target left in the path, stop when it gets close enough
            if (
              u.path.points[0] && u.path.points.length == 1 && u.unitSubType == UnitSubType.MELEE && math.distance(u, u.path.points[0]) <= config.COLLISION_MESH_RADIUS * 2
            ) {
              // Once the unit reaches the target, shift so the next point in the path is the next target
              u.path.points.shift();
            }

          }
          // check for collisions with pickups in new location
          this.checkPickupCollisions(u, false);
          // Ensure that resolveDoneMoving is invoked when unit is out of stamina (and thus, done moving)
          // or when find point in the path has been reached.
          // This is necessary to end the moving units turn because elsewhere we are awaiting the fulfillment of that promise
          // to know they are done moving
          if (u.stamina <= 0 || !u.path || u.path.points.length === 0) {
            u.resolveDoneMoving();
            if (u.path) {
              // Update last position that changed via own movement
              u.path.lastOwnPosition = Vec.clone(u);
            }
          }
        }
        for (let p of this.pickups) {
          Pickup.syncImage(p);
        }
        // Sync Image even for non moving units since they may be moved by forces other than themselves
        // This keeps the unit.image in the same place as unit.x, unit.y
        Unit.syncImage(u)
        // Draw unit overlay graphics
        //--
        // Prevent drawing unit overlay graphics when a unit is in the portal
        if (u.x !== null && u.y !== null) {
          // Draw health bar
          const healthBarColor = u.faction == Faction.ALLY ? healthAllyGreen : healthRed;
          const healthBarHurtColor = u.faction == Faction.ALLY ? 0x235730 : healthHurtRed;
          const healthBarHealColor = u.faction == Faction.ALLY ? 0x23ff30 : 0xff2828;
          globalThis.unitOverlayGraphics?.lineStyle(0, 0x000000, 1.0);
          globalThis.unitOverlayGraphics?.beginFill(healthBarColor, 1.0);
          const healthBarProps = getUIBarProps(u.x, u.y, u.health, u.healthMax, zoom);
          globalThis.unitOverlayGraphics?.drawRect(
            healthBarProps.x,
            // Stack the health bar above the mana bar
            healthBarProps.y - config.UNIT_UI_BAR_HEIGHT / zoom,
            healthBarProps.width,
            healthBarProps.height
          );

          // Only show health bar predictions on PlayerTurns, while players are able
          // to cast, otherwise it will show out of sync when NPCs do damage
          if (this.turn_phase == turn_phase.PlayerTurns) {
            // Show how much damage they'll take on their health bar
            globalThis.unitOverlayGraphics?.beginFill(healthBarHurtColor, 1.0);
            if (predictionUnit) {
              const healthAfterHurt = predictionUnit.health;
              if (healthAfterHurt > u.health) {
                globalThis.unitOverlayGraphics?.beginFill(healthBarHealColor, 1.0);
              }
              // const healthBarHurtWidth = Math.max(0, config.UNIT_UI_BAR_WIDTH * (u.health - healthAfterHurt) / u.healthMax);
              const healthBarHurtProps = getUIBarProps(u.x, u.y, u.health - healthAfterHurt, u.healthMax, zoom);
              globalThis.unitOverlayGraphics?.drawRect(
                // Show the healthBarHurtBar on the right side of the health  bar
                healthBarHurtProps.x + config.UNIT_UI_BAR_WIDTH / zoom * healthAfterHurt / u.healthMax,
                // Stack the health bar above the mana bar
                healthBarHurtProps.y - config.UNIT_UI_BAR_HEIGHT / zoom,
                healthBarHurtProps.width,
                healthBarHurtProps.height);
              // Draw red death circle if a unit is currently alive, but wont be after cast
              if (u.alive && !predictionUnit.alive) {
                const skullPosition = withinCameraBounds({ x: u.x, y: u.y - config.COLLISION_MESH_RADIUS * 2 + 8 });
                ImmediateMode.draw('badgeDeath.png', skullPosition, (1 / zoom) + (Math.sin(Date.now() / 500) + 1) / 3);
              }
            }
          }
          // Draw mana bar
          if (u.manaMax != 0) {
            globalThis.unitOverlayGraphics?.lineStyle(0, 0x000000, 1.0);
            globalThis.unitOverlayGraphics?.beginFill(colors.manaBlue, 1.0);
            const manaBarProps = getUIBarProps(u.x, u.y, u.mana, u.manaMax, zoom);
            globalThis.unitOverlayGraphics?.drawRect(
              manaBarProps.x,
              manaBarProps.y,
              manaBarProps.width,
              manaBarProps.height);
          }
          globalThis.unitOverlayGraphics?.endFill();
        }
      }
    }
    // Sort unit sprites visually by y position (like "z-index")
    containerUnits?.children.sort((a: any, b: any) => a.y - b.y)

    updateCameraPosition(this);
    this.drawEnemyAttentionMarkers();
    this.drawResMarkers();
    this.drawPlayerThoughts();
    updatePlanningView(this);
    mouseMove(this);
    // Particles
    updateParticlees(deltaTime, this.bloods, this.random);

    // Invoke gameLoopUnits again next loop
    requestAnimationFrameGameLoopId = requestAnimationFrame(this.gameLoop)
  }
  // setPath finds a path to the target
  // and sets that to the unit's path
  setPath(unit: Unit.IUnit, target: Vec2) {
    const path = this.calculatePath(unit.path, Vec.round(unit), Vec.round(target))
    if (unit.path) {
      // If there is a pre-existing path, intentionally mutate it.
      // This is so that predictionUnits can mutate the path's of 
      // their actual unit counterparts so we get the optimization gains
      // of cached paths.
      unit.path.lastOwnPosition = path.lastOwnPosition;
      unit.path.points = path.points;
      unit.path.targetPosition = path.targetPosition;
    } else {
      unit.path = path;
    }
  }
  // calculatePath will find a UnitPath from startPoint to target.
  // If preExistingPath exists, it may slightly modify
  // the preExistingPath as an optimization
  calculatePath(preExistingPath: Unit.UnitPath | undefined, startPoint: Vec2, target: Vec2): Unit.UnitPath {
    // Cached path finding, if start point and target are the same (or close)
    // do not recalculate path.  start point being the same includes if units has only moved
    // along path but not moved under other forces (for this case: preExistingPath.lastOwnPosition 
    // is updated elsewhere).
    if (preExistingPath) {
      // If there is a preexisting path, see if it can be reused
      const targetMoved = !Vec.equal(target, preExistingPath.targetPosition);
      const selfMoved = !Vec.equal(startPoint, preExistingPath.lastOwnPosition);
      if (targetMoved) {
        // Fully recalculate
        return this.calculatePathNoCache(startPoint, target);
      } else if (selfMoved) {
        // Fully recalculate
        return this.calculatePathNoCache(startPoint, target);
      } else {
        // Do nothing, keep the same path.  This is the most optimal result because
        // it requires the least additional computation
        return preExistingPath;
      }
    } else {
      // If there is no preexisting path, recalculate path
      return this.calculatePathNoCache(startPoint, target);
    }
  }
  // calculatePathNoCache calculates a path without checking if an old path can be 
  // reused like 'calculatePath()' does.
  calculatePathNoCache(startPoint: Vec2, target: Vec2): Unit.UnitPath {
    let points = findPath(startPoint, target, this.pathingLineSegments);

    // If the real target is in an invalid location,
    // find the closest valid target to represent the endpoint of the path
    if (points.length == 0) {
      const nearPointsOnWalls: Vec2[] = [];
      for (let wall of this.pathingLineSegments) {
        const intersection = findWherePointIntersectLineSegmentAtRightAngle(target, wall);
        if (intersection) {
          // globalThis.debugGraphics.lineStyle(3, 0xff0000, 1.0);
          // globalThis.debugGraphics.drawCircle(intersection.x, intersection.y, 3);
          nearPointsOnWalls.push(intersection);
        }
        nearPointsOnWalls.push(wall.p1);
        nearPointsOnWalls.push(wall.p2);

      }
      // Find the closest of the nearPointsOnWalls 
      if (nearPointsOnWalls[0]) {
        const closest = nearPointsOnWalls.reduce<{ intersection: Vec2, dist: number }>((acc, cur) => {
          const dist = math.distance(cur, target)
          if (dist <= acc.dist) {
            return { intersection: cur, dist };
          } else {
            return acc;
          }

        }, { intersection: nearPointsOnWalls[0], dist: Number.MAX_SAFE_INTEGER })
        // Override target with a location that the unit can actually fit in:
        target = closest.intersection;
      }
      // Try again with adjustedTarget set to nearpoint on wall
      points = findPath(startPoint, target, this.pathingLineSegments);

    }
    return {
      points,
      lastOwnPosition: Vec.clone(startPoint),
      targetPosition: Vec.clone(target)
    }
  }
  drawResMarkers() {
    if (!globalThis.resMarkers) {
      return;
    }
    for (let marker of globalThis.resMarkers) {
      const { zoom } = getCamera();
      ImmediateMode.draw('raise_dead.png', marker, 1 / zoom);
    }

  }
  drawEnemyAttentionMarkers() {
    if (!globalThis.attentionMarkers) {
      return;
    }
    // Draw attention markers which show if an NPC will
    // attack you next turn
    // Note: this block must come after updating the camera position
    for (let marker of globalThis.attentionMarkers) {
      const { zoom } = getCamera();

      // Offset exclamation mark just above the head of the unit "- config.COLLISION_MESH_RADIUS - 10"
      const exclamationMarkPosition = withinCameraBounds({ x: marker.pos.x, y: marker.pos.y - config.COLLISION_MESH_RADIUS * 2 + 8 });

      // Draw Attention Icon to show the enemy will hurt you next turn
      // 1/zoom keeps the attention marker the same size regardless of the level of zoom
      // Math.sin... makes the attention marker swell and shink so it grabs the player's attention so they
      // know that they're in danger
      ImmediateMode.draw(marker.imagePath, exclamationMarkPosition, (1 / zoom) + (Math.sin(Date.now() / 500) + 1) / 3);
    }
  }
  drawPlayerThoughts() {
    // No graphics for headless
    if (globalThis.headless) { return; }

    const spaceBetweenIcons = 20;
    function getXLocationOfImageForThoughtBubble(originX: number, index: number, totalNumberOfSpells: number) {
      return originX + (0.5 + index - totalNumberOfSpells / 2) * spaceBetweenIcons
    }
    // Only display player thoughts if they are not the current client's player
    globalThis.thinkingPlayerGraphics?.clear();
    containerPlayerThinking?.removeChildren();
    if (globalThis.thinkingPlayerGraphics) {
      containerPlayerThinking?.addChild(globalThis.thinkingPlayerGraphics);
    }
    for (let [thinkerClientId, thought] of Object.entries(this.playerThoughts)) {
      const { target, cardIds } = thought;
      const thinkingPlayerIndex = this.players.findIndex(p => p.clientId == thinkerClientId);
      const thinkingPlayer = this.players[thinkingPlayerIndex];
      if (thinkingPlayer) {
        // Render thought bubble around spell icons
        if (cardIds.length) {
          const thoughtBubbleMargin = 20;
          const thoughtBubbleRight = getXLocationOfImageForThoughtBubble(thinkingPlayer.unit.x, cardIds.length, cardIds.length);
          const thoughtBubbleLeft = getXLocationOfImageForThoughtBubble(thinkingPlayer.unit.x, 0, cardIds.length) - thoughtBubbleMargin;
          globalThis.thinkingPlayerGraphics?.lineStyle(3, 0xffffff, 1.0);
          globalThis.thinkingPlayerGraphics?.beginFill(0xffffff, 0.7);
          globalThis.thinkingPlayerGraphics?.drawRoundedRect(thoughtBubbleLeft, thinkingPlayer.unit.y - config.COLLISION_MESH_RADIUS * 2 - thoughtBubbleMargin, thoughtBubbleRight - thoughtBubbleLeft, thoughtBubbleMargin * 2, 5);
          globalThis.thinkingPlayerGraphics?.endFill();
        }
        for (let i = 0; i < cardIds.length; i++) {
          const cardId = cardIds[i];
          if (!cardId) {
            continue;
          }
          const card = Cards.allCards[cardId];
          if (card) {
            const x = getXLocationOfImageForThoughtBubble(thinkingPlayer.unit.x, i, cardIds.length);
            const sprite = addPixiSprite(card.thumbnail, containerPlayerThinking);
            if (sprite) {
              sprite.anchor.x = 0.5;
              sprite.anchor.y = 0.5;
              sprite.rotation = 0;
              const pos = { x, y: thinkingPlayer.unit.y - config.COLLISION_MESH_RADIUS * 2 };
              sprite.x = pos.x;
              sprite.y = pos.y;
              sprite.scale.set(0.3);
            }
          }
        }
        if (target && cardIds.length) {
          // Draw a line to show where they're aiming:
          globalThis.thinkingPlayerGraphics?.lineStyle(3, colors.healthAllyGreen, 0.7);
          // Use this similarTriangles calculation to make the line pretty so it doesn't originate from the exact center of the
          // other player but from the edge instead
          const startPoint = Vec.subtract(thinkingPlayer.unit, math.similarTriangles(thinkingPlayer.unit.x - target.x, thinkingPlayer.unit.y - target.y, math.distance(thinkingPlayer.unit, target), config.COLLISION_MESH_RADIUS));
          globalThis.thinkingPlayerGraphics?.moveTo(startPoint.x, startPoint.y);
          globalThis.thinkingPlayerGraphics?.lineTo(target.x, target.y);
          globalThis.thinkingPlayerGraphics?.drawCircle(target.x, target.y, 4);
        }
      }
    }

  }
  // Returns true if it is the current players turn
  isMyTurn() {
    return this.turn_phase == turn_phase.PlayerTurns;
  }
  destroy() {
    console.log('teardown: destroying underworld')

    if (this.removeEventListeners) {
      this.removeEventListeners();
    }
    // Prevent requestAnimationFrame from calling this method next time, since this underworld
    // instance is being cleaned up
    if (requestAnimationFrameGameLoopId !== undefined) {
      cancelAnimationFrame(requestAnimationFrameGameLoopId);
    }

  }
  // Caution: Be careful when changing clean up code.  There are times when you just want to
  // clean up assets and then there are times when you want to clear and empty the arrays
  // Be sure not to confuse them.
  // cleanup cleans up all assets that must be manually removed (for now `Image`s)
  // if an object stops being used.  It does not empty the underworld arrays, by design.
  cleanup() {
    console.trace('teardown: Cleaning up underworld');

    // Remove all phase classes from body
    if (document && !globalThis.headless) {
      // @ts-expect-error Property 'values' does not exist on type 'DOMTokenList'
      for (let phaseClass of document.body?.classList.values()) {
        if (phaseClass.includes('phase-')) {
          document.body?.classList.remove(phaseClass);
        }
      }
      document.body?.classList.remove('your-turn');
    }

    // Note: Player's unit image is cleaned up below where it also has a reference in this.units
    for (let u of this.units) {
      Image.cleanup(u.image);
    }
    for (let x of this.pickups) {
      Image.cleanup(x.image);
    }
    // Clean up doodads
    containerDoodads?.removeChildren();
    // Clean up board
    containerBoard?.removeChildren();
    globalThis.updateInGameMenuStatus?.()

  }
  // cacheWalls updates underworld.walls array
  // with the walls for the edge of the map
  // and the walls from the current obstacles
  cacheWalls(obstacles: Obstacle.IObstacle[], emptyTiles: Tile[]) {

    const distanceFromTileCenterWhenAdjacent = 1 + Math.sqrt(2) * config.OBSTACLE_SIZE / 2;
    // Optimization: Removes linesegments that are not adjacent to walkable ground to prevent
    // having to process linesegments that will never be used
    // function filterRemoveNonGroundAdjacent(ls: LineSegment): boolean {
    //   return groundTiles.some(gt => math.distance(gt, ls.p1) <= distanceFromTileCenterWhenAdjacent)
    // }

    // Used to remove polygons that border empty tiles
    function filterRemoveEmptyTileAdjacentPoly(poly: Polygon2): boolean {
      return !emptyTiles.some(tile => poly.some(p => math.distance(tile, p) <= distanceFromTileCenterWhenAdjacent))
    }
    const getWallPolygons = () => obstacles.filter(o => o.material == Material.WALL).map(o => o.bounds);
    // walls block sight and movement
    this.walls = mergePolygon2s(getWallPolygons())
      // Optimization, remove the outermost wall poly since no units will ever collide with it
      .filter(filterRemoveEmptyTileAdjacentPoly)
      .map(toLineSegments).flat()

    const expandMagnitude = config.COLLISION_MESH_RADIUS * 0.6;

    // liquid bounds block movement only under certain circumstances
    this.liquidPolygons = mergePolygon2s(obstacles.filter(o => o.material == Material.LIQUID).map(o => o.bounds));
    const expandedLiquidPolygons = this.liquidPolygons//.map(p => p.map(Vec.clone))
      .map(p => expandPolygon(p, -expandMagnitude / 2))
      // Move bounds up because center of units is not where they stand, and the bounds
      // should be realtive to a unit's feet
      .map(p => p.map(vec2 => ({ x: vec2.x, y: vec2.y - expandMagnitude / 2 })))
    this.liquidBounds = expandedLiquidPolygons
      .map(toLineSegments).flat();
    // TODO: Optimize:
    //.filter(filterRemoveNonGroundAdjacent);

    // Expand pathing walls by the size of the regular unit
    // pathing polygons determines the area that units can move within
    // this.pathingPolygons = mergePolygon2s([...obstacles.map(o => o.bounds)]

    this.pathingPolygons = mergePolygon2s([...getWallPolygons().map(p => expandPolygon(p, expandMagnitude))
      .map(p => p.map(vec2 => ({ x: vec2.x, y: vec2.y - 10 })))
      , ...expandedLiquidPolygons.map(p => expandPolygon(p, expandMagnitude))])
      // remove polygons that border empty tiles (the outermost poly) so that if player tries to path to an out of bounds location
      // it will still be able to find the nearest point on a wall.  If it wasn't removed, attempting to path to an out of bounds
      // location would find an adjusted path target on the wall of the outermost poly, but since the inside 2nd outermost poly
      // is always between units and the outermost poly, that adjusted point wouldn't find a successful path either
      // and it the player would not move. 
      .filter(filterRemoveEmptyTileAdjacentPoly);


    // Process the polygons into pathingwalls for use in tryPath
    // TODO: Optimize if needed: When this.pathingLineSegments gets serialized to send over the network
    // it has an excess of serialized polygons with many points  because lots of the linesegments have a ref to the
    // same polygon.  This is a lot of extra data that is repeated.  Optimize if needed
    this.pathingLineSegments = this.pathingPolygons.map(toPolygon2LineSegments).flat();
  }
  spawnPickup(index: number, coords: Vec2) {
    const pickup = Pickup.pickups[index];
    if (pickup) {
      Pickup.create({ pos: coords, pickupSource: pickup }, this, false);
    } else {
      console.error('Could not find pickup with index', index);
    }
  }
  spawnEnemy(id: string, coords: Vec2, isArmored: boolean, strength: number) {
    const sourceUnit = allUnits[id];
    if (!sourceUnit) {
      console.error('Unit with id', id, 'does not exist.  Have you registered it in src/units/index.ts?');
      return;
    }
    if (globalThis.enemyEncountered && !globalThis.enemyEncountered.includes(id)) {
      globalThis.enemyEncountered.push(id);
      storage.set(ENEMY_ENCOUNTERED_STORAGE_KEY, JSON.stringify(globalThis.enemyEncountered));
      Jprompt({ imageSrc: Unit.getImagePathForUnitId(id), text: id + '\n' + sourceUnit.info.description, yesText: 'Okay!', yesKey: 'Space', yesKeyText: 'Spacebar' });
    }
    let unit: Unit.IUnit = Unit.create(
      sourceUnit.id,
      coords.x,
      coords.y,
      Faction.ENEMY,
      sourceUnit.info.image,
      UnitType.AI,
      sourceUnit.info.subtype,
      strength,
      sourceUnit.unitProps,
      this
    );
    unit.originalLife = true;

    if (isArmored) {
      unit.healthMax *= 2;
      unit.health = unit.healthMax;
      unit.damage *= 2;
      // Add subsprite to show they are armored:
      Image.addSubSprite(unit.image, 'heavy_armor');

    }

  }
  testLevelData(): LevelData {
    const baseTileValues = Object.values(baseTiles);
    // Hard coded to match the tiles array below
    const width = 8;
    const height = 8;
    // 0: empty
    // 1: wall
    // 2: semiWall
    // 3: liquid
    // 4: ground

    const _tiles: Tile[] = [
      0, 1, 1, 1, 1, 1, 0, 0,
      1, 1, 4, 4, 4, 1, 1, 1,
      1, 4, 4, 3, 4, 4, 1, 4,
      1, 4, 3, 4, 4, 4, 4, 4,
      1, 4, 4, 4, 4, 4, 4, 4,
      1, 1, 4, 4, 4, 4, 4, 4,
      1, 4, 1, 4, 4, 4, 4, 4,
      1, 1, 1, 1, 4, 4, 4, 4,
    ].map((value, i) => {
      const pos = oneDimentionIndexToVec2(i, width);
      return {
        x: pos.x * config.OBSTACLE_SIZE,
        y: pos.y * config.OBSTACLE_SIZE,
        image: baseTileValues[value] || ''
      }
    });
    const map = {
      liquid: [],
      tiles: _tiles,
      width,
      height
    };
    globalThis.map = JSON.parse(JSON.stringify(map))
    convertBaseTilesToFinalTiles(map);
    const { tiles } = map;
    return {
      levelIndex: 1,
      liquid: [],
      limits: getLimits(tiles),
      obstacles: tiles.flatMap(t => {
        const obstacle = t && toObstacle(t);
        return obstacle ? [obstacle] : [];
      }),
      imageOnlyTiles: tiles.flatMap(x => x == undefined ? [] : [x]),
      width,
      pickups: [],
      enemies: [
        // { id: 'vampire', coord: { x: 64, y: 64 }, strength: 1, isArmored: false }
      ],
      validPlayerSpawnCoords: [{ x: 304, y: 280 }]

    }

  }

  // Returns undefined if it fails to make valid LevelData
  generateRandomLevelData(levelIndex: number): LevelData | undefined {
    console.log('Setup: generateRandomLevel', levelIndex);
    if (!caveSizes.small || !caveSizes.medium) {
      console.error('Missing caveSize for generating level')
      return;
    }
    const { map, limits } = generateCave(levelIndex > 6 ? caveSizes.medium : caveSizes.small, this);
    const { tiles, liquid, width } = map;
    const levelData: LevelData = {
      levelIndex,
      limits,
      liquid,
      obstacles: tiles.flatMap(t => {
        const obstacle = t && toObstacle(t);
        return obstacle ? [obstacle] : [];
      }),
      imageOnlyTiles: [],
      width,
      pickups: [],
      enemies: [],
      validPlayerSpawnCoords: []
    };
    let validSpawnCoords: Vec2[] = tiles.flatMap(t => t && t.image == all_ground ? [t] : []);
    // flatMap removes undefineds
    levelData.imageOnlyTiles = tiles.flatMap(x => x == undefined ? [] : [x]);

    levelData.validPlayerSpawnCoords = validSpawnCoords.filter(c => c.x <= config.OBSTACLE_SIZE * 2).slice(0, 8);
    // Remove spawns that are too close to player spawns
    validSpawnCoords = validSpawnCoords.filter(spawn => levelData.validPlayerSpawnCoords.every(ps => math.distance(spawn, ps) >= config.SAFETY_DISTANCE_FROM_PLAYER_SPAWN));

    // TODO numberOfPickups should scale with level size
    const numberOfPickups = 4;
    for (let i = 0; i < numberOfPickups; i++) {
      if (validSpawnCoords.length == 0) { break; }
      const choice = chooseObjectWithProbability(Pickup.pickups.map((p, i) => ({ index: i, probability: p.probability })), this.random);
      if (choice) {
        const { index } = choice;
        const validSpawnCoordsIndex = randInt(this.random, 0, validSpawnCoords.length - 1);
        const coord = validSpawnCoords.splice(validSpawnCoordsIndex, 1)[0];
        if (coord) {
          levelData.pickups.push({ index, coord })
        }
      }
    }
    // Spawn units at the start of the level
    const { unitIds, strength } = getEnemiesForAltitude(levelIndex, this);
    if (validSpawnCoords.length == 0) {
      console.error('Not enough spawn coords to spawn ANY enemies');
      return undefined;
    }
    for (let id of unitIds) {
      if (validSpawnCoords.length == 0) { break; }
      const validSpawnCoordsIndex = randInt(this.random, 0, validSpawnCoords.length - 1);
      const coord = validSpawnCoords.splice(validSpawnCoordsIndex, 1)[0];
      if (coord) {
        const roll = randInt(this.random, 0, 100);
        const isArmored = (roll < config.PERCENT_CHANCE_OF_HEAVY_UNIT);
        levelData.enemies.push({ id, coord, strength, isArmored })
      }
    }

    if (levelData.validPlayerSpawnCoords.length < this.players.length) {
      console.log('Bad level seed, not enough valid spawns for players, regenerating', levelData.validPlayerSpawnCoords.length, this.players.length);
      return;
    }
    return levelData;

  }
  addGroundTileImages() {
    if (globalThis.headless) {
      return;
    }
    // Lay down a ground tile for every tile that is not liquid
    for (let tile of this.imageOnlyTiles.filter(t => t.image.indexOf('liquid') === -1)) {
      if (tile.image) {
        const sprite = addPixiSprite('tiles/all_ground.png', containerBoard);
        if (sprite) {
          sprite.x = tile.x - config.COLLISION_MESH_RADIUS;
          sprite.y = tile.y - config.COLLISION_MESH_RADIUS;
        }
      }
    }
    // Then lay down wall tiles on top of them
    for (let tile of this.imageOnlyTiles.filter(t => t.image !== 'tiles/all_ground.png')) {
      if (tile.image) {
        if (tile.image == 'tiles/all_liquid.png') {
          // liquid tiles are rendered with a shader
          continue;
        }
        // Ground tiles that border liquid should go in containerBoard
        // Wall tiles should go in containerWalls
        const isWall = tile.image.toLowerCase().includes('wall');
        const sprite = addPixiSprite(tile.image, isWall ? containerWalls : containerBoard);
        if (sprite) {
          sprite.x = tile.x - config.COLLISION_MESH_RADIUS;
          sprite.y = tile.y - config.COLLISION_MESH_RADIUS;
        }
      }
    }
  }
  // fromSource is used when the spawn in question is spawning FROM something else,
  // like clone.  This prevents clones from spawning through walls
  isPointValidSpawn(spawnPoint: Vec2, radius: number, fromSource?: Vec2): boolean {
    if (fromSource) {
      // Ensure attemptSpawn isn't through any walls or liquidBounds
      if ([...this.walls, ...this.liquidBounds].some(wall => lineSegmentIntersection({ p1: fromSource, p2: spawnPoint }, wall))) {
        return false;
      }
    }
    // Ensure spawnPoint doesn't intersect any walls with radius:
    if ([...this.walls, ...this.liquidBounds].some(wall => {
      const rightAngleIntersection = findWherePointIntersectLineSegmentAtRightAngle(spawnPoint, wall);
      return rightAngleIntersection && math.distance(rightAngleIntersection, spawnPoint) <= radius;
    })) {
      return false;
    }
    return true;

  }
  // ringLimit limits how far away from the spawnSource it will check for valid spawn locations
  // same as below "findValidSpanws", but shortcircuits at the first valid spawn found and returns that
  findValidSpawn(spawnSource: Vec2, ringLimit: number, radius: number = config.COLLISION_MESH_RADIUS): Vec2 | undefined {
    const honeycombRings = ringLimit;
    for (let s of math.honeycombGenerator(radius, spawnSource, honeycombRings)) {
      const attemptSpawn = { ...s, radius: config.COLLISION_MESH_RADIUS };
      if (this.isPointValidSpawn(attemptSpawn, config.COLLISION_MESH_RADIUS, spawnSource)) {
        return attemptSpawn
      }
    }
    return undefined;
  }
  // Same as above "findValidSpawn", but returns an array of valid spawns
  findValidSpawns(spawnSource: Vec2, radius: number = config.COLLISION_MESH_RADIUS / 4, ringLimit: number): Vec2[] {
    const validSpawns: Vec2[] = [];
    const honeycombRings = ringLimit;
    // The radius passed into honeycombGenerator is how far between vec2s each honeycomb cell is
    for (let s of math.honeycombGenerator(radius, spawnSource, honeycombRings)) {
      // attemptSpawns radius must be the full config.COLLISION_MESH_RADIUS to ensure
      // that the spawning unit wont intersect something it shouldn't
      const attemptSpawn = { ...s, radius: config.COLLISION_MESH_RADIUS };
      if (this.isPointValidSpawn(attemptSpawn, config.COLLISION_MESH_RADIUS, spawnSource)) {
        // Return the first valid spawn found
        validSpawns.push(attemptSpawn);
      }
    }
    return validSpawns;

  }

  cleanUpLevel() {
    // Now that it's a new level clear out the level's dodads such as
    // bone dust left behind from destroyed corpses
    containerDoodads?.removeChildren();
    // Clean previous level info
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      // Clear all remaining AI units
      if (u && u.unitType === UnitType.AI) {
        Unit.cleanup(u);
        this.units.splice(i, 1);
      }
    }
    // Now that the units have been cleaned up syncPredictionEntities
    // so they are not out of sync with the underworld units array
    this.syncPredictionEntities();
    // Clear all pickups
    for (let p of this.pickups) {
      Pickup.removePickup(p, this, false);
    }
    // Clear all wall images:
    // Note: walls are stored in container Units so they can be sorted z-index
    // along with units
    // so this removes all unit images too.
    containerUnits?.removeChildren();

    // Clear all floor images
    containerBoard?.removeChildren();
    containerWalls?.removeChildren();
    containerLiquid?.removeChildren();
    cleanUpLiquidFilter();
    // Clean up blood
    graphicsBloodSmear?.clear();
    this.imageOnlyTiles = [];

    // Clear card usage counts, otherwise players will be
    // incentivied to bum around after a level to clear it themselves
    // which would be a bad player experience
    for (let p of this.players) {
      p.cardUsageCounts = {};
    }
  }
  postSetupLevel() {
    // Set the first turn phase
    this.broadcastTurnPhase(turn_phase.PlayerTurns);
    cameraAutoFollow(true);
    document.body?.classList.toggle('loading', false);
    setView(View.Game);
    // this.ensureAllClientsHaveAssociatedPlayers(getClients());
  }
  // creates a level from levelData
  createLevelSyncronous(levelData: LevelData) {
    // showUpgrades is invoked by createLevel which is called from a wsPie message
    // rather than from checkForEndOfLevel() because all players are guarunteed to receive
    // the CREATE_LEVEL message whereas, checkForEndOfLevel could be subject to a race condition
    // that might prevent the upgrade screen from showing for some users in rare circumstances.
    // Better to have the upgrade screen tied to the network message.
    if (this.levelIndex === 0) {
      for (let i = 0; i < config.STARTING_CARD_COUNT; i++) {
        this.showUpgrades(false);
      }
    } else {
      this.showUpgrades(true);
    }

    console.log('Setup: createLevel', levelData);
    this.lastLevelCreated = levelData;
    // Clean up the previous level
    this.cleanUpLevel();

    const { levelIndex, limits, liquid, imageOnlyTiles, pickups, enemies, obstacles, validPlayerSpawnCoords } = levelData;
    this.levelIndex = levelIndex;
    this.limits = limits;

    // Setup liquid
    setupLiquidFilter();
    for (let tile of liquid) {
      const sprite = addPixiSprite(tile.image, containerLiquid);
      if (sprite) {
        sprite.x = tile.x - config.COLLISION_MESH_RADIUS;
        sprite.y = tile.y - config.COLLISION_MESH_RADIUS;
      }
    }
    // empty tiles are tiles with an image of ''
    this.cacheWalls(obstacles, imageOnlyTiles.filter(x => x.image == ''));
    this.imageOnlyTiles = imageOnlyTiles;
    this.addGroundTileImages();
    for (let p of pickups) {
      this.spawnPickup(p.index, p.coord);
    }
    for (let e of enemies) {
      this.spawnEnemy(e.id, e.coord, e.isArmored, e.strength);
    }
    // Show text in center of screen for the new level
    queueCenteredFloatingText(
      `Level ${this.levelIndex + 1}`,
      'white'
    );
    // validPlayerSpawnCoords must be set before resetting the player
    // so the player has coords to spawn into
    this.validPlayerSpawnCoords = validPlayerSpawnCoords;
    for (let player of this.players) {
      Player.resetPlayerForNextLevel(player, this);
    }
    this.postSetupLevel();
    // Change song now that level has changed:
    if (globalThis.playNextSong) {
      globalThis.playNextSong();
    }
  }
  async createLevel(levelData: LevelData) {
    return new Promise<void>(resolve => {
      document.body?.classList.toggle('loading', true);
      // Add timeout so that loading can update dom
      setTimeout(() => {
        this.createLevelSyncronous(levelData);
        resolve();
      }, 10)
    });
  }
  generateLevelDataSyncronous(levelIndex: number): LevelData {
    console.log('Setup: generateLevelData', levelIndex);
    this.levelIndex = levelIndex;
    // Generate level
    let level;
    do {
      // Invoke generateRandomLevel again until it succeeds
      level = this.generateRandomLevelData(levelIndex);
    } while (level === undefined);
    this.pie.sendData({
      type: MESSAGE_TYPES.CREATE_LEVEL,
      level
    });
    return level;
  }
  async generateLevelData(levelIndex: number): Promise<LevelData> {
    return new Promise<LevelData>(resolve => {
      document.body?.classList.toggle('loading', true);
      // setTimeout allows the UI to refresh before locking up the CPU with
      // heavy level generation code
      setTimeout(() => {
        resolve(this.generateLevelDataSyncronous(levelIndex));
      }, 10);
    })
  }
  checkPickupCollisions(unit: Unit.IUnit, prediction: boolean) {
    for (let pu of ((prediction && globalThis.predictionPickups) ? globalThis.predictionPickups : this.pickups)) {
      // Note, units' radius is rather small (to allow for crowding), so
      // this distance calculation uses neither the radius of the pickup
      // nor the radius of the unit.  It is hard coded to 2 COLLISION_MESH_RADIUSES
      // which is currently 64 px (or the average size of a unit);
      if (math.distance(unit, pu) < config.COLLISION_MESH_RADIUS * 2) {
        Pickup.triggerPickup(pu, unit, this, prediction);
      }
    }
  }
  getMousePos(): Vec2 {
    if (!(app && containerBoard)) {
      return { x: 0, y: 0 }
    }
    const { x, y } = containerBoard.toLocal(
      app.renderer.plugins.interaction.mouse.global,
    );
    return { x, y };
  }
  isGameOver(): boolean {
    return !this.players.some(p => p.unit.alive);
  }
  goToNextPhaseIfAppropriate(): boolean {
    // Only move on from the player turn phase if there are players in the game,
    // otherwise, wait for players to be in the game so that the serve doesn't just 
    // run cycles pointlessly
    if (this.turn_phase === turn_phase.PlayerTurns && this.players.length > 0) {
      // If all players that have taken turns, then...
      // (Players who CANT take turns have their turn ended automatically)
      // TODO: Make sure game can't get stuck here
      const activeAlivePlayers = this.players.filter(p => p.clientConnected && p.unit.alive);
      if (
        activeAlivePlayers.every(p => p.endedTurn)
      ) {
        this.endPlayerTurnPhase();
        return true;
      } else {
        console.log('PlayerTurn: Check end player turn phase; players havent ended turn yet:', activeAlivePlayers.filter(p => !p.endedTurn).map(p => p.clientId));
      }
    }
    return false;
  }
  endPlayerTurnPhase() {
    console.log('Underworld: TurnPhase: End player turn phase');
    // Safety, force die any units that are out of bounds (this should never happen)
    for (let u of this.units.filter(u => u.alive)) {
      if (this.lastLevelCreated) {
        // TODO ensure that this works on headless
        const originalTile = this.lastLevelCreated.imageOnlyTiles[vec2ToOneDimentionIndexPreventWrap({ x: Math.round(u.x / config.OBSTACLE_SIZE), y: Math.round(u.y / config.OBSTACLE_SIZE) }, this.lastLevelCreated.width)];
        if (!originalTile || originalTile.image == '') {
          console.error('Unit was force killed because they ended up out of bounds', u.unitSubType)
          Unit.die(u, this, false);
        }
      }
    }
    // Add mana to AI units
    for (let unit of this.units.filter((u) => u.unitType === UnitType.AI && u.alive)) {
      unit.mana += unit.manaPerTurn;
      // Cap manaPerTurn at manaMax
      unit.mana = Math.min(unit.mana, unit.manaMax);
    }
    // Decrement card usage counts,
    // This makes spells less expensive
    for (let p of this.players) {
      for (let cardId of p.cards) {
        // Decrement, cap at 0
        const cardUsage = p.cardUsageCounts[cardId];
        if (cardUsage !== undefined) {
          p.cardUsageCounts[cardId] = Math.max(0, cardUsage - 1);
        }
      }
    }
    updateManaCostUI(this);
    // Move onto next phase
    // Note: BroadcastTurnPhase should happen last because it
    // queues up a unitsync, so if changes to the units
    // were to happen AFTER broadcastTurnPhase they would be
    // overwritten when the sync occurred
    this.broadcastTurnPhase(turn_phase.NPC_ALLY);
  }

  async endNPCTurnPhase() {
    // Move onto next phase
    // --
    // Note: The reason this logic happens here instead of in initializeTurnPhase
    // is because initializeTurnPhase needs to be called on game load to put everything
    // in a good state when updating to the canonical client's game state. (this 
    // happens when one client disconnects and rejoins).
    // --
    // Trigger onTurnEnd Events
    for (let unit of this.units.filter(u => u.unitType === UnitType.AI)) {
      await Promise.all(unit.onTurnEndEvents.map(
        async (eventName) => {
          const fn = Events.onTurnEndSource[eventName];
          return fn ? await fn(unit, this) : false;
        },
      ));
    }
    // Increment the turn number now that it's starting over at the first phase
    this.turn_number++;

    for (let p of this.pickups) {
      if (p.turnsLeftToGrab !== undefined) {
        p.turnsLeftToGrab--;
        if (p.text) {
          p.text.text = `${p.turnsLeftToGrab}`;
        }
      }
      if (p.turnsLeftToGrab !== undefined && p.turnsLeftToGrab < 0) {
        // Trigger custom behavior
        if (p.onTurnsLeftDone) {
          await p.onTurnsLeftDone(p);
        }
        // Remove pickup
        Pickup.removePickup(p, this, false);
      }
    }

    this.broadcastTurnPhase(turn_phase.PlayerTurns);
  }
  syncTurnMessage() {
    console.log('syncTurnMessage: phase:', turn_phase[this.turn_phase]);
    let message = '';
    let yourTurn = false;
    if (this.turn_phase === turn_phase.NPC_ALLY) {
      message = "Ally Turn";
      yourTurn = false;
    } else if (this.turn_phase === turn_phase.NPC_ENEMY) {
      message = "Enemy Turn";
      yourTurn = false;
    } else if (this.turn_phase === turn_phase.PlayerTurns) {
      if (globalThis.player?.endedTurn) {
        message = `Waiting on ${this.players.filter(p => !p.endedTurn).length} Other Players`
        yourTurn = false;
      } else {
        message = 'Your Turn';
        yourTurn = true;
      }
    } else if (this.isGameOver()) {
      message = 'Game Over';
      yourTurn = false;
    } else {
      message = '';
      console.error('Unknown syncTurnMessage state');
    }
    if (elPlayerTurnIndicator) {
      elPlayerTurnIndicator.innerText = message;
    }
    document.body?.classList.toggle('your-turn', yourTurn);

    // Update level indicator UI at top of screen
    if (elLevelIndicator) {
      elLevelIndicator.innerText = `Level ${this.levelIndex}`;
    } else {
      console.error('elLevelIndicator is null');
    }
  }
  async initializePlayerTurns() {
    for (let player of this.players) {
      if (!player) {
        console.error("Attempted to initialize turn for a non existant player");
        console.trace('Attempted to initialize nonexistant player trace');
        return;
      }
      // Reset player.endedTurn
      player.endedTurn = false;
      // Give mana at the start of turn
      const manaTillFull = player.unit.manaMax - player.unit.mana;
      // Give the player their mana per turn but don't let it go beyond manaMax
      // It's implemented this way instead of an actual capping in a setter so that
      // mana CAN go beyond max for other reasons (like mana potions), by design
      if (player.unit.alive) {
        player.unit.mana += Math.max(0, Math.min(player.unit.manaPerTurn, manaTillFull));
      }

      // If this current player is NOT able to take their turn...
      if (!Player.ableToTakeTurn(player)) {
        // Skip them
        this.endPlayerTurn(player.clientId);
        // Do not continue with initialization
        return;
      }
      if (player == globalThis.player) {
        // Notify the current player that their turn is starting
        queueCenteredFloatingText(`Your Turn`);

      }
      // Trigger onTurnStart Events
      const onTurnStartEventResults: boolean[] = await Promise.all(player.unit.onTurnStartEvents.map(
        async (eventName) => {
          const fn = Events.onTurnStartSource[eventName];
          return fn ? await fn(player.unit, false, this) : false;
        },
      ));
      if (onTurnStartEventResults.some((b) => b)) {
        // If any onTurnStartEvents return true, skip the player
        this.endPlayerTurn(player.clientId);
        // Do not continue with initialization
        return;
      }
      // If player is killed at the start of their turn (for example, due to poison)
      // end their turn
      if (!player.unit.alive) {
        this.endPlayerTurn(player.clientId);
      }
    }
    this.syncTurnMessage();
  }
  // Sends a network message to end turn
  async endMyTurn() {
    if (globalThis.player) {
      // Turns can only be manually ended during the PlayerTurns phase
      if (this.isMyTurn()) {
        let affirm = true
        // Interrupt endTurn with a cancellable prompt IF
        // player hasn't already ended their turn (note if they already HAVE ended their turn, just allow the END_TURN message to go through; this
        // might, but hopefully never, come in handy in the event that there is a desync and the client thinks it's ended its turn but the server doesn't. then
        // the client can end it again)
        // and stamina is still max
        // and player has not cast yet
        if (!globalThis.player.endedTurn && globalThis.player.unit.stamina == globalThis.player.unit.staminaMax && !globalThis.castThisTurn) {
          affirm = await Jprompt({ text: 'Are you sure you want to end your turn without moving or casting?', noBtnText: 'Cancel', noBtnKey: 'Escape', yesText: 'End Turn', yesKey: 'Space', yesKeyText: 'Spacebar' });
        }
        if (affirm) {
          console.log('endMyTurn: send END_TURN message');
          this.pie.sendData({ type: MESSAGE_TYPES.END_TURN });
        }
      }
    }
  }
  async endPlayerTurn(clientId: string) {
    console.log('endPlayerTurn', clientId)
    const playerIndex = this.players.findIndex((p) => p.clientId === clientId);
    const player = this.players[playerIndex];
    if (!player) {
      console.error('Cannot end turn, player with clientId:', clientId, 'does not exist');
      return;
    }
    player.endedTurn = true;
    if (this.turn_phase != turn_phase.PlayerTurns) {
      // (A player "ending their turn" when it is not their turn
      // can occur when a client disconnects when it is not their turn)
      console.info('Cannot end the turn of a player when it isn\'t currently their turn')
      return
    }
    // Ensure players can only end the turn when it IS their turn
    if (this.turn_phase === turn_phase.PlayerTurns) {
      // Trigger onTurnEnd Events
      await Promise.all(player.unit.onTurnEndEvents.map(
        async (eventName) => {
          const fn = Events.onTurnEndSource[eventName];
          return fn ? await fn(player.unit, this) : false;
        },
      ));
      console.log('PlayerTurn: End player turn', clientId);
      this.syncTurnMessage();
      const wentToNextLevel = this.checkForEndOfLevel();
      if (wentToNextLevel) {
        return;
      }
      const gameIsOver = this.isGameOver();
      if (gameIsOver) {
        // Prevent infinite loop since there are no players
        // alive it would continue to loop endlessly and freeze up
        // the game if it didn't early return here
        return;
      }
      const wentToNextPhase = this.goToNextPhaseIfAppropriate();
      if (wentToNextPhase) {
        return;
      }
    } else {
      console.error("turn_phase must be PlayerTurns to end turn.  Cannot be ", this.turn_phase);
    }
  }
  chooseUpgrade(player: Player.IPlayer, upgrade: Upgrade.IUpgrade) {
    upgrade.effect(player, this);
    player.upgrades.push(upgrade);
    if (player == globalThis.player) {
      document.body?.querySelector(`.card[data-upgrade="${upgrade.title}"]`)?.classList.toggle('chosen', true);
      // Clear upgrades when current player has picked one
      document.body?.classList.toggle('showUpgrades', false);
      // Show next round of upgrades to pick if there are upgrades in the queue
      if (showUpgradesQueue.length) {
        const statsUpgrades = showUpgradesQueue.shift();
        if (statsUpgrades !== undefined) {
          this.showUpgrades(statsUpgrades);
        }
      }

    }
  }

  showUpgrades(statsUpgrades: boolean) {
    if (!globalThis.player) {
      console.error('Cannot show upgrades, no globalThis.player');
      return
    }
    if (document.body?.classList.contains('showUpgrades')) {
      // Upgrades are already visible, queue the next upgrades
      showUpgradesQueue.push(statsUpgrades);
      return;
    }
    let minimumProbability = 0;
    const startingSpellsLeftToPick = config.STARTING_CARD_COUNT - globalThis.player.inventory.length
    if (startingSpellsLeftToPick > 0) {
      // Limit starting cards to a probability of 10 or more
      minimumProbability = 10;
      if (elUpgradePickerLabel) {
        elUpgradePickerLabel.innerHTML = `Pick ${startingSpellsLeftToPick} starting spells.`;
      }
    } else {
      if (elUpgradePickerLabel) {
        elUpgradePickerLabel.innerHTML = statsUpgrades ? 'Pick an upgrade' : 'Pick a spell';
      }
    }
    // Now that level is complete, move to the Upgrade view where players can choose upgrades
    // before moving on to the next level
    // Generate Upgrades
    document.body?.classList.toggle('showUpgrades', true);
    if (!elUpgradePicker || !elUpgradePickerContent) {
      console.error('elUpgradePicker or elUpgradePickerContent are undefined.');
    }
    const player = this.players.find(
      (p) => p.clientId === globalThis.clientId,
    );
    if (player) {
      const upgrades = Upgrade.generateUpgrades(player, 3, minimumProbability, statsUpgrades);
      if (!upgrades.length) {
        // Player already has all the upgrades
        document.body?.classList.toggle('showUpgrades', false);
        queueCenteredFloatingText('No more spell upgrades to pick from.');
      } else {
        const elUpgrades = upgrades.map((upgrade) => Upgrade.createUpgradeElement(upgrade, player, this));
        if (elUpgradePickerContent) {
          elUpgradePickerContent.innerHTML = '';
          for (let elUpgrade of elUpgrades) {
            if (elUpgrade) {

              elUpgradePickerContent.appendChild(elUpgrade);
              if (globalThis.devMode) {
                elUpgrade.click();
              }
            } else {
              console.warn('Upgrade is undefined, this block should never be executed in headless mode')
            }
          }
        }
      }
    } else {
      console.error('Upgrades cannot be generated, player not found');
    }
  }

  // Returns true if it goes to the next level
  checkForEndOfLevel(): boolean {
    // All living (and client connected) players
    const livingPlayers = this.players.filter(
      (p) => p.unit.alive && p.clientConnected,
    );
    const areAllLivingPlayersInPortal =
      livingPlayers.filter((p) => p.inPortal).length === livingPlayers.length;
    // Advance the level if there are living players and they all are in the portal:
    if (livingPlayers.length && areAllLivingPlayersInPortal) {
      // Invoke initLevel within a timeout so that this function
      // doesn't have to wait for level generation to complete before
      // returning
      setTimeout(() => {
        // Prepare the next level
        if (globalThis.isHost(this.pie)) {
          this.generateLevelData(++this.levelIndex);
        }
      }, 0)
      // Return of true signifies it went to the next level
      return true;
    }
    return false;
  }
  getRandomCoordsWithinBounds(bounds: Limits): Vec2 {
    const x = randInt(this.random, bounds.xMin || 0, bounds.xMax || 0);
    const y = randInt(this.random, bounds.yMin || 0, bounds.yMax || 0);
    return { x, y };
  }
  async broadcastTurnPhase(p: turn_phase) {
    // If host, send sync; if non-host, ignore 
    if (globalThis.isHost(this.pie)) {
      console.log('Broadcast turn phase', turn_phase[p]);
      this.pie.sendData({
        type: MESSAGE_TYPES.SET_PHASE,
        phase: p,
        units: this.units.map(Unit.serialize),
        players: this.players.map(Player.serialize)
      });
    }
  }
  // sets underworld.turn_phase variable and syncs related html classes
  // Do not confuse with initializeTurnPhase which runs initialization
  // logic when the turn phase changes.  Note: initializeTurnPhase
  // calls this function
  setTurnPhase(p: turn_phase) {
    console.log('setTurnPhase(', turn_phase[p], ')');
    this.turn_phase = p;
    this.syncTurnMessage();

    // Remove all phase classes from body
    if (!globalThis.headless) {
      // @ts-expect-error Property 'values' does not exist on type 'DOMTokenList'
      for (let phaseClass of document.body?.classList.values()) {
        if (phaseClass.includes('phase-')) {
          document.body?.classList.remove(phaseClass);
        }
      }
    }
    const phase = turn_phase[this.turn_phase];
    if (phase) {
      // Add current phase class to body
      document.body?.classList.add('phase-' + phase.toLowerCase());
    } else {
      console.error('Invalid turn phase', this.turn_phase)
    }

  }
  // Initialization logic that runs to setup a change of turn_phase
  // Invoked only through wsPie, use broadcastTurnPhase in game logic
  // when you want to set the turn_phase
  async initializeTurnPhase(p: turn_phase) {
    console.log('initializeTurnPhase(', turn_phase[p], ')');

    // Clear cast this turn
    globalThis.castThisTurn = false;

    // Clear debug graphics
    globalThis.debugGraphics?.clear()

    // Change the underworld.turn_phase variable and
    // related html classes that are used by the UI to
    // know what turn phase it is
    this.setTurnPhase(p);

    // Clean up invalid units
    const keepUnits: Unit.IUnit[] = [];
    for (let u of this.units) {
      if (!u.flaggedForRemoval) {
        keepUnits.push(u);
      }
    }
    this.units = keepUnits;

    const phase = turn_phase[this.turn_phase];
    if (phase) {
      switch (phase) {
        case turn_phase[turn_phase.PlayerTurns]:

          for (let u of this.units.filter(u => u.unitType == UnitType.PLAYER_CONTROLLED)) {
            // Reset stamina for player units so they can move again
            u.stamina = u.staminaMax;
          }
          // Lastly, initialize the player turns.
          // Note, it is possible that calling this will immediately end
          // the player phase (if there are no players to take turns)
          this.initializePlayerTurns();
          break;
        case turn_phase[turn_phase.NPC_ALLY]:
          for (let u of this.units.filter(u => u.unitType == UnitType.AI && u.faction == Faction.ALLY)) {
            // Reset stamina for non-player units so they can move again
            u.stamina = u.staminaMax;
          }
          // Clear enemy attentionMarkers since it's now their turn
          globalThis.attentionMarkers = [];
          // Run AI unit actions
          await this.executeNPCTurn(Faction.ALLY);
          // Now that allies are done taking their turn, change to NPC Enemy turn phase
          this.broadcastTurnPhase(turn_phase.NPC_ENEMY)
          break;
        case turn_phase[turn_phase.NPC_ENEMY]:
          for (let u of this.units.filter(u => u.unitType == UnitType.AI && u.faction == Faction.ENEMY)) {
            // Reset stamina for non-player units so they can move again
            u.stamina = u.staminaMax;
          }
          // Clear enemy attentionMarkers since it's now their turn
          globalThis.attentionMarkers = [];
          // Run AI unit actions
          await this.executeNPCTurn(Faction.ENEMY);
          // Set turn phase to player turn
          this.endNPCTurnPhase();
          break;
        default:
          break;
      }
    } else {
      console.error('Invalid turn phase', this.turn_phase)
    }
  }

  async executeNPCTurn(faction: Faction) {
    console.log('game: executeNPCTurn', Faction[faction]);
    const animationPromises: Promise<void>[] = [];
    unitloop: for (let u of this.units.filter(
      (u) => u.unitType === UnitType.AI && u.alive && u.faction == faction,
    )) {
      // Trigger onTurnStart Events
      const abortTurn = await Unit.runTurnStartEvents(u, false, this);
      if (abortTurn) {
        continue unitloop;
      }
      // If unit is now dead (due to turnStartEvents)
      // abort their turn
      if (!u.alive) {
        continue unitloop;
      }
      const unitSource = allUnits[u.unitSourceId];
      if (unitSource) {
        const target = this.getUnitAttackTarget(u);
        // Add unit action to the array of promises to wait for
        // TODO: Prevent grunts from attacking if they are out of range
        // like when they are around a corner
        let promise = raceTimeout(5000, `Unit.action; unit.id: ${u.id}; subType: ${u.unitSubType}`, unitSource.action(u, target, this, this.canUnitAttackTarget(u, target)));
        animationPromises.push(promise);
      } else {
        console.error(
          'Could not find unit source data for',
          u.unitSourceId,
        );
      }
    }
    await Promise.all(animationPromises);

  }
  canUnitAttackTarget(u: Unit.IUnit, attackTarget?: Unit.IUnit): boolean {
    if (!attackTarget) {
      return false;
    }
    switch (u.unitSubType) {
      case UnitSubType.MELEE:
        this.setPath(u, attackTarget);
        if (u.path && u.path.points.length) {
          // Returns true if melee unit WILL be within range once their done moving
          // (Note: Does not take into account dynamic obstacles)
          const lastPointInPath = u.path.points[u.path.points.length - 1]
          if (lastPointInPath && math.distance(lastPointInPath, attackTarget) > config.COLLISION_MESH_RADIUS * 2) {
            // Note: a unit's path isn't guarunteed to include the target (if 
            // they can't find a valid path it won't include the target)
            // So if the lastPointInPath isn't relatively close to the target,
            // return false because the path doesn't make it all the way to the target
            return false;
          }
          const maxPathDistance = u.attackRange + u.staminaMax;
          const dist = calculateDistanceOfVec2Array([u, ...u.path.points]);
          return !!u.path.points.length && dist <= maxPathDistance;
        } else {
          // Returns true if melee unit is ALREADY within range
          return withinMeleeRange(u, attackTarget)
        }
      case UnitSubType.RANGED_LOS:
        return this.hasLineOfSight(u, attackTarget)
      case UnitSubType.RANGED_RADIUS:
        return u.alive && Unit.inRange(u, attackTarget);
      case UnitSubType.SUPPORT_CLASS:
        // Support classes (such as priests) dont attack
        return false;
      default:
        console.error('Cannot determine canUnitAttackTarget, unit sub type is unaccounted for', u.unitSubType)
        return false;
    }

  }
  getUnitAttackTarget(u: Unit.IUnit): Unit.IUnit | undefined {
    switch (u.unitSubType) {
      case UnitSubType.MELEE:
        return Unit.findClosestUnitInDifferentFaction(u, this);
      case UnitSubType.RANGED_LOS:
        return getBestRangedLOSTarget(u, this);
      case UnitSubType.RANGED_RADIUS:
        return Unit.findClosestUnitInDifferentFaction(u, this);
      case UnitSubType.PLAYER_CONTROLLED:
        // Ignore player controlled units, they don't get an attack target assigned by
        // the game, they choose their own.
        return undefined;
      case UnitSubType.SUPPORT_CLASS:
        // Support class units don't have attack targets
        return undefined;
      default:
        console.error('Cannot determine attackTarget, unit sub type is unaccounted for', UnitSubType[u.unitSubType], u.unitSubType)
        return undefined;
    }
  }

  getPickupsWithinDistanceOfTarget(
    target: Vec2,
    distance: number,
    prediction: boolean,
  ): Pickup.IPickup[] {
    const withinDistance: Pickup.IPickup[] = [];
    const pickups = (prediction && globalThis.predictionPickups) ? globalThis.predictionPickups : this.pickups;
    for (let pickup of pickups) {
      if (math.distance(pickup, target) <= distance) {
        withinDistance.push(pickup);
      }
    }
    return withinDistance;
  }
  getUnitsWithinDistanceOfTarget(
    target: Vec2,
    distance: number,
    prediction: boolean,
  ): Unit.IUnit[] {
    const withinDistance: Unit.IUnit[] = [];
    const units = (prediction && globalThis.predictionUnits) ? globalThis.predictionUnits : this.units;
    for (let unit of units) {
      if (math.distance(unit, target) <= distance) {
        withinDistance.push(unit);
      }
    }
    return withinDistance;
  }
  getUnitsAt(coords: Vec2, prediction?: boolean): Unit.IUnit[] {
    const sortedByProximityToCoords = (prediction && globalThis.predictionUnits ? globalThis.predictionUnits : this.units)
      // Filter for only valid units, not units with NaN location or waiting to be removed
      .filter(u => !u.flaggedForRemoval && !isNaN(u.x) && !isNaN(u.y))
      // Filter for units within SELECTABLE_RADIUS of coordinates
      .filter(u => math.distance(u, coords) <= config.SELECTABLE_RADIUS)
      // Order by closest to coords
      .sort((a, b) => math.distance(a, coords) - math.distance(b, coords))
      // Sort dead units to the back, prefer selecting living units
      // TODO: This should be opposite if the spell is ressurect
      .sort((a, b) => a.alive && b.alive ? 0 : a.alive ? -1 : 1);
    return sortedByProximityToCoords;
  }
  getUnitAt(coords: Vec2, prediction?: boolean): Unit.IUnit | undefined {
    return this.getUnitsAt(coords, prediction)[0];
  }
  getPickupAt(coords: Vec2, prediction?: boolean): Pickup.IPickup | undefined {
    const sortedByProximityToCoords = (prediction && globalThis.predictionPickups ? globalThis.predictionPickups : this.pickups)
      .filter(p => !isNaN(p.x) && !isNaN(p.y) && math.distance(coords, p) <= p.radius).sort((a, b) => math.distance(a, coords) - math.distance(b, coords));
    const closest = sortedByProximityToCoords[0]
    return closest;
  }
  addUnitToArray(unit: Unit.IUnit, prediction: boolean) {
    if (prediction && globalThis.predictionUnits) {
      globalThis.predictionUnits.push(Unit.copyForPredictionUnit(unit, this));
    } else {
      this.units.push(unit);
    }
  }
  removePickupFromArray(pickup: Pickup.IPickup, prediction: boolean) {
    if (prediction && globalThis.predictionPickups) {
      globalThis.predictionPickups = globalThis.predictionPickups.filter(p => p !== pickup);
    } else {
      this.pickups = this.pickups.filter((p) => p !== pickup);
    }
  }
  addPickupToArray(pickup: Pickup.IPickup, prediction: boolean) {
    if (prediction && globalThis.predictionPickups) {
      globalThis.predictionPickups.push(Pickup.copyForPredictionPickup(pickup))
    } else {
      this.pickups.push(pickup);
    }
  }
  async castCards(
    casterCardUsage: Player.CardUsage,
    casterUnit: Unit.IUnit,
    cardIds: string[],
    castLocation: Vec2,
    prediction: boolean,
    // If true, prevents removing mana when spell is cast.  This is used for "trap" card
    costPrepaid: boolean,
  ): Promise<Cards.EffectState> {
    if (!prediction && casterUnit == (globalThis.player && globalThis.player.unit)) {
      globalThis.castThisTurn = true;
    }
    const unitAtCastLocation = this.getUnitAt(castLocation, prediction);
    const pickupAtCastLocation = this.getPickupAt(castLocation, prediction);
    let effectState: Cards.EffectState = {
      cardIds,
      casterCardUsage,
      casterUnit,
      targetedUnits: unitAtCastLocation ? [unitAtCastLocation] : [],
      targetedPickups: pickupAtCastLocation ? [pickupAtCastLocation] : [],
      castLocation,
      aggregator: {
        unitDamage: [],
      },
    };
    if (!effectState.casterUnit.alive) {
      // Prevent dead players from casting
      return effectState;
    }
    if (!costPrepaid) {
      const cards = Cards.getCardsFromIds(cardIds);
      const spellCost = calculateCost(cards, casterCardUsage);
      // Apply mana and health cost to caster
      // Note: it is important that this is done BEFORE a card is actually cast because
      // the card may affect the caster's mana
      effectState.casterUnit.mana -= spellCost.manaCost;
      Unit.takeDamage(effectState.casterUnit, spellCost.healthCost, this, prediction, effectState);
      // Add expense scaling BEFORE card effects are invoked
      // This is important because of 'trap' since trap removes
      // the cards after it in the spell, it is important
      // that they still get expense scaling
      for (let cardId of effectState.cardIds) {
        const card = Cards.allCards[cardId];
        if (card) {
          // Now that the caster is using the card, increment usage count
          if (casterCardUsage[cardId] === undefined) {
            casterCardUsage[cardId] = 0;
          }
          casterCardUsage[cardId] += card.expenseScaling;
          if (!prediction) {
            updateManaCostUI(this);
          }
        }
      }
    }

    // "quantity" is the number of identical cards cast in a row. Rather than casting the card sequentially
    // quantity allows the card to have a unique scaling effect when cast sequentially after itself.
    let quantity = 1;
    for (let index = 0; index < effectState.cardIds.length; index++) {
      const cardId = effectState.cardIds[index];
      if (cardId === undefined) {
        console.error('card id is undefined in loop', index, effectState.cardIds);
        continue;
      }
      const card = Cards.allCards[cardId];
      if (card) {
        // Only increment quantity for sequntial identical cards IF the card
        // explicitly supports quantity
        if (card.supportQuantity) {
          const nextCardId = effectState.cardIds[index + 1];
          if (nextCardId !== undefined) {
            if (nextCardId === cardId) {
              quantity++;
              continue;
            }
          }
        }


        effectState = await card.effect(effectState, card, quantity, this, prediction);

        // Clear images from previous card before drawing the images from the new card
        containerSpells?.removeChildren();
      }
      // Reset quantity once a card is cast
      quantity = 1;
    }
    if (!prediction) {
      // Clear spell animations once all cards are done playing their animations
      containerSpells?.removeChildren();
    }

    return effectState;
  }
  checkIfShouldSpawnPortal() {
    if (this.units.filter(u => u.faction == Faction.ENEMY).every(u => !u.alive)) {
      // Convenience: Pickup any CARD_PICKUP_NAME left automatically, so that they aren't left behind
      this.pickups.filter(p => p.name == Pickup.CARDS_PICKUP_NAME).forEach(pickup => {
        if (globalThis.player) {
          Pickup.triggerPickup(pickup, globalThis.player.unit, this, false);
        }
      })
      // Spawn portal near each player
      const portalPickup = Pickup.pickups.find(p => p.imagePath == 'portal');
      if (portalPickup) {
        for (let playerUnit of this.units.filter(u => u.unitType == UnitType.PLAYER_CONTROLLED && u.alive)) {
          const portalSpawnLocation = this.findValidSpawn(playerUnit, 2) || playerUnit;
          Pickup.create({ pos: portalSpawnLocation, pickupSource: portalPickup }, this, false);
          // Give all player units max stamina for convenience:
          playerUnit.stamina = playerUnit.staminaMax;
          // Give all players max health and mana (it will be reset anyway when they are reset for the next level
          // but this disswades them from going around to pickup potions)
          playerUnit.health = playerUnit.healthMax;
          playerUnit.mana = playerUnit.manaMax;

        }
      } else {
        console.error('Portal pickup not found')
      }
    }

  }

  // hasLineOfSight returns true if there are no walls interrupting
  // a line from seer to target
  // Note: if you want a function like this that returns a Vec2, try
  // closestLineSegmentIntersection
  hasLineOfSight(seer: Vec2, target: Vec2): boolean {
    const lineOfSight: LineSegment = { p1: seer, p2: target };
    for (let w of this.walls) {
      if (lineSegmentIntersection(lineOfSight, w)) {
        return false
      }
    }
    return true
  }
  // shuffleUnits adapted from https://stackoverflow.com/a/2450976/4418836
  // Used for validating the efficacy of syncUnits
  dev_shuffleUnits() {
    let currentIndex = this.units.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      // @ts-ignore
      [this.units[currentIndex], this.units[randomIndex]] = [
        this.units[randomIndex], this.units[currentIndex]];
    }

    return this.units;
  }
  syncUnits(units: Unit.IUnitSerialized[]) {
    console.log('sync: Syncing units', units.map(u => u.id), this.units.map(u => u.id));
    // Remove excess units if local copy of units has more units than the units it
    // should be syncing with
    if (this.units.length > units.length) {
      console.log('sync: Remove excess units')
      for (let i = units.length; i < this.units.length; i++) {
        const unit = this.units[i];
        if (unit) {
          Unit.cleanup(unit);
        }
      }
      this.units.splice(units.length);
    }
    for (let i = 0; i < units.length; i++) {
      const syncUnit = units[i];
      const currentUnit = this.units[i];
      if (syncUnit) {
        if (currentUnit) {
          // Note: Unit.syncronize maintains the player.unit reference
          Unit.syncronize(syncUnit, currentUnit);
        } else {
          const newUnit = Unit.create(syncUnit.unitSourceId, syncUnit.x, syncUnit.y, syncUnit.faction, syncUnit.defaultImagePath, syncUnit.unitType, syncUnit.unitSubType, syncUnit.strength, undefined, this);
          Unit.syncronize(syncUnit, newUnit);
        }
      }
    }

  }
  // Sends what this player is thinking to other clients
  // Optimized to only send if message has changed
  sendPlayerThinking(thoughts: { target?: Vec2, cardIds: string[] }) {
    // Only send your thoughts on your turn
    if (this.isMyTurn()) {
      let { target, cardIds } = thoughts;
      // Since it takes a hash, best to round target
      // to whole numbers so floating point changes
      // don't create a different hash
      if (target) {
        target = Vec.round(target);
      }
      const hash = objectHash({ target, cardIds });
      if (hash !== this.lastThoughtsHash) {
        this.lastThoughtsHash = hash;
        if (this.pie) {
          this.pie.sendData({
            type: MESSAGE_TYPES.PLAYER_THINKING,
            target,
            cardIds
          });
        }
      }
    }

  }
  // Returns an array of newly created players
  ensureAllClientsHaveAssociatedPlayers(clients: string[]): Player.IPlayer[] {
    let newlyCreatedPlayers: Player.IPlayer[] = [];
    // Ensure all clients have players
    for (let clientId of clients) {
      const player = this.players.find(p => p.clientId == clientId);
      if (!player) {
        // If the client that joined does not have a player yet, make them one immediately
        // since all clients should always have a player associated
        console.log(`Setup: Create a Player instance for ${clientId}`)
        const p = Player.create(clientId, this);
        Player.resetPlayerForNextLevel(p, this);
        newlyCreatedPlayers.push(p);
      }
    }
    // Sync all players' connection statuses with the clients list
    // This ensures that there are no players left that think they're connected
    // but are not a part of the clients list
    for (let player of this.players) {
      const wasConnected = player.clientConnected;
      const isConnected = clients.includes(player.clientId);
      Player.setClientConnected(player, isConnected, this);
      if (!wasConnected && isConnected) {
        // Send the lastest gamestate to that client so they can be up-to-date:
        // Note: It is important that this occurs AFTER the player instance is created for the
        // client who just joined
        // If the game has already started (e.g. the host has already joined), send the initial state to the new 
        // client only so they can load
        hostGiveClientGameState(player.clientId, this, this.lastLevelCreated, MESSAGE_TYPES.INIT_GAME_STATE);
      }
    }
    return newlyCreatedPlayers;
  }
  syncPlayers(players: Player.IPlayerSerialized[]) {
    console.log('sync: Syncing players', JSON.stringify(players.map(p => p.clientId)));
    // Clear previous players array
    this.players = [];
    players.map(p => Player.load(p, this));
  }

  // Create a hash from the gamestate.  Useful for determining if
  // clients have desynced.
  // hash() {
  //   const state = this.serializeForHash();
  //   const hashResult = hash(state);
  //   console.log(`hash-${hashResult}:`, JSON.stringify(state));
  //   return hashResult
  // }
  // Returns a modified copy of gamestate that is used when generating a hash
  // of the gamestate to determine if clients have identical states
  // Use caution: any properties improperly modified or removed could cause
  // a silent desync between clients.  Only properties that are client-only
  // and need not be syncronized, should be removed.
  serializeForHash() {
    const serializedState: any = this.serializeForSaving();
    // Remove variables that would cause the hash to change second to second.
    // The hash is meant to show if clients have roughly identical game state
    // but it will take time to communicate the hash. 
    return serializedState;
  }

  // Returns only the properties that can be saved
  // callbacks and complicated objects such as PIXI.Sprites
  // are removed
  serializeForSaving(): IUnderworldSerialized {
    const { pie, random, players, units, pickups, walls, pathingPolygons, ...rest } = this;
    return {
      ...rest,
      players: this.players.map(Player.serialize),
      units: this.units.map(Unit.serialize),
      pickups: this.pickups.map(Pickup.serialize),
      // the state of the Random Number Generator
      RNGState: this.random.state(),
    };
  }
  // Updates specifically selected properties of underworld
  // Mutates current object
  // The purpose of this function is to keep underworld in sync
  // between clients
  // syncronize(serialized: IUnderworldSerializedForSyncronize) {
  //   if (serialized.RNGState) {
  //     this.syncronizeRNG(serialized.RNGState);
  //   }
  //   this.levelIndex = serialized.levelIndex;
  //   this.turn_phase = serialized.turn_phase;
  //   this.turn_number = serialized.turn_number;
  //   // Note: obstacles are not serialized since they are unchanging between levels
  //   // TODO, remove walls and pathingPolygons here, they are set in cacheWalls, so this is redundant
  //   // make sure obstacles come over when serialized
  //   this.walls = serialized.walls;
  //   this.pathingPolygons = serialized.pathingPolygons;
  //   this.processedMessageCount = this.processedMessageCount;
  //   this.addGroundTileImages();
  //   this.cacheWalls();
  // }
  serializeForSyncronize(): IUnderworldSerializedForSyncronize {
    const { pie, players, units, pickups, random, gameLoop, ...rest } = this;
    const serialized: IUnderworldSerializedForSyncronize = {
      ...rest,
      // the state of the Random Number Generator
      RNGState: this.random.state() as SeedrandomState,
    }
    return serialized;
  }
}

type IUnderworldSerialized = Omit<typeof Underworld, "pie" | "prototype" | "players" | "units" | "pickups" | "random" | "turnInterval"
  // walls and pathingPolygons are omitted because they are derived from obstacles when cacheWalls() in invoked
  | "walls" | "pathingPolygons"> & {
    players: Player.IPlayerSerialized[],
    units: Unit.IUnitSerialized[],
    pickups: Pickup.IPickupSerialized[],
  };
type NonFunctionPropertyNames<T> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T];
type UnderworldNonFunctionProperties = Exclude<NonFunctionPropertyNames<Underworld>, null | undefined>;
export type IUnderworldSerializedForSyncronize = Omit<Pick<Underworld, UnderworldNonFunctionProperties>, "pie" | "debugGraphics" | "players" | "units" | "pickups" | "obstacles" | "random" | "gameLoop">;

// TODO: enforce max units at level index
// Idea: Higher probability of tougher units at certain levels
const startingNumberOfUnits = 3;
const bossEveryXLevels = 15;

function getEnemiesForAltitude(levelIndex: number, underworld: Underworld): { unitIds: string[], strength: number } {
  const possibleUnitsToChoose = Object.values(allUnits)
    .filter(u => u.spawnParams && u.spawnParams.unavailableUntilLevelIndex <= levelIndex)
    .map(u => ({ id: u.id, probability: u.spawnParams ? u.spawnParams.probability : 0 }))
  const unitIds = Array(startingNumberOfUnits + levelIndex).fill(null)
    // flatMap is used to remove any undefineds
    .flatMap(() => {
      const chosenUnit = chooseObjectWithProbability(possibleUnitsToChoose, underworld.random)
      return chosenUnit ? [chosenUnit.id] : []
    })
  const strength = (levelIndex / 10) + underworld.players.length / 2;
  // Add bosses
  if (levelIndex !== 0 && levelIndex % bossEveryXLevels == 0) {
    unitIds.push('Night Queen');
  }
  console.log('Level strength: ', strength, 'enemies:', unitIds);
  return { unitIds, strength };
}


export interface LevelData {
  levelIndex: number,
  limits: Limits,
  obstacles: Obstacle.IObstacle[];
  liquid: Tile[];
  imageOnlyTiles: Tile[];
  // Width in tiles
  width: number;
  pickups: {
    index: number;
    coord: Vec2;
  }[];
  enemies: {
    id: string,
    coord: Vec2,
    strength: number,
    isArmored: boolean
  }[];
  validPlayerSpawnCoords: Vec2[]
}