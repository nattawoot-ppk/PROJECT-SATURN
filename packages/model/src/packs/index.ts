import { GENERIC_PACK } from "./generic";
import { NORWAY_PACK } from "./norway";
import { THAILAND_PACK } from "./thailand";
import type { RulePack } from "../rules";
export const RULE_PACKS: RulePack[] = [GENERIC_PACK, NORWAY_PACK, THAILAND_PACK];
export function getRulePack(id: string): RulePack {
  return RULE_PACKS.find((p) => p.id === id) ?? GENERIC_PACK;
}
export { GENERIC_PACK, NORWAY_PACK, THAILAND_PACK };
