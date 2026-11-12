import { feature } from "topojson-client";
import { geoContains } from "d3-geo";
import atlas from "world-atlas/countries-50m.json";

function bboxOf(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const walk = (coords) => {
    if (typeof coords[0] === "number") {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    for (const part of coords) walk(part);
  };

  walk(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

export const countries = feature(atlas, atlas.objects.countries).features.map((item) => ({
  id: String(parseInt(item.id, 10)),
  feature: item,
  bbox: bboxOf(item.geometry),
}));

export function wrapLng(lng) {
  let value = lng;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

export function locateCountry(lng, lat) {
  const x = wrapLng(lng);
  for (const country of countries) {
    const [minX, minY, maxX, maxY] = country.bbox;
    if (x < minX || x > maxX || lat < minY || lat > maxY) continue;
    if (geoContains(country.feature, [x, lat])) return country;
  }
  return null;
}
