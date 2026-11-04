import { GENERIC_PACK } from "./generic";
import type { RulePack } from "../rules";
export const RULE_PACKS: RulePack[] = [GENERIC_PACK];
export function getRulePack(id: string): RulePack {
  return RULE_PACKS.find((p) => p.id === id) ?? GENERIC_PACK;
}
export { GENERIC_PACK };
