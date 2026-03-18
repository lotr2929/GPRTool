# GPRTool LAI Database Strategy
**Author:** Boon Lay Ong  
**Created:** 2026-03-17  
**Status:** Working document — update as strategies are resolved

---

## Purpose

This document records all known free LAI data sources, their suitability for GPRTool, and the strategy for building a curated, defensible LAI plant library for GPR calculation.

The LAI database is the intellectual core of GPRTool. The CAD visualiser is simply the delivery mechanism. A scientifically rigorous, auditable, urban-context LAI database — the first of its kind — is the publishable IP.

---

## The Central Scientific Problem

All existing LAI databases were compiled for ecological and forestry research. Values were measured in natural forests, plantations, and experimental plots — not urban conditions. Urban greenery is fundamentally different:

- Root volume restriction → reduced LAI vs open-ground
- Substrate depth constraints (green roofs, podium gardens)
- Light level variation (street tree shade, atrium interiors, aspect)
- Wind exposure on rooftops
- Irrigation regimes and soil quality
- Pruning management

**GPRTool must ultimately provide:**
1. A best-available LAI value per species (from literature)
2. An urban adjustment factor per installation type — OR — direct urban-measured LAI where data exists
3. Full traceability: source, methodology, context

---

## Current Processed Data (as of 2026-03-17)

| File | Contents |
|------|----------|
| `LAI_combined_clean.csv` | All unique species from ORNL + TRY, aggregated |
| `LAI_tropical_subset.csv` | Tropical/subtropical species flagged by latitude |
| `LAI_categorised.csv` | All 760 species categorised by genus lookup |
| `LAI_category_report.txt` | Category counts and REVIEW list |
| `LAI_explorer_report.txt` | Full pipeline report |
| `Material Library.csv` | Working GPRTool species library (manual) |

### Category counts (from lai_categorise.py)
| Category | Count |
|----------|-------|
| Tree | 248 |
| Multi-Species | 323 |
| REVIEW | 55 |
| Generic-Benchmark | 38 |
| Shrub | 29 |
| Groundcover | 25 |
| Grass | 22 |
| Mangrove | 10 |
| Bamboo | 9 |
| Palm | 1 |
| **TOTAL** | **760** |

**Pending:** Boon to manually categorise 55 REVIEW species in `LAI_categorised.csv`.

---

## Data Sources

### 1. ORNL DAAC — Global LAI Database (Woody Plants 1932–2011)
- **File:** `LAI Database - ONRL.csv`
- **Coverage:** ~350 single species entries, global, woody plants only
- **Strength:** Long time series, peer-reviewed, includes some Australian Eucalyptus/Acacia
- **Weakness:** Mostly European and North American forest species; natural/plantation context only
- **Access:** Free, registration required — https://daac.ornl.gov
- **Status:** ✅ Downloaded, processed

### 2. TRY Plant Trait Database
- **File:** `LAI Database - TRY.csv` + `TRY Database/37339.txt`
- **Coverage:** Broader global coverage, includes some tropical genera (Ficus, Terminalia etc.)
- **Strength:** LAI measurements include latitude/longitude for tropical flagging; large dataset
- **Weakness:** Still natural/plantation context; requires data request/registration
- **Access:** Free, data request required — https://www.try-db.org
- **Status:** ✅ Downloaded, processed (including raw 37339.txt with location data)

### 3. Tan & Sia 2009 — GPR Guidebook (LOCAL REFERENCE)
- **File:** `Tan, Sia - 2009 - LAI of tropical plants - a Guidebook on its use in the calculation of GPR.pdf`
- **Coverage:** Tropical species specifically for GPR calculation in Singapore context
- **Strength:** Urban-context LAI, the only source directly calibrated for GPR; foundational IP reference
- **Weakness:** Limited species list; Singapore-centric
- **Access:** In-house — already in folder
- **Status:** ⏳ Pending — species list and LAI values to be manually extracted and cross-referenced

### 4. LeafWeb / LOPEX Database
- **Coverage:** Leaf optical properties and LAI, global
- **Strength:** Includes some canopy LAI measurements; useful for spectral validation
- **Weakness:** Primarily optical physics, not urban context
- **Access:** Free — https://www.lopexdatabase.com
- **Status:** 🔲 Not yet assessed

### 5. GlobAI — Global Plant Functional Type LAI
- **Coverage:** Satellite-derived LAI aggregated by plant functional type (PFT)
- **Strength:** Large coverage, includes tropical broadleaf evergreen (relevant for SE Asia)
- **Weakness:** PFT averages, not species-level; not urban
- **Access:** Free via ESA/Copernicus — https://land.copernicus.eu/global/products/lai
- **Status:** 🔲 Not yet assessed — potentially useful for benchmark/sanity check

### 6. MODIS LAI Product (MOD15A2H)
- **Coverage:** Global, 500m resolution, time series
- **Strength:** Continuous global LAI, tropical coverage excellent
- **Weakness:** Landscape-scale, not species-level; remote sensing artifact in urban areas
- **Access:** Free via NASA EarthData — https://earthdata.nasa.gov
- **Status:** 🔲 Not yet assessed — useful for regional benchmarks only

### 7. NParks Flora & Fauna Web (Singapore)
- **Coverage:** Singapore native and cultivated species database
- **Strength:** Directly relevant urban species for tropical GPR; includes growth form data
- **Weakness:** No LAI values — but provides species list, growth habit, and images useful for lookup
- **Access:** Free — https://www.nparks.gov.sg/florafaunaweb
- **Status:** 🔲 Not yet assessed — use as species crosswalk, not LAI source

