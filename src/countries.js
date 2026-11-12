import iso from "./iso.json";
import { NAMES_ET } from "./names-et.js";

const EXTRA = {
  383: { iso2: "XK", english: "Kosovo" },
};

export const byNumeric = new Map(
  iso.map((row) => [
    String(parseInt(row["country-code"], 10)),
    { iso2: row["alpha-2"], english: row.name },
  ]),
);

for (const [id, meta] of Object.entries(EXTRA)) {
  byNumeric.set(id, meta);
}

export function countryName(iso2, english) {
  if (iso2 && NAMES_ET[iso2]) return NAMES_ET[iso2];
  return english || "Määramata ala";
}
