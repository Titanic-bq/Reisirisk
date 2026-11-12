import { CAUTION, PROFILES } from "./profiles.js";
import { NAMES_ET } from "./names-et.js";
import { countryName } from "./countries.js";

const BUDGETS = {
  saastlik: "säästlik",
  keskmine: "keskmine",
  mugav: "mugav",
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function favorWord(score) {
  if (score <= 2) return "soodne";
  if (score === 3) return "keskmine";
  return "ebasoodne";
}

function meter(score, label) {
  const bars = [1, 2, 3, 4, 5]
    .map((step) => `<i class="${step <= score ? "on" : ""}"></i>`)
    .join("");
  return `<div class="meter" data-score="${score}" role="img" aria-label="${esc(label)}: ${score} viiest, ${favorWord(score)}">${bars}<span>${favorWord(score)}</span></div>`;
}

function peopleLabel(adults, children) {
  const adultsText = adults === 1 ? "1 täiskasvanu" : `${adults} täiskasvanut`;
  const childrenText =
    children === 0 ? "lapsi pole" : children === 1 ? "1 laps" : `${children} last`;
  return `${adultsText}, ${childrenText}`;
}

function assess(profile, group) {
  const costWeight = group.budget === "saastlik" ? 0.95 : group.budget === "mugav" ? 0.2 : 0.45;
  const healthWeight = group.children > 0 ? 0.85 : 0.3;
  const penalty =
    (profile.safety - 1) * 1.35 +
    (profile.theft - 1) * 0.35 +
    (profile.health - 1) * healthWeight +
    (profile.cost - 1) * costWeight +
    (profile.traffic - 1) * 0.28 +
    (profile.flights - 1) * 0.38 +
    (profile.tourism - 1) * 0.15;

  let tone = "good";
  let title = "Grupile soodne valik";
  if (penalty >= 7.4) {
    tone = "bad";
    title = "Riskid on selle grupi jaoks suured";
  } else if (penalty >= 4.4) {
    tone = "mid";
    title = "Tehtav, kui vaatad riskid läbi";
  }

  const notes = [profile.group];
  if (group.children > 0 && profile.family) notes.push(profile.family);
  if (profile.safety >= 4) notes.unshift("Turvalisus vajab enne broneerimist eraldi kontrolli.");
  if (group.budget === "saastlik" && profile.cost >= 4) {
    notes.push("Säästliku eelarve jaoks on hinnatase kõrge.");
  }
  if (group.budget === "mugav" && profile.cost <= 2) {
    notes.push("Sellest eelarvest jätkub siin ka lisategevusteks.");
  }
  if (profile.flights >= 4) notes.push("Kohalejõudmine on pikk või ühendused haprad.");

  return { tone, title, notes: notes.slice(0, 4) };
}

function weatherPhrase(code) {
  if (code === 0) return "selge";
  if (code <= 3) return "pilvine";
  if (code === 45 || code === 48) return "udu";
  if (code <= 57) return "uduvihm";
  if (code <= 67) return "vihm";
  if (code <= 77) return "lumi";
  if (code <= 82) return "hoogvihm";
  if (code <= 86) return "lumesadu";
  if (code >= 95) return "äike";
  return "muutlik";
}

function formatDay(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("et-EE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatCoord(lat, lng) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lng).toFixed(2)}° ${ew}`;
}

function weatherBlock(status, weather) {
  if (status === "loading") return `<p class="live">Laen valitud positsiooni ilma…</p>`;
  if (status !== "ready" || !weather?.current) {
    return `<p class="live">Kukkumispunkti ilma ei õnnestunud praegu laadida.</p>`;
  }

  const current = weather.current;
  const days = weather.daily.time
    .slice(0, 3)
    .map((date, index) => {
      const max = Math.round(weather.daily.temperature_2m_max[index]);
      const min = Math.round(weather.daily.temperature_2m_min[index]);
      const rain = Math.round(weather.daily.precipitation_sum[index]);
      const sky = weatherPhrase(weather.daily.weather_code[index]);
      return `<div><span>${esc(formatDay(date))}</span><strong>${max}° / ${min}°</strong><em>${esc(sky)} · ${rain} mm</em></div>`;
    })
    .join("");

  return `
    <div class="live-card">
      <p class="tag">Otseandmed · valitud positsioon</p>
      <p class="now">${Math.round(current.temperature_2m)}°, ${esc(weatherPhrase(current.weather_code))}, tuul ${Number(current.wind_speed_10m).toFixed(0)} m/s</p>
      <div class="days">${days}</div>
    </div>
  `;
}

function chips() {
  return Object.keys(PROFILES)
    .sort((a, b) => NAMES_ET[a].localeCompare(NAMES_ET[b], "et"))
    .map(
      (iso2) =>
        `<button type="button" data-iso="${iso2}">${esc(NAMES_ET[iso2])}</button>`,
    )
    .join("");
}

function section(title, score, label, body) {
  return `
    <section class="block">
      <div class="block-head">
        <h3>${esc(title)}</h3>
        ${score == null ? "" : meter(score, label)}
      </div>
      ${body}
    </section>
  `;
}

function profileView(place, group, weatherStatus, weather) {
  const profile = PROFILES[place.iso2];
  const verdict = assess(profile, group);
  const alternatives = profile.alternatives
    .map(
      (item) => `
        <button type="button" class="alt" data-iso="${item.iso2}">
          <strong>${esc(NAMES_ET[item.iso2])}</strong>
          <span>${esc(item.why)}</span>
        </button>
      `,
    )
    .join("");
  const notes = verdict.notes.map((note) => `<li>${esc(note)}</li>`).join("");
  const alerts = profile.alerts.map((alert) => `<li>${esc(alert)}</li>`).join("");
  const alertIntro = group.booked
    ? "Reis on märgitud broneerituks. Need on näidisteated, mida süsteem sellises olukorras saadaks."
    : "Enne broneerimist on need võimalikud teated, mitte saadetud hoiatused. Märgi reis broneerituks, kui tahad neid esile tõsta.";

  return `
    <p class="coords">Positsioon: ${esc(formatCoord(place.lat, place.lng))}. Riskid on kogu riigi näidis, ilm on selle punkti oma.</p>
    <article class="verdict ${verdict.tone}">
      <p class="tag">Grupi hinnang</p>
      <h3>${esc(verdict.title)}</h3>
      <p>${esc(peopleLabel(group.adults, group.children))}, ${esc(BUDGETS[group.budget])} eelarve. Lähtekoht Tallinn.</p>
      <ul>${notes}</ul>
    </article>
    ${section(
      "Turvalisus ja geopoliitika",
      profile.safety,
      "Turvalisus",
      `<p>${esc(profile.safetyText)}</p><p>${esc(profile.geopolitics)}</p>`,
    )}
    ${section(
      "Lennud, streigid ja transport",
      profile.flights,
      "Lennud ja transport",
      `<p>${esc(profile.flightsText)}</p><p>${esc(profile.strikes)}</p><p class="access">${esc(profile.access)}</p>`,
    )}
    ${section(
      "Ilm, loodus ja hooaeg",
      null,
      "",
      `<p class="tag">Näidis · november</p><p>${esc(profile.season)}</p><p>${esc(profile.disasters)}</p>${weatherBlock(weatherStatus, weather)}`,
    )}
    ${section(
      "Liiklus, teetööd ja kestus",
      profile.traffic,
      "Liiklus ja teekond",
      `<p>${esc(profile.trafficText)}</p>`,
    )}
    ${section(
      "Hinnatase ja turismikoormus",
      null,
      "",
      `<div class="pair"><div><p>Hinnatase</p>${meter(profile.cost, "Hinnatase")}</div><div><p>Turismikoormus</p>${meter(profile.tourism, "Turismikoormus")}</div></div><p>${esc(profile.costText)}</p>`,
    )}
    ${section(
      "Tervis, vargus ja kindlustus",
      null,
      "",
      `<div class="pair"><div><p>Tervis</p>${meter(profile.health, "Tervis")}</div><div><p>Vargus</p>${meter(profile.theft, "Vargus")}</div></div><p>${esc(profile.healthText)}</p><p>${esc(profile.theftText)}</p><p>${esc(profile.insurance)}</p>`,
    )}
    <section class="block">
      <div class="block-head"><h3>Alternatiivid grupile</h3></div>
      <div class="alts">${alternatives}</div>
    </section>
    <section class="block">
      <div class="block-head"><h3>${group.booked ? "Aktiivsed teated" : "Teated pärast broneerimist"}</h3></div>
      <p>${esc(alertIntro)}</p>
      <ul class="alerts ${group.booked ? "is-live" : ""}">${alerts}</ul>
    </section>
  `;
}

export function renderBriefing(elements, state) {
  const { title, eyebrow, briefing, status } = elements;
  const { place, group, weatherStatus, weather } = state;

  if (!place) {
    eyebrow.textContent = "Enne reisi";
    title.textContent = "Vali sihtkoht positsiooniga";
    briefing.innerHTML = `
      <div class="empty">
        <p>Lohista kaarti hiire või sõrmega ja suumi kerimisrattaga või kahe sõrmega. Sihtkoha valimiseks klõpsa või puuduta kaarti, või lohista positsioon soovitud kohta.</p>
        <p>Vaade on peredele ja gruppidele: turvalisus, kulud, transport, ilm ja varuvariant ühes kohas.</p>
        <h3>Näidisprofiiliga riigid</h3>
        <div class="chips">${chips()}</div>
      </div>
    `;
    return;
  }

  if (place.kind === "ocean") {
    eyebrow.textContent = "Asukoht";
    title.textContent = "Meri";
    if (state.announced !== "meri") {
      status.textContent = "Positsioon asub merel. Riigi andmeid ei ole.";
      state.announced = "meri";
    }
    briefing.innerHTML = `
      <div class="empty">
        <p>Positsioon asub merel, kohas ${esc(formatCoord(place.lat, place.lng))}. Vali maismaa, et avada riigi ülevaade.</p>
        ${weatherBlock(weatherStatus, weather)}
      </div>
    `;
    return;
  }

  const name = countryName(place.iso2, place.english);
  eyebrow.textContent = place.profile ? "Näidisprofiil" : "Riik";
  title.textContent = name;
  if (state.announced !== place.iso2) {
    status.textContent = `${name}. Riigi andmed on paneelis.`;
    state.announced = place.iso2;
  }

  if (!place.profile) {
    const caution = place.iso2 ? CAUTION[place.iso2] : "";
    briefing.innerHTML = `
      <div class="empty">
        ${caution ? `<p class="caution">${esc(caution)}</p>` : ""}
        <p class="coords">Positsioon: ${esc(formatCoord(place.lat, place.lng))}.</p>
        <p>${esc(name)} on kaardil olemas. Täielik näidisprofiil on ainult osal riikidest, ilm on ikka selle punkti kohta.</p>
        ${weatherBlock(weatherStatus, weather)}
        <h3>Ava täisprofiil</h3>
        <div class="chips">${chips()}</div>
      </div>
    `;
    return;
  }

  briefing.innerHTML = profileView(place, group, weatherStatus, weather);
}
