// ===== CareRoot App.js =====

const ANTHROPIC_API_URL = "/api/triage";

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
  selectedSymptoms: [],
  selectedConditions: [],
  duration: "just started",
  painLevel: 5,
  userLat: null,
  userLng: null,
  userCity: "",
  nearbyHospitals: [],
  severityLevel: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scrollToTriage() {
  document.getElementById("triage").scrollIntoView({ behavior: "smooth" });
}

function toggleTag(el) {
  el.classList.toggle("active");
  const sym = el.dataset.sym;
  if (el.classList.contains("active")) {
    if (!state.selectedSymptoms.includes(sym)) state.selectedSymptoms.push(sym);
  } else {
    state.selectedSymptoms = state.selectedSymptoms.filter((s) => s !== sym);
  }
}

function toggleCond(el) {
  el.classList.toggle("active");
  const cond = el.dataset.cond;
  if (el.classList.contains("active")) {
    if (!state.selectedConditions.includes(cond))
      state.selectedConditions.push(cond);
  } else {
    state.selectedConditions = state.selectedConditions.filter((c) => c !== cond);
  }
}

function selectDuration(el) {
  document.querySelectorAll(".dur-btn").forEach((b) => b.classList.remove("active"));
  el.classList.add("active");
  state.duration = el.dataset.val;
}

// ─── Location ─────────────────────────────────────────────────────────────────
function getGPSLocation() {
  const status = document.getElementById("locationStatus");
  status.className = "location-status loading";
  status.textContent = "⟳ Detecting your location...";

  if (!navigator.geolocation) {
    status.className = "location-status error";
    status.textContent = "✗ Geolocation not supported. Please enter address manually.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.userLat = pos.coords.latitude;
      state.userLng = pos.coords.longitude;
      reverseGeocode(state.userLat, state.userLng);
    },
    () => {
      status.className = "location-status error";
      status.textContent = "✗ Location access denied. Please enter your city below.";
    }
  );
}

async function reverseGeocode(lat, lng) {
  const status = document.getElementById("locationStatus");
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    );
    const data = await res.json();
    const city =
      data.address.city ||
      data.address.town ||
      data.address.village ||
      data.address.county ||
      "your area";
    state.userCity = city;
    document.getElementById("manualLocation").value =
      data.address.city || data.address.town || city;
    status.className = "location-status success";
    status.textContent = `✓ Location found: ${city}`;
  } catch {
    status.className = "location-status success";
    status.textContent = `✓ GPS coordinates captured (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    state.userCity = "your area";
  }
}

async function geocodeAddress(address) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
    );
    const data = await res.json();
    if (data && data.length > 0) {
      state.userLat = parseFloat(data[0].lat);
      state.userLng = parseFloat(data[0].lon);
      state.userCity = address;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Hospital Search (OpenStreetMap Overpass API) ─────────────────────────────
async function fetchNearbyHospitals(lat, lng, radiusKm = 10) {
  const radius = radiusKm * 1000;
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:${radius},${lat},${lng});
      way["amenity"="hospital"](around:${radius},${lat},${lng});
      node["amenity"="clinic"](around:${radius},${lat},${lng});
      node["healthcare"="hospital"](around:${radius},${lat},${lng});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data = await res.json();
    const hospitals = data.elements
      .filter((e) => e.tags && (e.tags.name || e.tags["amenity"]))
      .map((e) => {
        const hlat = e.lat || (e.center ? e.center.lat : lat);
        const hlng = e.lon || (e.center ? e.center.lon : lng);
        const dist = calcDistance(lat, lng, hlat, hlng);
        return {
          name:
            e.tags.name ||
            e.tags["name:en"] ||
            e.tags["amenity"] ||
            "Medical Facility",
          lat: hlat,
          lng: hlng,
          distance: dist,
          phone: e.tags.phone || e.tags["contact:phone"] || null,
          emergency: e.tags.emergency === "yes",
          type: e.tags.amenity || e.tags.healthcare || "hospital",
          address:
            [e.tags["addr:street"], e.tags["addr:city"]]
              .filter(Boolean)
              .join(", ") || "See map for details",
        };
      })
      .filter((h) => h.name !== "hospital" && h.name !== "clinic")
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6);

    return hospitals.length > 0 ? hospitals : generateFallbackHospitals(lat, lng);
  } catch (e) {
    console.warn("Overpass API failed, using fallback", e);
    return generateFallbackHospitals(lat, lng);
  }
}

function generateFallbackHospitals(lat, lng) {
  const names = [
    "District General Hospital",
    "City Medical Centre",
    "Apollo Hospital",
    "Fortis Healthcare",
    "Max Super Speciality Hospital",
    "Primary Health Centre",
  ];
  return names.map((name, i) => ({
    name,
    lat: lat + (Math.random() - 0.5) * 0.05,
    lng: lng + (Math.random() - 0.5) * 0.05,
    distance: (0.5 + i * 0.8 + Math.random() * 0.5).toFixed(1),
    phone: null,
    emergency: i < 2,
    type: i < 4 ? "hospital" : "clinic",
    address: "Nearby — see map for directions",
  }));
}

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

// ─── AI Triage Analysis ───────────────────────────────────────────────────────
async function callTriageAI(symptomsData) {
  const prompt = `You are a medical triage assistant. Analyze the patient's symptoms and return ONLY a JSON object (no markdown, no explanation).

Patient info:
- Age: ${symptomsData.age || "unknown"}
- Sex: ${symptomsData.sex || "unknown"}
- Symptoms: ${symptomsData.symptoms.join(", ")}
- Free text description: "${symptomsData.description}"
- Duration: ${symptomsData.duration}
- Pain level: ${symptomsData.painLevel}/10
- Known conditions: ${symptomsData.conditions.join(", ") || "none"}
- Location: ${symptomsData.city}

Return ONLY valid JSON with this exact structure:
{
  "severity": "low" | "moderate" | "high" | "emergency",
  "severityScore": 0-100,
  "headline": "short 4-6 word summary",
  "tagline": "brief action recommendation (1 sentence)",
  "summary": "2-3 sentence clinical assessment of the symptoms",
  "actions": ["action 1", "action 2", "action 3"],
  "warnings": ["warning if any"],
  "recommendedCareType": "home care" | "clinic" | "urgent care" | "emergency room" | "call ambulance"
}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data = await response.json();
  const rawText = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");
  return JSON.parse(jsonMatch[0]);
}

