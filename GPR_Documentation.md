# Green Plot Ratio — Documentation

**Author**: Boon Lay Ong
**Version**: 1.0 — March 2026
**Purpose**: Reference documentation for GPRTool and GPR methodology

---

## 1. What is Green Plot Ratio?

**Green Plot Ratio (GPR)** is a planning metric that quantifies the three-dimensional green leaf area a development provides relative to the site area it occupies.

```
GPR = Total Leaf Area / Site Area
```

Where:
- **Total Leaf Area** = sum of (planted area × LAI) for all planted elements on the site
- **Site Area** = gross site area in square metres
- **LAI** = Leaf Area Index of the plant species assigned to each element

GPR is dimensionless. A GPR of 1.0 means the site has generated one square metre of leaf area for every square metre of site area. A GPR of 3.0 means three times the site area has been returned as leaf area — typically achievable with a combination of ground planting, rooftop gardens, and vertical greenery.

---

## 2. Why GPR Matters

Urban development replaces permeable, biodiverse land with hard surfaces. GPR is the mechanism for quantifying and requiring compensation — not just ground coverage, but the full three-dimensional green volume a site generates.

A building with a green roof, vertical gardens, and a landscaped podium can exceed the green value of the undeveloped site it replaced. That is the ambition GPR enables planners and architects to pursue.

### What GPR quantifies

All the following ecological functions are directly proportional to leaf area:

**Urban heat island mitigation**
Leaves drive evapotranspiration — the conversion of liquid water to vapour — which cools the surrounding air. Shading from canopy reduces surface temperatures. Both effects scale with leaf area.

**Biodiversity support**
Canopy structure, species diversity, and leaf area together determine habitat value. GPR provides a minimum quantitative threshold for planning compliance; species selection determines whether that threshold delivers genuine biodiversity value.

**Stormwater management**
Leaves intercept rainfall before it reaches impervious surfaces. Root systems absorb water and slow runoff. Both mechanisms reduce peak stormwater loads on urban drainage systems.

**Carbon sequestration**
Carbon uptake through photosynthesis is directly tied to leaf area and biomass accumulation. While urban trees are not carbon sinks at the scale of forests, they make a measurable contribution to site-level carbon accounting.

**Air quality**
Leaf surfaces capture particulate matter, absorb gaseous pollutants, and produce oxygen. All three effects scale with leaf area.

**Human wellbeing**
A substantial evidence base links exposure to green vegetation to reduced stress, improved mental health outcomes, faster recovery from illness, and increased physical activity. GPR provides a quantitative basis for ensuring minimum green exposure in urban environments.

---

## 3. Why the Calculation is Hard

Most green metrics count area — square metres of grass, number of trees. GPR counts **leaf area**, which is a proxy for all the ecological functions above.

A mature *Ficus benjamina* and a lawn patch of the same footprint are not ecologically equivalent. The *Ficus* may have 50× the leaf area. GPR captures that difference. But only if the LAI values feeding the calculation are valid.

### The LAI problem

**Leaf Area Index (LAI)** is defined as the total one-sided area of leaf tissue per unit ground surface area. It is measured in m²/m² and is dimensionless.

LAI varies enormously between species — from 0.5 for sparse groundcovers to 8+ for dense tropical trees. It also varies significantly within a species depending on growing conditions.

**The gap that GPRTool addresses:**

All existing LAI databases (ORNL Global LAI, TRY Plant Trait Database) were compiled for ecological and forestry research in natural or plantation settings. Urban greenery operates under fundamentally different constraints:

| Factor | Open Ground | Urban Condition |
|--------|-------------|-----------------|
| Root volume | Unlimited | Restricted by planter, soil depth |
| Substrate depth | Natural soil profile | 200–1500mm typical for podiums/roofs |
| Light | Full sun | Variable — atrium, north wall, overshadowed |
| Wind | Normal | Elevated on rooftops, channelled in streets |
| Pruning | None | Regular, reduces canopy density |
| Installation type | Ground planting | Rooftop, vertical, atrium, street tree pit |

Urban trees measured in street tree pits typically show 30–50% lower LAI than the same species in open ground. Rooftop gardens on shallow substrate may achieve only 40% of the LAI measured in a nursery or plantation setting.

