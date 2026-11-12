import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import { locateCountry, wrapLng } from "./geo.js";
import { byNumeric } from "./countries.js";
import { PROFILES } from "./profiles.js";
import { renderBriefing } from "./panel.js";

const POSITION_SVG = `
<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="30" fill="#f4efe6" stroke="#c45512" stroke-width="3"/>
  <circle cx="32" cy="32" r="23" fill="none" stroke="#e4d3b8" stroke-width="2"/>
  <path d="M32 8.5v6M32 49.5v6M8.5 32h6M49.5 32h6" stroke="#c45512" stroke-width="2" stroke-linecap="round"/>
  <circle cx="32" cy="25" r="5.2" fill="#1c1915"/>
  <path d="M22.2 47c1.1-8.2 4.8-12.2 9.8-12.2s8.7 4 9.8 12.2" fill="#1c1915"/>
</svg>`;

const HOME = { lat: 54, lng: 15, zoom: 4 };
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const position = document.querySelector("#position");
const ghost = document.querySelector("#ghost");
const hoverTag = document.querySelector("#hover-tag");
const dockHelp = document.querySelector("#dock-help");
const positionSlot = document.querySelector(".position-slot");
const briefing = document.querySelector("#briefing");
const title = document.querySelector("#panel-title");
const eyebrow = document.querySelector(".panel-head .eyebrow");
const status = document.querySelector("#status");
const groupForm = document.querySelector("#group");
const bookedInput = document.querySelector("#booked");
const welcome = document.querySelector("#welcome");
const themeToggle = document.querySelector("#theme-toggle");

position.innerHTML = POSITION_SVG;
ghost.innerHTML = POSITION_SVG;

const map = L.map("map", {
  zoomControl: false,
  dragging: true,
  scrollWheelZoom: true,
  doubleClickZoom: true,
  boxZoom: false,
  keyboard: true,
  touchZoom: true,
  worldCopyJump: true,
  minZoom: 2,
  maxZoom: 19,
  zoomSnap: 0.25,
}).setView([HOME.lat, HOME.lng], HOME.zoom);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  subdomains: "abc",
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
}).addTo(map);
L.control.zoom({
  position: "bottomleft",
  zoomInTitle: "Suurenda kaarti",
  zoomOutTitle: "Vähenda kaarti",
}).addTo(map);

function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Lülita heledale kujundusele" : "Lülita tumedale kujundusele",
  );
  themeToggle.querySelector(".theme-label").textContent = isDark
    ? "Hele vaade"
    : "Tume vaade";
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀" : "◐";
}

setTheme("light");
L.control.scale({ imperial: false, metric: true, position: "bottomleft" }).addTo(map);

const state = {
  place: null,
  group: readGroup(),
  weather: null,
  weatherStatus: "idle",
  announced: "",
};

let marker = null;
let highlight = null;
let committedFeature = null;
let weatherRequest = 0;
let drag = null;

function readGroup() {
  const adults = Number(document.querySelector("#adults").value);
  const children = Number(document.querySelector("#children").value);
  return {
    adults: Number.isFinite(adults) ? Math.min(12, Math.max(1, adults)) : 2,
    children: Number.isFinite(children) ? Math.min(10, Math.max(0, children)) : 0,
    budget: groupForm.querySelector("input[name=budget]:checked").value,
    booked: bookedInput.checked,
  };
}

function render() {
  state.group = readGroup();
  renderBriefing({ title, eyebrow, briefing, status }, state);
}

function setHighlight(feature) {
  if (highlight) {
    highlight.remove();
    highlight = null;
  }
  if (!feature) return;
  highlight = L.geoJSON(feature, {
    style: {
      color: "#c45512",
      weight: 2,
      fillColor: "#e39a45",
      fillOpacity: 0.28,
    },
  }).addTo(map);
}

function placeTag(x, y, text) {
  hoverTag.hidden = false;
  hoverTag.textContent = text;
  const left = x > window.innerWidth - 230 ? x - 188 : x + 16;
  hoverTag.style.left = `${left}px`;
  hoverTag.style.top = `${y + 18}px`;
}

function hideTag() {
  hoverTag.hidden = true;
}

function describeHit(hit) {
  if (!hit) return "Meri — siin pole riiki";
  const meta = byNumeric.get(hit.id);
  if (!meta) return "Määramata ala";
  return meta.iso2 && PROFILES[meta.iso2]
    ? `${meta.english ? countryLabel(meta) : meta.iso2}`
    : countryLabel(meta);
}

function countryLabel(meta) {
  const profileName = meta.iso2 && PROFILES[meta.iso2] ? null : null;
  void profileName;
  return new Intl.DisplayNames ? labelFromMeta(meta) : meta.english;
}

function labelFromMeta(meta) {
  const names = {
    importName: null,
  };
  void names;
  return window.__countryName(meta.iso2, meta.english);
}

function positionIcon() {
  return L.divIcon({
    className: "position-marker",
    html: POSITION_SVG,
    iconSize: [64, 64],
    iconAnchor: [32, 32],
  });
}

