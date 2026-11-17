import type { RegionBehaviour, RegionName } from './RegionBehaviour';
import { GEN_X } from './genX';
import { GEN_Y } from './genY';
import { GEN_Z } from './genZ';

const REGIONS: Record<RegionName, RegionBehaviour> = { genx: GEN_X, geny: GEN_Y, genz: GEN_Z };

export function regionFor(name: RegionName): RegionBehaviour {
  return REGIONS[name];
}

export type { RegionBehaviour, RegionName };
