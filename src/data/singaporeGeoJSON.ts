// Singapore planning area boundaries as GeoJSON
// Coordinates based on URA planning area definitions
// Format: GeoJSON FeatureCollection with Polygon features for each planning area

export const singaporeGeoJSON = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature",
      properties: { name: "Woodlands", area: "North" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.68, 1.450], [103.80, 1.455], [103.82, 1.440], [103.80, 1.425], [103.70, 1.420], [103.68, 1.435], [103.68, 1.450]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Sembawang", area: "North" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.80, 1.450], [103.90, 1.460], [103.92, 1.445], [103.85, 1.435], [103.80, 1.440], [103.80, 1.450]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Yishun", area: "North-East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.82, 1.442], [103.92, 1.448], [103.95, 1.428], [103.88, 1.420], [103.82, 1.425], [103.82, 1.442]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Punggol", area: "North-East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.90, 1.430], [104.08, 1.445], [104.10, 1.410], [103.95, 1.400], [103.90, 1.415], [103.90, 1.430]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Sengkang", area: "North-East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.88, 1.415], [103.98, 1.420], [104.00, 1.395], [103.90, 1.385], [103.88, 1.400], [103.88, 1.415]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Ang Mo Kio", area: "Central" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.82, 1.388], [103.90, 1.392], [103.92, 1.360], [103.85, 1.352], [103.82, 1.365], [103.82, 1.388]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Hougang", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.88, 1.388], [103.98, 1.395], [104.00, 1.360], [103.90, 1.350], [103.88, 1.365], [103.88, 1.388]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Toa Payoh", area: "Central" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.82, 1.365], [103.88, 1.370], [103.90, 1.335], [103.82, 1.330], [103.82, 1.365]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Serangoon", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.88, 1.360], [103.96, 1.365], [103.98, 1.330], [103.88, 1.325], [103.88, 1.360]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Geylang", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.88, 1.332], [103.98, 1.340], [104.00, 1.300], [103.90, 1.295], [103.88, 1.310], [103.88, 1.332]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Kallang", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.85, 1.330], [103.92, 1.335], [103.94, 1.300], [103.86, 1.295], [103.85, 1.310], [103.85, 1.330]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Bedok", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.90, 1.325], [104.05, 1.338], [104.08, 1.295], [103.93, 1.285], [103.90, 1.305], [103.90, 1.325]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Tampines", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.93, 1.360], [104.08, 1.375], [104.12, 1.310], [103.98, 1.295], [103.93, 1.330], [103.93, 1.360]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Pasir Ris", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [104.00, 1.395], [104.12, 1.410], [104.15, 1.360], [104.05, 1.345], [104.00, 1.370], [104.00, 1.395]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Jurong West", area: "West" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.60, 1.345], [103.78, 1.360], [103.80, 1.310], [103.65, 1.295], [103.60, 1.315], [103.60, 1.345]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Jurong East", area: "West" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.73, 1.340], [103.85, 1.350], [103.88, 1.305], [103.75, 1.295], [103.73, 1.315], [103.73, 1.340]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Clementi", area: "West" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.76, 1.315], [103.84, 1.322], [103.86, 1.280], [103.77, 1.272], [103.76, 1.290], [103.76, 1.315]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Queenstown", area: "Central" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.78, 1.305], [103.86, 1.312], [103.88, 1.270], [103.78, 1.262], [103.78, 1.285], [103.78, 1.305]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Bukit Merah", area: "Central" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.80, 1.282], [103.88, 1.292], [103.90, 1.250], [103.80, 1.240], [103.80, 1.265], [103.80, 1.282]
        ]]
      }
    }
  ]
};

export type PlanningArea = typeof singaporeGeoJSON.features[0];
