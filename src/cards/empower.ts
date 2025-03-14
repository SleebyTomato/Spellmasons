import * as Unit from '../entity/Unit';
import { CardCategory, UnitType } from '../types/commonTypes';
import type Underworld from '../Underworld';
import { playDefaultSpellAnimation, playDefaultSpellSFX } from './cardUtils';
import { Spell, refundLastSpell } from './index';
import { CardRarity, probabilityMap } from '../types/commonTypes';
import { getOrInitModifier } from './util';
import { PRIEST_ID } from '../entity/units/priest';
import { POISONER_ID } from '../entity/units/poisoner';
import { gripthulu_id } from '../entity/units/gripthulu';
import { decoyId } from './summon_decoy';
import { bossmasonUnitId } from '../entity/units/deathmason';
import { DARK_SUMMONER_ID } from '../entity/units/darkSummoner';
import { spellmasonUnitId } from '../entity/units/playerUnit';

const empowerId = 'Empower';
const statChange = 5;
const spell: Spell = {
  card: {
    id: empowerId,
    category: CardCategory.Blessings,
    sfx: 'empower',
    supportQuantity: true,
    manaCost: 20,
    healthCost: 0,
    staminaCost: 0,
    expenseScaling: 1,
    probability: probabilityMap[CardRarity.UNCOMMON],
    thumbnail: 'spellIconEmpower.png',
    animationPath: 'spellEmpower',
    description: ['spell_empower', (statChange).toString()],
    effect: async (state, card, quantity, underworld, prediction) => {
      // .filter: only target living units
      const targets = state.targetedUnits.filter(
        u => u.alive && u.unitType !== UnitType.PLAYER_CONTROLLED
          && u.unitSourceId != PRIEST_ID
          && u.unitSourceId != gripthulu_id
          && u.unitSourceId != decoyId
          && u.unitSourceId != bossmasonUnitId
          && u.unitSourceId != DARK_SUMMONER_ID
      );
      // Even though the player's damage stat doesn't affect their spells
      // it will affect cloned spellmasons, so we allow it.

      if (!targets.length) {
        refundLastSpell(state, prediction, "No valid targets");
      } else {
        playDefaultSpellSFX(card, prediction);
        //await playDefaultSpellAnimation(card, targets, prediction);
        for (let unit of targets) {
          Unit.addModifier(unit, empowerId, underworld, prediction, quantity);
        }
      }
      return state;
    },
  },
  modifiers: {
    add,
    remove,
  },
};

function add(unit: Unit.IUnit, underworld: Underworld, prediction: boolean, quantity: number = 1) {
  const modifier = getOrInitModifier(unit, empowerId, { isCurse: false, quantity, }, () => {
    //no first time setup
  });

  // Special balance case: Poisoner applies 1 stack of poison per damage
  if (unit.unitSourceId == POISONER_ID) {
    unit.damage += quantity;
  } else {
    unit.damage += statChange * quantity;
  }
}

function remove(unit: Unit.IUnit, underworld: Underworld) {
  const modifier = unit.modifiers[empowerId];
  if (!modifier) {
    console.error(`Missing modifier object for ${empowerId}; cannot remove.  This should never happen`);
    return
  }

  // Special balance case: Poisoner applies 1 stack of poison per damage
  if (unit.unitSourceId == POISONER_ID) {
    unit.damage -= modifier.quantity;
  } else {
    unit.damage -= statChange * modifier.quantity;
  }
}

export default spell;