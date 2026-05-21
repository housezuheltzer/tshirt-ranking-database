You are a senior textile engineer and garment quality analyst. Your task is to perform a detailed technical breakdown of a premium t-shirt model and generate a structured JSON object containing all engineering metrics, manufacturing details, and material properties.

Review the following T-shirt:
[INSERT BRAND, MODEL NAME, AND ANY TEXT/DATA SOURCE HERE]

---

### Scoring Methodology Rules
1. **Fibre & Yarn Score (Max 30)**: Score based on cotton grade (ELS like Suvin/Giza/Pima scores 20-30; long-staple scores 15-20; short-staple/open-end scores under 10), yarn ply (2-ply gets a premium over 1-ply), spin method (compact-spun/ring-spun combed scores high; carded/open-end scores low).
2. **Knit & Dyeing Score (Max 20)**: Score based on knit density, machinery used (loopwheel, Tompkins upward-knitting get top marks), tension control, and dye safety/authenticity.
3. **Structural Geometry Score (Max 20)**: Score based on sewing execution, armhole height (higher = better range of motion), shoulder seam offset (forward-shifted shoulder seams for comfort), and collar construction.
4. **Stability & Finish resilience (Max 15)**: Score based on shrinkage treatments (sanforization, wash cycles), collar rib recovery (elastane blending, binding tape), and shape retention.
5. **Manufacturer Disclosure Score (Max 15)**: Score based on supply chain transparency. Assign 1 point for each clear disclosure: mill name, sewing factory name, raw cotton country, fabric knitting country, fabric dyeing country, etc.
6. **Engineering Score (Max 100)**: Sum of all 5 sub-scores above.
7. **Final Rating (Max 10)**: Engineering Score divided by 10 (e.g., 85/100 = 8.5).
8. **Value Index (1 to 10 Scale)**: Divide the final score by the retail price (standardized to AUD) or evaluate price-to-engineering performance.
9. **Confidence Rating (0 to 100%)**: The % of specifications that are verified/audited rather than marketing claims.
10. **Hard Rejection Gate**: If the garment uses open-end carded yarn (rough/weak), has a "Dry Clean Only" label (indicating unstable fabric engineering), or has severe structural/torsion issues, set `hard_rejection_flag: true` and specify the `rejection_reason`.

---

### JSON Schema & Field Constraints

Deliver ONLY a valid JSON object. Do not include any wrapper text, markdown explanations, or comments outside the JSON block.

#### 1. STRICT ENUM FIELDS (Must match one of the listed strings exactly)
* **fit**: Array containing one or more of: `["Slim"]`, `["Regular"]`, `["Relaxed"]`, `["Boxy"]`, `["Oversized"]`, `["Straight"]`
* **fibre_verified**: `"Verified"` | `"Partial (Brand claim)"` | `"Unverified"`
* **fibre_class**: `"ELS (Extra Long Staple)"` | `"Long-staple"` | `"Unspecified staple"` | `"Unspecified blend"`
* **specific_cotton_type**: `"Suvin Cotton"` | `"Pima Cotton"` | `"Giza Cotton"` | `"Organic Cotton"` | `"unspecified"`
* **yarn_spin_method**: `"Ring-spun"` | `"Compact spun"` | `"Open-end"` | `"Combed ring-spun"` | `"Carded"` | `"unknown"`
* **combed**: `"Combed"` | `"Carded"` | `"unknown"`
* **compact_spun**: `"Yes"` | `"No"` | `"unknown"`
* **pre_shrunk**: `"Yes"` | `"No"` | `"unknown"` | `"Partial"` | `"Pre-washed (Will shrink slightly on first hot cycle)"` | `"Yes (Fully pre-shrunk in boiling natural dyes)"`
* **sanforised**: `"Yes"` | `"No"` | `"unknown"`
* **silicone_finish_disclosed**: `"Yes"` | `"No"` | `"unknown"` | `"No (Silicone feel inferred)"`
* **side_seams**: `"Yes (Side seams)"` | `"No (Circular tubular knit)"`
* **shoulder_seam_position**: `"Standard alignment"` | `"Forward-shifted (Comfort shoulder)"`
* **armhole_height**: `"High"` | `"Medium"` | `"Low"`
* **collar_recovery**: `"Excellent"` | `"Very Good"` | `"Good"` | `"Moderate"` | `"Poor"`
* **availability**: `"Available"` | `"Made-to-order"` | `"Discontinued"`

#### 2. BOOLEAN FIELDS (Must be literal `true` or `false` without quotes)
* **tubular_flag**: `true` (if circular knit, no side seams) or `false`
* **dry_clean_only_flag**: `true` or `false`
* **hard_rejection_flag**: `true` (if it fails engineering gates) or `false`

