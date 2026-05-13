"""
enrich_plants.py
Enriches LAI_categorised.csv (760 species) with:
  - canopy_form (inferred from genus taxonomy)
  - default sizes (by canopy_form)
  - mature height/canopy from Wikipedia REST API
  - planted typical sizes (60-80% of mature)
Output: LAI_enriched.csv  (ready for Supabase import)
Author: GPRTool / Boon Lay Ong
"""

import csv, json, re, time, urllib.request, urllib.parse, sys

# ── Taxonomy rules ────────────────────────────────────────────────────────────

CONIFER_GENERA = {
    'Abies','Picea','Pseudotsuga','Tsuga','Larix','Cedrus','Pinus','Araucaria',
    'Sequoia','Sequoiadendron','Metasequoia','Taxodium','Cryptomeria','Thuja',
    'Thujopsis','Chamaecyparis','Juniperus','Cupressus','Calocedrus','Taxus',
    'Podocarpus','Agathis','Callitris','Widdringtonia','Fitzroya','Keteleeria',
    'Pseudolarix','Cephalotaxus','Torreya','Sciadopitys','Platycladus'
}

PALM_GENERA = {
    'Washingtonia','Phoenix','Cocos','Livistona','Archontophoenix','Roystonea',
    'Syagrus','Brahea','Sabal','Trachycarpus','Chamaerops','Bismarckia','Dypsis',
    'Jubaea','Butia','Caryota','Rhapis','Ravenea','Hyophorbe','Wodyetia',
    'Ptychosperma','Howea','Arenga','Licuala','Pritchardia','Rhopalostylis',
    'Latania','Copernicia','Thrinax','Coccothrinax'
}

SPREADING_GENERA = {
    'Platanus','Salix','Albizia','Terminalia','Delonix','Prosopis',
    'Enterolobium','Faidherbia','Acacia','Vachellia','Senegalia'
}

COLUMNAR_KEYWORDS = ['italica','columnaris','fastigiata','pyramidalis','stricta','erecta']

# ── Default sizes by canopy_form ──────────────────────────────────────────────
# (height_mature_m, canopy_radius_mature_m, trunk_height_m, min_substrate_mm)

DEFAULTS = {
    'conical':     (20.0, 4.0,  3.0,  1000),
    'columnar':    (20.0, 1.5,  2.0,  1000),
    'round':       (15.0, 5.0,  2.0,  1000),
    'spreading':   (12.0, 7.0,  2.0,  1000),
    'palm':        (15.0, 3.0, 12.0,  1000),
    'shrub':       ( 3.0, 1.5,  0.0,   500),
    'hedge':       ( 3.0, 0.5,  0.0,   400),
    'groundcover': ( 0.3, 99.0, 0.0,   150),
    'climber':     ( 6.0, 1.0,  0.0,   300),
    'grass':       ( 0.3, 99.0, 0.0,   100),
}

PLANTED_FACTOR = 0.65   # urban planted specimens are typically 65% of mature size

# ── Canopy form inference ─────────────────────────────────────────────────────

def infer_form(species_name, category):
    genus = species_name.split()[0] if species_name else ''
    cat   = (category or '').lower()
    sp    = species_name.lower()

    if genus in PALM_GENERA:                         return 'palm'
    if genus in CONIFER_GENERA:                      return 'conical'
    if any(k in sp for k in COLUMNAR_KEYWORDS):      return 'columnar'
    if genus in SPREADING_GENERA:                    return 'spreading'
    if 'shrub' in cat:                               return 'shrub'
    if 'hedge' in cat:                               return 'hedge'
    if any(k in cat for k in ['grass','turf','sedge','graminoid']): return 'grass'
    if any(k in cat for k in ['ground','herb','forb','moss','sedum']): return 'groundcover'
    if any(k in cat for k in ['climb','vine','lian','creep']):       return 'climber'
    if 'tree' in cat or 'woody' in cat:              return 'round'   # broadleaf default
    if category == 'REVIEW':                         return 'round'   # treat as tree
    return 'round'