function ensureMarker(lat, lng) {
  if (!marker) {
    marker = L.marker([lat, lng], {
      icon: positionIcon(),
      draggable: true,
      autoPan: false,
      zIndexOffset: 800,
    }).addTo(map);
    marker.on("drag", () => {
      const latlng = marker.getLatLng();
      previewLatLng(latlng.lat, wrapLng(latlng.lng));
    });
    marker.on("dragend", () => {
      hideTag();
      const latlng = marker.getLatLng();
      selectLatLng(L.latLng(latlng.lat, wrapLng(latlng.lng)));
    });
  } else {
    marker.setLatLng([lat, lng]);
  }
  positionSlot.classList.add("is-placed");
  dockHelp.textContent = "Lohista positsioon uuesti või liiguta seda kaardil";
}

function previewLatLng(lat, lng) {
  const hit = locateCountry(lng, lat);
  setHighlight(hit ? hit.feature : null);
  const point = map.latLngToContainerPoint([lat, lng]);
  const rect = map.getContainer().getBoundingClientRect();
  placeTag(rect.left + point.x, rect.top + point.y, describeHit(hit));
}

async function loadWeather(lat, lng) {
  const requestId = ++weatherRequest;
  state.weatherStatus = "loading";
  state.weather = null;
  render();
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toFixed(4));
    url.searchParams.set("longitude", lng.toFixed(4));
    url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum");
    url.searchParams.set("forecast_days", "3");
    url.searchParams.set("timezone", "auto");
    const response = await fetch(url);
    if (!response.ok) throw new Error("weather");
    const data = await response.json();
    if (requestId !== weatherRequest) return;
    state.weather = data;
    state.weatherStatus = "ready";
  } catch {
    if (requestId !== weatherRequest) return;
    state.weather = null;
    state.weatherStatus = "error";
  }
  render();
}

function selectLatLng(latlng, { fly = false, zoom } = {}) {
  const lat = latlng.lat;
  const lng = wrapLng(latlng.lng);
  ensureMarker(lat, lng);
  if (fly) {
    map.flyTo([lat, lng], zoom ?? Math.max(map.getZoom(), 5), {
      duration: reduceMotion ? 0 : 0.75,
    });
  }

  const hit = locateCountry(lng, lat);
  committedFeature = hit ? hit.feature : null;
  setHighlight(committedFeature);

  if (!hit) {
    state.place = { kind: "ocean", lat, lng };
  } else {
    const meta = byNumeric.get(hit.id);
    const iso2 = meta?.iso2 ?? null;
    state.place = {
      kind: "country",
      lat,
      lng,
      iso2,
      english: meta?.english ?? null,
      profile: iso2 ? Boolean(PROFILES[iso2]) : false,
    };
  }

  loadWeather(lat, lng);
}

map.on("click", (event) => selectLatLng(event.latlng));

function latLngFromClient(x, y) {
  const rect = map.getContainer().getBoundingClientRect();
  return map.containerPointToLatLng([x - rect.left, y - rect.top]);
}

function previewFromClient(x, y) {
  const top = document.elementFromPoint(x, y);
  if (!top || !top.closest("#map")) {
    hideTag();
    setHighlight(committedFeature);
    return;
  }
  const latlng = latLngFromClient(x, y);
  const hit = locateCountry(wrapLng(latlng.lng), latlng.lat);
  setHighlight(hit ? hit.feature : null);
  placeTag(x, y, describeHit(hit));
}

position.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  position.setPointerCapture(event.pointerId);
  drag = { x: event.clientX, y: event.clientY, moved: false };
  document.body.classList.add("is-dragging");
});

position.addEventListener("pointermove", (event) => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
  drag.moved = true;
  ghost.hidden = false;
  ghost.style.left = `${event.clientX}px`;
  ghost.style.top = `${event.clientY}px`;
  previewFromClient(event.clientX, event.clientY);
});

function endDrag(event) {
  if (!drag) return;
  const moved = drag.moved;
  drag = null;
  document.body.classList.remove("is-dragging");
  ghost.hidden = true;
  hideTag();
  if (!moved) {
    setHighlight(committedFeature);
    return;
  }
  const top = document.elementFromPoint(event.clientX, event.clientY);
  if (!top || !top.closest("#map")) {
    setHighlight(committedFeature);
    return;
  }
  selectLatLng(latLngFromClient(event.clientX, event.clientY));
}

position.addEventListener("pointerup", endDrag);
position.addEventListener("pointercancel", endDrag);

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

document.querySelector("#begin-trip").addEventListener("click", () => {
  welcome.hidden = true;
  requestAnimationFrame(() => {
    map.invalidateSize();
    map.getContainer().focus();
  });
});

groupForm.addEventListener("submit", (event) => event.preventDefault());
groupForm.addEventListener("input", render);
bookedInput.addEventListener("change", render);
for (const input of groupForm.querySelectorAll('input[type="number"]')) {
  input.addEventListener("blur", () => {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    input.value = String(Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min);
    render();
  });
}

briefing.addEventListener("click", (event) => {
  const button = event.target.closest("[data-iso]");
  if (!button) return;
  const profile = PROFILES[button.dataset.iso];
  if (!profile) return;
  selectLatLng(L.latLng(profile.lat, profile.lng), { fly: true, zoom: profile.zoom });
});

import { countryName } from "./countries.js";
window.__countryName = countryName;

function countryLabelFixed(meta) {
  return countryName(meta.iso2, meta.english);
}

render();
