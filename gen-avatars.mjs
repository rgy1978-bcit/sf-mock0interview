// Regenerate interviewer avatars.
// Run with: node gen-avatars.mjs
//
// Writes SVG files into src/assets/. Requires devDeps @dicebear/core and
// @dicebear/collection. Ship the SVG files in the repo — this script does
// not run at build time or in the browser.

import { createAvatar } from '@dicebear/core';
import { personas } from '@dicebear/collection';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'src', 'assets');
fs.mkdirSync(outDir, { recursive: true });

const FEMALE_HAIR = ['long','bobCut','curly','pigtails','curlyBun','bobBangs','extraLong','straightBun','bunUndercut'];
const MALE_HAIR   = ['sideShave','shortCombover','curlyHighTop','buzzcut','bald','balding','fade','mohawk','shortComboverChops'];

// Seed picks are curated — regenerate the candidate gallery and re-pick
// before changing these.
const PEOPLE = [
  { key: 'sarah',    name: 'Sarah Mitchell',    seed: 'Sarah Mitchell #c',    gender: 'female', bg: 'FDF8EC' },
  { key: 'marcus',   name: 'Marcus Chen',       seed: 'Marcus Chen #h',       gender: 'male',   bg: 'FDF2EC' },
  { key: 'jennifer', name: 'Jennifer Kowalski', seed: 'Jennifer Kowalski #e', gender: 'female', bg: 'EDF7EE' },
  { key: 'david',    name: 'David Park',        seed: 'David Park #a',        gender: 'male',   bg: 'E8F4FB' },
];

for (const p of PEOPLE) {
  const svg = createAvatar(personas, {
    seed: p.seed,
    backgroundColor: [p.bg],
    radius: 50,
    hair: p.gender === 'female' ? FEMALE_HAIR : MALE_HAIR,
    facialHairProbability: p.gender === 'female' ? 0 : 25,
    body: ['squared', 'rounded'],
    mouth: ['smile', 'bigSmile', 'smirk', 'lips'],
    eyes: ['open', 'happy', 'glasses'],
    nose: ['mediumRound', 'smallRound'],
  }).toString();
  const outPath = path.join(outDir, `avatar-${p.key}.svg`);
  fs.writeFileSync(outPath, svg);
  console.log(`wrote ${outPath}`);
}
