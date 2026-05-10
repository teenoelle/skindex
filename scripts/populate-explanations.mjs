/**
 * Populates ingredient explanations directly from a hardcoded lookup — no API credits needed.
 * Safe to re-run: skips ingredients that already have an explanation.
 * To force-overwrite, pass --force as an argument.
 *
 * Explanations reflect the canary baseline (hypersensitive reactive skin) and
 * incorporate the personal reason field from topical ingredients (2).xlsx.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fqpqlllixjnzsdpqrovv.supabase.co',
  'sb_publishable_KsmOlC3vVPcMrFZV_sKpkA_8EBmhvcG'
);

const FORCE = process.argv.includes('--force');

// ─── INGREDIENT CATEGORY NOTES ─────────────────────────────────────────────
//
// FLAGGED — "Stings":
//   Drying solvents (Alcohol Denat, Isopropyl Alcohol)
//   Fragrance compounds (Citral, Fragrance, Geraniol, Limonene, Linalool, etc.)
//   Preservative allergens (DMDM Hydantoin, MI, Imidazolidinyl Urea, Tosylamide Resin)
//   Irritants (Triethanolamine variants)
//   Retinol, Salicylic Acid, Benzoyl Peroxide, Sulfur
//
// FLAGGED — "Itches":
//   Chemical sunscreen filters (Benzophenone-3, Avobenzone, Octinoxate,
//   Octyl Salicylate, Homosalate, Octocrylene)
//
// FLAGGED — "Crusts":
//   Aloe variants
//
// FLAGGED — "Unbreathable":
//   All Cocoa Butter variants
//   All Shea Butter variants (including lighter esters and PEG forms)
//
// FLAGGED — "Traps bacteria":
//   All Hyaluronic Acid variants (including ferments, crosspolymers, sodium salts)
//
// SAFE — Copper ("Fire Extinguisher"):
//   Copper Gluconate, Copper Tripeptide-1
//
// SAFE — Peptides ("Firmness Anchor"):
//   All peptide variants
//
// SAFE — no specific reason (general positive framing):
//   Allantoin, Azelaic Acid, Bisabolol, Camellia Sinensis, Centella Asiatica,
//   Ceramide variants, Glycerin, Hydrocolloid, Hypochlorous Acid, Madecassoside,
//   Magnesium variants, Niacinamide, Oatmeal variants, Panthenol variants,
//   Propolis variants, Squalane variants, Zinc variants
//
// ───────────────────────────────────────────────────────────────────────────

const EXPLANATIONS = {

  // ── DRYING SOLVENTS — "Stings" ──────────────────────────────────────────

  'Alcohol Denat':
    'Denatured alcohol is ethanol made undrinkable with additives, used to make products dry fast and feel lightweight on skin. For this skin it stings on contact — that\'s the barrier disruption happening in real time, as it strips protective lipids and leaves nerve endings exposed. Best avoided in anything that sits on skin.',

  'Alcohol Denat.':
    'The same as Alcohol Denat — denatured ethanol added to products for fast drying and absorption. For this skin it stings on contact — a clear signal that it\'s compromising the barrier rather than helping it. Avoid in leave-on formulations.',

  'Isopropyl Alcohol':
    'Rubbing alcohol, used in skincare as a quick-dry solvent and surface antimicrobial. It stings for this skin because it strips lipids from the barrier aggressively and on contact, leaving the surface raw and sensitized. One of the more straightforward ingredients to avoid.',

  // ── FRAGRANCE — "Stings" ────────────────────────────────────────────────

  'Fragrance':
    '"Fragrance" on a label is a legal umbrella covering anywhere from 10 to hundreds of undisclosed aromatic compounds — the manufacturer doesn\'t have to list them individually. It stings for this skin, which is typical for reactive types: fragrance is the single most common cause of contact dermatitis, and the mix of compounds makes it impossible to know which one is triggering the reaction.',

  'Fragrance (Parfum)':
    'The EU/INCI version of "Fragrance" — the same catch-all term covering a proprietary blend of aromatic compounds that don\'t have to be individually disclosed. It stings for this skin. For reactive and sensitized skin, this listing on a product is a firm stop sign regardless of how minor or "natural" the brand claims the scent is.',

  'Parfum/Fragrance':
    'The combined French/English fragrance disclosure — same ingredient, same problem. It stings for this skin, and the blanket term means there\'s no way to know which specific compound is responsible without patch testing the individual components. Fragrance-free is the only safe call for reactive skin.',

  'Fragrance Allergens':
    'A category label covering the EU\'s mandatory disclosure list of the 26 fragrance compounds most associated with contact allergy. When these appear individually on a label, the brand is being more transparent — but their presence still means the product stings for this skin. Transparency about the allergen doesn\'t make the allergen less of a problem.',

  'Citral':
    'A naturally occurring fragrance compound in citrus and lemongrass essential oils, widely used in perfumery. Despite being "natural," it stings for this skin — citral is on the EU\'s 26 mandatory fragrance allergen list because it\'s a documented sensitizer, and it becomes more allergenic as it oxidizes in air.',

  'Geraniol':
    'A floral fragrance alcohol found in rose, geranium, and palmarosa oils. It stings for this skin, and it\'s on the EU\'s 26 fragrance allergen list for good reason: it\'s a contact sensitizer, meaning repeated exposure can build into a full allergy even without an initial reaction. Particularly risky in leave-on products.',

  'Limonene':
    'The compound that gives citrus products their characteristic bright scent — present in most citrus essential oils and widely used as a fragrance ingredient. It stings for this skin, and the problem compounds as limonene oxidizes in air into even more potent allergens. It\'s on the EU\'s mandatory fragrance allergen disclosure list.',

  'Linalool':
    'A floral fragrance compound found naturally in lavender, rosewood, and hundreds of other essential oils. It stings for this skin. Like limonene, linalool oxidizes into more allergenic compounds over time, and it\'s on the EU\'s 26 fragrance allergen list — one of the more common triggers of fragrance contact allergy in reactive skin.',

  // ── PRESERVATIVE ALLERGENS — "Stings" ───────────────────────────────────

  'DMDM Hydantoin':
    'A formaldehyde-releasing preservative that slowly releases small amounts of formaldehyde to prevent bacterial and mold growth in products. It stings for this skin — formaldehyde is a known sensitizer and allergen, and this ingredient appears frequently in positive patch test results for contact dermatitis. Reactive skin types are better served by formulas preserved with alternatives.',

  'Imidazolidinyl Urea':
    'Another formaldehyde-releasing preservative with the same mechanism as DMDM Hydantoin — slow formaldehyde release to inhibit microbial growth. It stings for this skin, and it\'s one of the preservatives most consistently flagged in dermatology allergy clinics. Look for products preserved with phenoxyethanol, ethylhexylglycerin, or sodium benzoate instead.',

  'Methylisothiazolinone':
    'Often abbreviated MI — a preservative that caused a widespread contact dermatitis epidemic in the early 2010s, leading the EU to ban it from leave-on products entirely. It stings for this skin, and it\'s a potent sensitizer even at low concentrations; once sensitized, reactions can be severe. Still appears in some US leave-on products.',

  'Tosylamide/Formaldehyde Resin':
    'A film-forming resin used primarily in nail polish for adhesion and durability, and the most common allergen specifically associated with nail products. It stings for this skin — contact allergy reactions frequently show up on the eyelids, neck, and face from hand-to-face contact with freshly polished nails, which is how most people discover the sensitivity.',

  // ── IRRITANTS — "Stings" ────────────────────────────────────────────────

  'Triethanolamine':
    'A pH adjuster and emulsifier used to balance acidity and stabilize oil-water emulsions in formulations. It stings for this skin — at higher concentrations it\'s a known irritant, and there are documented concerns about nitrosamine formation when it\'s used alongside certain other preservatives. A common enough ingredient that it\'s worth flagging on reactive-skin product labels.',

  'Triethanolamine Lauryl Sulfate':
    'A sulfate surfactant similar to sodium lauryl sulfate, using triethanolamine as the counterion. It stings for this skin — it\'s an aggressive cleanser that strips the barrier and leaves reactive skin raw, irritated, and more permeable to other triggers. Among the surfactants most associated with barrier damage in sensitive skin types.',

  // ── ACTIVE ACIDS & TREATMENTS — "Stings" ───────────────────────────────

  'Retinol':
    'Vitamin A — the most evidence-backed anti-aging ingredient in cosmetics, with solid data for increasing cell turnover, stimulating collagen, and fading hyperpigmentation. It stings for this skin, which is a real constraint: retinol triggers a known "retinization" period of redness and peeling that reactive skin struggles to tolerate even at low percentages. Worth exploring only under dermatologist guidance with a very slow introduction.',

  'Salicylic Acid':
    'A beta hydroxy acid (BHA) that exfoliates inside the pore, making it the go-to ingredient for acne and congestion. It stings for this skin — salicylic acid penetrates deeply and works fast, which also means it disrupts the barrier quickly in reactive types. Even at low concentrations (0.5-1%), this skin tends to feel the sting before the benefit.',

  'Benzoyl Peroxide':
    'A well-proven acne treatment that kills bacteria by releasing oxygen into the pore. It stings for this skin — benzoyl peroxide is genuinely aggressive, bleaching fabrics on contact and causing significant dryness and burning, especially on a sensitized barrier. Even at 2.5%, this skin is unlikely to tolerate it without significant reaction.',

  'Sulfur':
    'One of the oldest acne treatments — it reduces oil, kills acne bacteria, and mildly exfoliates. It stings for this skin, which makes it hard to use despite being gentler than benzoyl peroxide in theory. The sulfur smell (eggs) is a practical obstacle too, but the stinging reaction is the real reason it doesn\'t work for this skin type.',

  // ── CHEMICAL SUNSCREENS — "Itches" ─────────────────────────────────────

  'Benzophenone-3':
    'Also called oxybenzone — one of the most common chemical UV filters, absorbing UVA and UVB radiation. It itches for this skin, which is consistent with its profile as one of the chemical sunscreen ingredients most associated with contact reactions in sensitized skin. The EU has restricted its concentration, and it\'s also flagged as a potential hormone disruptor.',

  'Butyl Methoxydibenzoylmethane':
    'This is avobenzone — the most widely used UVA filter globally. It itches for this skin. Avobenzone is also inherently unstable in sunlight and requires stabilizers (usually octocrylene) to hold up, so the itching reaction may be compounded by other filters in the same formula.',

  'Ethylhexyl Methoxycinnamate':
    'Also called octinoxate, a common chemical UVB filter. It itches for this skin — octinoxate is a fairly frequent contact allergen in reactive skin types, and its ability to penetrate skin and accumulate in the body adds to the concerns around it. Mineral sunscreens (zinc oxide) are the safer swap.',

  'Ethylhexyl Salicylate':
    'Also known as octyl salicylate — a chemical UVB filter derived from salicylic acid, though without its exfoliating properties. It itches for this skin. People with general salicylate sensitivity (or aspirin allergies) are at higher risk, but even without that history, this filter can trigger reactions in reactive skin.',

  'Homosalate':
    'A chemical UVB filter under increasing regulatory pressure — the EU has proposed lowering its maximum permitted concentration, and it\'s been flagged as a potential hormone disruptor in some studies. It itches for this skin, and its tendency to accumulate in body fat with repeated sunscreen use is an additional concern for those watching systemic absorption.',

  'Octocrylene':
    'A chemical UV filter used to absorb UVA/UVB and to stabilize avobenzone. It itches for this skin — octocrylene is one of the more sensitizing sunscreen ingredients, and contact allergy to it has increased significantly as its use has grown. It also accumulates in the body over time. Worth specifically checking sunscreen ingredient lists for this one.',

  // ── ALOE — "Crusts" ─────────────────────────────────────────────────────

  'Aloe':
    'The clear gel from aloe vera leaves, widely used for its soothing and anti-inflammatory properties. For this skin it crusts — the gel dries to a film on the surface that then flakes and lifts, which for a reactive barrier becomes a cycle of irritation rather than relief. Despite its reputation as universally calming, this skin doesn\'t tolerate it well.',

  'Aloe Barbadensis Leaf Extract':
    'A concentrated extract from aloe vera, delivering the plant\'s polysaccharides and antioxidants in a more potent form than the raw gel. For this skin it crusts — the film-forming properties of aloe compounds that make it feel cooling when wet become a problem when they dry on reactive skin, leading to tight, flaky patches.',

  'Aloe Barbadensis Leaf Juice Powder':
    'Freeze-dried or spray-dried aloe vera juice reconstituted into formulations — functionally the same as fresh aloe gel for skin purposes. For this skin it crusts, same as other aloe forms. The drying and reconstitution doesn\'t change how the aloe compounds interact with the surface.',

  'Aloe Barbadensis Leaf Water':
    'The water fraction of aloe vera — lighter than gel extract, mostly used as a hydrating base ingredient with mild soothing properties. For this skin it still crusts, though at lower intensity than concentrated forms. Even dilute aloe can trigger the same film-forming and flaking response on a reactive barrier.',

  'Aloe Vera':
    'The raw gel from aloe vera leaves — the base form of every other aloe ingredient on this list. For this skin it crusts: the gel dries to a tight film on the surface that then lifts and flakes, turning what should be a calming ingredient into a source of irritation. It\'s a well-documented paradox in reactive skin — "natural soothing" isn\'t universal.',

  // ── COCOA BUTTER — "Unbreathable" ───────────────────────────────────────

  'Cocoa Butter':
    'The solid fat from cocoa beans — a deeply occlusive emollient that seals moisture under an impermeable film. For this skin it feels unbreathable: the heavy occlusion traps heat, prevents the skin from regulating itself, and creates the smothered feeling that leads to congestion and breakouts on reactive skin.',

  'Cocoa Butter Glyceryl Esters':
    'A modified ester of cocoa butter fatty acids — lighter in texture than plain cocoa butter but still carrying the same occlusive character. For this skin it still feels unbreathable, even in the modified form. The fundamental issue is the fatty acid profile that seals the surface too completely for reactive skin to tolerate.',

  'Cocoa Butter PEG-8 Esters':
    'Cocoa butter made water-soluble with PEG chains, used in water-based formulas and rinse-off products. While it\'s technically lighter, for this skin it still registers as unbreathable — the source material\'s occlusive quality carries through even in modified forms when left on skin.',

  'Theobroma Cacao Seed Butter':
    'The INCI name for cocoa butter — same ingredient, different label format. A rich occlusive that seals the skin surface completely. For this skin it feels unbreathable: that heavy seal traps heat and congestion rather than locking in recovery, which is why this skin reacts to it even though it works well for less reactive types.',

  // ── SHEA BUTTER (all variants) — "Unbreathable" ─────────────────────────

  'Shea Butter':
    'The classic rich emollient from African shea tree nuts, loaded with oleic and stearic fatty acids. For this skin it feels unbreathable — shea\'s dense occlusive layer seals the surface too completely, trapping heat and debris rather than letting the skin breathe and recover. A beloved moisturizer for most people, but a consistent problem for this skin type.',

  'Butyrospermum Parkii (Shea) Butter':
    'The INCI name for plain shea butter. Rich, occlusive, and deeply nourishing on paper — but for this skin it feels unbreathable. The same fatty acid density that makes it effective for dry skin creates the smothered, congested feeling that reactive skin can\'t tolerate, regardless of the label name.',

  'Butyrospermum Parkii Butter':
    'Another label variant for shea butter — same ingredient, same reaction. For this skin it feels unbreathable: the occlusive seal it creates over reactive skin traps heat and congestion rather than supporting recovery.',

  'Hydrogenated Shea Butter':
    'Shea butter that\'s been hydrogenated (hydrogen added to fatty acid chains) to make it harder and more shelf-stable. The modification changes the texture but not the fundamental occlusive character. For this skin it still feels unbreathable — the barrier-sealing quality that\'s the problem with plain shea butter carries through in this form.',

  'Isopropyl Shea Butterate':
    'An ester of isopropyl alcohol and shea butter fatty acids — a lighter, faster-absorbing form of shea often used in lightweight moisturizers and sunscreens. Despite being much less heavy than raw shea butter, for this skin it still registers as unbreathable. The shea fatty acid profile seems to be the consistent trigger regardless of how light the modification is.',

  'Octyldodecyl Shea Butterate':
    'A lightweight shea butter ester with a dry skin feel, commonly used in sunscreens and lightweight formulas to reduce heaviness. Still derived from shea fatty acids, and for this skin it still feels unbreathable — even the lighter shea derivatives don\'t escape the same occlusive issue.',

  'PEG-50 Shea Butter':
    'Shea butter modified with a PEG-50 chain to make it water-soluble — used in water-based formulas. Despite the significant modification, it retains enough of the shea fatty acid character that for this skin it still feels unbreathable. No shea derivative, light or not, seems to be an exception for this skin type.',

  'PEG-75 Shea Butter Glycerides':
    'A heavily PEGylated shea butter glyceride, primarily used as an emulsifier and conditioner. Even at this level of modification and dilution in formulas, this skin reads it as unbreathable. The consistency of the reaction across all shea derivatives is a strong signal to avoid the entire ingredient family.',

  'Potassium Shea Butterate':
    'The potassium soap of shea butter fatty acids — essentially shea butter saponified into a mild surfactant. Found in gentler cleansers and bars. Even in surfactant form, for this skin it registers as unbreathable in leave-on contexts, and worth watching even in rinse-off products if reactions persist.',

  'Shea Butter Cetyl Esters':
    'Shea butter fatty acids esterified with cetyl alcohol — a lighter, more spreadable emollient than plain shea. For this skin it still registers as unbreathable. The modification reduces heaviness but doesn\'t resolve whatever it is in the shea fatty acid profile that this skin reacts to.',

  'Shea Butter Ethyl Esters':
    'Shea butter esterified with ethanol — an even lighter, quick-absorbing form. Still triggers the unbreathable reaction for this skin despite the light, dry skin feel. Worth treating all shea derivatives as flagged until a specific form proves to be the exception.',

  'Shea Butter Glycereth-8 Esters':
    'Shea butter fatty acids combined with a glycereth-8 chain for water compatibility. A lighter, more water-friendly form used in water-based emulsions. Still unbreathable for this skin — the modification doesn\'t change the fundamental reaction.',

  'Shea Butter Glyceride':
    'A monoglyceride of shea butter fatty acids — a light emollient and emulsifier with conditioning properties. For this skin it still registers as unbreathable, consistent with all other shea-derived emollients regardless of their weight or texture.',

  'Shea Butter Glycerides':
    'A mixture of shea butter fatty acid glycerides at various esterification levels. Used as a lighter alternative to straight shea butter in formulations. Same result for this skin — unbreathable. The shea fatty acid family is consistently problematic regardless of the modification.',

  'Shea Butter Oleyl Esters':
    'Shea butter esterified with oleyl alcohol — a lighter, semi-dry emollient. Despite the lighter feel, this skin still finds it unbreathable. The consistency of this reaction across every shea derivative on this list is notable and suggests avoiding all shea-derived ingredients.',

  'Shea Butteramidopropyl Betaine':
    'A gentle amphoteric surfactant derived from shea butter, often marketed as a sensitive-skin cleanser ingredient because it\'s milder than sulfates. For this skin it still registers as unbreathable in leave-on applications — worth caution even in rinse-off if this skin is consistently reactive to shea-derived surfactants.',

  'Shea Butteramidopropyltrimonium Chloride':
    'A conditioning quaternary ammonium compound derived from shea butter, used for smoothing and conditioning. For this skin it still triggers the unbreathable reaction — the shea derivation is the common thread across all of these, regardless of how heavily the original fat has been modified.',

  'Sodium Shea Butteramphoacetate':
    'A mild amphoteric surfactant from shea butter, typically found in gentle cleansers. For this skin, shea-derived ingredients consistently feel unbreathable — including this surfactant form. Worth tracking whether rinse-off shea surfactants trigger the same response or just leave-on forms.',

  'Sodium Shea Butterate':
    'The sodium soap of shea butter fatty acids — a mild natural-formula surfactant. For this skin the shea fatty acid profile consistently registers as unbreathable across all forms and modifications. Treating the entire shea ingredient family as flagged is the consistent and safe call.',

  // ── HYALURONIC ACID — "Traps bacteria" ─────────────────────────────────

  'Hyaluronic Acid':
    'A naturally occurring sugar molecule that holds up to 1000x its weight in water — one of the most popular humectants in skincare. For this skin it traps bacteria: the dense moisture film HA creates over an already-reactive barrier becomes a warm, humid environment where bacteria proliferate rather than being kept in check. This is an unusual reaction — most people do well with HA — but it\'s real and consistent for this skin.',

  'Hyaluronic Acid Crosspolymer-2-Sodium':
    'A crosslinked form of hyaluronic acid that holds moisture even more persistently than standard HA. For this skin that means even more sustained bacterial trapping — the longer-lasting hydration film that makes this form appealing to most people amplifies the problem for this skin type.',

  'Hyaluronic Acid/Polyglutamic Acid Crosspolymer':
    'A hybrid humectant combining hyaluronic acid with polyglutamic acid (which holds even more water than HA alone) in a crosslinked structure. For this skin, that enhanced moisture-holding capacity translates to a more problematic bacteria-trapping environment than standard HA. The combination of two strong humectants compounds the issue.',

  'Hydrolyzed Hyaluronic Acid':
    'Hyaluronic acid broken into smaller fragments so it can penetrate deeper into skin layers. For this skin it still traps bacteria — the smaller size means the moisture-trapping effect reaches deeper rather than being eliminated, which arguably makes the bacterial environment issue more significant, not less.',

  'Lactococcus/Hyaluronic Acid Ferment Filtrate':
    'A postbiotic made by fermenting Lactococcus bacteria in a hyaluronic acid medium. Despite the probiotic framing, the HA base is still the issue for this skin — the moisture-trapping character carries through even in ferment form. The bacterial-environment problem that makes HA problematic here isn\'t resolved by the fermentation process.',

  'Sinomonas/Hyaluronic Acid Ferment Filtrate':
    'A postbiotic fermented from Sinomonas bacteria in a hyaluronic acid medium — similar to the Lactococcus version above. Same concern: the HA substrate means this skin still gets the bacteria-trapping effect that makes all hyaluronic acid-based ingredients problematic here.',

  'Sodium Hyaluronate':
    'The sodium salt form of hyaluronic acid — more shelf-stable and slightly smaller in molecular size than HA itself. For this skin it traps bacteria just as effectively as other HA forms. The salt form is used interchangeably with HA in most formulas, and for this skin that means the same problem regardless of which name appears on the label.',

  'Sodium Hyaluronate Acid':
    'Functionally sodium hyaluronate — the naming convention varies by manufacturer but it\'s the same ingredient. For this skin it traps bacteria. Whichever name it goes by on the label, all sodium hyaluronate variants create the same moisture-dense surface environment that this skin reacts to.',

  'Sodium Hyaluronate Crosspolymer':
    'Crosslinked sodium hyaluronate that forms a persistent hydrating film on the skin surface. For this skin it\'s even more of a bacteria-trapping issue than regular sodium hyaluronate — the crosslinked structure is specifically designed to keep moisture locked in longer, which is exactly the problem for this skin type.',

  'Sodium Hyaluronate Dimethylsilanol':
    'A hybrid of sodium hyaluronate with a silicone component (dimethylsilanol) that adds spreadability and a silky feel alongside HA\'s moisture-binding. For this skin the HA component still traps bacteria — the silicone addition doesn\'t resolve the issue and arguably makes the occlusive environment more persistent.',

  // ── COPPER — "Fire Extinguisher" ─────────────────────────────────────────

  'Copper ­Gluconate':
    'A water-soluble copper salt that delivers copper ions to skin — the same mineral that makes copper peptides work. Think of copper as the fire extinguisher for reactive skin: decades of research confirm it mutes inflammation, accelerates healing in irritated clusters, and actively rebuilds barrier integrity in skin that\'s felt thinned or raw. A precursor form to the more potent copper peptides.',

  'Copper Tripeptide-1':
    'Copper bound to a three-amino-acid peptide (GHK-Cu) — the fire extinguisher for reactive skin. This is one of the most researched skin-repair ingredients available: it mutes inflammation, accelerates healing of irritated red patches, and rebuilds the "thinned" skin barrier that makes reactive skin feel so raw and exposed. Originally developed for wound care, which tells you something about how seriously it takes barrier repair.',

  // ── PEPTIDES — "Firmness Anchor" ─────────────────────────────────────────

  'Acetyl Tetrapeptide-15':
    'A synthetic peptide that works as a firmness anchor for reactive skin — specifically targeting the extracellular matrix (the scaffolding that holds skin cells in place) to reduce the fragile, raw feeling that comes with a compromised barrier. It also has nerve-calming properties that reduce sensitivity signals at the skin surface. Very well-tolerated; the surrounding formula matters more than this ingredient.',

  'Hexapeptide-11':
    'A yeast-derived peptide working as a firmness anchor — part of the peptide family that strengthens the extracellular matrix to make skin feel denser and less fragile. It improves texture and resilience over time. Very well-tolerated, consistent with the peptide class generally.',

  'Hexapeptide-9':
    'A synthetic peptide that signals skin to produce more collagen by mimicking a collagen fragment — building the firmness anchor from within. It strengthens the extracellular matrix over time, which is what makes skin feel less raw and reactive even when nothing is actively irritating it. Gentle and appropriate for reactive skin.',

  'Matrixyl':
    'A trade name for a specific peptide complex (usually palmitoyl pentapeptide-4) — the original firmness anchor peptide ingredient. It stimulates collagen and elastin production by telling skin it needs to repair itself, strengthening the extracellular matrix that makes skin feel dense and resilient rather than fragile. Well-tolerated and one of the better-researched cosmetic peptides.',

  'Palmitoyl Pentapeptide-4':
    'The peptide behind the Matrixyl name — a firmness anchor that signals the skin\'s repair process and boosts collagen and elastin production. It strengthens the extracellular matrix to make skin feel less fragile and raw over time. Well-tolerated, and the palmitoyl fatty acid attachment helps it reach where it needs to work.',

  'Palmitoyl Tetrapeptide-7':
    'One half of the Matrixyl 3000 complex — a firmness anchor peptide that targets the inflammatory side of skin aging and helps reduce collagen breakdown. It works alongside palmitoyl tripeptide-1 to address both new collagen production and existing collagen protection. Very well-tolerated.',

  'Palmitoyl Tripeptide-1':
    'The other half of Matrixyl 3000 — a firmness anchor peptide that mimics collagen fragments to stimulate the production of new collagen and hyaluronic acid (the skin\'s own kind, not topically applied). It strengthens the extracellular matrix from the inside, which is what makes skin feel less fragile with use. Well-tolerated for reactive skin.',

  'Palmitoyl Tripeptide-8':
    'A peptide firmness anchor with a specific focus on the skin\'s neurological sensitivity — it interferes with substance P, the compound that triggers the redness and hypersensitivity response in reactive skin. Strengthens the extracellular matrix while actively reducing the "everything hurts" sensitivity that characterizes reactive skin. One of the most relevant peptides for this skin type.',

  'Tripeptide-1':
    'A three-amino-acid peptide (glycine-histidine-lysine) with copper-binding properties — the structural building block of the copper tripeptide GHK-Cu, even without the copper attached. It functions as a firmness anchor, supporting the extracellular matrix and wound-healing signaling. Well-tolerated, consistent with the peptide class.',

  // ── SAFE — NO SPECIFIC REASON ───────────────────────────────────────────

  'Allantoin':
    'A soothing, skin-conditioning ingredient derived from comfrey root (or synthesized) that calms irritated skin, supports cell turnover, and reduces hypersensitivity. It\'s essentially an anti-inflammatory workhorse — one of the most universally tolerated ingredients in skincare and an excellent choice for reactive skin that needs calming without challenge.',

  'Azelaic Acid':
    'A naturally occurring acid (found in grains) that targets hyperpigmentation, acne bacteria, and rosacea simultaneously — with a significantly gentler irritation profile than stronger exfoliating acids. Some people feel a brief tingling or mild flushing when first starting it; this usually settles within a couple of weeks and is distinct from the stinging reaction this skin has to harsher actives.',

  'Bisabolol':
    'A naturally occurring alcohol from chamomile (or synthesized for stability) that\'s a classic anti-irritant and skin-soother. You\'ll often see it deliberately added to formulas alongside active ingredients to buffer their irritation potential. Very well-tolerated — a genuinely useful ingredient for reactive skin.',

  'Camellia Sinensis Leaf Extract':
    'Green tea extract, rich in antioxidants (especially EGCG) that protect against free radical damage and reduce inflammation. It has solid evidence behind it as a calming and protective ingredient with very low irritation potential — one of the safer actives to look for in formulas for reactive skin.',

  'Centella Asiatica':
    'Cica — a plant extract that\'s become central to K-beauty for its wound-healing and barrier-building properties. The active compounds (asiaticoside, madecassoside) calm inflammation and stimulate collagen production. This is the kind of ingredient designed for exactly this skin type: it rebuilds the barrier rather than challenging it.',

  'Centella Asiatica Extract':
    'A concentrated extract from Centella Asiatica standardized for its active triterpenoids. It reduces inflammation, accelerates skin barrier repair, and has clinical backing specifically for sensitive and reactive skin. One of the more reliably helpful actives for this skin type.',

  'Ceramide':
    'Ceramides are lipids that make up roughly half of the skin\'s barrier structure — they\'re what holds skin cells together and keeps moisture from escaping. Supplementing them topically helps rebuild a compromised barrier. Extremely well-tolerated, and one of the most fundamentally useful ingredients for reactive skin that needs structural repair.',

  'Ceramide 3':
    'Ceramide 3 (also called ceramide NP) is one of the most abundant ceramides in healthy skin, critical for barrier integrity and moisture retention. Topical application helps replenish what\'s lost through age, harsh products, or environmental stress. Excellent tolerability, and genuinely restorative for reactive and sensitized skin.',

  'Ceramide AP':
    'One of the nine ceramide types found in human skin, playing a role in maintaining barrier structure and preventing water loss. Topical application helps repair barrier damage from within. Well-tolerated and beneficial for reactive skin that needs structural support.',

  'Ceramide EOP':
    'A long-chain ceramide found in the outermost layer of skin, important for the water-impermeability of the barrier structure. Depleted by age, harsh cleansers, and environmental exposure — replenishing it topically helps restore barrier function. Excellent tolerability.',

  'Ceramide NP':
    'The most common ceramide type in skin, essential for forming the lamellar structure that makes the barrier water-tight. The key ingredient in CeraVe and similar barrier-repair formulas. Universally well-tolerated and actively beneficial for reactive or compromised skin.',

  'Ceramides':
    'The lipid class that forms the backbone of the skin\'s moisture barrier. When ceramides are depleted — by age, harsh products, or environmental damage — skin becomes dry, reactive, and easily irritated. Replenishing them topically is one of the most evidence-backed approaches to barrier repair for reactive skin.',

  'Glycerin':
    'A humectant that draws moisture from the environment (and from deeper skin layers) to the surface — one of the most studied and universally well-tolerated skincare ingredients. It works across all skin types including reactive, helps barrier function at higher concentrations, and improves the delivery of other ingredients. A safe and genuinely useful staple.',

  'Hydrocolloid':
    'A gel-forming material used in medical wound dressings and in acne pimple patches. It creates a moist healing environment that draws fluid out of blemishes and protects the wound from bacteria and contact. The same technology used in post-surgical wound care — excellent tolerability and a non-chemical approach to spot treatment that works well for reactive skin.',

  'Hypochlorous Acid':
    'A weak acid produced naturally by white blood cells as part of the immune response to infection — it\'s literally part of how the body fights bacteria. In skincare, it\'s used as a gentle antimicrobial spray that\'s particularly popular in the eczema and reactive-skin community. Very low irritation potential; it actively helps calm inflammatory skin conditions rather than challenge them.',

  'Madecassoside':
    'One of the key active compounds extracted from Centella Asiatica (cica) — a triterpenoid with strong anti-inflammatory and wound-healing properties and evidence for stimulating collagen synthesis. It builds the skin barrier rather than stressing it, which makes it one of the more appropriate actives for this skin type.',

  'Magnesium':
    'In skincare, magnesium typically arrives as a salt form used for its anti-inflammatory and calming properties. The evidence for topical magnesium effects is less robust than for oral supplementation, but it\'s very well-tolerated topically and unlikely to trigger any reaction, even on reactive skin.',

  'Magnesium Sulfate':
    'Epsom salt — used in bath soaks and masks for mild anti-inflammatory properties and temporary skin texture improvement. Very well-tolerated and commonly used in eczema and reactive-skin care. An accessible, low-risk way to incorporate a calming mineral soak into a routine.',

  'Niacinamide':
    'Vitamin B3 — one of the most versatile and well-researched skincare ingredients available. It reduces pore visibility, fades hyperpigmentation, strengthens the skin barrier, and has meaningful anti-inflammatory effects. Generally very well tolerated; a small number of people experience temporary flushing at concentrations above 10%, but at 5% it\'s almost universally problem-free.',

  'Avena Sativa (Oat) Seed Water':
    'Water extracted from oat seeds, rich in beta-glucan and avenanthramides — compounds with well-documented anti-inflammatory and barrier-supportive effects specifically researched for eczema-prone and reactive skin. One of the gentler ways to get oat benefits into a formula. Safe for this skin.',

  'Colloidal Oatmeal':
    'Finely ground oats suspended in liquid — an FDA-recognized skin protectant with clinical evidence for reducing itch and inflammation in eczema and reactive skin. The beta-glucan and avenanthramide content forms a protective film while actively calming the inflammatory response. One of the most validated soothing ingredients for reactive skin.',

  'Panthenol':
    'Provitamin B5 — converts to pantothenic acid in skin, where it supports barrier repair, wound healing, and hydration. Consistently recommended for sensitive and compromised skin because it genuinely accelerates barrier recovery without any meaningful irritation risk. One of the more straightforward "always safe" ingredients for reactive skin.',

  'Panthenol(Skin-Conditioning Agents)':
    'Same as panthenol — provitamin B5 with the functional category appended from the ingredient list format. Converts to pantothenic acid in skin to support barrier repair and hydration. Excellent tolerability; a useful ingredient for reactive skin to look for specifically.',

  'Propolis':
    'A resinous substance bees produce from plant saps to seal their hives, with genuine antimicrobial and anti-inflammatory properties that have been studied for acne and wound healing. Well-tolerated for this skin. People with bee product allergies (beeswax, honey) should patch test, but absent that history, propolis is a safe and useful ingredient.',

  'Propolis Extract':
    'Concentrated bee propolis standardized for its active phenolic compounds. Has antimicrobial and anti-inflammatory activity, with some evidence for acne applications. Well-tolerated for this skin. Same caveat as raw propolis: known bee product allergies warrant a patch test first.',

  'Squalane':
    'A stable, plant-derived (usually olive or sugarcane) form of squalene that closely mimics the skin\'s own natural oils. Lightweight, non-comedogenic, and one of the most universally well-tolerated emollients available. Reactive skin tends to respond very well — it reinforces the barrier without occlusion, without fragrance, and without any of the common irritation triggers.',

  'Squalane(Skin-Conditioning Agents)':
    'Same as squalane — the category label is appended from the ingredient list format. A stable, plant-derived emollient that mimics the skin\'s own lipids: lightweight, non-comedogenic, and one of the safest emollient choices for reactive skin.',

  'Zinc':
    'In skincare, zinc typically arrives as zinc oxide (mineral sunscreen and anti-inflammatory) or zinc salts (for acne and oil control). Topical zinc has real evidence for inflammatory and acne-prone skin, and zinc deficiency is associated with barrier problems. Very well-tolerated across skin types.',

  'Zinc ­Gluconate':
    'A zinc salt used in acne products for its antimicrobial and anti-inflammatory properties. Gentler than benzoyl peroxide and without the bleaching side effect. Some evidence supports it as an effective alternative to topical antibiotic acne treatments. Well-tolerated for reactive skin.',

  'Zinc Oxide':
    'The benchmark mineral sunscreen filter — it physically deflects UV radiation rather than absorbing it chemically. The most reactive-skin-friendly sunscreen option available: no systemic absorption, no hormone disruption concerns, no itching or stinging. The main drawback is white cast, though micronized formulas have reduced this substantially.',

  'Zinc Stearate':
    'The zinc salt of stearic acid, used as a thickener, lubricant, and slip agent in powder cosmetics. It helps products spread smoothly and prevents caking. Very small amounts are used in formulations, and zinc stearate has low sensitization potential — a background ingredient that\'s unlikely to be the source of any reaction.',

};

async function main() {
  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('id, name, explanation')
    .order('name');

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  const toUpdate = ingredients.filter((ing) => {
    if (!FORCE && ing.explanation) return false;
    return EXPLANATIONS[ing.name] !== undefined;
  });

  const noMatch = ingredients.filter(
    (ing) => EXPLANATIONS[ing.name] === undefined
  );

  console.log(`${ingredients.length} ingredients in DB.`);
  console.log(`${toUpdate.length} will be updated.`);
  if (noMatch.length > 0) {
    console.log(`\nNo explanation defined for:`);
    noMatch.forEach((i) => console.log(`  - "${i.name}"`));
  }
  console.log('');

  let ok = 0, failed = 0;
  for (const ing of toUpdate) {
    const explanation = EXPLANATIONS[ing.name];
    const { error: updateError } = await supabase
      .from('ingredients')
      .update({ explanation })
      .eq('id', ing.id);

    if (updateError) {
      console.error(`✗ ${ing.name}: ${updateError.message}`);
      failed++;
    } else {
      console.log(`✓ ${ing.name}`);
      ok++;
    }
  }

  console.log(`\nDone. ${ok} updated, ${failed} failed.`);
}

main().catch(console.error);
