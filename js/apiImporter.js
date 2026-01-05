/**
 * apiImporter.js
 * Importacao SR OGAPI (DEFENDER) + API2 (SELF)
 * Pipeline: API -> mapping -> state -> UI -> recalc
 * 
 * =============================================================================
 * MAPEAMENTO DE CLASSES (API → STATE)
 * =============================================================================
 * 
 * PLAYER CLASS (Character Class):
 * ┌─────────────────────────┬─────────┬─────────┬──────────────┐
 * │ Classe                  │ API ID  │ State ID│ Select Value │
 * ├─────────────────────────┼─────────┼─────────┼──────────────┤
 * │ Sem Classe              │    0    │   -1    │     "-1"     │
 * │ Colecionador (Collector)│    1    │    0    │      "0"     │
 * │ General                 │    2    │    1    │      "1"     │
 * │ Descobridor (Discoverer)│    3    │    2    │      "2"     │
 * └─────────────────────────┴─────────┴─────────┴──────────────┘
 * 
 * ALLIANCE CLASS:
 * ┌─────────────────────────┬─────────┬─────────┬──────────────┐
 * │ Classe                  │ API ID  │ State ID│ Select Value │
 * ├─────────────────────────┼─────────┼─────────┼──────────────┤
 * │ Sem Aliança             │ null/0  │    0    │      "0"     │
 * │ Guerreiros (Warrior)    │    1    │    2    │      "2"     │
 * │ Comerciantes (Trader)   │    2    │    1    │      "1"     │
 * │ Investigadores (Research│    3    │    3    │      "3"     │
 * └─────────────────────────┴─────────┴─────────┴──────────────┘
 * 
 * FONTES DA API:
 * - SR API (OGAPI): defender_character_class_id, defender_alliance_class_id
 * - API2: characterClassId, allianceClassId
 * 
 * =============================================================================
 */

