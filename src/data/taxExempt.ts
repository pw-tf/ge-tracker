/**
 * Items Jagex exempts from the Grand Exchange tax (tools and the bond).
 * Matched by name against /mapping so no item IDs are hard-coded.
 * Source: https://oldschool.runescape.wiki/w/Grand_Exchange#Convenience_fee_and_item_sink
 */
export const TAX_EXEMPT_NAMES: ReadonlySet<string> = new Set([
  'Old school bond',
  'Chisel',
  'Gardening trowel',
  'Glassblowing pipe',
  'Hammer',
  'Needle',
  'Pestle and mortar',
  'Rake',
  'Saw',
  'Secateurs',
  'Seed dibber',
  'Shears',
  'Spade',
  'Watering can(0)',
]);
