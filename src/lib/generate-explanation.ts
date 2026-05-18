// Curated explanations for the most common skincare ingredients.
// Checked before templates — provides specific, high-quality text for top ingredients.

const CURATED: Record<string, string> = {
  // ── Water / Solvents ───────────────────────────────────────────────────
  "water": "Water is the primary solvent in most skincare formulas, dissolving and delivering active ingredients to the skin. It makes up the bulk of most moisturizers, serums, and toners and is universally well-tolerated.",
  "aqua": "Water is the primary solvent in most skincare formulas, dissolving and delivering active ingredients to the skin. It makes up the bulk of most moisturizers, serums, and toners and is universally well-tolerated.",
  "aqua (water)": "Water is the primary solvent in most skincare formulas, dissolving and delivering active ingredients to the skin. It makes up the bulk of most moisturizers, serums, and toners and is universally well-tolerated.",
  "butylene glycol": "Butylene glycol is a lightweight solvent and humectant that improves texture, helps actives absorb into skin, and provides mild hydration. It is less likely to cause reactions than propylene glycol and is generally well-tolerated.",

  // ── Humectants ─────────────────────────────────────────────────────────
  "glycerin": "Glycerin is a humectant derived from plant oils or fats that draws moisture from the air into the skin's surface layers. It is one of the most studied and widely tolerated moisturizing ingredients in skincare, effective across all skin types including sensitive and reactive.",
  "glycerine": "Glycerin is a humectant derived from plant oils or fats that draws moisture from the air into the skin's surface layers. It is one of the most studied and widely tolerated moisturizing ingredients in skincare, effective across all skin types including sensitive and reactive.",
  "glycerol": "Glycerin is a humectant derived from plant oils or fats that draws moisture from the air into the skin's surface layers. It is one of the most studied and widely tolerated moisturizing ingredients in skincare, effective across all skin types including sensitive and reactive.",
  "sodium hyaluronate": "Sodium hyaluronate is the sodium salt of hyaluronic acid and a powerful humectant that binds up to 1,000 times its weight in water. Its smaller molecular size allows better skin penetration than standard hyaluronic acid. It is rated 0 on comedogenicity scales, but at standard molecular weights it forms a film on the skin surface that can trap dead skin cells and contribute to milia — small, hard keratin bumps just under the skin. In low-humidity environments it can also pull moisture from deeper skin layers rather than from the air, temporarily dehydrating the barrier.",
  "hydrolyzed hyaluronic acid": "Hydrolyzed hyaluronic acid is a low molecular weight form of HA that penetrates into the skin rather than sitting on the surface. Unlike standard (high MW) hyaluronic acid, it has less film-forming tendency and lower milia risk — it doesn't create the same surface layer that traps dead skin cells. However, very low MW fragments can be mildly pro-inflammatory in reactive skin, and it still acts as a humectant that can pull moisture from deeper layers in low-humidity environments.",
  "hyaluronic acid": "Hyaluronic acid is a humectant naturally found in the skin that holds large amounts of water to keep skin plump and hydrated. It is rated 0 on comedogenicity scales — it does not clog pores in the traditional sense. However, standard (high molecular weight) hyaluronic acid forms a film on the skin surface that can trap dead skin cells and lead to milia: small, hard keratin-filled bumps just under the skin that are different from comedones. In low-humidity environments, it can also pull moisture upward from deeper skin layers rather than from the air, which temporarily dehydrates the barrier beneath.",
  "panthenol": "Panthenol is a provitamin B5 that converts to pantothenic acid in the skin, supporting barrier repair, reducing inflammation, and improving moisture retention. It is exceptionally well-tolerated and beneficial for dry, sensitive, and post-procedure skin.",
  "d-panthenol": "Panthenol is a provitamin B5 that converts to pantothenic acid in the skin, supporting barrier repair, reducing inflammation, and improving moisture retention. It is exceptionally well-tolerated and beneficial for dry, sensitive, and post-procedure skin.",
  "urea": "Urea is a humectant and keratolytic naturally present in the skin's NMF. At low concentrations (2–10%) it draws moisture to the skin and gently smooths flakiness; it is particularly effective for chronically dry or rough skin.",
  "betaine": "Betaine is a humectant derived from sugar beets that draws moisture to the skin and stabilizes other formula ingredients under temperature stress. It has mild anti-irritant properties and is well-tolerated, including on sensitive skin.",
  "sorbitol": "Sorbitol is a humectant derived from glucose that attracts moisture from the air to maintain skin hydration. It is gentle and well-tolerated, often used alongside glycerin to enhance the moisturizing effect.",
  "sodium pca": "Sodium PCA is a naturally occurring humectant and key component of the skin's Natural Moisturizing Factor (NMF). It is highly biocompatible, drawing water to the skin's surface and integrating seamlessly with the barrier's own moisture-retention mechanisms.",
  "polyglutamic acid": "Polyglutamic acid is a ferment-derived humectant that holds more water than hyaluronic acid and forms a moisture-retaining film on the skin's surface. It may also inhibit the enzyme that breaks down the skin's own hyaluronic acid.",

  // ── Soothing actives ───────────────────────────────────────────────────
  "allantoin": "Allantoin is a soothing active derived from comfrey root that promotes cell turnover and calms skin irritation. It is widely used in formulas for sensitive, reactive, or post-procedure skin for its ability to reduce redness and accelerate healing.",
  "bisabolol": "Alpha-bisabolol is a soothing active derived from chamomile that reduces inflammation, calms skin irritation, and has mild antimicrobial properties. It is exceptionally gentle and widely used in formulas for reactive and sensitive skin.",
  "alpha-bisabolol": "Alpha-bisabolol is a soothing active derived from chamomile that reduces inflammation, calms skin irritation, and has mild antimicrobial properties. It is exceptionally gentle and widely used in formulas for reactive and sensitive skin.",
  "madecassoside": "Madecassoside is a triterpenoid extracted from Centella asiatica that powerfully soothes inflammation and supports wound healing and barrier repair. It is particularly effective for post-procedure recovery and chronically reactive skin.",
  "asiaticoside": "Asiaticoside is a triterpenoid from Centella asiatica that stimulates collagen synthesis and supports skin barrier repair. It helps calm redness and strengthens the skin's structural integrity with consistent use.",
  "aloe barbadensis leaf juice": "Aloe barbadensis leaf juice is a botanical extract with hydrating, soothing, and anti-inflammatory properties. It calms sunburn, redness, and surface irritation while providing lightweight moisture, and is well-tolerated by most skin types.",
  "aloe vera gel": "Aloe vera gel is a botanical extract with hydrating, soothing, and anti-inflammatory properties. It calms sunburn, redness, and surface irritation while providing lightweight moisture, and is well-tolerated by most skin types.",

  // ── Antioxidants ───────────────────────────────────────────────────────
  "tocopherol": "Tocopherol is vitamin E, a lipid-soluble antioxidant that neutralizes free radicals and helps prevent oxidative damage to both skin and formula. It also supports barrier repair and has mild anti-inflammatory properties.",
  "tocopheryl acetate": "Tocopheryl acetate is a stable ester form of vitamin E that converts to tocopherol on the skin for antioxidant protection. It is more shelf-stable than pure tocopherol and well-tolerated by sensitive skin.",
  "ferulic acid": "Ferulic acid is a plant-derived antioxidant that neutralizes free radicals and dramatically boosts the stability and efficacy of vitamins C and E when combined. It is a key ingredient in high-performance antioxidant serums.",
  "ascorbic acid": "Ascorbic acid is the most bioavailable form of vitamin C and a potent antioxidant that neutralizes free radicals, stimulates collagen synthesis, and inhibits melanin production. It is most effective at low pH and in airtight packaging to prevent oxidation.",
  "l-ascorbic acid": "L-Ascorbic acid is the most bioavailable form of vitamin C and a potent antioxidant that neutralizes free radicals, stimulates collagen synthesis, and inhibits melanin production. It is most effective at low pH and in airtight packaging to prevent oxidation.",
  "sodium ascorbyl phosphate": "Sodium ascorbyl phosphate is a stable, water-soluble vitamin C derivative that converts to ascorbic acid on the skin. It provides antioxidant and brightening benefits with significantly less irritation than pure ascorbic acid, making it well-suited for sensitive skin.",
  "ascorbyl glucoside": "Ascorbyl glucoside is a gentle, stable vitamin C derivative that releases ascorbic acid in the skin for antioxidant and brightening benefits. It is one of the more stable vitamin C forms and is well-tolerated by sensitive skin.",
  "resveratrol": "Resveratrol is a polyphenol antioxidant found in grape skins that neutralizes free radicals and activates sirtuins — proteins linked to cellular longevity. It helps protect skin from oxidative stress and environmental aging.",
  "coenzyme q10": "Coenzyme Q10 is a naturally occurring antioxidant found in skin cells that declines with age. As a topical active it neutralizes free radicals, supports cellular energy production, and helps reduce the appearance of fine lines.",
  "ubiquinone": "Ubiquinone (CoQ10) is a naturally occurring antioxidant present in every skin cell that protects against oxidative stress and supports cellular energy metabolism. Topical application helps compensate for the decline in CoQ10 that occurs with age.",
  "camellia sinensis leaf extract": "Camellia sinensis leaf extract (green tea) is rich in EGCG — a polyphenol antioxidant that neutralizes free radicals, reduces UV-induced inflammation, and has demonstrated anti-aging properties. It is well-tolerated by most skin types.",

  // ── Brightening actives ────────────────────────────────────────────────
  "niacinamide": "Niacinamide is a water-soluble form of vitamin B3 that simultaneously regulates sebum production, fades hyperpigmentation, strengthens the skin barrier, and reduces inflammation. It is one of the most versatile and well-tolerated multifunctional actives in skincare.",
  "nicotinamide": "Niacinamide is a water-soluble form of vitamin B3 that simultaneously regulates sebum production, fades hyperpigmentation, strengthens the skin barrier, and reduces inflammation. It is one of the most versatile and well-tolerated multifunctional actives in skincare.",
  "alpha-arbutin": "Alpha-arbutin is a brightening active derived from bearberry that inhibits tyrosinase — the enzyme responsible for melanin production — to reduce dark spots and even skin tone. It is more effective and gentler than beta-arbutin, and well-tolerated on sensitive skin.",
  "tranexamic acid": "Tranexamic acid is a brightening active that reduces melanin transfer and addresses post-inflammatory hyperpigmentation. Originally a medical hemostatic agent, it has emerged as one of the most effective and well-tolerated brightening ingredients for sensitive skin.",
  "adenosine": "Adenosine is a naturally occurring compound found in all living cells that activates skin repair pathways and supports collagen and elastin synthesis, firming the skin over time. It is gentle, non-irritating, and suitable for sensitive skin.",

  // ── Peptides ───────────────────────────────────────────────────────────
  "palmitoyl tripeptide-1": "Palmitoyl Tripeptide-1 is a lipopeptide that signals fibroblasts to produce collagen and elastin, helping to firm skin and reduce the appearance of fine lines. The palmitoyl chain improves penetration into the skin's deeper layers.",
  "palmitoyl oligopeptide": "Palmitoyl oligopeptide is a peptide that signals fibroblasts to boost collagen and elastin production, supporting firmer skin and reducing the appearance of fine lines with consistent use.",
  "palmitoyl tetrapeptide-7": "Palmitoyl Tetrapeptide-7 is a peptide that modulates interleukin-6 to reduce chronic low-grade skin inflammation. It is often paired with Palmitoyl Tripeptide-1 for complementary firming and anti-aging effects.",
  "acetyl hexapeptide-3": "Acetyl Hexapeptide-3, known as Argireline, is a peptide that inhibits neurotransmitter release to temporarily relax facial muscle contractions. It reduces the appearance of dynamic expression lines with consistent use.",
  "acetyl hexapeptide-8": "Acetyl Hexapeptide-8 (Argireline) is a peptide that inhibits neurotransmitter release to temporarily relax facial muscle contractions, reducing the appearance of expression lines with consistent use.",
  "copper tripeptide-1": "Copper Tripeptide-1 (GHK-Cu) is a naturally occurring peptide-copper complex that promotes wound healing, stimulates collagen and elastin synthesis, and has antioxidant and anti-inflammatory properties. It is used in serums targeting fine lines, firmness, and skin repair.",

  // ── Ceramides ─────────────────────────────────────────────────────────
  "ceramide np": "Ceramide NP is the most abundant ceramide in healthy skin and a critical component of the lipid barrier that locks in moisture and protects against irritants. Topical application replenishes ceramides depleted by aging, over-cleansing, or barrier disruption.",
  "ceramide ap": "Ceramide AP is a barrier lipid that works alongside other ceramides to reinforce the skin's protective function. It is particularly effective in formulas targeting eczema-prone, compromised, or chronically dry skin.",
  "ceramide eop": "Ceramide EOP is a long-chain ceramide essential for the lamellar structure of the skin barrier. It is critical for reducing transepidermal water loss and is commonly used in formulas for eczema, psoriasis, and compromised skin.",
  "ceramide 1": "Ceramide 1 is a key lipid in the skin barrier's lamellar structure that seals moisture in and protects against environmental irritants. Topical replenishment supports barrier integrity in dry, sensitive, or compromised skin.",
  "phytosphingosine": "Phytosphingosine is a sphingolipid precursor to ceramides that strengthens the skin barrier and has antimicrobial and anti-inflammatory properties. It helps rebuild barrier lipids in compromised skin and is well-tolerated by sensitive skin.",
  "cholesterol": "Cholesterol is a naturally occurring lipid that makes up roughly 25% of the skin barrier's lipid structure, working alongside ceramides and fatty acids to maintain moisture and elasticity. Topically, it replenishes barrier lipids and is particularly beneficial for dry or mature skin.",

  // ── Emollients ─────────────────────────────────────────────────────────
  "squalane": "Squalane is a stable, plant-derived emollient (usually from sugarcane or olives) that closely mimics the skin's natural sebum. Unlike squalene (the unsaturated form), squalane is hydrogenated and does not oxidize on skin. It absorbs quickly, rates very low on comedogenicity scales, and is well-tolerated by oily, sensitive, and acne-prone skin.",
  "squalene": "Squalene is the unstabilized, unsaturated precursor to squalane — it occurs naturally in sebum and plant oils, but oxidizes readily when applied to skin or exposed to air. Oxidized squalene is a documented contributor to closed comedones and pore congestion. For topical use, squalane (the hydrogenated, shelf-stable form, spelled with an 'a') is significantly safer for congestion-prone skin.",
  "bakuchiol": "Bakuchiol is a plant-derived active from the babchi plant that activates retinol receptor pathways to support cell turnover and collagen production. It provides retinol-like firming and smoothing benefits with significantly less irritation, making it suitable for reactive and sensitive skin.",
  "rosehip oil": "Rosehip oil is an emollient plant oil rich in linoleic and linolenic acids and natural carotenoids. It supports barrier repair, helps fade hyperpigmentation, and improves skin texture with consistent use.",
  "rosa canina fruit oil": "Rosehip oil is an emollient plant oil rich in linoleic and linolenic acids and natural carotenoids. It supports barrier repair, helps fade hyperpigmentation, and improves skin texture with consistent use.",
  "simmondsia chinensis seed oil": "Jojoba oil is technically a liquid wax ester from the jojoba plant that closely mimics human sebum. It acts as a lightweight, non-comedogenic emollient and is well-tolerated even by acne-prone and sensitive skin.",

  // ── Fatty alcohols / Emulsifiers ───────────────────────────────────────
  "cetearyl alcohol": "Cetearyl alcohol is a fatty alcohol derived from vegetable sources that acts as an emollient and stabilizes emulsions. Despite the name, it does not dry the skin — it is well-tolerated including by sensitive skin.",
  "cetyl alcohol": "Cetyl alcohol is a fatty alcohol from palm or coconut oil that softens skin and gives creams their smooth, spreadable consistency. It is not a drying alcohol and is safe for sensitive skin.",
  "stearic acid": "Stearic acid is a saturated fatty acid found naturally in skin sebum that replenishes barrier lipids and acts as a mild emulsifier. It is well-tolerated and leaves skin feeling soft and comfortable.",
  "glyceryl stearate": "Glyceryl stearate is an emulsifier derived from glycerin and stearic acid that stabilizes the oil-water blend in creams and lotions. It also imparts a soft, emollient feel and is well-tolerated by most skin types.",
  "stearyl alcohol": "Stearyl alcohol is a long-chain fatty alcohol derived from plant or animal sources that softens and smooths the skin while helping to stabilize emulsions. Despite its name it is not a drying alcohol — fatty alcohols are non-stripping and non-sensitizing, well-tolerated even by sensitive skin.",

  // ── UV Filters (mineral) ──────────────────────────────────────────────
  "zinc oxide": "Zinc oxide is a mineral UV filter that sits on the skin's surface to physically scatter and absorb both UVA and UVB radiation. It provides broad-spectrum protection and is well-tolerated even by reactive and sensitive skin, often preferred over chemical UV filters.",
  "titanium dioxide": "Titanium dioxide is a mineral UV filter that reflects UV radiation from the skin's surface. It is particularly effective against UVB rays, is non-sensitizing, and is often preferred for reactive skin over chemical sunscreen alternatives.",

  // ── Thickeners ────────────────────────────────────────────────────────
  "carbomer": "Carbomer is a synthetic thickening polymer that creates the smooth gel-like texture in many serums and moisturizers. It is inert, non-reactive, and has no known skin effects beyond improving the formula's feel and stability.",
  "xanthan gum": "Xanthan gum is a natural thickener produced by bacterial fermentation that creates smooth, stable gel textures. It is completely inert and non-irritating, safe for all skin types including reactive and sensitive skin.",

  // ── Surfactants (mild) ────────────────────────────────────────────────
  "cocamidopropyl betaine": "Cocamidopropyl betaine is a gentle amphoteric surfactant derived from coconut oil that cleanses skin and provides mild foaming. It is significantly gentler on the barrier than sulfate surfactants and is well-tolerated by most skin types.",

  // ── Preservatives (safe) ──────────────────────────────────────────────
  "phenoxyethanol": "Phenoxyethanol is a widely used preservative that prevents microbial growth in skincare formulas. It is flagged because it can cause sensitization and skin irritation in reactive individuals, particularly at concentrations above 0.5%, and has been linked to nervous system effects in infants.",

  // ── Silicones (safe) ──────────────────────────────────────────────────
  "dimethicone": "Dimethicone is a silicone polymer that provides a smooth, silky texture and forms a breathable film on skin to prevent moisture loss. It is non-comedogenic at typical concentrations and well-tolerated, though it may feel heavy for oily skin types.",
  "amodimethicone": "Amodimethicone is an amino-modified silicone that selectively coats and smooths damaged areas of hair and skin. It is non-occlusive and gentler than dimethicone, and is well-tolerated by sensitive skin.",

  // ── Flagged ───────────────────────────────────────────────────────────
  "parfum": "Parfum is a catch-all term for fragrance blends, which can contain hundreds of undisclosed compounds including known allergens. It is one of the most common causes of contact dermatitis and sensitization in reactive skin.",
  "fragrance": "Fragrance is a catch-all term for scent blends that can contain hundreds of undisclosed compounds including known allergens. It is a leading trigger for contact dermatitis and sensitization in reactive skin.",
  "limonene": "Limonene is a fragrance compound found in citrus peels that adds a fresh scent to products. It is flagged because it oxidizes on contact with air to form potent allergens, commonly triggering contact dermatitis in reactive skin.",
  "linalool": "Linalool is a fragrance compound naturally found in lavender and other plants. It is flagged as a common allergen that can cause contact dermatitis, especially in its oxidized form, and is regulated as a known sensitizer.",
  "menthol": "Menthol is a naturally derived cooling compound from mint that activates cold-sensing receptors in the skin to create an intense cooling sensation. It is flagged because the sensation frequently transitions to burning or stinging on reactive skin and triggers unconscious touching and scratching, compounding barrier damage — and it is a recognized cause of sensitization and contact dermatitis with repeated exposure.",
  "l-menthol": "L-Menthol is the naturally derived form of menthol from mint that activates cold-sensing receptors to create an intense cooling sensation. It is flagged because this sensation frequently transitions to burning or stinging on reactive skin and triggers unconscious touching and scratching, compounding barrier damage — and it is a recognized cause of sensitization and contact dermatitis with repeated exposure.",
  "melaleuca alternifolia leaf oil": "Melaleuca alternifolia leaf oil (tea tree oil) is a steam-distilled essential oil with natural antimicrobial and anti-inflammatory properties. It is flagged because it is a concentrated volatile oil and one of the most common causes of allergic contact dermatitis in skincare — reactive or barrier-compromised skin is particularly vulnerable to its sensitizing volatile compounds.",
  "melaleuca alternifolia (tea tree) leaf oil": "Melaleuca alternifolia leaf oil (tea tree oil) is a steam-distilled essential oil with natural antimicrobial and anti-inflammatory properties. It is flagged because it is a concentrated volatile oil and one of the most common causes of allergic contact dermatitis in skincare — reactive or barrier-compromised skin is particularly vulnerable to its sensitizing volatile compounds.",
  "sodium lauryl sulfate": "Sodium lauryl sulfate is an aggressive cleansing surfactant that creates rich lather. It is flagged because it strips the skin's natural oils, disrupts the barrier, and commonly causes dryness, irritation, and worsened sensitivity with regular use.",
  "sodium laureth sulfate": "Sodium laureth sulfate is a sulfate surfactant that provides cleansing and lather. It is flagged because it can strip the skin barrier and cause irritation in sensitive individuals, though it is somewhat milder than sodium lauryl sulfate.",
  "sodium myreth sulfate": "Sodium myreth sulfate is an ethoxylated sulfate surfactant derived from myristic acid that provides cleansing and light foaming. It is flagged because sulfate surfactants strip the skin's natural oils and disrupt the moisture barrier, causing dryness and irritation with regular use — though it is somewhat milder than sodium lauryl or laureth sulfate.",
  "oxybenzone": "Oxybenzone is a chemical UV filter that absorbs UV radiation. It is flagged due to documented skin sensitization, concerns about endocrine-disrupting activity at higher exposures, and significant toxicity to coral reef ecosystems.",
  "cyclopentasiloxane": "Cyclopentasiloxane is a lightweight cyclic silicone that evaporates quickly to leave a silky feel. It is flagged because it is a suspected endocrine disruptor, bioaccumulates in the environment, and can form an occlusive film that worsens congestion.",
  "alcohol denat": "Denatured alcohol is used in formulas to improve texture, increase absorption, and create a fast-drying finish. It is flagged because it rapidly strips the skin's natural oils, damages the moisture barrier, and causes dryness and irritation with regular use.",
  "alcohol denat.": "Denatured alcohol is used in formulas to improve texture, increase absorption, and create a fast-drying finish. It is flagged because it rapidly strips the skin's natural oils, damages the moisture barrier, and causes dryness and irritation with regular use.",
  "retinol": "Retinol is a vitamin A derivative that accelerates cell turnover to smooth texture, reduce fine lines, and fade discoloration. It is flagged for reactive skin because it commonly causes dryness, peeling, and irritation — especially during the adjustment period — and substantially increases sun sensitivity.",
  "retinyl palmitate": "Retinyl palmitate is a mild ester form of vitamin A that converts to retinol in the skin. It is flagged because it can cause irritation at higher concentrations and increases photosensitivity, posing a concern when used without adequate sun protection.",
  "salicylic acid": "Salicylic acid is a BHA exfoliant that penetrates oil-filled follicles to dissolve dead skin cells and reduce blackheads and breakouts. It is flagged because at higher concentrations it causes dryness, barrier disruption, and photosensitivity on reactive skin.",
  "glycolic acid": "Glycolic acid is the smallest AHA, allowing deep penetration to exfoliate dead skin, stimulate collagen, and improve texture. It is flagged because it commonly causes stinging, redness, and significantly increases sun sensitivity, particularly on reactive or sensitized skin.",
  "lactic acid": "Lactic acid is a gentle AHA that exfoliates dead skin cells while simultaneously attracting moisture to the surface. It is flagged because even at milder concentrations it can cause barrier disruption and increased photosensitivity in reactive individuals.",
  "propylene glycol": "Propylene glycol is a solvent and humectant that dissolves ingredients and improves their absorption into the skin. It is flagged because it can cause contact dermatitis and irritation in sensitive individuals, particularly at concentrations above 5%.",
  "methylisothiazolinone": "Methylisothiazolinone is a preservative used to prevent microbial growth. It is flagged as a potent allergen and one of the most common causes of preservative-related contact dermatitis — its use in leave-on products is restricted in the EU.",

  // ── Emollients and occlusives ──────────────────────────────────────────
  "caprylic/capric triglyceride": "Caprylic/capric triglyceride is a lightweight emollient derived from coconut oil and glycerin that spreads effortlessly and absorbs quickly without greasiness. It is non-comedogenic, non-sensitizing, and exceptionally well-tolerated — one of the cleanest and most skin-compatible emollients in modern skincare.",
  "petrolatum": "Petrolatum is a highly refined semi-solid occlusive that forms a protective film on the skin surface to lock in moisture and prevent water loss. It is one of the most effective skin protectants available — non-sensitizing, non-comedogenic, and exceptionally well-tolerated even by severely compromised or reactive skin.",
  "white petrolatum": "White petrolatum is a purified form of petrolatum that forms a protective occlusive film on the skin to prevent moisture loss. It is one of the most effective skin protectants available — non-sensitizing, non-comedogenic, and well-tolerated even by the most reactive or compromised skin.",
  "mineral oil": "Mineral oil is a highly refined petroleum-derived liquid that acts as an emollient and occlusive, sealing moisture into the skin surface without penetrating it. Cosmetic-grade mineral oil is non-sensitizing, non-comedogenic at typical concentrations, and well-tolerated even by reactive skin — its poor reputation comes from industrial-grade variants, not cosmetic use.",
  "lanolin": "Lanolin is a rich emollient wax derived from sheep's wool that closely mimics the skin's own lipid composition, providing deep moisturization and barrier repair. It is effective for dry and compromised skin, but worth noting for those with wool sensitivity — a subset of individuals can develop allergic contact dermatitis with repeated exposure.",
  "shea butter": "Shea butter is a rich emollient from the shea tree packed with oleic and stearic fatty acids, vitamin E, and anti-inflammatory triterpenes that deeply moisturize and support barrier repair. It is well-tolerated by most skin types, though its high oleic acid content can occasionally worsen congestion in acne-prone skin.",
  "butyrospermum parkii butter": "Shea butter (Butyrospermum parkii) is a rich emollient packed with oleic and stearic fatty acids, vitamin E, and anti-inflammatory triterpenes that deeply moisturize and support barrier repair. It is well-tolerated by most skin types, though its high oleic acid content can occasionally worsen congestion in acne-prone skin.",
  "butyrospermum parkii (shea) butter": "Shea butter (Butyrospermum parkii) is a rich emollient packed with oleic and stearic fatty acids, vitamin E, and anti-inflammatory triterpenes that deeply moisturize and support barrier repair. It is well-tolerated by most skin types, though its high oleic acid content can occasionally worsen congestion in acne-prone skin.",
  "helianthus annuus seed oil": "Helianthus annuus seed oil (sunflower oil) is a lightweight emollient rich in linoleic acid that nourishes the skin barrier without greasiness. Its high linoleic content helps replace barrier lipids that reactive and acne-prone skin tends to be deficient in, supporting barrier recovery without clogging pores.",
  "helianthus annuus (sunflower) seed oil": "Helianthus annuus seed oil (sunflower oil) is a lightweight emollient rich in linoleic acid that nourishes the skin barrier without greasiness. Its high linoleic content helps replace barrier lipids that reactive and acne-prone skin tends to be deficient in, supporting barrier recovery without clogging pores.",
  "prunus amygdalus dulcis oil": "Prunus amygdalus dulcis oil (sweet almond oil) is a lightweight emollient rich in oleic and linoleic fatty acids that softens skin and improves moisture retention. It absorbs readily, leaves a light finish, and is well-tolerated by most skin types including sensitive.",
  "prunus amygdalus dulcis (sweet almond) oil": "Prunus amygdalus dulcis oil (sweet almond oil) is a lightweight emollient rich in oleic and linoleic fatty acids that softens skin and improves moisture retention. It absorbs readily, leaves a light finish, and is well-tolerated by most skin types including sensitive.",
  "persea gratissima oil": "Persea gratissima oil (avocado oil) is a rich emollient loaded with oleic acid, phytosterols, and fat-soluble vitamins A, D, and E that nourish and support barrier repair. Its thicker texture and deeper penetration make it most beneficial for dry, mature, or severely compromised skin.",
  "persea gratissima (avocado) oil": "Persea gratissima oil (avocado oil) is a rich emollient loaded with oleic acid, phytosterols, and fat-soluble vitamins A, D, and E that nourish and support barrier repair. Its thicker texture and deeper penetration make it most beneficial for dry, mature, or severely compromised skin.",
  "argania spinosa kernel oil": "Argania spinosa kernel oil (argan oil) is a lightweight emollient from the Moroccan argan tree, rich in vitamin E and a balanced mix of oleic and linoleic acids. It absorbs quickly without greasiness, supports barrier function and skin elasticity, and is well-tolerated by most skin types.",
  "vitis vinifera seed oil": "Vitis vinifera seed oil (grapeseed oil) is a lightweight emollient rich in linoleic acid and vitamin E that absorbs quickly and leaves a clean, non-greasy finish. Its high linoleic acid content supports barrier repair and makes it a good option for oily and acne-prone skin types.",
  "oenothera biennis oil": "Oenothera biennis oil (evening primrose oil) is an emollient particularly rich in gamma-linolenic acid (GLA), an omega-6 fatty acid that plays a key role in maintaining the skin barrier. It is especially beneficial for dry, eczema-prone, and reactive skin that is deficient in GLA.",
  "limnanthes alba seed oil": "Limnanthes alba seed oil (meadowfoam oil) is a lightweight, highly stable emollient rich in long-chain fatty acids that closely resemble the skin's own sebum. It absorbs readily, reduces transepidermal water loss, and is exceptionally well-tolerated by sensitive skin.",
  "sclerocarya birrea seed oil": "Sclerocarya birrea seed oil (marula oil) is a fast-absorbing emollient rich in oleic acid and antioxidants that nourishes and softens skin without greasiness. It is well-tolerated by most skin types and helps improve skin elasticity and moisture retention with consistent use.",

  // ── Soothing botanicals ────────────────────────────────────────────────
  "centella asiatica extract": "Centella asiatica extract is a potent wound-healing and anti-inflammatory botanical concentrated in triterpenoids — including madecassoside, asiaticoside, and asiatic acid — that reduce inflammation and support collagen synthesis. It is one of the most effective plant ingredients for reactive, sensitized, barrier-compromised, or post-procedure skin.",
  "centella asiatica leaf extract": "Centella asiatica leaf extract is a soothing and barrier-strengthening botanical rich in triterpenoid compounds that reduce inflammation and stimulate collagen production. It is one of the most effective plant ingredients for reactive, sensitized, and compromised skin.",
  "centella asiatica leaf water": "Centella asiatica leaf water is a hydrosol distilled from centella leaves, providing a gentle botanical base with trace soothing compounds. It is far more dilute than the concentrated extract — delivering mild calming and hydrating properties without significant triterpenoid concentration — and is well-tolerated by reactive skin.",
  "glycyrrhiza glabra root extract": "Glycyrrhiza glabra root extract (licorice root) delivers glabridin, which inhibits tyrosinase to reduce hyperpigmentation, alongside glycyrrhizin, which calms inflammation. It is well-tolerated by sensitive skin and uniquely effective at addressing both redness and discoloration simultaneously.",
  "glycyrrhiza uralensis root extract": "Glycyrrhiza uralensis root extract (Chinese licorice root) is a soothing and brightening botanical active that inhibits melanin production and reduces skin inflammation. It is well-tolerated by sensitive skin and used to address hyperpigmentation and redness together.",
  "avena sativa kernel extract": "Avena sativa kernel extract (oat extract) reduces skin inflammation and relieves itch through its avenanthramide and beta-glucan content. It is an FDA-recognized skin protectant and one of the most effective and well-tolerated botanical ingredients for reactive, eczema-prone, and chronically sensitized skin.",
  "colloidal oatmeal": "Colloidal oatmeal is finely milled oat that forms a protective, anti-inflammatory film on the skin to relieve itch, reduce redness, and temporarily reinforce a damaged barrier. It is an FDA-recognized skin protectant that is exceptionally gentle — suitable for even the most reactive, eczema-prone individuals.",
  "matricaria chamomilla flower extract": "Matricaria chamomilla flower extract (chamomile) is a soothing botanical rich in bisabolol and the flavonoid apigenin that reduces redness, calms inflammation, and promotes skin healing. It is well-tolerated by sensitive skin and effective for chronic irritation and reactive conditions.",
  "chamomilla recutita flower extract": "Chamomilla recutita flower extract (chamomile) is a soothing botanical rich in bisabolol and apigenin that calms inflammation, reduces redness, and supports skin healing. It is well-tolerated by sensitive and reactive skin types.",
  "chamomilla recutita (matricaria) flower extract": "Chamomilla recutita flower extract (chamomile) is a soothing botanical rich in bisabolol and apigenin that calms inflammation, reduces redness, and supports skin healing. It is well-tolerated by sensitive and reactive skin types.",
  "hamamelis virginiana water": "Hamamelis virginiana water (witch hazel distillate) is steam-distilled from witch hazel bark and leaves, delivering tannins and polyphenols that temporarily tighten pores and reduce surface oiliness. The pronounced astringent sensation it creates prompts face-touching, and with regular use its drying effect progressively weakens the skin barrier — particularly problematic for reactive or dry skin.",
  "hamamelis virginiana extract": "Hamamelis virginiana extract (witch hazel extract) is a concentrated botanical rich in tannins and polyphenols with astringent and mild anti-inflammatory properties. It is flagged because the tightening sensation it causes prompts touching, and its drying effect from regular use gradually weakens the skin barrier — less appropriate for reactive or dry skin.",
  "hamamelis virginiana leaf water": "Hamamelis virginiana leaf water (witch hazel leaf distillate) is a gentle botanical hydrosol with mild astringent and soothing properties. The tightening sensation it produces still prompts face-touching, and its astringent action can gradually weaken the skin barrier with regular use on reactive or dry skin.",
  "salix alba bark extract": "Salix alba bark extract (white willow bark) is a natural source of salicin, which converts to salicylic acid-like compounds in the skin. It provides gentle exfoliating and pore-refining properties at lower effective concentrations than synthetic salicylic acid, though it can mildly increase photosensitivity and is worth noting for those with aspirin sensitivity.",
  "salix alba (white willow) bark extract": "Salix alba bark extract (white willow bark) is a natural source of salicin, which converts to salicylic acid-like compounds in the skin. It provides gentle exfoliating and pore-refining properties at lower effective concentrations than synthetic salicylic acid, though it can mildly increase photosensitivity and is worth noting for those with aspirin sensitivity.",

  // ── Additional vitamin C derivatives ──────────────────────────────────
  "magnesium ascorbyl phosphate": "Magnesium ascorbyl phosphate is a stable, water-soluble vitamin C derivative that converts to ascorbic acid in the skin for antioxidant protection and melanin inhibition. It is significantly gentler than pure ascorbic acid and one of the best-tolerated vitamin C forms for reactive and sensitive skin.",
  "3-o-ethyl ascorbic acid": "3-O-Ethyl ascorbic acid is a highly stable vitamin C ether that penetrates skin efficiently and converts to ascorbic acid for antioxidant and brightening effects. It causes minimal irritation and is well-tolerated by most skin types, making it a strong stable alternative to pure vitamin C.",
  "ascorbyl tetraisopalmitate": "Ascorbyl tetraisopalmitate is an oil-soluble vitamin C ester that penetrates into the skin's lipid layers for antioxidant and brightening effects that water-soluble vitamin C cannot reach. It is exceptionally stable, non-irritating, and particularly suited for dry and sensitive skin types.",

  // ── Additional actives ─────────────────────────────────────────────────
  "azelaic acid": "Azelaic acid is a dicarboxylic acid naturally produced by skin microbiota that simultaneously reduces inflammation, inhibits melanin production, and targets acne-causing bacteria. It is one of the few actives suited for reactive and rosacea-prone skin — effective without the significant photosensitivity risk or barrier disruption seen with AHAs and retinoids.",
  "mandelic acid": "Mandelic acid is an AHA exfoliant derived from bitter almonds with a larger molecular weight than glycolic acid, slowing its penetration and significantly reducing irritation. It is flagged for increased sun sensitivity and potential barrier disruption with overuse, but is the gentlest and most reactive-skin-friendly AHA option.",
  "gluconolactone": "Gluconolactone is a polyhydroxy acid (PHA) exfoliant with a larger molecular structure than AHAs, limiting its penetration depth and irritation potential. Unlike AHAs, it also functions as a humectant and antioxidant — making it the gentlest chemical exfoliant class and uniquely well-tolerated by reactive, eczema-prone, and sensitive skin.",
  "retinaldehyde": "Retinaldehyde (retinal) is a vitamin A aldehyde positioned one conversion step closer to retinoic acid than retinol, making it significantly more potent at lower concentrations. It is flagged because it causes more pronounced initial irritation, dryness, and photosensitivity than retinol — introduce very gradually and always pair with daily SPF.",
  "retinal": "Retinaldehyde (retinal) is a vitamin A aldehyde positioned one conversion step closer to retinoic acid than retinol, making it significantly more potent at lower concentrations. It is flagged because it causes more pronounced initial irritation, dryness, and photosensitivity than retinol — introduce very gradually and always pair with daily SPF.",

  // ── Common preservatives and boosters ────────────────────────────────
  "potassium sorbate": "Potassium sorbate is a mild preservative derived from sorbic acid that inhibits mold and yeast growth in cosmetic formulas. It has a low sensitization potential and is one of the most broadly tolerated preservatives available, commonly used in natural and clean formulations.",
  "sodium benzoate": "Sodium benzoate is a preservative effective against bacteria and yeasts, commonly paired with potassium sorbate for broad-spectrum preservation. It is well-tolerated by most skin types at cosmetic concentrations, though highly reactive individuals may occasionally notice mild irritation.",
  "ethylhexylglycerin": "Ethylhexylglycerin is a glycerin-derived preservative booster and skin-conditioning agent that amplifies the efficacy of primary preservatives while also softening skin. It is well-tolerated by most skin types and a common ingredient in clean beauty formulations.",
  "1,2-hexanediol": "1,2-Hexanediol is a preservative booster and skin-conditioning agent that inhibits microbial growth and improves formula feel. Despite its '-diol' suffix, it is not a drying alcohol — it has mild humectant properties and is well-tolerated at cosmetic concentrations.",
  "caprylyl glycol": "Caprylyl glycol is a preservative booster and skin-conditioning agent derived from caprylic acid that inhibits microbial growth while softening skin. It is well-tolerated and commonly paired with other mild preservatives in clean formulations.",

  // ── Solvents and humectants ───────────────────────────────────────────
  "pentylene glycol": "Pentylene glycol is a multifunctional solvent, mild humectant, and antimicrobial booster that improves delivery of other actives while drawing moisture to the skin surface. It is well-tolerated and widely used as a cleaner, less irritating alternative to propylene glycol.",
  "propanediol": "Propanediol is a plant-derived (typically from corn) solvent and humectant that improves the absorption and skin feel of other ingredients while providing mild surface hydration. It is well-tolerated by most skin types and used as a gentler, more sustainably sourced alternative to propylene glycol.",
  "1,3-propanediol": "1,3-Propanediol is a plant-derived solvent and humectant that improves the absorption and skin feel of other ingredients while providing mild surface hydration. It is well-tolerated by most skin types and used as a gentler, more sustainably sourced alternative to propylene glycol.",

  // ── Additional fragrance allergens ────────────────────────────────────
  "citronellol": "Citronellol is a fragrance compound naturally found in rose and citrus oils that adds a floral, rosy scent to products. It is flagged as a documented EU-regulated fragrance allergen that can trigger contact dermatitis and sensitization in reactive skin, particularly in its oxidized form.",
  "geraniol": "Geraniol is a fragrance compound found naturally in rose, geranium, and palmarosa oils. It is flagged as a documented EU-regulated allergen and one of the more common causes of fragrance-related contact dermatitis — it also oxidizes on air contact to form even more potent allergenic derivatives.",
  "eugenol": "Eugenol is a fragrance compound found in clove, cinnamon, and many essential oils that adds a warm, spicy character. It is flagged as a potent sensitizer and documented EU-regulated allergen that frequently triggers allergic contact dermatitis — among the most reactive fragrance compounds for sensitive skin.",
  "coumarin": "Coumarin is a fragrance compound found naturally in tonka bean, sweet clover, and vanilla, added for a warm, sweet scent. It is flagged as a documented EU-regulated fragrance allergen that can cause photosensitization and contact dermatitis with repeated exposure in reactive skin.",
  "benzyl alcohol": "Benzyl alcohol is a fragrance compound and preservative that adds a mild floral scent while inhibiting microbial growth. It is flagged as a documented EU-regulated fragrance allergen that can cause contact dermatitis in reactive individuals — at higher preservative concentrations it can also be directly irritating.",

  // ── Formaldehyde releasers ─────────────────────────────────────────────
  "dmdm hydantoin": "DMDM hydantoin is a preservative that inhibits microbial growth by slowly releasing formaldehyde into the formula over the product's lifetime. It is flagged because formaldehyde is a potent allergen and probable carcinogen — repeated exposure is a well-documented cause of allergic contact dermatitis in reactive skin.",
  "imidazolidinyl urea": "Imidazolidinyl urea is a formaldehyde-releasing preservative used to extend product shelf life. It is flagged because it continuously releases formaldehyde — a potent allergen — increasing the risk of sensitization and contact dermatitis with repeated exposure on reactive skin.",
  "diazolidinyl urea": "Diazolidinyl urea is a formaldehyde-releasing preservative that releases more formaldehyde than imidazolidinyl urea, making it one of the most potent preservative sensitizers in common cosmetic use. It is flagged due to its high documented rate of triggering allergic contact dermatitis in reactive and sensitized individuals.",

  // ── Additional flagged actives ─────────────────────────────────────────
  "benzoyl peroxide": "Benzoyl peroxide is an antimicrobial active that kills acne-causing bacteria by generating oxidative stress inside follicles. It is flagged because it is a direct irritant that commonly causes dryness, peeling, and redness — reactive skin should start at 2.5% and consider short-contact application to reduce irritation.",
  "kojic acid": "Kojic acid is a brightening active derived from fungal fermentation that inhibits tyrosinase to reduce melanin production and fade hyperpigmentation. It is flagged as a sensitizer that can cause contact dermatitis with repeated use — reactive skin should use it cautiously, ideally at concentrations below 1%.",

  // ── Additional cyclic silicones ────────────────────────────────────────
  "cyclohexasiloxane": "Cyclohexasiloxane is a cyclic silicone (D6) that creates a smooth, silky feel and fast-evaporating finish in cosmetics. It is flagged because cyclic silicones are suspected endocrine disruptors, persist and bioaccumulate in the environment, and can form an occlusive film that worsens skin congestion.",
  "cyclomethicone": "Cyclomethicone is a mixture of cyclic silicones (D4/D5/D6) that imparts a lightweight, fast-evaporating feel to cosmetics and skincare. It is flagged because its components are suspected endocrine disruptors and environmental bioaccumulants that may also form an occlusive film trapping sebum and bacteria against the skin.",

  // ── Additional ceramides ───────────────────────────────────────────────
  "ceramide ns": "Ceramide NS is a naturally occurring ceramide in the skin's lamellar lipid matrix that works alongside ceramide NP and fatty acids to seal moisture in and prevent transepidermal water loss. Topical replenishment helps restore barrier lipids depleted by aging, over-cleansing, or skin conditions.",
  "ceramide ng": "Ceramide NG is a ceramide that contributes to the lamellar structure of the stratum corneum, working synergistically with other ceramides to reinforce the barrier against irritants and moisture loss. It is particularly beneficial in formulas targeting dry, eczema-prone, or sensitized skin.",
  "ceramide 2": "Ceramide 2 (also known as Ceramide NS) is a naturally occurring barrier lipid that helps seal moisture into the skin and protect against environmental irritants. It works synergistically with other ceramides and fatty acids to maintain the structural integrity of the skin's outer protective layer.",
};

