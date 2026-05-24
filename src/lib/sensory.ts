export const SENSORY_PATTERNS: { pattern: RegExp; note: string; sensory_category: string; maxPosition?: number }[] = [
  {
    pattern: /(?!.*\bleaf water\b)(\baloe\b|aloe barbadensis|aloe vera)/i,
    sensory_category: "Film-forming",
    note: "Aloe's acemannan polysaccharides form a biopolymer film on skin that tightens and crusts as it dries, creating an itch-and-scratch cycle. This is most pronounced with raw or concentrated gel — in well-formulated products where aloe is diluted, the film-forming effect is usually minimal.",
  },
  {
    pattern: /\bkaolin\b|\bbentonite\b|montmorillonite/i,
    sensory_category: "Film-forming",
    note: "Forms a tightening film as it dries that creates discomfort and an urge to touch or rub the face — cumulative mechanical contact that can damage the skin barrier over time.",
  },
  {
    pattern: /\bmenthol\b|\bl-menthol\b/i,
    sensory_category: "Cooling",
    note: "Creates an intense cooling sensation that transitions to burning or itching, frequently triggering unconscious touching and scratching. The repeated mechanical contact can damage an already reactive skin barrier.",
  },
  {
    pattern: /peppermint/i,
    sensory_category: "Cooling",
    note: "Contains menthol, which produces a cooling-then-burning sensation that prompts touching and scratching. Not recommended for reactive or barrier-compromised skin.",
  },
  {
    pattern: /spearmint|mentha spicata/i,
    sensory_category: "Cooling",
    note: "Contains carvone and trace menthol, producing a cooling-then-burning sensation similar to peppermint. The sensation prompts touching or rubbing, which can mechanically disrupt an already reactive skin barrier.",
  },
  {
    pattern: /\bcamphor\b/i,
    sensory_category: "Cooling",
    note: "Creates a strong cooling-to-warming sensation that frequently triggers touching or scratching, which can mechanically damage an already reactive skin barrier.",
  },
  {
    pattern: /eucalyptus/i,
    sensory_category: "Cooling",
    note: "Contains eucalyptol, which creates a cooling-to-numbing sensation that transitions to itching on reactive skin. Frequently triggers unconscious touching and can worsen barrier damage.",
  },
  {
    pattern: /\bclove\b|eugenia caryophyllus/i,
    sensory_category: "Warming",
    note: "Eugenol creates a numbing-then-burning sensation on skin that frequently triggers unconscious touching. Can be acutely irritating to a compromised barrier.",
  },
  {
    pattern: /\bcinnamon\b|cinnamomum/i,
    sensory_category: "Warming",
    note: "Cinnamaldehyde creates a warming-to-burning sensation that prompts touching and rubbing. Even low concentrations can cause irritation on reactive skin.",
  },
  {
    pattern: /hamamelis|witch hazel/i,
    sensory_category: "Astringent",
    note: "Its astringent tannins cause a visible tightening sensation that prompts touching the face. With regular use, the cumulative drying effect progressively weakens the barrier.",
  },
  {
    pattern: /alcohol denat|denatured alcohol|sd alcohol/i,
    sensory_category: "Stripping",
    note: "Creates an immediate stinging or burning sensation on reactive or compromised skin, frequently triggering face-touching and rubbing reflexes.",
  },
  {
    pattern: /sodium lauryl sulfate|\bsls\b(?!es)/i,
    sensory_category: "Stripping",
    note: "Sodium lauryl sulfate is the same detergent class as dish soap and many hand soaps. If your skin reacts to foaming household cleaners, SLS in skincare will produce the same response — a tight, stripped feeling after rinsing. That feeling signals the skin's surface film is temporarily gone; apply your next product promptly to close the window before itch sets in.",
  },
  {
    pattern: /sodium laureth sulfate|\bsles\b|sodium lauryl ether sulfate/i,
    sensory_category: "Stripping",
    note: "Sodium laureth sulfate (SLES) is in the same anionic surfactant family as SLS and dish soap, but is milder due to ethoxylation. On sensitive or barrier-compromised skin it can still produce a tight, stripped feeling after rinsing — apply your next product promptly to avoid the post-wash itch window.",
  },
  {
    pattern: /sodium c14-16 olefin sulfonate|sodium c12-14 olefin sulfonate|alpha olefin sulfonate/i,
    sensory_category: "Stripping",
    note: "An anionic surfactant in the same chemical class as dish soap detergents, common in body washes and shampoos. Can produce a stripped, tight sensation after rinsing on reactive or sensitive skin.",
  },
  {
    pattern: /salicylic acid/i,
    sensory_category: "Stinging",
    note: "Creates a mild tingling-to-burning sensation on sensitive or barrier-compromised skin, especially at concentrations above 1%.",
  },
  {
    pattern: /glycolic acid/i,
    sensory_category: "Stinging",
    note: "Causes a noticeable stinging or burning sensation on reactive or barrier-compromised skin. The sting intensifies at higher concentrations and on areas where the barrier is already damaged — prompting touching that slows recovery.",
  },
  {
    pattern: /lactic acid|mandelic acid|malic acid|tartaric acid/i,
    sensory_category: "Stinging",
    note: "AHA exfoliants that cause a tingling or stinging sensation on reactive skin. Gentler than glycolic acid but still capable of causing discomfort on a compromised barrier, especially in acidic formulas.",
  },
  {
    pattern: /citric acid/i,
    sensory_category: "Stinging",
    note: "At high concentrations (indicated by appearing in the first 10 ingredients), citric acid acts as an AHA exfoliant and can cause a tingling or stinging sensation on reactive or barrier-compromised skin.",
    maxPosition: 10,
  },
  {
    pattern: /benzoyl peroxide/i,
    sensory_category: "Stinging",
    note: "Causes a pronounced burning and stinging sensation on contact, especially on reactive or broken skin. The drying effect compounds over time, creating a raw, sensitized surface that is difficult not to touch or pick at.",
  },
  {
    pattern: /^propylene glycol$/i,
    sensory_category: "Stinging",
    note: "Can cause a stinging or burning sensation on sensitized skin and around areas where the barrier is broken or compromised. As a penetration enhancer, it also drives co-applied ingredients deeper — amplifying the potency of any other irritants or sensitizers in the formula.",
  },
  {
    pattern: /^(butylene glycol|dipropylene glycol)$/i,
    sensory_category: "Stinging",
    note: "At high concentrations (indicated by appearing in the first 5 ingredients), butylene glycol can cause a stinging or burning sensation on sensitized skin and around areas where the barrier is broken or compromised.",
    maxPosition: 5,
  },
  {
    pattern: /kojic acid/i,
    sensory_category: "Stinging",
    note: "Can produce a prickling or stinging sensation on reactive skin, particularly at higher concentrations or when applied to a weakened barrier.",
  },
  {
    pattern: /petrolatum|mineral oil|white petrolatum|\bparaffin\b/i,
    sensory_category: "Occlusive",
    note: "Creates a dense physical seal over the skin surface, trapping sweat, sebum, and heat underneath. The resulting warmth and humidity can cause a prickling or itching sensation — and the bacterial buildup over time leads to breakouts that prompt picking.",
  },
  {
    pattern: /\blanolin\b/i,
    sensory_category: "Occlusive",
    note: "A dense animal wax that seals the skin surface and restricts airflow. The occlusive warmth can cause a stuffy, itching feeling over time — especially around pores and in warmer weather.",
  },
  {
    pattern: /\bbeeswax\b|cera alba|cera flava/i,
    sensory_category: "Occlusive",
    note: "A heavy wax that seals the skin surface and limits breathability. Can cause a stuffy, warm feeling that leads to itching and touching, particularly on reactive or congestion-prone skin.",
  },
  {
    pattern: /butyrospermum parkii|shea butter|theobroma cacao seed butter|cocoa butter/i,
    sensory_category: "Occlusive",
    note: "A rich, heavy emollient that creates a semi-occlusive layer on the skin surface, trapping heat and sebum underneath. For reactive or congestion-prone skin, the warmth and humidity this creates can cause a prickling or itching sensation and encourage picking — similar to beeswax.",
  },
  {
    pattern: /carnauba|candelilla/i,
    sensory_category: "Occlusive",
    note: "A hard plant wax that creates a stiff, occlusive film on skin. Can trap sweat and sebum beneath the surface, causing warmth and itching that prompt touching.",
  },
  {
    pattern: /\bdimethicone\b|trimethylsiloxysilicate/i,
    sensory_category: "Pilling",
    note: "Can ball up into a gritty, visible residue when applied over water-based layers or in excess — especially if the previous layer hasn't fully absorbed. The physical sensation of pilled product on skin frequently triggers rubbing and picking.",
  },
  {
    pattern: /acrylates copolymer|acrylates\/c10|\bpvp\b|polyvinylpyrrolidone/i,
    sensory_category: "Pilling",
    note: "A film-forming polymer that can roll and ball up when layered with incompatible formulas or applied over skin that isn't fully dry. The lumpy residue it creates prompts rubbing and picking that disrupts the skin barrier.",
  },
  {
    pattern: /acryloyldimethyltaurate|\/vp copolymer|vp\/va copolymer|carbomer|carbopol|polyacrylate/i,
    sensory_category: "Film-forming",
    note: "A synthetic film-forming polymer used to create gel or serum textures. It lays a continuous surface film that slows the natural shedding of dead skin cells — first producing a subtle itch as cells accumulate underneath, and with extended leave-on use, contributing to milia (small, hard keratin bumps just under the skin surface, distinct from comedones).",
  },

  // ── Chemical-itch ────────────────────────────────────────────────────────
  // Ingredients that trigger nerve irritation or histamine responses
  {
    pattern: /\bfragrance\b|\bparfum\b/i,
    sensory_category: "chemical-itch",
    note: "Fragrance is one of the most common contact allergens in skincare. It can trigger histamine responses, contact dermatitis, and an itch-and-scratch cycle on reactive skin — and repeated exposure progressively increases sensitization even in people who initially tolerate it.",
  },
  {
    pattern: /methylisothiazolinone|methylchloroisothiazolinone|chloromethylisothiazolinone/i,
    sensory_category: "chemical-itch",
    note: "Methylisothiazolinone (MI) and its chlorinated form MCI are biocide preservatives classified as strong contact allergens by the EU Scientific Committee. They can cause itching, burning, and allergic contact dermatitis — even at very low concentrations in leave-on formulas.",
  },
  {
    pattern: /dmdm hydantoin|imidazolidinyl urea|diazolidinyl urea|quaternium-15|\bbronopol\b/i,
    sensory_category: "chemical-itch",
    note: "A formaldehyde-releasing preservative that slowly releases small amounts of formaldehyde to prevent microbial growth. Formaldehyde is a recognized allergen and sensitizer that can cause itching, redness, and contact dermatitis on sensitive or already-reactive skin.",
  },
  {
    pattern: /iodopropynyl butylcarbamate|\bipbc\b/i,
    sensory_category: "chemical-itch",
    note: "IPBC is a biocide preservative and recognized skin sensitizer. It can cause allergic contact dermatitis, particularly in leave-on products or when applied to skin with a compromised barrier.",
  },
  {
    pattern: /cocamidopropyl betaine|\bcapb\b/i,
    sensory_category: "chemical-itch",
    note: "Cocamidopropyl betaine (CAPB) is a mild amphoteric surfactant but a documented contact allergen — sensitization comes from amidoamine impurities in the ingredient, not from stripping action. Can cause itching, redness, and allergic contact dermatitis on reactive or sensitized skin independently of barrier condition.",
  },
  {
    pattern: /\bchlorhexidine\b/i,
    sensory_category: "chemical-itch",
    note: "Chlorhexidine is an antiseptic disinfectant used in some body washes and skin prep products. A recognized sensitizer that can cause itching and contact dermatitis; people with sensitivity to strong disinfectants or bleach-based cleaners may cross-react.",
  },

  // ── Occlusive-itch ───────────────────────────────────────────────────────
  // Heavy waxy esters that trap heat and sebum, not yet covered by Occlusive
  {
    pattern: /myristyl myristate/i,
    sensory_category: "occlusive-itch",
    note: "Myristyl myristate is a heavy wax ester that forms a dense occlusive layer on skin. It traps heat and sebum beneath the surface, causing a stuffy, itching sensation — and rates moderately high on comedogenicity scales for pore congestion.",
  },
  {
    pattern: /cetyl palmitate|cetyl esters wax/i,
    sensory_category: "occlusive-itch",
    note: "Cetyl palmitate is a waxy ester used as an emollient and thickener. It creates a semi-occlusive seal that can trap warmth and sebum, causing an itching sensation and contributing to congestion on oily or reactive skin.",
  },

  // ── Comedogenic-itch ─────────────────────────────────────────────────────
  // Pore-blocking ingredients that cause congestion and inflammatory itch
  {
    pattern: /isopropyl myristate|isopropyl palmitate/i,
    sensory_category: "comedogenic-itch",
    note: "Isopropyl myristate and isopropyl palmitate rate 5/5 on comedogenicity scales — among the highest of any cosmetic ingredient. They penetrate into follicles and physically block pores, leading to congestion, closed comedones, and an inflammatory itch over time on acne-prone or oily skin.",
  },
  {
    pattern: /cocos nucifera|coconut oil/i,
    sensory_category: "comedogenic-itch",
    note: "Coconut oil is rich in lauric acid, which rates 4/5 on comedogenicity scales. While effective as an antimicrobial, it readily blocks pores for acne-prone and oily skin types, leading to congestion and inflammatory itch over time.",
  },
  {
    pattern: /butyl stearate/i,
    sensory_category: "comedogenic-itch",
    note: "Butyl stearate is a synthetic ester that rates 3–4/5 on comedogenicity scales. It provides a smooth, silky texture but can block pores and worsen congestion on oily or acne-prone skin, contributing to closed comedones and an inflammatory itch over time.",
  },
];

export function countSensoryPatternMatches(ingredientList: string): number {
  const tokens = ingredientList
    .split(/,(?![^(]*\))/)
    .map((s) => s.replace(/\([^)]*\)/g, "").replace(/[​‌‍﻿]/g, "").trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 1);

  let count = 0;
  const seen = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const cleaned = tokens[i].replace(/\([^)]*\)/g, "").trim();
    for (const rule of SENSORY_PATTERNS) {
      if (rule.maxPosition !== undefined && i >= rule.maxPosition) continue;
      if (rule.pattern.test(cleaned)) {
        const key = cleaned.toLowerCase();
        if (!seen.has(key)) { seen.add(key); count++; }
        break;
      }
    }
  }
  return count;
}