#### 3. NUMBER FIELDS (Must be integers or decimals without quotes)
* **retail_price**: integer (e.g. `90`)
* **price_aud**: integer (approx value in Australian Dollars)
* **yarn_ply**: integer (usually `1` or `2`)
* **weight_gsm**: integer (grams per square meter, e.g. `180`)
* **fibre_yarn_score**: integer (0 to 30)
* **knit_dye_score**: integer (0 to 20)
* **geometry_score**: integer (0 to 20)
* **stability_score**: integer (0 to 15)
* **disclosure_score**: integer (0 to 15)
* **engineering_score**: integer (0 to 100) (Sum of the 5 sub-scores)
* **confidence_score**: integer (0 to 100)
* **value_score**: integer (1 to 10)
* **final_score_10**: decimal (0.0 to 10.0) (Engineering Score / 10)

#### 4. FREE-TEXT FIELDS (Free-form string content)
If any of these details are completely unknown, use the literal string `"unknown"`.
* **brand**: Exact Brand name (e.g., `"Sunspel"`)
* **manufacturer**: Parent company or owner (e.g., `"Sunspel Ltd."`)
* **item_name**: Product name (e.g., `"Classic Cotton Tee (Q82)"`)
* **season**: `"Permanent"` or specific collection (e.g., `"SS26"`)
* **sku**: Manufacturer SKU or `"unknown"`
* **product_url**: Web address link
* **country_of_origin**: e.g., `"🇯🇵 Japan"` (include flag emoji + name)
* **country_of_fabric**: e.g., `"Japan"`
* **country_of_knitting**: e.g., `"Japan"`
* **country_of_sewing**: e.g., `"Japan"`
* **mill**: Specific knitting mill, or `"unknown"`/`"Undisclosed"`
* **factory**: Specific sewing house, or `"unknown"`/`"Undisclosed"`
* **fabric_composition**: e.g., `"100% Cotton"` or `"50% Silk / 50% Cotton"`
* **fibre_claim**: Sourcing claims, e.g., `"ELS Egyptian Cotton"`
* **yarn_count**: e.g., `"40/2"` or `"30/1"`
* **knit_type**: e.g., `"High-gauge single jersey"`
* **knit_tension_notes**: Physical description of the knit and tension
* **dye_method**: e.g., `"Piece dyed"`, `"Yarn dyed"`, `"Garment dyed"`
* **rear_neck_structure**: e.g., `"Self-fabric neck tape"`, `"Herringbone reinforcing tape"`
* **collar_rib_material**: Fabric composition of the neck rib
* **hem_quality**: e.g., `"Blind stitched clean hem"`, `"Twin-needle coverstitch"`
* **care_label**: Washing instructions
* **rejection_reason**: Explanation if rejected, otherwise empty `""`
* **source_url_1**: Reference link or audit document URL
* **source_url_2**: Reference link or empty `""`
* **source_url_3**: Reference link or empty `""`
* **source_quote_notes**: Key quotes or engineering insights from sources
* **analyst_notes**: Summary of pros, cons, and reasons behind the engineering scores

---

### Expected JSON Output Template

```json
{
  "brand": "Brand",
  "manufacturer": "Manufacturer Co.",
  "item_name": "Item Name",
  "season": "Permanent",
  "sku": "unknown",
  "category": "T-Shirt",
  "fit": ["Regular"],
  "neckline": "Crew neck",
  "sleeve": "Short sleeve",
  "retail_price": 90,
  "currency": "USD",
  "price_aud": 135,
  "availability": "Available",
  "product_url": "https://...",
  "country_of_origin": "🇯🇵 Japan",
  "country_of_fabric": "Japan",
  "country_of_knitting": "Japan",
  "country_of_sewing": "Japan",
  "mill": "Undisclosed",
  "factory": "Undisclosed",
  "fabric_composition": "100% Cotton",
  "fibre_claim": "ELS Cotton",
  "fibre_verified": "Verified",
  "fibre_class": "ELS (Extra Long Staple)",
  "specific_cotton_type": "Pima Cotton",
  "yarn_count": "40/2",
  "yarn_ply": 2,
  "yarn_spin_method": "Combed ring-spun",
  "combed": "Combed",
  "compact_spun": "No",
  "knit_type": "Single jersey",
  "knit_tension_notes": "Firm gauge circular knit",
  "dye_method": "Piece dyed",
  "pre_shrunk": "Yes",
  "sanforised": "Yes",
  "silicone_finish_disclosed": "No",
  "side_seams": "Yes (Side seams)",
  "shoulder_seam_position": "Standard alignment",
  "rear_neck_structure": "Self-fabric neck tape",
  "armhole_height": "Medium",
  "collar_rib_material": "100% Cotton rib",
  "collar_recovery": "Good",
  "hem_quality": "Twin-needle stitch",
  "care_label": "Machine wash cold",
  "tubular_flag": false,
  "dry_clean_only_flag": false,
  "fibre_yarn_score": 24,
  "knit_dye_score": 15,
  "geometry_score": 14,
  "stability_score": 11,
  "disclosure_score": 11,
  "engineering_score": 75,
  "confidence_score": 85,
  "value_score": 7,
  "final_score_10": 7.5,
  "hard_rejection_flag": false,
  "rejection_reason": "",
  "source_url_1": "https://...",
  "source_url_2": "",
  "source_url_3": "",
  "source_quote_notes": "Certificates and spec claims verified.",
  "analyst_notes": "Well constructed mid-weight tee...",
  "weight_gsm": 180
}
