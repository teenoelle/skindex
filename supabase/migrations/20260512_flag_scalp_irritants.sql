-- Add MCI and SLS as new flagged ingredients
INSERT INTO ingredients (id, name, inci_name, status, explanation, category)
VALUES
  (gen_random_uuid(), 'Methylchloroisothiazolinone', 'METHYLCHLOROISOTHIAZOLINONE', 'flagged',
   'A preservative and one of the most potent contact allergens found in rinse-off products. Works synergistically with Methylisothiazolinone (MI) to cause sensitization — even brief scalp exposure can trigger chronic itch, flaking, and contact dermatitis. Restricted or banned in leave-on products in many countries but still permitted in shampoos.',
   null),
  (gen_random_uuid(), 'Sodium Lauryl Sulfate', 'SODIUM LAURYL SULFATE', 'flagged',
   'A harsh surfactant that strips the skin and scalp of their natural oils and disrupts the acid mantle. Unlike Sodium Laureth Sulfate (SLES), SLS has a smaller molecule that penetrates more deeply, causing dryness, tightness, and itch. A well-documented primary irritant — the reaction is direct, not immune-mediated.',
   null);

-- Update Cocamidopropyl Betaine from safe to flagged
UPDATE ingredients
SET status = 'flagged',
    explanation = 'A mild surfactant and foam booster derived from coconut oil. While widely used in "gentle" formulas, it is a documented sensitizer — meaning the immune system can develop a reaction to it over repeated exposures. Symptoms include scalp itch, redness, and contact dermatitis that worsens over time rather than on first use.'
WHERE LOWER(TRIM(name)) = 'cocamidopropyl betaine';

-- Update Dimethicone from safe to flagged
UPDATE ingredients
SET status = 'flagged',
    explanation = 'A silicone polymer that forms a smooth, breathable film on the skin surface. On the scalp, repeated use leads to silicone build-up that can coat the hair follicle opening, trap sebum, and cause persistent itch and congestion. Also occlusive in leave-on formulas — can prevent the skin from releasing heat and moisture under heavy application.'
WHERE LOWER(TRIM(name)) = 'dimethicone';
