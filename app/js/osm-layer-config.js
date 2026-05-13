export const LAYER_CONFIG = {
  topography:  { label: 'Terrain',     color: 0xc8b890, opacity: 1.0,  yOffset: 0.000 },
  buildings:   { label: 'Buildings',   color: 0xd4d0c8, opacity: 0.85, yOffset: 0.000 },
  highways:    { label: 'Highways',    color: 0x808078, opacity: 1.0,  yOffset: 0.040 },
  major_roads: { label: 'Major Roads', color: 0x989890, opacity: 1.0,  yOffset: 0.030 },
  minor_roads: { label: 'Minor Roads', color: 0xa8a8a0, opacity: 1.0,  yOffset: 0.020 },
  paths:       { label: 'Paths',       color: 0xb8b8a8, opacity: 1.0,  yOffset: 0.010 },
  parks:       { label: 'Parks',       color: 0x70b850, opacity: 1.0,  yOffset: 0.005 },
  water:       { label: 'Water',       color: 0x5888c0, opacity: 0.85, yOffset: 0.005 },
  railways:    { label: 'Railways',    color: 0x585048, opacity: 1.0,  yOffset: 0.010 },
  contours:    { label: 'Contours',    color: 0xa08860, opacity: 0.7,  yOffset: 0.015 },
};

export const ROAD_WIDTHS = {
  motorway: 22, trunk: 18, primary: 14, secondary: 12,
  tertiary: 10, residential: 8, service: 5, living_street: 6,
  footway: 2, cycleway: 2, path: 2, steps: 2,
};
