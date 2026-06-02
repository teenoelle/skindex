export type Classification = {
  status: "safe" | "flagged";
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
};

function n(raw: string) {
  // Strip soft hyphens and zero-width chars that can corrupt DB ingredient names
  return raw.replace(/[­​‌‍﻿]/g, "").toLowerCase().trim();
}

// ── Flagged rules ──────────────────────────────────────────────────────────

const FRAGRANCE_ALLERGENS = new Set([
  "limonene","d-limonene","linalool","citronellol","geraniol","eugenol","isoeugenol",
  "benzyl alcohol","benzyl benzoate","benzyl cinnamate","benzyl salicylate",
  "cinnamal","cinnamyl alcohol","farnesol","coumarin","hydroxycitronellal",
  "alpha-isomethyl ionone","amyl cinnamal","amylcinnamyl alcohol","anise alcohol",
  "butylphenyl methylpropional","citral","hexyl cinnamal","lilial","lyral",
  "methyl 2-octynoate","oakmoss extract","treemoss extract",
]);

const CHEMICAL_UV_FILTERS = new Set([
  "oxybenzone","benzophenone-3","octinoxate","ethylhexyl methoxycinnamate",
  "octisalate","ethylhexyl salicylate","avobenzone","butyl methoxydibenzoylmethane",
  "octocrylene","homosalate","iscotrizinol","drometrizole trisiloxane",
  "ensulizole","ecamsule","mexoryl sx","mexoryl xl",
]);

const FORMALDEHYDE_RELEASERS = new Set([
  "dmdm hydantoin","quaternium-15","imidazolidinyl urea","diazolidinyl urea",
  "bronopol","2-bromo-2-nitropropane-1,3-diol","sodium hydroxymethylglycinate",
]);

const CYCLIC_SILICONES = new Set([
  "cyclopentasiloxane","cyclohexasiloxane","cyclomethicone","cyclotetrasiloxane","d4","d5","d6",
]);

const DRYING_ALCOHOLS = new Set([
  "alcohol denat","alcohol denat.","denatured alcohol","sd alcohol 40","sd alcohol",
  "isopropyl alcohol","ethanol",
]);

const SULFATE_SURFACTANTS = new Set([
  "sodium lauryl sulfate","ammonium lauryl sulfate","sodium laureth sulfate",
  "ammonium laureth sulfate","sodium myreth sulfate","tea-lauryl sulfate","sls","sles",
]);

const SENSITIZING_PRESERVATIVES = new Set([
  "methylisothiazolinone","methylchloroisothiazolinone","benzisothiazolinone","mit","cmit",
  "triclosan","triclocarban",
  "iodopropynyl butylcarbamate","ipbc",
]);

// ── Classify ────────────────────────────────────────────────────────────────

// Strip leading marketing/certification adjectives so "organic aloe vera" classifies as "aloe vera".
// Processing descriptors (cold-pressed, unrefined, steam distilled) are intentionally excluded:
// they affect chemistry and should be preserved for classification and AI explanation context.
const NON_INCI_PREFIX = /^(organic|natural|vegan|certified|wildcrafted)\s+/i;