// ── Richer templates ────────────────────────────────────────────────────────

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

const STRUCTURAL_ROLE: Record<string, string> = {
  "Emulsifier": "helps oil and water blend together to keep the formula stable",
  "Thickener": "increases the formula's viscosity for smooth, even application",
  "Film Former": "creates a thin protective film on the skin surface",
  "Surfactant": "reduces surface tension to cleanse skin and rinse away dirt and oil",
  "Wax": "provides texture, structure, and an occlusive protective layer",
  "Pigment": "provides color in the formula",
  "Colorant": "adds or enhances color in the formula",
  "pH Adjuster": "keeps the formula at an optimal pH for stability and skin compatibility",
  "Conditioning Agent": "coats and smooths skin and hair surfaces to reduce friction and improve feel",
  "Silicone": "provides a silky texture and slip while forming a breathable barrier on skin",
  "Fatty Acid": "replenishes the skin's lipid barrier and helps lock in moisture",
  "Fatty Alcohol": "softens texture and stabilizes emulsions without drying the skin",
  "Botanical Water": "provides a plant-derived aqueous base with mild skin benefits",
  "Mineral": "supplies trace elements that support skin function",
  "Preservative Booster": "enhances the effectiveness of preservatives to extend shelf life",
  "Emollient": "softens and smooths skin by filling gaps in the lipid barrier",
  "Humectant": "draws moisture from the air into the upper layers of skin",
  "UV Filter": "absorbs or reflects UV radiation to protect skin from sun damage",
  "Plant Extract": "delivers concentrated plant-derived actives",
  "Solvent": "dissolves other ingredients and helps the formula spread on skin",
  "Chelating Agent": "binds trace metals in water to prevent formula degradation",
  "Preservative": "prevents microbial growth to extend the product's shelf life",
  "Fragrance": "adds scent to the formula",
  "Peptide": "signals skin cells to support collagen production, repair, and moisture retention",
  "Ceramide": "replenishes the skin barrier's lipid structure to lock in moisture and protect against irritants",
  "Retinoid": "accelerates cell turnover to smooth texture and reduce discoloration",
  "Exfoliant": "dissolves the bonds between dead skin cells to reveal smoother skin",
  "Protein": "forms a conditioning film on skin and hair to strengthen and smooth",
  "Clay": "absorbs excess sebum and draws out impurities from pores",
  "Amino Acid": "supports hydration and barrier function as a skin-identical NMF component",
  "Active": "delivers a targeted skin benefit",
};

