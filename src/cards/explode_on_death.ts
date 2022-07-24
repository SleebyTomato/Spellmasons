import { IUnit, takeDamage } from '../entity/Unit';
import * as Unit from '../entity/Unit';
import * as Image from '../graphics/Image';
import type { Spell } from '.';
import { drawPredictionCircle } from '../graphics/PlanningView';
import { forcePush } from './push';
import Underworld from '../Underworld';

const id = 'Bloat';
const imageName = 'explode-on-death.png';
const damage = 3;
const range = 140;
function add(unit: IUnit) {
  // First time setup
  if (!unit.modifiers[id]) {
    unit.modifiers[id] = {
      isCurse: true,
    };
    // Add event
    if (!unit.onDeathEvents.includes(id)) {
      unit.onDeathEvents.push(id);
    }
    // Add subsprite image
    Image.addSubSprite(unit.image, id);
  }
}

const spell: Spell = {
  card: {
    id,
    manaCost: 15,
    healthCost: 0,
    expenseScaling: 1,
    probability: 50,
    thumbnail: 'explode-on-death.png',
    description: `Cursed targets explode when they die dealing ${damage} to all units within the
    explosion radius.`,
    effect: async (state, underworld, prediction) => {
      for (let unit of state.targetedUnits) {
        Unit.addModifier(unit, id, underworld);
      }
      return state;
    },
  },
  modifiers: {
    add,
    subsprite: {
      imageName,
      alpha: 1.0,
      anchor: {
        x: 0,
        y: 0,
      },
      scale: {
        x: 0.5,
        y: 0.5,
      },
    },
  },
  events: {
    onDeath: async (unit: IUnit, underworld: Underworld, prediction: boolean) => {
      drawPredictionCircle(unit, range);
      if (!prediction) {
        underworld.animateSpell(unit, 'explode-on-death.png');
      }
      underworld.getUnitsWithinDistanceOfTarget(
        unit,
        range,
        prediction
      ).forEach(u => {
        // Push units away from exploding unit
        forcePush(u, unit, underworld, prediction);
        // Deal damage to units
        takeDamage(u, damage, underworld, prediction);
      });
      underworld.getPickupsWithinDistanceOfTarget(
        unit,
        range
      ).forEach(p => {
        // Push pickups away
        forcePush(p, unit, underworld, prediction);
      })
    }
  }
};
export default spell;