export function classifyIngredient(rawName: string): Classification {
  const stripped = rawName.replace(NON_INCI_PREFIX, "").trim();
  if (stripped.length > 0 && stripped.toLowerCase() !== rawName.toLowerCase().trim()) {
    return classifyIngredient(stripped);
  }
  const name = n(rawName);

  // Parabens
  if (name.includes("paraben"))
    return { status: "flagged", structural_category: "Preservative", category: null, flagged_category: "sensitizer" };

  // Isothiazolinones / sensitizing preservatives
  if (SENSITIZING_PRESERVATIVES.has(name) || name.includes("isothiazolinone"))
    return { status: "flagged", structural_category: "Preservative", category: null, flagged_category: "sensitizer" };

  // Formaldehyde releasers
  if (FORMALDEHYDE_RELEASERS.has(name) || name.includes("formaldehyde resin"))
    return { status: "flagged", structural_category: "Preservative", category: null, flagged_category: "sensitizer" };

  // Chemical UV filters
  if (CHEMICAL_UV_FILTERS.has(name))
    return { status: "flagged", structural_category: "UV Filter", category: null, flagged_category: "Chemical Sunscreen" };

  // Generic fragrance — structural tells you what it IS; "sensitizer" tells you why it's flagged
  if (["parfum","fragrance","aroma","perfume","fragrance (parfum)","parfum/fragrance"].includes(name))
    return { status: "flagged", structural_category: "Fragrance", category: null, flagged_category: "sensitizer" };

  // Fragrance allergens
  if (FRAGRANCE_ALLERGENS.has(name))
    return { status: "flagged", structural_category: "Fragrance", category: null, flagged_category: "fragrance-allergen" };

  // Synthetic musks
  if (name.includes("musk") || ["galaxolide","tonalide","cashmeran","iso e super","ethylene brassylate"].includes(name))
    return { status: "flagged", structural_category: "Fragrance", category: null, flagged_category: "Synthetic Musk" };

  // Sensitizing essential oils — common botanical sensitizers
  if (
    name.includes("essential oil") ||
    (name.includes("oil") && [
      "tea tree","eucalyptus","peppermint","clove","cinnamon","bergamot","grapefruit","lime ",
      "lavandula","lavender","pelargonium","geranium","cananga","ylang",
      "aniba","rosaeodora","pogostemon","patchouli",
      "salvia","sage","rosmarinus","rosemary",
      "anthemis","roman chamomile","eugenia caryophyllus",
      "elettaria","cardamom","juniperus","juniper",
      "bergamia","citrus limon","citrus grandis","citrus nobilis",
      "citrus aurantium","mentha arvensis","cinnamomum camphora",
    ].some(e => name.includes(e)))
  )
    return { status: "flagged", structural_category: "Fragrance", category: null, flagged_category: "sensitizer" };

  // Other specific sensitizing fragrance/preservative compounds
  if (["phenethyl alcohol","phenylethyl alcohol"].includes(name))
    return { status: "flagged", structural_category: "Fragrance", category: null, flagged_category: "sensitizer" };

  // Arnica — potent botanical sensitizer (contains helenalin)
  if (name.includes("arnica"))
    return { status: "flagged", structural_category: "Plant Extract", category: null, flagged_category: "sensitizer" };

  // Sulfate surfactants
  if (SULFATE_SURFACTANTS.has(name) || name.includes("lauryl sulfate") || name.includes("laureth sulfate") || name.includes("coco-sulfate") || name.includes("cetearyl sulfate"))
    return { status: "flagged", structural_category: "Surfactant", category: null, flagged_category: "Sulfate Surfactant" };

  // Cyclic silicones
  if (CYCLIC_SILICONES.has(name))
    return { status: "flagged", structural_category: "Silicone", category: null, flagged_category: "occlusive" };

  // Drying alcohols
  if (DRYING_ALCOHOLS.has(name))
    return { status: "flagged", structural_category: "Solvent", category: null, flagged_category: "Drying Solvent" };

  // Retinoids
  if (name.includes("retinol") || name.includes("retinyl") || name.includes("retinaldehyde") || name === "retinal" || name === "retinoic acid" || name === "tretinoin")
    return { status: "flagged", structural_category: "Retinoid", category: null, flagged_category: "Barrier-disrupting" };

  // AHA exfoliants — citric acid excluded (used primarily as pH adjuster at trace amounts)
  if (["glycolic acid","lactic acid","mandelic acid","malic acid","tartaric acid","trichloroacetic acid"].includes(name))
    return { status: "flagged", structural_category: "Exfoliant", category: null, flagged_category: "AHA Exfoliant" };

  // BHA exfoliants
  if (name === "salicylic acid" || name.includes("beta hydroxy acid"))
    return { status: "flagged", structural_category: "Exfoliant", category: null, flagged_category: "BHA Exfoliant" };

  // Propylene glycol
  if (name === "propylene glycol")
    return { status: "flagged", structural_category: "Solvent", category: null, flagged_category: "sensitizer" };

  // Benzoyl peroxide
  if (name.includes("benzoyl peroxide"))
    return { status: "flagged", structural_category: "Active", category: null, flagged_category: "Irritant" };

  // Kojic acid
  if (name === "kojic acid")
    return { status: "flagged", structural_category: "Active", category: null, flagged_category: "sensitizer" };

  // ── Safe ────────────────────────────────────────────────────────────────
  const structural_category = detectStructural(name);
  const category = detectCategory(name, structural_category);
  return { status: "safe", structural_category, category, flagged_category: null };
}