**This means every LAI value in current databases carries a hidden assumption: that the plant is growing in natural or near-natural conditions.** Using these values without adjustment systematically overstates the GPR of urban developments.

The field measurements conducted by Boon Lay Ong and Dr Tan (Singapore, 2009) are among the very few published LAI values measured directly in urban conditions. They form the primary source for GPRTool's plant library.

---

## 4. The GPR Formula

### Basic calculation

For a site with multiple planted elements:

```
GPR = Σ (Aᵢ × LAIᵢ) / A_site
```

Where:
- `Aᵢ` = plan area of planted element i (m²)
- `LAIᵢ` = Leaf Area Index assigned to element i
- `A_site` = total site area (m²)
- `Σ` = sum over all planted elements

### Three-dimensional elements

For vertical greenery (green walls), the planted area is measured as the **vertical surface area**, not the plan footprint:

```
A_wall = width × height (m²)
```

This is correct — a 10m × 3m green wall has 30m² of planted area regardless of how little plan area it occupies. This is what makes vertical greenery powerful in GPR terms: it generates leaf area without consuming site area.

### Slope correction (future)

On sloped terrain, the actual planted surface area is greater than the plan area:

```
A_slope = A_plan / cos(θ)
```

Where θ is the slope angle. A 30° slope increases the effective planted area by ~15%. GPRTool will implement slope-aware calculation in V2 when terrain is integrated.

### Stacking

GPR stacks vertically. A site can achieve:
- Ground planting: GPR contribution from all planted beds
- Podium garden: additional GPR from rooftop planting
- Green walls: additional GPR from vertical surfaces
- Green roof on building: additional GPR from elevated planting

The total GPR is the sum of all these contributions divided by the site area. There is no penalty for stacking — this is intentional, as it rewards three-dimensional green design.

---

## 5. GPR Targets and Benchmarks

### Singapore (where GPR was developed)
The Singapore Urban Redevelopment Authority (URA) introduced GPR requirements progressively from 2009 onwards. Typical targets:

| Development Type | GPR Target |
|-----------------|------------|
| Residential (landed) | 2.0–3.0 |
| Residential (high-rise) | 4.0–5.0 |
| Commercial | 3.0–4.0 |
| Mixed-use | 3.5–4.5 |
| Industrial | 1.5–2.5 |

These are Singapore-specific values based on tropical climate conditions with high baseline LAI for regional species.

### Australian context
No mandatory GPR targets exist in Australia as of 2026. However several councils have adopted canopy cover and green infrastructure policies that are GPR-compatible. GPRTool is positioned as the calculation tool for when such policies are adopted, and as a voluntary optimisation tool in the interim.

### Interpreting the result

| GPR Value | Interpretation |
|-----------|----------------|
| < 0.5 | Minimal green — hardscape dominant |
| 0.5–1.0 | Low green — some ground planting |
| 1.0–2.0 | Moderate — ground planting + some elevated green |
| 2.0–3.0 | Good — deliberate multi-layer greening |
| 3.0–5.0 | High — rooftop, vertical, and ground planting combined |
| > 5.0 | Exceptional — intensive three-dimensional greening |

---

## 6. Leaf Area Index Reference Values

### Field-measured urban values (Ong & Tan, Singapore 2009)

These are primary source measurements in urban conditions and take precedence over all other sources.

| Species | LAI Value | Notes |
|---------|-----------|-------|
| Agrostis capillaris | 8.40 | Grass |
| Arrhenatherum elatius | 7.66 | Grass |
| Alopecurus pratensis | 7.65 | Grass |
| Anthoxanthum odoratum | 7.34 | Grass |
| Clinopodium vulgare | 6.93 | Herb |
| Acer spicatum | 6.91 | Tree |
| Anthyllis vulneraria | 5.52 | Shrub |
| Digitalis purpurea | 5.42 | Herb |
| Arctium lappa | 4.72 | Herb |
| Aextoxicon punctatum | 4.60 | Tree |
| Dacryodes rostrata | 1.06 | Tree |
| Canarium denticulatum | 1.05 | Tree |
| Cleistanthus paxii | 0.98 | Tree |
| Dacryodes laxa | 0.96 | Tree |
| Cleistanthus baramicus | 0.89 | Shrub |
| Aporusa lucida | 0.86 | Tree |
| Canarium pilosum | 0.71 | Tree |
| Cornus stolonifera | 0.23 | Shrub |

