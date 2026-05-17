export const COMEDOGENIC_PATTERNS: { pattern: RegExp; note: string; maxPosition?: number }[] = [
  {
    pattern: /polysorbate[ -]?\d+/i,
    note: "Polysorbates are emulsifiers commonly linked to closed comedones (hard, flesh-colored bumps), particularly on the forehead and chin.",
  },
  {
    pattern: /cyclopentasiloxane|cyclohexasiloxane|cyclomethicone|trimethylsiloxysilicate|dimethicone\/vinyl dimethicone crosspolymer/i,
    note: "Heavy or cyclic silicones form an occlusive film on the skin's surface that can trap sebum and dead skin cells, contributing to closed comedones on acne-prone or reactive skin.",
  },
  {
    pattern: /palmitoyl\s+\w*peptide/i,
    note: "Palmitoyl peptide carriers use fatty acid chains to deliver active peptides into skin. These chains can be occlusive and may trigger closed comedones in pore-prone skin.",
  },
  {
    pattern: /\b(algae|laminaria|fucus|ascophyllum|sargassum|chlorella|spirulina|ecklonia|macrocystis|undaria|porphyra|ulva|chondrus|carrageenan)\b/i,
    note: "Algae-derived ingredients provide a smooth, slippery skin feel but are associated with closed comedones on acne-prone and reactive skin due to their polysaccharide content, which can trap sebum in the pore.",
  },
  {
    // High-comedogenic esters (rated 4–5/5 on standard comedogenicity scales)
    pattern: /isopropyl myristate|isopropyl palmitate|isopropyl isostearate|isopropyl linoleate|myristyl myristate/i,
    note: "Isopropyl esters are among the most comedogenic cosmetic ingredients — they penetrate follicle walls and directly contribute to closed comedones. Even small amounts can cause breakouts on congestion-prone skin.",
  },
  {
    // Moderate-comedogenic esters and ethers
    pattern: /ethylhexyl palmitate|octyldodecyl myristate|octyl palmitate|cetyl myristate/i,
    note: "This ester has a moderate comedogenic rating and can contribute to closed comedones with repeated use on congestion-prone or reactive skin.",
  },
  {
    // Only flag glycols when they appear high in the formula (first 5 ingredients)
    pattern: /^(butylene glycol|dipropylene glycol)$/i,
    note: "At high concentrations — indicated by appearing in the first five ingredients — Butylene Glycol and Dipropylene Glycol can disrupt the skin barrier and contribute to closed comedones.",
    maxPosition: 5,
  },
];

export function countComedogenicPatternMatches(ingredientList: string): number {
  const tokens = ingredientList
    .split(/,(?![^(]*\))/)
    .map((s) => s.replace(/\([^)]*\)/g, "").replace(/[​‌‍﻿]/g, "").trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 1);

  let count = 0;
  const seen = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const cleaned = tokens[i];
    for (const rule of COMEDOGENIC_PATTERNS) {
      if (rule.maxPosition !== undefined && i >= rule.maxPosition) continue;
      if (rule.pattern.test(cleaned)) {
        const key = cleaned.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          count++;
        }
        break;
      }
    }
  }
  return count;
}