function detectStructural(name: string): string | null {
  // Iron oxides — cosmetic colorants
  if (name.includes("iron oxide") || (name.startsWith("ci ") && /ci \d/.test(name)))
    return "Colorant";
  // Anti-Malassezia actives
  if (["zinc pyrithione","pyrithione zinc","zinc pyridine thiol"].includes(name) || name.includes("zinc pyrithione") || name.includes("pyrithione zinc"))
    return "Active";
  if (["selenium sulfide","selenium disulfide"].includes(name))
    return "Active";
  if (name === "piroctone olamine" || name === "piroctone ethanolamine")
    return "Active";
  // Iodine antimicrobials
  if (["povidone-iodine","pvp-iodine","polyvinylpyrrolidone iodine","potassium iodide","sodium iodide"].includes(name))
    return "Active";
  // Manganese compounds
  if (["manganese gluconate","manganese sulfate","manganese pca"].includes(name))
    return "Active";
  // Additional selenium
  if (name === "selenium" || name === "selenium methionine" || name === "selenomethionine")
    return "Active";
  // Zinc coceth sulfate — antimicrobial surfactant (anti-Malassezia), must check before generic surfactant rule
  if (name === "zinc coceth sulfate")
    return "Surfactant";

  if (["gluconolactone","lactobionic acid","galactose"].includes(name) || name.includes("gluconolactone"))
    return "Exfoliant";
  if (name === "azelaic acid")
    return "Exfoliant";
  if (name.includes("peptide") || name.includes("palmitoyl") || name.includes("polypeptide") || name.includes("oligopeptide") || name.includes("matrixyl"))
    return "Peptide";
  if (name.includes("ceramide") || ["phytosphingosine","sphingosine","glucosylceramide","pseudoceramide","cholesterol"].includes(name))
    return "Ceramide";
  if (["glycerin","glycerine","glycerol","sodium hyaluronate","hyaluronic acid","sodium pca","sorbitol","xylitol","trehalose","betaine","urea","erythritol","inositol","panthenol","d-panthenol","polyglutamic acid"].includes(name) || name.includes("hyaluronate") || name.includes("hyaluronic") || name.includes("panthenol"))
    return "Humectant";
  // Steam-distilled essential oils (leaf, flower, bark, wood, peel, root, grass, needle)
  // Seed oils and fruit oils are carrier oils (emollients), NOT essential oils — excluded here
  if (
    name.includes("leaf oil") || name.includes("flower oil") || name.includes("bark oil") ||
    name.includes("wood oil") || name.includes("peel oil") || name.includes("root oil") ||
    name.includes("grass oil") || name.includes("needle oil") ||
    ["menthol","l-menthol","camphor","menthyl lactate","4-terpineol"].includes(name)
  )
    return "Fragrance";
  if (["squalane","jojoba esters","lanolin","shea butter","mineral oil","petrolatum","white petrolatum","beeswax","cera alba","cera flava","coco-caprylate/caprate","coco-caprylate","paraffinum liquidum","paraffin","ceresin","hydrogenated polyisobutene"].includes(name) || name.includes("squalane") || (name.includes(" oil") && !name.includes("essential oil")) || name.includes("triglyceride") || name.includes("caprylic/capric") || name.includes("caprylic"))
    return "Emollient";
  if (["stearic acid","palmitic acid","linoleic acid","linolenic acid","oleic acid","lauric acid","myristic acid","behenic acid"].includes(name) || name.includes("fatty acid"))
    return "Fatty Acid";
  if (["cetyl alcohol","stearyl alcohol","cetearyl alcohol","behenyl alcohol","myristyl alcohol"].includes(name))
    return "Fatty Alcohol";
  if (name.includes("dimethicone") || name === "amodimethicone" || name.includes("trimethylsiloxysilicate") || name.includes("triethoxycaprylyl") || name.includes("triethoxycaprylylsilane"))
    return "Silicone";
  if (["kaolin","bentonite","montmorillonite","zeolite","fullers earth"].includes(name) || name.endsWith(" clay"))
    return "Clay";
  // ascorbyl glucoside is a vitamin C derivative, not a surfactant — exclude before glucoside check
  if ((name.includes("glucoside") && !name.includes("ascorbyl")) || name.includes("betaine") || name.includes("sulfosuccinate") || name.includes("amphoacetate") || ["cocamidopropyl betaine","sodium cocoyl isethionate","sodium lauroyl sarcosinate","sodium lauroyl isethionate","cocamide dea","cocamide mea","betaine salicylate"].includes(name) || name.includes("cocamide"))
    return "Surfactant";
  if (name.includes("glyceryl stearate") || name.includes("polyglyceryl") || name.includes("sorbitan") || name.includes("polysorbate") || name.includes("lecithin") || name.includes("ceteareth") || name.includes("steareth") || name.includes("oleth"))
    return "Emulsifier";
  if (name.includes("carbomer") || name.includes("xanthan") || name.includes("cellulose") || name.includes("starch") || (name.includes("gum") && !name.includes("guggul")) || (name.includes("acrylate") && name.includes("polymer")) || name === "silica" || name.includes("fumed silica") || name.includes("hydrated silica") || ["nylon-12","nylon-6","polymethyl methacrylate","arrowroot","lauroyl lysine","talc","boron nitride","polyethylene","hydrocolloid","alumina","perlite","pumice","charcoal powder","sapphire powder","calcite","amber powder","silk powder"].includes(name) || name.includes("seed powder") || name.includes("kernel powder") || name.includes("fruit powder"))
    return "Thickener";
  if (["phenoxyethanol","potassium sorbate","ethylhexylglycerin","1,2-hexanediol","caprylyl glycol","chlorphenesin","sorbic acid","sodium benzoate","o-cymen-5-ol","1,10-decanediol","10-decanediol","hydroxyacetophenone","bht","bha","sodium metabisulfite","undecylenoyl glycine","capryloyl glycine"].includes(name))
    return "Preservative";
  if (["zinc oxide","titanium dioxide","zinc oxide (nano)","titanium dioxide (nano)"].includes(name) || name.includes("titanium dioxide") || name.includes("zinc oxide") || ["bis-ethylhexyloxyphenol methoxyphenyl triazine","ethylhexyl triazone","terephthalylidene dicamphor sulfonic acid"].includes(name))
    return "UV Filter";
  if (["colloidal oatmeal","avena sativa","oat kernel"].includes(name) || name.startsWith("avena sativa") || name.includes("colloidal oatmeal"))
    return "Plant Extract";
  if (name.includes("extract") || name.includes("leaf water") || name.includes("flower water") || name.includes("bark water") || name.includes("aloe") || ["eucalyptus globulus","chondrus crispus","propolis","centella asiatica"].includes(name))
    return "Plant Extract";
  if (name.includes("edta") || ["phytic acid","sodium phytate","sodium gluconate","tetrasodium glutamate diacetate","trisodium ethylenediamine disuccinate"].includes(name))
    return "Chelating Agent";
  if (["sodium hydroxide","potassium hydroxide","triethanolamine","aminomethyl propanol","sodium citrate","aluminum hydroxide","citric acid","tartaric acid","malic acid","lactic acid buffer"].includes(name))
    return "pH Adjuster";
  if (["water","aqua","purified water","distilled water","deionized water","spring water","aqua (water)","water (aqua)","butylene glycol","pentylene glycol","hexylene glycol","dipropylene glycol","1,3-propanediol","propanediol","ethoxydiglycol","propylene carbonate","t-butyl alcohol","cyclohexane","isobutane","sodium chloride","sodium sulfate","hydroxypropyl cyclodextrin"].includes(name) || name.includes("aqua") || (name.includes("water") && !name.includes("leaf water") && !name.includes("flower water") && !name.includes("bark water")))
    return "Solvent";
  if (name.includes("quaternium") || name.includes("polyquaternium") || name.includes("behentrimonium"))
    return "Conditioning Agent";
  if (name.includes("hydrolyzed") || (name.includes("collagen") && !name.includes("vascular")) || name.includes("keratin") || name.includes("elastin") || name.includes("silk") || name.includes("serica"))
    return "Protein";
  if (["arginine","lysine","serine","glycine","alanine","proline","threonine","histidine","valine","glutamine","asparagine","glutamic acid","aspartic acid","acetyl glucosamine","taurine","arginine hcl","citrulline"].includes(name) || name.includes("amino acid"))
    return "Amino Acid";
  if (["niacinamide","nicotinamide","ascorbic acid","sodium ascorbyl phosphate","magnesium ascorbyl phosphate","ascorbyl glucoside","ascorbyl tetraisopalmitate","3-o-ethyl ascorbic acid","alpha-arbutin","arbutin","tranexamic acid","ferulic acid","resveratrol","coenzyme q10","ubiquinone","adenosine","allantoin","bisabolol","alpha-bisabolol","zinc gluconate","zinc sulfate","zinc pca","bakuchiol","retinol alternative","nrf2","caffeine","madecassoside","asiaticoside","madecassic acid","asiatic acid","melatonin","glutathione","thioctic acid","dimethyl sulfone","potassium azeloyl diglycinate","stearyl glycyrrhetinate","dipotassium glycyrrhizate","phytonadione","beta-carotene","hypochlorous acid","fructooligosaccharides","magnesium gluconate","copper gluconate","calcium gluconate","magnesium sulfate","magnesium","calamine","sulfur","nordihydroguaiaretic acid","hydroxyapatite","magnesium chloride","magnesium pca","magnesium aspartate","zinc ricinoleate","copper peptide","ghk-cu"].includes(name) || name.includes("tocopherol") || name.includes("ascorbyl") || name.includes("arbutin") || name.includes("niacinamide") || name.includes("glycyrrhiz") || name.includes("madecass") || name.includes("phytonadione") || name.includes("lactobacillus") || name.includes("copper tripeptide") || name.includes("copper peptide"))
    return "Active";
  return null;
}