*Note: values for additional species available in GreenPlotRatio_LAI Values.csv*

### General LAI ranges by plant type

These are indicative ranges from open-ground measurements. Apply urban adjustment factors when using for GPR calculation in constrained conditions.

| Plant Type | LAI Range | Typical Urban Value |
|------------|-----------|-------------------|
| Mature canopy tree (tropical) | 3.0–8.0 | 2.0–5.0 |
| Mature canopy tree (temperate) | 2.0–6.0 | 1.5–4.0 |
| Street tree (pit-planted) | 1.0–4.0 | 0.8–2.5 |
| Dense shrub | 2.0–5.0 | 1.5–3.5 |
| Groundcover | 1.0–4.0 | 0.8–3.0 |
| Lawn / turf grass | 1.5–5.0 | 1.5–4.0 |
| Green roof — extensive | 0.5–2.0 | 0.5–1.5 |
| Green roof — intensive | 1.5–5.0 | 1.0–4.0 |
| Vertical greenery | 1.5–4.0 | 1.0–3.0 |
| Bamboo | 2.0–6.0 | 1.5–4.5 |
| Palm | 1.0–3.0 | 0.8–2.5 |

---

## 7. Urban Adjustment Factors (research in progress)

The following adjustment schema is proposed for future implementation. Values are indicative and subject to research validation.

### Installation type multipliers

| Installation Type | Adjustment Factor | Rationale |
|-------------------|-------------------|-----------|
| Ground planting, deep soil (>1m) | 1.0 | No constraint |
| Podium garden, medium substrate (400–1000mm) | 0.7–0.9 | Root restriction |
| Rooftop, shallow substrate (150–400mm) | 0.4–0.7 | Severe root restriction, wind |
| Rooftop, extensive (<150mm) | 0.3–0.5 | Sedum/low-growing only |
| Street tree, standard pit | 0.5–0.7 | Root volume restriction |
| Street tree, structural soil | 0.7–0.9 | Improved root volume |
| Vertical greenery, soil-based | 0.7–0.9 | Root volume, wind |
| Vertical greenery, hydroponic | 0.8–1.0 | Optimal nutrition |
| Atrium planting | 0.6–0.8 | Light reduction |

### Climate zone factors

Species LAI values measured in Singapore (tropical) cannot be directly applied to Perth (hot semi-arid) or Melbourne (temperate oceanic). Climate zone adjustment is a future research priority.

---

## 8. GPR in the Planning Process

### Design sequence

1. **Site analysis** — establish site area, orientation, existing green elements
2. **Design intent** — set GPR target based on council requirements or voluntary ambition
3. **Massing** — determine building footprint, podium levels, wall surfaces available for greening
4. **Plant selection** — choose species appropriate to each installation type and climate
5. **GPR calculation** — calculate contribution of each green element
6. **Optimisation** — adjust plant selection or green element areas to meet target
7. **Documentation** — generate GPR Report for planning submission

### GPR Report contents (planned)

- Site plan showing all green elements (GPRTool viewport screenshot)
- Site area and boundary
- Table of green elements: type, area, species, LAI, GPR contribution
- Total GPR value
- Target GPR and compliance status
- Plant schedule: species, quantity, installation type, LAI source
- Notes on urban adjustment factors applied

---

## 9. References

**Primary**
- Ong, B.L. (2003). Green plot ratio: an ecological measure for architecture and urban planning. *Landscape and Urban Planning*, 63(4), 197–211.
- Tan, P.Y. & Sia, A. (2009). *LAI of tropical plants: a guidebook on its use in the calculation of Green Plot Ratio*. National Parks Board, Singapore.

**LAI Databases**
- ORNL DAAC (2011). *Global database of LAI for woody plants 1932–2011*. Oak Ridge National Laboratory.
- TRY Plant Trait Database. https://www.try-db.org/

**Urban greening policy**
- Urban Redevelopment Authority, Singapore. *Landscaping for Urban Spaces and High-Rises (LUSH)* guidelines.
- Building and Construction Authority, Singapore. *Green Mark* scheme technical guidelines.

---

*This documentation is maintained as part of GPRTool. For the latest version see `_devguide.md` and `_journal.md` in the project root.*