### 8. FloraBase (Western Australia)
- **Coverage:** WA native flora, taxonomy, distribution
- **Strength:** Perth-relevant species; growth form data; useful for WA urban greenery context
- **Weakness:** No LAI values
- **Access:** Free — https://florabase.dpaw.wa.gov.au
- **Status:** 🔲 Not yet assessed — use as species crosswalk for Perth context

### 9. AusTraits — Australian Plant Trait Database
- **Coverage:** Australian plants, functional traits including some LAI/SLA measurements
- **Strength:** Australian native species, peer-reviewed, growing dataset
- **Weakness:** LAI coverage sparse; mostly natural context
- **Access:** Free — https://austraits.org
- **Status:** 🔲 Not yet assessed — HIGH PRIORITY for Perth/Australian urban context

### 10. GBIF — Global Biodiversity Information Facility
- **Coverage:** Occurrence data, not LAI — but useful for confirming species distributions
- **Strength:** Confirms whether a species occurs in a target climate zone
- **Weakness:** Not a trait database
- **Access:** Free — https://www.gbif.org
- **Status:** 🔲 Background utility only

### 11. Peer-reviewed Urban LAI Literature (Manual Extraction)
- **Coverage:** Scattered papers measuring LAI in urban settings — green roofs, vertical greenery, street trees
- **Strength:** THE primary source for urban-context values; directly defensible
- **Weakness:** No single database exists; must be manually harvested
- **Key sources to mine:**
  - Papers citing Tan & Sia 2009
  - Singapore BCA / NParks technical reports
  - Hong Kong BEAM Plus studies
  - European urban greenery studies (Hedera, Parthenocissus for vertical greenery)
  - Living wall manufacturer technical data (Biotecture, Sempergreen, ANS Group)
  - Urban heat island studies with embedded LAI measurements
- **Access:** Google Scholar, Scopus, ResearchGate; some via Curtin library
- **Status:** 🔲 Not yet started — Phase 2 priority; Mobius Factory can assist

---

## Strategies

### Strategy A — Curated Species Library (MVP)
Build a hand-curated list of 50–100 species most relevant to Perth and Singapore urban greenery contexts. Source LAI from ORNL/TRY where available; supplement with Tan & Sia 2009 values; add urban adjustment factors based on installation type (conservative estimates until measured data available). This is the GPRTool MVP material library.

**Output:** `Material Library.csv` (already started)  
**Timeline:** Doable now with existing data  
**Risk:** Urban adjustment factors are expert estimates, not measured — must be disclosed

### Strategy B — Full Database Expansion
Systematically pull from AusTraits, NParks, and peer-reviewed urban LAI literature to expand species coverage and add measured urban LAI values where they exist. Cross-reference all entries with ORNL/TRY for consistency.

**Output:** Expanded `LAI_combined_clean.csv` with `urban_lai`, `urban_context`, `substrate_depth`, `light_level` fields  
**Timeline:** Months; suitable for Mobius Factory automation  
**Risk:** Labour-intensive; some sources incomplete

### Strategy C — Mobius Factory Autonomous Crawl
Configure a Mobius Factory module (`Urban Greenery & LAI`) to continuously crawl peer-reviewed urban LAI literature, Singapore/HK/EU technical guidelines, and manufacturer plant data. Evaluated findings enter a Supabase knowledge layer; GPRTool pulls from it periodically.

**Output:** Self-improving, citable urban LAI knowledge base  
**Timeline:** Medium-term; requires Factory module build  
**Risk:** Data quality depends on Factory evaluation prompts

---

## Recommended Next Steps (in order)

1. **Boon:** Manually categorise 55 REVIEW species in `LAI_categorised.csv`
2. **Boon:** Annotate `LAI_tropical_subset.csv` — mark species relevant to Perth/Singapore
3. **Extract Tan & Sia 2009** — species list and LAI values → add to combined database with `source = "Tan_Sia_2009"` and `urban_context = TRUE`
4. **Assess AusTraits** — download trait data, check LAI/SLA coverage for Australian species
5. **Build curated Material Library** — 50–100 species, Strategy A, ready for GPRTool MVP
6. **Define urban adjustment factor schema** — installation type × substrate depth × light level → LAI multiplier
7. **Strategy B/C** — post-MVP, expand with Factory integration

---

## Urban Context Metadata Schema (proposed)

For each species entry in the final material library:

| Field | Values | Notes |
|-------|--------|-------|
| `species_name` | binomial | |
| `common_name` | string | |
| `category` | Tree / Shrub / Groundcover / Grass / Climber / Bamboo / Palm / Mangrove | |
| `lai_reference` | float | Best available value from literature (natural context) |
| `lai_urban` | float | Measured urban value if available |
| `urban_adjustment` | float | Multiplier for installation type (0–1) |
| `installation_type` | Street Tree / Rooftop / Vertical / Podium / Atrium / Ground | |
| `substrate_depth_min` | mm | Minimum substrate for viable LAI |
| `light_requirement` | Full Sun / Part Shade / Shade | |
| `climate_zone` | Tropical / Subtropical / Temperate | |
| `source` | string | Citation |
| `urban_source` | string | Urban measurement citation if different |
| `notes` | string | |

---

*Last updated: 2026-03-17*