# ── Wikipedia lookup ──────────────────────────────────────────────────────────

WIKI_API = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
HEIGHT_RE = re.compile(
    r'(\d+(?:\.\d+)?)\s*(?:–|-|to)\s*(\d+(?:\.\d+)?)\s*m\b|'
    r'(\d+(?:\.\d+)?)\s*m\s*(?:tall|high|in height)',
    re.IGNORECASE
)

def wiki_height(species_name):
    """Query Wikipedia summary for mature height. Returns metres or None."""
    try:
        url  = WIKI_API + urllib.parse.quote(species_name)
        req  = urllib.request.Request(url, headers={'User-Agent': 'GPRTool/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data    = json.loads(resp.read())
            extract = data.get('extract', '')
        m = HEIGHT_RE.search(extract)
        if m:
            if m.group(1) and m.group(2):          # range e.g. "10–20 m"
                return (float(m.group(1)) + float(m.group(2))) / 2.0
            elif m.group(3):                        # single e.g. "15 m tall"
                return float(m.group(3))
    except Exception:
        pass
    return None

# ── Main enrichment ───────────────────────────────────────────────────────────

INPUT_CSV  = 'LAI_categorised.csv'
OUTPUT_CSV = 'LAI_enriched.csv'

FIELDNAMES = [
    'id','species','common_name',
    'mean_lai','median_lai','min_lai','max_lai','measurement_count',
    'sources','tropical','category','canopy_form',
    'height_mature_m','canopy_radius_mature_m','trunk_height_m',
    'height_typical_m','canopy_radius_typical_m',
    'min_substrate_mm','wikipedia_height_m','size_source'
]

def main():
    with open(INPUT_CSV, newline='', encoding='utf-8') as fin:
        rows = list(csv.DictReader(fin))

    total = len(rows)
    print(f'Enriching {total} species ...')

    out_rows = []
    wiki_hits = 0

    for i, row in enumerate(rows, 1):
        species  = row['species'].strip()
        category = row.get('category', 'Tree').strip()
        form     = infer_form(species, category)
        h_mat, r_mat, t_h, sub = DEFAULTS[form]

        # Wikipedia lookup
        wiki_h   = None
        size_src = 'category default'
        if form not in ('groundcover', 'grass', 'climber'):
            wiki_h = wiki_height(species)
            time.sleep(0.3)                          # polite rate limit
            if wiki_h and 1.0 < wiki_h < 120.0:     # sanity check
                h_mat    = wiki_h
                size_src = 'Wikipedia'
                wiki_hits += 1

        h_typ = round(h_mat * PLANTED_FACTOR, 1)
        r_typ = round(r_mat * PLANTED_FACTOR, 1)

        out_rows.append({
            'id':                    i,
            'species':               species,
            'common_name':           '',            # can be filled later
            'mean_lai':              row.get('mean_lai', ''),
            'median_lai':            row.get('median_lai', ''),
            'min_lai':               row.get('min_lai', ''),
            'max_lai':               row.get('max_lai', ''),
            'measurement_count':     row.get('measurement_count', ''),
            'sources':               row.get('sources', ''),
            'tropical':              row.get('tropical', 'False'),
            'category':              category,
            'canopy_form':           form,
            'height_mature_m':       h_mat,
            'canopy_radius_mature_m':r_mat,
            'trunk_height_m':        t_h,
            'height_typical_m':      h_typ,
            'canopy_radius_typical_m': r_typ,
            'min_substrate_mm':      sub,
            'wikipedia_height_m':    wiki_h or '',
            'size_source':           size_src,
        })

        if i % 50 == 0:
            pct = int(i / total * 100)
            print(f'  {i}/{total} ({pct}%)  Wikipedia hits so far: {wiki_hits}')
        sys.stdout.flush()

    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as fout:
        writer = csv.DictWriter(fout, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(out_rows)

    print(f'\nDone. {wiki_hits}/{total} species had Wikipedia height data.')
    print(f'Output: {OUTPUT_CSV}')

if __name__ == '__main__':
    main()
