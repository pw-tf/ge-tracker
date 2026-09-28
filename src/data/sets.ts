/**
 * Item sets that a Grand Exchange clerk will combine or split.
 * Names are matched against /mapping at runtime; a set whose set item or any
 * piece isn't found is skipped, so a wrong name here only hides that one row.
 */
export interface SetDef {
  name: string;
  pieces: string[];
}

const METALS = ['Bronze', 'Iron', 'Steel', 'Black', 'Mithril', 'Adamant', 'Rune', 'Gilded', 'Dragon'];

const metalSets: SetDef[] = METALS.flatMap((m) => [
  { name: `${m} armour set (lg)`, pieces: [`${m} full helm`, `${m} platebody`, `${m} platelegs`, `${m} kiteshield`] },
  { name: `${m} armour set (sk)`, pieces: [`${m} full helm`, `${m} platebody`, `${m} plateskirt`, `${m} kiteshield`] },
]);

const barrows: SetDef[] = [
  { name: "Ahrim's armour set", pieces: ["Ahrim's hood", "Ahrim's robetop", "Ahrim's robeskirt", "Ahrim's staff"] },
  { name: "Dharok's armour set", pieces: ["Dharok's helm", "Dharok's platebody", "Dharok's platelegs", "Dharok's greataxe"] },
  { name: "Guthan's armour set", pieces: ["Guthan's helm", "Guthan's platebody", "Guthan's chainskirt", "Guthan's warspear"] },
  { name: "Karil's armour set", pieces: ["Karil's coif", "Karil's leathertop", "Karil's leatherskirt", "Karil's crossbow"] },
  { name: "Torag's armour set", pieces: ["Torag's helm", "Torag's platebody", "Torag's platelegs", "Torag's hammers"] },
  { name: "Verac's armour set", pieces: ["Verac's helm", "Verac's brassard", "Verac's plateskirt", "Verac's flail"] },
];

const hides: SetDef[] = ['Green', 'Blue', 'Red', 'Black'].map((c) => ({
  name: `${c} dragonhide set`,
  pieces: [`${c} d'hide body`, `${c} d'hide chaps`, `${c} d'hide vambraces`],
}));

const endgame: SetDef[] = [
  { name: 'Justiciar armour set', pieces: ['Justiciar faceguard', 'Justiciar chestguard', 'Justiciar legguards'] },
  { name: 'Obsidian armour set', pieces: ['Obsidian helmet', 'Obsidian platebody', 'Obsidian platelegs'] },
  { name: "Inquisitor's armour set", pieces: ["Inquisitor's great helm", "Inquisitor's hauberk", "Inquisitor's plateskirt"] },
  { name: 'Ancestral robes set', pieces: ['Ancestral hat', 'Ancestral robe top', 'Ancestral robe bottom'] },
  { name: 'Masori armour set (f)', pieces: ['Masori mask (f)', 'Masori body (f)', 'Masori chaps (f)'] },
  { name: "Dagon'hai robes set", pieces: ["Dagon'hai hat", "Dagon'hai robe top", "Dagon'hai robe bottom"] },
];

export const SETS: SetDef[] = [...endgame, ...barrows, ...metalSets, ...hides];
