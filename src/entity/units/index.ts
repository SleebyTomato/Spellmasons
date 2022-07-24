import type * as Unit from '../Unit';
import type { UnitSubType } from '../../types/commonTypes';

interface ConstructorInfo {
  description: string;
  image: string;
  subtype: UnitSubType;
}
export type UnitAction = {
  (self: Unit.IUnit, attackTarget: Unit.IUnit | undefined, underworld: Underworld, canAttackTarget: boolean): Promise<void>;
};
export interface UnitSource {
  id: string;
  info: ConstructorInfo;
  init?: (unit: Unit.IUnit, underworld: Underworld) => void;
  action: UnitAction;
  unitProps: Partial<Unit.IUnit>;
  extraTooltipInfo?: () => string;
  spawnParams?: SpawnParams;
  animations: Unit.UnitAnimations;
}

interface SpawnParams {
  probability: number;
  unavailableUntilLevelIndex: number;
}

/// Units to register
import playerUnit from './playerUnit';
import grunt from './grunt';
import archer from './archer';
import lobber from './lobber';
import summoner from './summoner';
import priest from './priest';
import poisoner from './poisoner';
import vampire from './vampire';
import decoy from './decoy';
import nightqueen from './nightqueen';
import Underworld from '../../Underworld';

function register(unit: UnitSource) {
  allUnits[unit.id] = unit;
}
export function registerUnits() {
  register(grunt);
  register(archer);
  register(lobber);
  register(summoner);
  register(priest);
  register(poisoner);
  register(vampire);

  register(playerUnit);
  register(decoy);
  register(nightqueen);
}


export const allUnits: { [id: string]: UnitSource } = {};
