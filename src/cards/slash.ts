import * as Unit from '../entity/Unit';
import { containerSpells } from '../graphics/PixiUtils';
import { randFloat } from '../jmath/rand';
import { CardCategory } from '../types/commonTypes';
import { oneOffImage, playDefaultSpellSFX } from './cardUtils';
import { Spell, refundLastSpell } from './index';
import { CardRarity, probabilityMap } from '../types/commonTypes';

export const slashCardId = 'Slash';
const damageDone = 20;
export interface UnitDamage {
  id: number;
  x: number;
  y: number;
  health: number;
  damageTaken: number;

}
const animationPath = 'spell-effects/spellHurtCuts';
const delayBetweenAnimationsStart = 400;
const spell: Spell = {
  card: {
    id: slashCardId,
    category: CardCategory.Damage,
    supportQuantity: true,
    manaCost: 10,
    healthCost: 0,
    expenseScaling: 1,
    probability: probabilityMap[CardRarity.COMMON],
    thumbnail: 'spellIconHurt.png',
    animationPath,
    sfx: 'hurt',
    description: ['spell_slash', damageDone.toString()],
    effect: async (state, card, quantity, underworld, prediction) => {
      let animationDelaySum = 0;
      // .filter: only target living units
      const targets = state.targetedUnits.filter(u => u.alive)
      animationDelaySum = 0;
      let delayBetweenAnimations = delayBetweenAnimationsStart;
      let attackPromises = [];
      // Note: quantity loop should always be INSIDE of the targetedUnits loop
      // so that any quantity-based animations will play simultaneously on multiple targets
      // but sequentially within themselves (on a single target, e.g. multiple hurts over and over)
      for (let q = 0; q < quantity; q++) {
        if (!prediction && !globalThis.headless) {
          attackPromises.push(new Promise<void>((resolve) => {
            setTimeout(() => {
              playDefaultSpellSFX(card, prediction);
              const slashAnimationPromises = targets.map(unit => {
                return new Promise<void>(resolve => {
                  const spellEffectImage = oneOffImage(unit, animationPath, containerSpells, resolve);
                  if (spellEffectImage) {
                    // Randomize rotation a bit so that subsequent slashes don't perfectly overlap
                    spellEffectImage.sprite.rotation = randFloat(-Math.PI / 6, Math.PI / 6);
                    if (q % 2 == 0) {
                      // Flip every other slash animation so that it comes from the other side
                      spellEffectImage.sprite.scale.x = -1;
                    }
                  }
                  Unit.takeDamage(unit, damageDone, state.casterUnit, underworld, prediction, state);
                })
              })
              Promise.all(slashAnimationPromises).then(() => {
                resolve();
              });

            }, animationDelaySum);
          }));
          animationDelaySum += delayBetweenAnimations;
          // Don't let it go below 20 milliseconds
          delayBetweenAnimations = Math.max(20, delayBetweenAnimations);
          // Juice: Speed up subsequent hits
          delayBetweenAnimations *= 0.80
        } else {
          for (let unit of targets) {
            Unit.takeDamage(unit, damageDone, state.casterUnit, underworld, prediction, state);
          }
        }
      }
      if (targets.length == 0) {
        refundLastSpell(state, prediction, 'No valid targets. Cost refunded.');
      }
      if (!prediction && !globalThis.headless) {
        await Promise.all(attackPromises);
      }
      return state;
    },
  },
};
export default spell;
