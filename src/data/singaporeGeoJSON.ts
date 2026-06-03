// Simplified Singapore planning area boundaries as GeoJSON
// Coordinates approximate the actual URA planning area boundaries
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
          [103.7, 1.45], [103.85, 1.46], [103.85, 1.42], [103.8, 1.40], [103.75, 1.40], [103.7, 1.42], [103.7, 1.45]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Sembawang", area: "North" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.8, 1.45], [103.95, 1.47], [103.95, 1.43], [103.85, 1.42], [103.8, 1.45]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Yishun", area: "North-East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.8, 1.43], [103.95, 1.43], [103.95, 1.38], [103.8, 1.38], [103.8, 1.43]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Punggol", area: "North-East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.9, 1.41], [104.05, 1.42], [104.05, 1.36], [103.9, 1.36], [103.9, 1.41]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Sengkang", area: "North-East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.85, 1.40], [103.98, 1.40], [103.98, 1.35], [103.85, 1.35], [103.85, 1.40]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Ang Mo Kio", area: "Central" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.8, 1.38], [103.9, 1.38], [103.9, 1.32], [103.8, 1.32], [103.8, 1.38]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Hougang", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.85, 1.38], [103.95, 1.38], [103.95, 1.32], [103.85, 1.32], [103.85, 1.38]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Toa Payoh", area: "Central" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.82, 1.35], [103.88, 1.35], [103.88, 1.30], [103.82, 1.30], [103.82, 1.35]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Serangoon", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.88, 1.35], [103.95, 1.35], [103.95, 1.30], [103.88, 1.30], [103.88, 1.35]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Geylang", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.88, 1.33], [103.98, 1.33], [103.98, 1.28], [103.88, 1.28], [103.88, 1.33]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Kallang", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.85, 1.32], [103.92, 1.32], [103.92, 1.27], [103.85, 1.27], [103.85, 1.32]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Bedok", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.92, 1.33], [104.05, 1.34], [104.05, 1.28], [103.92, 1.28], [103.92, 1.33]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Tampines", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.93, 1.36], [104.08, 1.38], [104.08, 1.30], [103.93, 1.30], [103.93, 1.36]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Pasir Ris", area: "East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [104.02, 1.40], [104.10, 1.42], [104.10, 1.35], [104.02, 1.35], [104.02, 1.40]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Jurong West", area: "West" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.6, 1.35], [103.75, 1.37], [103.75, 1.30], [103.6, 1.30], [103.6, 1.35]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Jurong East", area: "West" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.73, 1.33], [103.85, 1.35], [103.85, 1.28], [103.73, 1.28], [103.73, 1.33]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Clementi", area: "West" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.76, 1.31], [103.83, 1.32], [103.83, 1.25], [103.76, 1.25], [103.76, 1.31]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Queenstown", area: "Central" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.79, 1.30], [103.85, 1.31], [103.85, 1.25], [103.79, 1.25], [103.79, 1.30]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Bukit Merah", area: "Central" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.80, 1.28], [103.88, 1.30], [103.88, 1.23], [103.80, 1.23], [103.80, 1.28]
        ]]
      }
    }
  ]
};

export type PlanningArea = typeof singaporeGeoJSON.features[0];