(() => {
  "use strict";

  const WORKER_URL = "https://ogapi-proxy.m0nicker.workers.dev";

  const SHIP_IDS = [
    202,203,204,205,206,207,208,209,
    210,211,212,213,214,215,218,219
  ];

  const $ = id => document.getElementById(id);

  // ============================================================
  // MAPEAMENTO
  // ============================================================

  // API -> STATE (Player Class)
  // API SR: 0=Sem Classe, 1=Colecionador, 2=General, 3=Descobridor
  // STATE: -1=Sem Classe, 0=Colecionador, 1=General, 2=Descobridor
  const PLAYER_CLASS_API_TO_STATE = {
    0: -1, // Sem Classe
    1: 0,  // Colecionador
    2: 1,  // General
    3: 2   // Descobridor
  };

  // API -> STATE (Alliance Class) 
  // API SR: null=Sem Aliança, 1=Guerreiros, 2=Comerciantes, 3=Investigadores
  // STATE: 0=Sem classe, 1=Comerciantes(Trader), 2=Guerreiros(Warrior), 3=Investigadores(Researcher)
  const ALLIANCE_CLASS_API_TO_STATE = {
    0: 0, // Sem aliança (null/undefined também mapeia para 0)
    1: 2, // Guerreiros (API) → Warrior (state)
    2: 1, // Comerciantes (API) → Trader (state)
    3: 3  // Investigadores (API) → Researcher (state)
  };

  // ============================================================
  // HELPERS
  // ============================================================

  function getState() {
    if (!window.FlightCalc || !window.FlightCalc.state) {
      throw new Error("FlightCalc nao inicializado");
    }
    return window.FlightCalc.state;
  }

  function safeInt(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  function parseCoords(str) {
    if (!str) return null;
    const p = str.split(":").map(n => parseInt(n, 10));
    return (p.length === 3 && p.every(Number.isFinite)) ? p : null;
  }

  async function fetchSR(token) {
    const res = await fetch(`${WORKER_URL}/report/${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function isAPI2(data) {
    return !!data?.coords && !!data?.ships && !data?.generic;
  }

  // ============================================================
  // APPLY - CLASSES
  // ============================================================

  function applyPlayerClass(apiValue) {
    const st = getState();
    
    const normalizedValue = (apiValue == null || !Number.isFinite(apiValue)) ? -1 : apiValue;
    
    if (normalizedValue === -1) {
      st.player.class = -1;
      const el = $("player-class");
      if (el) el.value = "-1";
      return;
    }
    
    const mapped = PLAYER_CLASS_API_TO_STATE[normalizedValue];
    const finalValue = (mapped != null) ? mapped : -1;

    st.player.class = finalValue;
    const el = $("player-class");
    if (el) el.value = String(finalValue);
    
    console.log("[apiImporter] Player class:", apiValue, "->", finalValue);
  }

  function applyAllianceClass(apiValue) {
    const st = getState();
    
    const normalizedValue = (apiValue == null || !Number.isFinite(apiValue)) ? 0 : apiValue;
    const mapped = ALLIANCE_CLASS_API_TO_STATE[normalizedValue];
    const finalValue = (mapped != null) ? mapped : 0;

    st.player.allianceClass = finalValue;
    const el = $("alliance-class");
    if (el) el.value = String(finalValue);
    
    console.log("[apiImporter] Alliance class:", apiValue, "->", finalValue);
  }

  // ============================================================
  // APPLY - COORDENADAS
  // ============================================================

  function applyOriginCoords(coordsStr) {
    const st = getState();
    const c = parseCoords(coordsStr);
    if (!c) {
      console.error("[apiImporter] Coordenadas invalidas:", coordsStr);
      return;
    }

    st.coords.origin = c;

    const gEl = $("coord-origin-g");
    const sEl = $("coord-origin-s");
    const pEl = $("coord-origin-p");
    
    if (gEl) gEl.value = c[0];
    if (sEl) sEl.value = c[1];
    if (pEl) pEl.value = c[2];
    
    console.log("[apiImporter] Coords:", c.join(":"));
  }

  // ============================================================
  // APPLY - PESQUISAS
  // ============================================================

  function applyResearches(obj) {
    const st = getState();

    st.tech.combustion = safeInt(obj[115]);
    st.tech.impulse    = safeInt(obj[117]);
    st.tech.hyperspace = safeInt(obj[118]);
    st.tech.hyperTech  = safeInt(obj[114]);

    const c = $("tech-combustion");
    const i = $("tech-impulse");
    const h = $("tech-hyperspace");
    const t = $("tech-hyperspace-tech");
    
    if (c) c.value = st.tech.combustion;
    if (i) i.value = st.tech.impulse;
    if (h) h.value = st.tech.hyperspace;
    if (t) t.value = st.tech.hyperTech;
    
    console.log("[apiImporter] Techs:", st.tech.combustion, st.tech.impulse, st.tech.hyperspace, st.tech.hyperTech);
  }

  // ============================================================
  // APPLY - FROTA
  // ============================================================

  function applyFleetFromObject(obj) {
    const st = getState();
    let totalShips = 0;
    
    SHIP_IDS.forEach((id, i) => {
      const qty = safeInt(obj[id]?.amount);
      st.fleet.ships[i] = qty;
      totalShips += qty;
      
      const el = $(`fleet-ship-${i}`);
      if (el) el.value = qty;
    });
    
    console.log("[apiImporter] Fleet total:", totalShips, "ships");
  }

  // ============================================================
  // APPLY - BONUS LIFEFORM
  // ============================================================

  function applyLifeformBonusesFromShips(shipsObj) {
    const st = getState();
    let bonusCount = 0;
    
    SHIP_IDS.forEach((id, i) => {
      const shipData = shipsObj[id];
      if (!shipData) return;
      
      // Converter de multiplicador para percentagem
      // Ex: speed=1.090988 -> 109.0988%
      const speedBonus = shipData.speed ? (shipData.speed * 100) : 0;
      const cargoBonus = shipData.cargo ? (shipData.cargo * 100) : 0;
      const fuelBonus = shipData.fuel ? (shipData.fuel * 100) : 0;
      
      // Aplicar ao state
      st.lfBonuses[i][0] = speedBonus;
      st.lfBonuses[i][1] = cargoBonus;
      st.lfBonuses[i][2] = fuelBonus;
      
      // Aplicar aos inputs
      const speedEl = $(`lf-speed-${i}`);
      const cargoEl = $(`lf-cargo-${i}`);
      const fuelEl = $(`lf-deut-${i}`);
      
      if (speedEl) speedEl.value = speedBonus.toFixed(3);
      if (cargoEl) cargoEl.value = cargoBonus.toFixed(3);
      if (fuelEl) fuelEl.value = fuelBonus.toFixed(3);
      
      if (speedBonus > 0 || cargoBonus > 0 || fuelBonus > 0) bonusCount++;
    });
    
    console.log("[apiImporter] Lifeform bonuses aplicados:", bonusCount, "ships");
  }

  function applyLifeformBonusesFromBaseStatsBooster(baseStatsBooster) {
    if (!baseStatsBooster) return;
    
    const st = getState();
    let bonusCount = 0;
    
    SHIP_IDS.forEach((id, i) => {
      const bonusData = baseStatsBooster[id];
      if (!bonusData) return;
      
      // Converter de fracao para percentagem
      const speedBonus = bonusData.speed ? (bonusData.speed * 100) : 0;
      const cargoBonus = bonusData.cargo ? (bonusData.cargo * 100) : 0;
      
      // Aplicar ao state
      st.lfBonuses[i][0] = speedBonus;
      st.lfBonuses[i][1] = cargoBonus;
      
      // Aplicar aos inputs
      const speedEl = $(`lf-speed-${i}`);
      const cargoEl = $(`lf-cargo-${i}`);
      
      if (speedEl) speedEl.value = speedBonus.toFixed(3);
      if (cargoEl) cargoEl.value = cargoBonus.toFixed(3);
      
      if (speedBonus > 0 || cargoBonus > 0) bonusCount++;
    });
    
    console.log("[apiImporter] BaseStatsBooster aplicado:", bonusCount, "ships");
  }

  function applyFuelBonusFromShips(shipsObj) {
    const st = getState();
    let bonusCount = 0;
    
    SHIP_IDS.forEach((id, i) => {
      const shipData = shipsObj[id];
      if (!shipData) return;
      
      // Converter de multiplicador para percentagem
      const fuelBonus = shipData.fuel ? (shipData.fuel * 100) : 0;
      
      // Aplicar ao state
      st.lfBonuses[i][2] = fuelBonus;
      
      // Aplicar ao input
      const fuelEl = $(`lf-deut-${i}`);
      if (fuelEl) fuelEl.value = fuelBonus.toFixed(3);
      
      if (fuelBonus > 0) bonusCount++;
    });
    
    console.log("[apiImporter] Fuel bonuses aplicados:", bonusCount, "ships");
  }

  // ============================================================
  // APPLY - CHARACTER CLASS BOOSTER
  // ============================================================

  function applyCharacterClassBooster(bonuses, characterClassId) {
    const st = getState();
    
    if (!bonuses || !bonuses.characterClassBooster) {
      console.log("[apiImporter] CharacterClassBooster nao encontrado");
      return;
    }
    
    const classBooster = bonuses.characterClassBooster;
    
    // Determinar o ID da classe no formato API (0, 1, 2, 3)
    let apiClassId;
    
    if (characterClassId != null && Number.isFinite(characterClassId)) {
      // Valor veio da API, usar diretamente
      apiClassId = characterClassId;
    } else {
      // Fallback: converter state format (-1, 0, 1, 2) para API format (0, 1, 2, 3)
      const stateClassId = st.player.class;
      
      // Mapear state -> API (inverso do PLAYER_CLASS_API_TO_STATE)
      const STATE_TO_API_CLASS = {
        '-1': 0, // Sem Classe
        '0': 1,  // Colecionador
        '1': 2,  // General
        '2': 3   // Descobridor
      };
      
      apiClassId = STATE_TO_API_CLASS[String(stateClassId)] || 0;
    }
    
    // Obter valor do booster usando o ID da API
    const boosterValue = classBooster[apiClassId] || 0;
    
    // Converter para percentagem (ex: 0.0632 -> 6.32%)
    const boosterPercent = boosterValue * 100;
    
    // Aplicar ao state
    st.tech.characterClassBooster = boosterPercent;
    
    // Aplicar ao input
    const el = $("character-class-booster");
    if (el) el.value = boosterPercent.toFixed(3);
    
    console.log("[apiImporter] CharacterClassBooster: API class", apiClassId, "->", boosterPercent.toFixed(3) + "%");
  }

  // ============================================================
  // PIPELINES
  // ============================================================

  function applySR(data) {
    console.log("[apiImporter] Aplicando SR API...");
    
    const g = data.generic;
    const ci = data.details?.combatInformation;

    if (!g || !ci) throw new Error("SR invalida");

    // DEFENDER ONLY
    applyPlayerClass(safeInt(g.defender_character_class_id));
    applyAllianceClass(safeInt(g.defender_alliance_class_id));
    applyOriginCoords(g.defender_planet_coordinates);
    applyResearches(ci.researches);
    applyFleetFromObject(ci.ships);
    
    // Bonus de formas de vida (2 lugares na SR API)
    const baseStatsBooster = data.details?.lifeformBonuses?.BaseStatsBooster;
    if (baseStatsBooster) {
      applyLifeformBonusesFromBaseStatsBooster(baseStatsBooster);
    }
    
    applyFuelBonusFromShips(ci.ships);
    
    // CharacterClassBooster
    const bonuses = ci.bonuses; // ✅ CORRIGIDO: bonuses está dentro de combatInformation
    if (bonuses) {
      applyCharacterClassBooster(bonuses, safeInt(g.defender_character_class_id));
    }
    
    console.log("[apiImporter] SR API aplicada com sucesso!");
  }

  function applyAPI2(data) {
    console.log("[apiImporter] Aplicando API2...");
    
    applyPlayerClass(safeInt(data.characterClassId));
    applyAllianceClass(safeInt(data.allianceClassId));
    applyOriginCoords(data.coords);
    applyResearches(data.researches);
    applyFleetFromObject(data.ships);
    
    // Bonus de formas de vida
    applyLifeformBonusesFromShips(data.ships);
    
    // CharacterClassBooster
    if (data.bonuses) {
      applyCharacterClassBooster(data.bonuses, safeInt(data.characterClassId));
    }
    
    console.log("[apiImporter] API2 aplicada com sucesso!");
  }

  // ============================================================
  // HANDLERS
  // ============================================================

  async function handleImport(ev) {
    ev.preventDefault();

    try {
      const token = $("api-code").value.trim();
      if (!token) throw new Error("Token vazio");

      console.log("[apiImporter] Importando SR:", token.substring(0, 20) + "...");
      
      const data = await fetchSR(token);

      if (isAPI2(data)) {
        applyAPI2(data);
      } else {
        applySR(data);
      }

      window.FlightCalc.recalc();
      alert("Importacao concluida!");

    } catch (e) {
      console.error("[apiImporter] ERRO:", e);
      alert(`Erro na importacao: ${e.message}`);
    }
  }

  async function handleImportAPI2(ev) {
    ev.preventDefault();

    try {
      const textarea = $("api-json-input");
      if (!textarea) throw new Error("Textarea nao encontrado");

      const jsonText = textarea.value.trim();
      if (!jsonText) {
        alert("Por favor, cole o JSON da API2");
        return;
      }

      console.log("[apiImporter] Parseando JSON...");
      const data = JSON.parse(jsonText);

      if (!isAPI2(data)) {
        alert("JSON invalido - nao e API2");
        return;
      }

      applyAPI2(data);
      window.FlightCalc.recalc();
      alert("Importacao API2 concluida!");

    } catch (e) {
      console.error("[apiImporter] ERRO:", e);
      alert(`Erro: ${e.message}`);
    }
  }

  function handleOpenAPI(ev) {
    ev.preventDefault();

    try {
      const token = $("api-code").value.trim();
      if (!token) {
        alert("Insira um SR Key");
        return;
      }

      const url = `${WORKER_URL}/report/${encodeURIComponent(token)}`;
      window.open(url, "_blank");

    } catch (e) {
      console.error("[apiImporter] ERRO:", e);
      alert(`Erro: ${e.message}`);
    }
  }

  // ============================================================
  // INIT
  // ============================================================

  document.addEventListener("DOMContentLoaded", () => {
    console.log("[apiImporter] Inicializando...");
    
    const importBtn = $("api-import-json");
    const openBtn = $("api-open");
    const importAPI2Btn = $("api-import-json-raw");
    
    if (importBtn) {
      importBtn.addEventListener("click", handleImport);
      console.log("[apiImporter] Botao Importar SR ligado");
    }
    
    if (openBtn) {
      openBtn.addEventListener("click", handleOpenAPI);
      console.log("[apiImporter] Botao Abrir ligado");
    }
    
    if (importAPI2Btn) {
      importAPI2Btn.addEventListener("click", handleImportAPI2);
      console.log("[apiImporter] Botao Importar API2 ligado");
    }
    
    console.log("[apiImporter] Pronto!");
  });

})();