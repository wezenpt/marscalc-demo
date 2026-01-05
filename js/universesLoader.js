// universesLoader.js – Carrega comunidades/universos (servers.json)
// e aplica config ao FlightCalc (speed, galaxias, donut, consumo deut)

(() => {
  "use strict";

  const COUNTRY_NAMES = {
    ar: "Argentina", br: "Brasil", cz: "Czech Republic", de: "Deutschland",
    dk: "Denmark", en: "United Kingdom", es: "España", fr: "France",
    gr: "Greece", hr: "Croatia", hu: "Hungary", it: "Italy",
    jp: "Japan", mx: "Mexico", nl: "Netherlands", pl: "Poland",
    pt: "Portugal", ro: "Romania", ru: "Russia", si: "Slovenia",
    sk: "Slovakia", tr: "Turkey", tw: "Taiwan", us: "United States"
  };

  const FLAGS = {
    ar: "🇦🇷", br: "🇧🇷", cz: "🇨🇿", de: "🇩🇪", dk: "🇩🇰", en: "🇬🇧",
    es: "🇪🇸", fr: "🇫🇷", gr: "🇬🇷", hr: "🇭🇷", hu: "🇭🇺", it: "🇮🇹",
    jp: "🇯🇵", mx: "🇲🇽", nl: "🇳🇱", pl: "🇵🇱", pt: "🇵🇹", ro: "🇷🇴",
    ru: "🇷🇺", si: "🇸🇮", sk: "🇸🇰", tr: "🇹🇷", tw: "🇹🇼", us: "🇺🇸"
  };

  let serversData = [];
  let communitiesData = {};
  const $ = id => document.getElementById(id);

  // ============================================================
  // CARREGAR servers.json
  // ============================================================

  async function loadServers() {
    try {
      const response = await fetch("servers.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      serversData = await response.json();
      processServers();
      populateCommunities();

      console.log(`[UniversesLoader] ${serversData.length} universos carregados.`);
    } catch (err) {
      console.error("[UniversesLoader] Erro ao carregar servers.json:", err);
    }
  }

  function processServers() {
    communitiesData = {};

    serversData.forEach(server => {
      const lang = server.language;

      if (!communitiesData[lang]) {
        communitiesData[lang] = {
          name: COUNTRY_NAMES[lang] || lang.toUpperCase(),
          flag: FLAGS[lang] || "🌍",
          universes: []
        };
      }

      communitiesData[lang].universes.push(server);
    });

    Object.keys(communitiesData).forEach(lang => {
      communitiesData[lang].universes.sort((a, b) => a.number - b.number);
    });
  }

  // ============================================================
  // POPULAR DROPDOWNS
  // ============================================================

  function populateCommunities() {
    const select = $("select-community");
    if (!select) return;

    select.innerHTML = '<option value="">Seleciona a comunidade</option>';

    const sorted = Object.keys(communitiesData).sort((a, b) =>
      communitiesData[a].name.localeCompare(communitiesData[b].name)
    );

    sorted.forEach(lang => {
      const c = communitiesData[lang];
      const opt = document.createElement("option");
      opt.value = lang;
      opt.textContent = `${c.flag} ${c.name}`;
      select.appendChild(opt);
    });

    select.addEventListener("change", onCommunityChange);
  }

  function onCommunityChange() {
    const selCom = $("select-community");
    const selUni = $("select-universe");
    if (!selCom || !selUni) return;

    selUni.innerHTML = '<option value="">Seleciona o universo</option>';

    const lang = selCom.value;
    if (!lang) {
      resetUniverseInfo();
      return;
    }

    const community = communitiesData[lang];
    if (!community) {
      resetUniverseInfo();
      return;
    }

    community.universes.forEach(u => {
      const opt = document.createElement("option");
      opt.value = JSON.stringify(u);

      let label = `${u.name} (Uni ${u.number})`;
      if (u.serverClosed === 1) label += " [FECHADO]";
      else if (u.settings?.serverLabel === "new") label += " 🆕"; // ✅ Corrigido: settings.serverLabel

      opt.textContent = label;
      selUni.appendChild(opt);
    });

    selUni.addEventListener("change", onUniverseChange);
  }

  function onUniverseChange() {
    const sel = $("select-universe");
    if (!sel || !sel.value) {
      resetUniverseInfo();
      return;
    }

    try {
      const universe = JSON.parse(sel.value);
      applyUniverseSettings(universe);
    } catch (e) {
      console.error("[UniversesLoader] Erro ao parsear universo:", e);
    }
  }

  // ============================================================
  // APLICAR CONFIG DO UNIVERSO AO FlightCalc
  // ============================================================

  function applyUniverseSettings(universe) {
    const s = universe.settings || {};

    const cfg = {
      // velocidades de frota (API OG)
      speedFleetPeaceful: s.fleetSpeedPeaceful || 1,
      speedFleetWar:      s.fleetSpeedWar       || 1,
      speedFleetHolding:  s.fleetSpeedHolding   || 1,

      galaxies:           s.universeSize        || 9,
      systems:            499,
      // Sempre manter circulares como padrão
      donutGalaxy:        true,
      donutSystem:        true,
      // Sondas com capacidade de carga
      espionageProbeRaids: s.espionageProbeRaids || 0
    };

    // Consumo de deutério do universo
    // OGAPI: globalDeuteriumSaveFactor (0.5 .. 1.0)
    if (s.globalDeuteriumSaveFactor != null) {
      const raw = Number(s.globalDeuteriumSaveFactor);
      if (Number.isFinite(raw) && raw > 0) {
        const normalized = Math.min(1, Math.max(0.1, raw));
        cfg.deutFactor = normalized;
      }
    }

    if (window.FlightCalc && typeof window.FlightCalc.setUniverseConfig === "function") {
      window.FlightCalc.setUniverseConfig(cfg);
    }

    console.log(
      `[UniversesLoader] Universo aplicado: ${universe.name} (${universe.language}-${universe.number})`
    );
  }

  function resetUniverseInfo() {
    [
      "fleet-speed-peaceful", "fleet-speed-war", "fleet-speed-holding",
      "universe-galaxies", "universe-systems",
      "donut-galaxy", "donut-system"
    ].forEach(id => {
      const el = $(id);
      if (el) el.textContent = "—";
    });

    const g = $("donut-galaxy-check");
    const s = $("donut-system-check");
    if (g) g.checked = false;
    if (s) s.checked = false;

    const deutSel = $("universe-deut-factor");
    if (deutSel) deutSel.value = "1.0";
  }

  // ============================================================
  // API PÚBLICA
  // ============================================================

  window.UniversesLoader = {
    loadServers,
    getCommunitiesData: () => communitiesData,
    getServersData: () => serversData
  };

  // ============================================================
  // INIT
  // ============================================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadServers);
  } else {
    loadServers();
  }

})();