const SAFE_BENEFIT: Record<string, string> = {
  "soothing": "It calms redness and irritation, making it particularly well-suited for sensitive and reactive skin.",
  "antioxidant": "It neutralizes free radicals to protect skin from oxidative stress and environmental aging.",
  "brightening": "It helps reduce hyperpigmentation and even skin tone with consistent use.",
  "firming": "It supports skin elasticity and a firmer, more lifted appearance over time.",
  "antimicrobial": "It helps control bacteria and keep skin clear with minimal irritation.",
  "humectant": "It maintains long-lasting surface hydration and is well-tolerated by all skin types.",
  "emollient": "It leaves skin soft and smooth and is generally well-tolerated.",
  "barrier-repairing": "It strengthens the skin barrier to reduce moisture loss and sensitivity.",
  "cleansing": "It removes impurities effectively and is considered mild and non-stripping.",
};

const FLAGGED_CONCERN: Record<string, string> = {
  "sensitizer": "It is a known sensitizer that can trigger allergic reactions or contact dermatitis with repeated exposure in reactive skin.",
  "pore-clogger": "It is comedogenic and can clog pores, contributing to breakouts in acne-prone skin.",
  "stripping": "It strips the skin's natural oils, disrupting the barrier and worsening dryness and sensitivity.",
  "fragrance-allergen": "It is a documented fragrance allergen that can trigger contact dermatitis in sensitive individuals.",
  "occlusive": "It can form an occlusive film that traps sebum and bacteria against the skin, worsening congestion.",
  "bacteria-trap": "At high concentrations it can draw moisture and bacteria to the skin surface, potentially worsening breakouts.",
  "photosensitizer": "It increases the skin's sensitivity to UV radiation, raising the risk of sun damage and reactions.",
  "exfoliant": "As a chemical exfoliant it can cause dryness, irritation, and substantially increased photosensitivity on reactive skin.",
  "retinoid": "It commonly causes dryness, peeling, and irritation — especially initially — and significantly increases sun sensitivity.",
  "Fragrance": "Fragrance is a leading trigger for contact dermatitis and sensitization in reactive skin.",
  "Preservative": "This preservative type can cause sensitization and allergic reactions with repeated exposure.",
  "Irritant": "It is a direct irritant that can cause redness, stinging, or inflammation on reactive skin.",
  "Drying Solvent": "It strips the skin's natural moisture barrier, increasing dryness, irritation, and transepidermal water loss.",
  "Sulfate Surfactant": "Sulfate surfactants aggressively strip the skin barrier, commonly causing dryness and irritation.",
  "Chemical Sunscreen": "Chemical UV filters are absorbed into the skin and are associated with sensitization and potential hormonal disruption.",
  "Synthetic Musk": "Synthetic musks are fragrance compounds linked to sensitization and potential environmental bioaccumulation.",
  "Essential Oil": "Essential oils contain concentrated volatile compounds that commonly cause sensitization in reactive skin.",
};