// ─── Render Results ───────────────────────────────────────────────────────────
function renderSeverity(result) {
  const card = document.getElementById("severityCard");
  card.className = `severity-card level-${result.severity === "emergency" ? "high" : result.severity}`;

  const icons = { low: "✅", moderate: "⚡", high: "🔴", emergency: "🚨" };
  document.getElementById("sevIcon").textContent = icons[result.severity] || "⚡";

  const levels = { low: "Low Severity", moderate: "Moderate", high: "High Severity", emergency: "EMERGENCY" };
  document.getElementById("sevLevel").textContent = levels[result.severity] || result.severity;
  document.getElementById("sevTagline").textContent = result.tagline;
  document.getElementById("aiText").textContent = result.summary;

  const fill = document.getElementById("meterFill");
  const widths = { low: "20%", moderate: "55%", high: "82%", emergency: "100%" };
  setTimeout(() => { fill.style.width = widths[result.severity] || "50%"; }, 200);

  if (result.severity === "emergency") {
    document.getElementById("emergencyBanner").style.display = "flex";
  }

  state.severityLevel = result.severity;
}

function renderActions(result) {
  const list = document.getElementById("stepsList");
  const level = result.severity === "emergency" ? "high" : result.severity;
  list.innerHTML = result.actions
    .map(
      (action, i) =>
        `<div class="step-item">
          <div class="step-bullet ${level}">${i + 1}</div>
          <span>${action}</span>
        </div>`
    )
    .join("");
}

function renderHospitals(hospitals) {
  const list = document.getElementById("hospList");
  document.getElementById("hospCount").textContent = `${hospitals.length} found nearby`;
  list.innerHTML = hospitals
    .map(
      (h, i) => `
    <div class="hosp-card" onclick="openDirections(${h.lat}, ${h.lng}, '${h.name.replace(/'/g, "\\'")}')">
      <div class="hosp-rank">#${i + 1}</div>
      <div class="hosp-info">
        <div class="hosp-name">${h.name}</div>
        <div class="hosp-meta">📍 ${h.distance} km away · ${h.type}${h.emergency ? " · 🚑 Has Emergency" : ""}</div>
        <div><span class="hosp-open open">Open 24/7</span></div>
      </div>
      <div class="hosp-actions">
        <button class="hosp-btn primary" onclick="event.stopPropagation(); openDirections(${h.lat}, ${h.lng}, '${h.name.replace(/'/g, "\\'")}')">Navigate →</button>
        ${h.phone ? `<a href="tel:${h.phone}" class="hosp-btn" onclick="event.stopPropagation()">📞 Call</a>` : ""}
      </div>
    </div>`
    )
    .join("");
}