function detectCategory(name: string, sc: string | null): string | null {
  // Formula-functional ingredients that also have meaningful skin benefit/concern categories
  if (sc === "Humectant") {
    if (name.includes("panthenol")) return "barrier-repairing";
    if (name.includes("hyaluronate") || name.includes("hyaluronic")) return "soothing";
    if (name === "urea") return "smoothing";
    return null;
  }
  if (sc === "Preservative") {
    if (["caprylyl glycol","1,2-hexanediol","chlorphenesin","o-cymen-5-ol","undecylenoyl glycine","capryloyl glycine"].includes(name)) return "antimicrobial";
    return null;
  }
  if (sc === "Solvent") {
    // Glycol solvents that also provide mild humectancy
    if (["pentylene glycol","1,3-propanediol","propanediol","butylene glycol"].includes(name)) return "moisturizing";
    return null;
  }

  // When the structural role IS the skin benefit, no separate category needed
  if (sc === "Fatty Alcohol") return "Softening";
  if (sc === "Fatty Acid") return "Barrier support";
  if (sc === "Silicone") return "Smoothing";
  if (sc === "Clay") return "Pore-cleansing";
  if (sc === "Protein") return "Strengthening";
  if (sc === "Conditioning Agent") return "Conditioning";
  if (sc === "Emollient") return "Moisturizing";
  if (sc === "Chelating Agent") return "chelating";
  if (sc && ["UV Filter","pH Adjuster","Emulsifier","Thickener","Fragrance"].includes(sc))
    return null;

  if (sc === "Ceramide") return "barrier-repairing";
  if (sc === "Peptide") {
    if (name.includes("copper") || name.includes("ghk") || name.includes("cu-")) return "wound-healing";
    return "firming";
  }
  if (sc === "Colorant") return null;
  if (sc === "Surfactant") {
    if (name === "zinc coceth sulfate") return "anti-malassezia";
    return "cleansing";
  }
  if (sc === "Preservative") return null;
  if (sc === "Exfoliant") {
    if (name === "gluconolactone" || name.includes("gluconolactone") || name === "lactobionic acid") return "PHA Exfoliant";
    if (name === "azelaic acid") return "Anti-inflammatory";
    return null;
  }

  // Active ingredient categories
  const BRIGHTENING = ["niacinamide","nicotinamide","alpha-arbutin","arbutin","tranexamic acid"];
  const ANTIOXIDANT = ["ferulic acid","resveratrol","coenzyme q10","ubiquinone","ascorbic acid","vitamin c","tocopherol","astaxanthin","glutathione","thioctic acid","beta-carotene","nordihydroguaiaretic acid","melatonin"];
  // "oat" excluded here — too short, matches "-oate" ester suffix; covered by "avena" for real oat ingredients
  const SOOTHING = ["allantoin","bisabolol","alpha-bisabolol","centella","cica","aloe","avena","chamomile","calendula","licorice","madecassoside","asiaticoside","willowherb","epilobium","panthenol","stearyl glycyrrhetinate","dipotassium glycyrrhizate","madecassic acid","asiatic acid"];
  const FIRMING = ["adenosine","bakuchiol","caffeine"];
  const BARRIER = ["ceramide","phytosphingosine","cholesterol","sphingosine"];
  const BRIGHTENING_PLANTS = ["bearberry","mulberry","morus","papaya","carica","saxifraga","daisy","bellis","yuzu"];
  const SOOTHING_PLANTS = ["centella","chamomil","matricaria","calendula","aloe","licorice","glycyrrhiza","bisabolol","cucumber","cucumis","avena","oatmeal","lavender","lavandula","althaea","plantago","arnica","hamamelis","helichrysum","boswellia","beta-glucan"];
  const ANTIOXIDANT_PLANTS = ["green tea","camellia","white tea","ginkgo","grape","pomegranate","blueberry","cranberry","rosehip","sea buckthorn","moringa","coffee","turmeric","curcuma","lotus","raspberry","elderberry","argan","ecklonia","pine bark","propolis"];
  const FIRMING_PLANTS = ["ginseng","panax","guarana","paullinia","horse chestnut","aesculus","algae","fucus","spirulina","kelp","seaweed"];

  if (BRIGHTENING.some(b => name.includes(b))) return "brightening";
  if (ANTIOXIDANT.some(a => name.includes(a)) || name.includes("tocopherol") || name.includes("ascorbyl")) return "antioxidant";
  if (SOOTHING.some(s => name.includes(s))) return "soothing";
  if (FIRMING.some(f => name.includes(f))) return "firming";
  if (BARRIER.some(b => name.includes(b))) return "barrier-repairing";

  if (sc === "Plant Extract") {
    if (BRIGHTENING_PLANTS.some(b => name.includes(b))) return "brightening";
    if (SOOTHING_PLANTS.some(s => name.includes(s))) return "soothing";
    if (ANTIOXIDANT_PLANTS.some(a => name.includes(a))) return "antioxidant";
    if (FIRMING_PLANTS.some(f => name.includes(f))) return "firming";
    if (["tea tree","melaleuca","neem","oregano","origanum","thyme","manuka","hypochlorous","eucalyptus","chondrus"].some(m => name.includes(m))) return "antimicrobial";
    return "antioxidant"; // default for unrecognized plant extracts
  }

  if (sc === "Active") {
    // Specific named actives with distinct functional categories
    if (["zinc pyrithione","pyrithione zinc","zinc pyridine thiol","selenium sulfide","selenium disulfide","piroctone olamine","piroctone ethanolamine","zinc coceth sulfate"].some(n => name.includes(n))) return "anti-malassezia";
    if (["povidone-iodine","pvp-iodine","potassium iodide","sodium iodide","hypochlorous acid"].includes(name)) return "antimicrobial";
    if (name === "sulfur") return "antimicrobial";
    if (name === "calamine") return "soothing";
    if (["manganese gluconate","manganese sulfate","manganese pca","selenium","selenium methionine","selenomethionine"].includes(name)) return "antioxidant";
    if (["magnesium chloride","magnesium pca","magnesium aspartate","magnesium gluconate","magnesium sulfate","magnesium"].includes(name)) return "soothing";
    if (["copper gluconate","zinc ricinoleate"].includes(name)) return "antimicrobial";
    if (name.includes("copper tripeptide") || name.includes("copper peptide") || name.includes("ghk")) return "wound-healing";
    return "soothing"; // safe fallback for unrecognized actives
  }
  return null;
}