function richTemplate(
  name: string,
  status: "safe" | "flagged",
  sc: string | null,
  cat: string | null,
  fc: string | null
): string {
  const role = sc ? STRUCTURAL_ROLE[sc] : null;
  const scLabel = sc ? sc.toLowerCase() : null;

  if (status === "flagged") {
    const concern = fc ?? cat;

    if (sc === "Preservative" && (concern === "sensitizer" || concern === "Preservative"))
      return `${name} is a preservative that prevents microbial growth to extend the product's shelf life, but it is a known sensitizer that can cause allergic reactions and contact dermatitis with repeated exposure in reactive skin.`;
    if (sc === "Fragrance" && concern === "Fragrance")
      return `${name} is a fragrance compound that adds scent to the formula. Fragrance blends are one of the most common triggers for contact dermatitis and sensitization in reactive skin.`;
    if (sc === "Fragrance" && concern === "fragrance-allergen")
      return `${name} is a fragrance allergen that adds scent to the formula. It is a documented contact allergen listed on EU regulatory watch lists that can trigger dermatitis and sensitization, particularly in reactive skin.`;
    if (sc === "Fragrance" && concern === "sensitizer")
      return `${name} is a fragrance ingredient that adds scent to the formula. It is flagged as a sensitizer that can cause contact dermatitis with repeated exposure, especially on reactive or compromised skin.`;
    if (sc === "Fragrance" && concern === "Synthetic Musk")
      return `${name} is a synthetic musk that adds a lingering scent to the formula. Synthetic musks are flagged due to their potential to cause skin sensitization and their tendency to bioaccumulate in the environment.`;
    if (sc === "UV Filter" && concern === "Chemical Sunscreen")
      return `${name} is a chemical UV filter that absorbs UV radiation to protect skin from sun damage. It is flagged due to concerns about skin sensitization, potential hormonal disruption, and environmental impact on marine ecosystems.`;
    if (sc === "Surfactant" && concern === "Sulfate Surfactant")
      return `${name} is a sulfate surfactant used for cleansing and lather. It is flagged because sulfates aggressively strip the skin's natural oils, disrupting the barrier and causing dryness and irritation, particularly with frequent use.`;
    if (sc === "Solvent" && concern === "Drying Solvent")
      return `${name} is an alcohol-based solvent used to improve texture and active absorption. It is flagged because it rapidly strips the skin's natural moisture barrier, increasing dryness, sensitivity, and transepidermal water loss.`;
    if (sc === "Silicone" && concern === "occlusive")
      return `${name} is a cyclic silicone used for lightweight, silky texture. It is flagged because it can form an occlusive film that traps sebum and bacteria against the skin, and it raises concerns about endocrine disruption and environmental bioaccumulation.`;
    if (sc === "Retinoid" && concern === "retinoid")
      return `${name} is a vitamin A derivative used to speed up cell turnover. It is flagged for reactive skin because it commonly causes dryness, peeling, and irritation — especially during initial weeks of use — and substantially increases sun sensitivity.`;
    if (sc === "Exfoliant" && concern === "exfoliant")
      return `${name} is a chemical exfoliant. It is flagged because it can cause stinging, dryness, and substantially increased sun sensitivity — introduce it gradually, avoid overuse, and apply SPF daily.`;

    // Generic flagged
    const concernText = concern ? (FLAGGED_CONCERN[concern] ?? `It may cause concerns for reactive or sensitive skin.`) : "It may cause irritation or sensitization in reactive skin.";
    if (role) return `${name} is ${article(scLabel!)} ${scLabel} that ${role}. ${concernText}`;
    return `${name} is a skincare ingredient that is flagged for reactive skin. ${concernText}`;
  }

  // Safe
  if (sc === "Ceramide")
    return `${name} is a ceramide — a lipid naturally found in the skin barrier — that replenishes the barrier's moisture-sealing structure to lock in hydration and protect against irritants and environmental stressors.`;
  if (sc === "Peptide" && cat === "firming")
    return `${name} is a peptide that signals skin cells to produce collagen and elastin, supporting firmer, more resilient skin and reducing the appearance of fine lines with consistent use.`;
  if (sc === "Peptide" && cat === "barrier-repairing")
    return `${name} is a peptide that activates skin repair pathways to strengthen the barrier and improve resilience against environmental stressors.`;
  if (sc === "Peptide")
    return `${name} is a peptide that communicates with skin cells to support collagen production and repair, helping to maintain firmness and skin health over time.`;
  if (sc === "Humectant")
    return `${name} is a humectant that draws moisture from the environment into the skin's surface layers, maintaining hydration and helping to keep skin soft and supple throughout the day.`;
  if (sc === "Emollient" && cat === "barrier-repairing")
    return `${name} is an emollient that fills gaps in the skin's lipid barrier to lock in moisture and reduce transepidermal water loss, strengthening the barrier against irritants.`;
  if (sc === "Plant Extract" && cat === "soothing")
    return `${name} is a plant extract with soothing and anti-inflammatory properties that calms redness, reduces irritation, and supports recovery in reactive skin.`;
  if (sc === "Plant Extract" && cat === "antioxidant")
    return `${name} is a plant extract rich in antioxidant compounds that neutralize free radicals and protect skin from oxidative stress caused by UV exposure and environmental pollution.`;
  if (sc === "Plant Extract" && cat === "brightening")
    return `${name} is a plant extract with brightening properties that inhibits melanin production to reduce hyperpigmentation and even skin tone over time.`;
  if (sc === "Plant Extract" && cat === "firming")
    return `${name} is a plant extract with firming properties that supports skin elasticity and helps maintain a lifted, more resilient appearance.`;
  if (sc === "Plant Extract" && cat === "antimicrobial")
    return `${name} is a plant extract with natural antimicrobial properties that helps control bacteria on the skin's surface and supports a clearer complexion.`;
  if (sc === "Active" && cat === "brightening")
    return `${name} is a brightening active that reduces melanin production to fade hyperpigmentation and even skin tone. It is well-tolerated and suitable for sensitive skin types.`;
  if (sc === "Active" && cat === "antioxidant")
    return `${name} is an antioxidant active that neutralizes free radicals to protect skin from oxidative damage and environmental aging. It is considered well-tolerated in typical formulations.`;
  if (sc === "Active" && cat === "soothing")
    return `${name} is a soothing active that reduces inflammation and calms skin irritation. It is particularly well-suited for reactive, sensitive, or post-procedure skin.`;
  if (sc === "Active" && cat === "firming")
    return `${name} is a firming active that supports collagen production and skin elasticity to improve firmness and reduce the appearance of fine lines over time.`;
  if (sc === "Active" && cat === "barrier-repairing")
    return `${name} is an active that supports the skin barrier by replenishing lipids and reducing moisture loss, improving resilience in sensitive or compromised skin.`;
  if (sc === "UV Filter")
    return `${name} is a mineral UV filter that physically reflects and absorbs UV radiation to protect the skin from sun damage. It is non-sensitizing and gentle, suitable for reactive and sensitive skin.`;
  if (sc === "Preservative")
    return `${name} is a preservative that prevents microbial growth in the formula to extend shelf life and maintain safety. It is considered well-tolerated at typical use concentrations.`;
  if (sc === "Surfactant" && cat === "cleansing")
    return `${name} is a gentle surfactant that removes oil, dirt, and impurities without stripping the natural barrier. It is considered mild and non-irritating compared to sulfate alternatives.`;
  if (sc === "Silicone")
    return `${name} is a silicone that provides a smooth, silky texture and forms a breathable barrier on skin to prevent moisture loss. It is non-comedogenic at typical concentrations and well-tolerated.`;
  if (sc === "Clay")
    return `${name} is a clay that absorbs excess sebum and draws out surface impurities and pore-clogging debris. It is best suited to oily and combination skin types.`;
  if (sc === "Protein")
    return `${name} is a hydrolyzed protein that forms a lightweight conditioning film on skin and hair, improving smoothness, strength, and moisture retention.`;
  if (sc === "Amino Acid")
    return `${name} is an amino acid — a building block of skin proteins — that supports hydration and barrier function as part of the skin's Natural Moisturizing Factor. It is well-tolerated by all skin types.`;
  if (sc === "Emollient")
    return `${name} is an emollient that softens and smooths the skin surface by filling micro-gaps in the lipid layer. It reduces roughness and improves skin feel without stripping moisture, and is generally well-tolerated including by sensitive skin.`;
  if (sc === "Fatty Acid")
    return `${name} is a fatty acid that replenishes barrier lipids naturally present in skin sebum. It fills gaps in the skin's outer lipid layer to help seal in moisture, improve texture, and support barrier recovery. It is well-tolerated by most skin types.`;
  if (sc === "Fatty Alcohol")
    return `${name} is a fatty alcohol — distinct from drying short-chain alcohols — that softens and smooths the skin surface while acting as a co-emulsifier in the formula. It does not strip moisture and is well-tolerated even by sensitive and reactive skin.`;
  if (sc === "Thickener")
    return `${name} is a thickening agent that gives the formula its gel or cream consistency for smooth, even application. It is an inert formula component with no direct skin-active effect and is well-tolerated at the concentrations used in cosmetics.`;
  if (sc === "Emulsifier")
    return `${name} is an emulsifier that prevents the oil and water phases of the formula from separating. It is a formula-stability ingredient with no direct skin-active effect and is generally well-tolerated by all skin types.`;
  if (sc === "Solvent")
    return `${name} is a solvent that dissolves and carries other ingredients across the skin, improving spreadability and aiding active absorption. It is generally well-tolerated at typical cosmetic concentrations.`;
  if (sc === "pH Adjuster")
    return `${name} is a pH adjuster included in trace amounts to bring the formula to its optimal pH range for stability and ingredient efficacy. At these concentrations it has no meaningful direct interaction with skin and is well-tolerated.`;
  if (sc === "Chelating Agent")
    return `${name} is a chelating agent that binds trace metal ions in water, preventing them from destabilizing the formula or weakening preservative efficacy. It is used at very low concentrations with no meaningful direct effect on skin.`;
  if (sc === "Conditioning Agent")
    return `${name} is a conditioning agent that forms a smooth, lubricating layer on skin and hair surfaces to reduce friction and improve softness. It primarily affects the surface feel rather than penetrating or interacting with deeper skin tissue.`;
  if (sc === "Film Former")
    return `${name} is a film former that creates a thin, flexible film on the skin surface for texture control and formula stability. It sits on top of the skin rather than penetrating it, and is generally inert and well-tolerated.`;
  if (sc === "Wax")
    return `${name} is a wax that provides structure to the formula and creates a protective, occlusive layer on the skin surface that slows moisture evaporation. It is inert and non-reactive, most beneficial for dry or barrier-compromised skin.`;
  if (sc === "Botanical Water")
    return `${name} is a botanical water that replaces or supplements plain water in the formula base with light plant-derived compounds. It provides gentle botanical actives alongside hydration and is generally well-tolerated.`;
  if (sc === "Mineral")
    return `${name} is a mineral ingredient that may act as an opacifier, mattifier, or textural agent in the formula. At typical cosmetic concentrations it has minimal direct skin interaction and is considered well-tolerated.`;
  if (sc === "Preservative Booster")
    return `${name} is a preservative booster that enhances the antimicrobial activity of primary preservatives to extend the product's shelf life and safety. It is used at low concentrations with no meaningful direct skin-active effect.`;
  if (sc === "Colorant" || sc === "Pigment")
    return `${name} is a colorant that provides or enhances color in the formula. It remains on the skin's surface and has no skin-active function; it is generally well-tolerated at cosmetic concentrations.`;

  // Generic safe fallback
  if (role && scLabel) {
    const benefitText = cat ? (SAFE_BENEFIT[cat] ?? "It is generally well-tolerated in skincare formulations.") : "It is generally well-tolerated in skincare formulations with no specific skin concerns identified at typical use concentrations.";
    return `${name} is ${article(scLabel)} ${scLabel} that ${role}. ${benefitText}`;
  }
  return `${name} is a skincare ingredient that is generally well-tolerated. No specific skin concerns have been identified at typical cosmetic use concentrations.`;
}

export function generateExplanation(
  name: string,
  status: "safe" | "flagged",
  structural_category: string | null,
  category: string | null,
  flagged_category: string | null
): string {
  const key = name.toLowerCase().trim();
  if (CURATED[key]) return CURATED[key];
  return richTemplate(name, status, structural_category, category, flagged_category);
}