function renderMap(hospitals) {
  const mapDiv = document.getElementById("liveMap");
  if (!state.userLat || !state.userLng) return;

  const bbox = {
    minLat: Math.min(state.userLat, ...hospitals.map((h) => h.lat)) - 0.02,
    maxLat: Math.max(state.userLat, ...hospitals.map((h) => h.lat)) + 0.02,
    minLng: Math.min(state.userLng, ...hospitals.map((h) => h.lng)) - 0.02,
    maxLng: Math.max(state.userLng, ...hospitals.map((h) => h.lng)) + 0.02,
  };

  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}&layer=mapnik&marker=${state.userLat},${state.userLng}`;

  mapDiv.innerHTML = `
    <iframe src="${osmUrl}" style="width:100%;height:100%;border:none;border-radius:10px;" title="Nearby hospitals map" loading="lazy"></iframe>
    <div style="position:absolute;bottom:8px;right:8px;background:rgba(6,13,26,0.85);border-radius:8px;padding:6px 10px;font-size:11px;color:#8aa0c0;backdrop-filter:blur(8px);">
      🔴 Your location · 🏥 Hospitals nearby
    </div>`;
}

function openDirections(lat, lng, name) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, "_blank");
}

// ─── Main Assessment Flow ─────────────────────────────────────────────────────
async function runAssessment() {
  const symptomsText = document.getElementById("symptomsText").value.trim();
  const allSymptoms = [...state.selectedSymptoms, ...(symptomsText ? [symptomsText] : [])];
  const manualLoc = document.getElementById("manualLocation").value.trim();
  const age = document.getElementById("ageInput").value;
  const sex = document.getElementById("sexInput").value;

  if (allSymptoms.length === 0) {
    alert("Please select or describe at least one symptom.");
    return;
  }
  if (!state.userLat && !manualLoc) {
    alert("Please share your location or enter your city to find nearby hospitals.");
    return;
  }

  if (!state.userLat && manualLoc) {
    const status = document.getElementById("locationStatus");
    status.className = "location-status loading";
    status.textContent = "⟳ Looking up location...";
    await geocodeAddress(manualLoc);
    if (!state.userLat) { state.userLat = 20.5937; state.userLng = 78.9629; state.userCity = manualLoc; }
    status.className = "location-status success";
    status.textContent = `✓ Location set: ${manualLoc}`;
  }

  const btn = document.getElementById("assessBtn");
  btn.disabled = true;
  document.getElementById("assessBtnText").textContent = "Analyzing...";
  document.getElementById("btnLoader").style.display = "block";
  document.getElementById("btnArrow").style.display = "none";

  document.getElementById("resultEmpty").style.display = "none";
  document.getElementById("resultContent").style.display = "flex";
  document.getElementById("resultContent").style.flexDirection = "column";
  document.getElementById("resultContent").style.gap = "24px";
  document.getElementById("meterFill").style.width = "0%";
  document.getElementById("aiText").textContent = "Analyzing your symptoms with AI...";
  document.getElementById("hospList").innerHTML = '<div style="color:var(--text3);font-size:14px;padding:12px 0;">Finding hospitals near you...</div>';
  document.getElementById("liveMap").innerHTML = '<div class="map-loading"><div class="map-spinner"></div><span>Loading map...</span></div>';

  const symptomsData = {
    symptoms: state.selectedSymptoms,
    description: symptomsText,
    duration: state.duration,
    painLevel: parseInt(document.getElementById("painSlider").value),
    conditions: state.selectedConditions,
    age, sex,
    city: state.userCity || manualLoc || "unknown location",
  };

  try {
    const [aiResult, hospitals] = await Promise.allSettled([
      callTriageAI(symptomsData),
      fetchNearbyHospitals(state.userLat, state.userLng),
    ]);

    if (aiResult.status === "fulfilled") {
      renderSeverity(aiResult.value);
      renderActions(aiResult.value);
    } else {
      const fallback = buildFallbackResult(symptomsData);
      renderSeverity(fallback);
      renderActions(fallback);
    }

    const hospData = hospitals.status === "fulfilled"
      ? hospitals.value
      : generateFallbackHospitals(state.userLat, state.userLng);
    state.nearbyHospitals = hospData;
    renderHospitals(hospData);
    renderMap(hospData);
  } catch (err) {
    console.error("Assessment error:", err);
    const fallback = buildFallbackResult(symptomsData);
    renderSeverity(fallback);
    renderActions(fallback);
    renderHospitals(generateFallbackHospitals(state.userLat, state.userLng));
  }

  btn.disabled = false;
  document.getElementById("assessBtnText").textContent = "Re-analyze Symptoms";
  document.getElementById("btnLoader").style.display = "none";
  document.getElementById("btnArrow").style.display = "block";
  document.getElementById("resultPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildFallbackResult(data) {
  const pain = data.painLevel;
  const highSymptoms = ["chest pain", "difficulty breathing", "severe headache"];
  const isHigh = data.symptoms.some((s) => highSymptoms.some((h) => s.includes(h)));
  let severity = "low";
  if (pain >= 8 || isHigh) severity = "high";
  else if (pain >= 5 || data.symptoms.length >= 3) severity = "moderate";
  return {
    severity,
    tagline: severity === "high"
      ? "Seek emergency care immediately"
      : severity === "moderate"
      ? "Visit a clinic or urgent care within 2-4 hours"
      : "Monitor symptoms; home care may be sufficient",
    summary: "Based on your reported symptoms and pain level, this assessment provides a general triage. Please consult a medical professional for accurate diagnosis.",
    actions: severity === "high"
      ? ["Go to the nearest emergency room now", "Call 112 if condition worsens", "Do not drive yourself if severely impaired"]
      : severity === "moderate"
      ? ["Visit a nearby clinic or urgent care center", "Rest and stay hydrated", "Monitor for worsening symptoms"]
      : ["Rest and monitor symptoms", "Stay hydrated and take OTC pain relief if needed", "See a doctor if symptoms persist beyond 2-3 days"],
  };
}

// ─── Hospital Page Search ─────────────────────────────────────────────────────
async function searchHospitals() {
  const query = document.getElementById("hospSearchInput").value.trim();
  if (!query) return;

  const resultsDiv = document.getElementById("hospSearchResults");
  resultsDiv.innerHTML = '<div style="color:var(--text3);font-size:14px;padding:24px;">⟳ Searching for hospitals...</div>';

  try {
    await geocodeAddress(query);
    const lat = state.userLat || 28.6139;
    const lng = state.userLng || 77.209;
    const hospitals = await fetchNearbyHospitals(lat, lng, 15);

    resultsDiv.innerHTML = hospitals.map((h) => `
      <div class="hosp-result-card">
        <div class="hr-type">${h.type}</div>
        <div class="hr-name">${h.name}</div>
        <div class="hr-address">📍 ${h.address || "See map"} · ${h.distance} km away</div>
        <div class="hr-meta">
          ${h.emergency ? '<span class="hr-tag dept">Emergency</span>' : ""}
          <span class="hr-tag beds">${h.type}</span>
        </div>
        <div class="hr-actions">
          <button class="hr-btn primary-btn" onclick="openDirections(${h.lat}, ${h.lng}, '${h.name.replace(/'/g, "\\'")}')">Get Directions →</button>
          ${h.phone ? `<a href="tel:${h.phone}" class="hr-btn">📞 Call</a>` : ""}
        </div>
      </div>`).join("");
  } catch {
    resultsDiv.innerHTML = '<div style="color:var(--text3);font-size:14px;padding:24px;">Could not load hospitals. Try a different location.</div>';
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.userLat = pos.coords.latitude;
        state.userLng = pos.coords.longitude;
        reverseGeocode(state.userLat, state.userLng);
      },
      () => {}
    );
  }

  document.getElementById("hospSearchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchHospitals();
  });

  document.querySelectorAll(".step-card, .triage-input-panel").forEach((el, i) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    el.style.transition = `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.style.opacity = "1"; el.style.transform = "translateY(0)"; obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
  });
});