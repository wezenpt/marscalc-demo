// app.js – FlightCalc core (pipeline alinhado com o cliente OGame)

(() => {
  "use strict";

  // ======================================================================
  // 1) ESTADO GLOBAL
  // ======================================================================

  const state = {
    universe: {
      galaxies: 9,
      systems: 499,
      donutGalaxy: true,
      donutSystem: true,

      speedPeaceful: 1,
      speedWar: 1,
      speedHolding: 1,

      deutFactor: 1.0,
      probeCargo: 0  // Capacidade de carga das sondas (0 ou 5)
    },

    tech: {
      combustion: 0,
      impulse: 0,
      hyperspace: 0,
      hyperTech: 0,

      // lfMechanGE: 0,        // REMOVED - redundante com characterClassBooster
      // lfRocktalCE: 0,       // REMOVED - redundante com characterClassBooster
      deutConsReduction: 50,  // General: -50% consumo base
      characterClassBooster: 0
    },

    player: {
      class: -1,
      allianceClass: -1
    },

    lfBonuses: Array.from({ length: 16 }, () => [0, 0, 0]),

    fleet: { ships: Array(16).fill(0) },

    coords: {
      origin: [1, 1, 1],
      dest: [1, 1, 1]
    },

    mission: "peaceful",
    speedPercent: 100,
    sameAlliance: false,  // Viagem para membro da mesma aliança (afeta EDM com Guerreiros)

    flightTimes: []
  };

  // ======================================================================
  // 2) HELPERS
  // ======================================================================

  const $ = id => document.getElementById(id);

  function num(id, def = 0) {
    const el = $(id);
    if (!el) return def;
    const v = parseFloat(String(el.value).replace(",", "."));
    return Number.isFinite(v) ? v : def;
  }

  function setText(id, txt) {
    const el = $(id);
    if (el) el.textContent = txt;
  }

  function clamp(v, min, max) {
    if (!Number.isFinite(v)) return min;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function formatNumber(n) {
    return Number(n).toLocaleString("pt-PT");
  }

  function formatDuration(sec) {
    if (!Number.isFinite(sec) || sec <= 0) return "—";
    let s = Math.trunc(sec);
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600);  s %= 3600;
    const m = Math.floor(s / 60);    s %= 60;
    const pad = x => String(x).padStart(2, "0");
    return `${pad(d)} ${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function getPlayerClassSafe() {
    const c = state.player.class;
    return (c === 0 || c === 1 || c === 2) ? c : -1;
  }

  function getAllianceClassSafe() {
    const a = state.player.allianceClass;
    return (a === 0 || a === 1 || a === 2) ? a : -1;
  }

  // ======================================================================
  // 2.1) ENTRY POINT PÚBLICO PARA IMPORTAÇÕES (INTEGRADO)
  // ======================================================================

  window.applyImportedData = function (data) {
    if (!data) return;

    if (Number.isFinite(data.playerClass)) {
      state.player.class = data.playerClass;
      if ($("player-class")) $("player-class").value = String(data.playerClass);
    }

    if (Number.isFinite(data.allianceClass)) {
      state.player.allianceClass = data.allianceClass;
      if ($("alliance-class")) $("alliance-class").value = String(data.allianceClass);
    }

    if (data.researches) {
      state.tech.combustion = Number(data.researches[115] ?? state.tech.combustion);
      state.tech.impulse    = Number(data.researches[117] ?? state.tech.impulse);
      state.tech.hyperspace = Number(data.researches[118] ?? state.tech.hyperspace);
      state.tech.hyperTech  = Number(data.researches[114] ?? state.tech.hyperTech);

      if ($("tech-combustion")) $("tech-combustion").value = state.tech.combustion;
      if ($("tech-impulse")) $("tech-impulse").value = state.tech.impulse;
      if ($("tech-hyperspace")) $("tech-hyperspace").value = state.tech.hyperspace;
      if ($("tech-hyperspace-tech")) $("tech-hyperspace-tech").value = state.tech.hyperTech;
    }

    if (data.ships) {
      Object.entries(data.ships).forEach(([shipId, obj]) => {
        const idx = SHIP_IDS.indexOf(Number(shipId));
        if (idx === -1) return;
        const qty = Math.max(0, Math.trunc(obj.amount ?? obj));
        state.fleet.ships[idx] = qty;
        const el = $(`fleet-ship-${idx}`);
        if (el) el.value = qty;
      });
    }

    if (data.lifeformBonuses && data.lifeformBonuses[2] != null) {
      const v = Math.round(data.lifeformBonuses[2] * 100);
      state.tech.deutConsReduction = v;
      if ($("lf-deut-reduction")) $("lf-deut-reduction").value = v;
    }

    recalc();
  };

  // ======================================================================
  // 3) TABELA BASE DE NAVES
  // ======================================================================

  const SHIP_LABELS = [
    "Pequeno Cargueiro","Grande Cargueiro","Caça Ligeiro","Caça Pesado",
    "Cruzador","Nave de Batalha","Nave Colonização","Reciclador",
    "Sonda","Bombardeiro","Satélite","Destruidor",
    "Estrela da Morte","Interceptor","Ceifeiro","Exploradora"
  ];

  const SHIP_IDS = [
    202,203,204,205,206,207,208,209,
    210,211,212,213,214,215,218,219
  ];

  const BASE_SHIPS = {
    202:{baseSpeed:5000,engine:0,fuel:10,cargo:5000},
    203:{baseSpeed:7500,engine:0,fuel:50,cargo:25000},
    204:{baseSpeed:12500,engine:0,fuel:20,cargo:50},
    205:{baseSpeed:10000,engine:1,fuel:75,cargo:100},
    206:{baseSpeed:15000,engine:1,fuel:300,cargo:800},
    207:{baseSpeed:10000,engine:2,fuel:500,cargo:1500},
    208:{baseSpeed:2500,engine:1,fuel:1000,cargo:7500},
    209:{baseSpeed:2000,engine:0,fuel:300,cargo:20000},
    210:{baseSpeed:100000000,engine:0,fuel:1,cargo:0},
    211:{baseSpeed:4000,engine:1,fuel:700,cargo:500},
    212:{baseSpeed:0,engine:0,fuel:0,cargo:0},
    213:{baseSpeed:5000,engine:2,fuel:1000,cargo:2000},
    214:{baseSpeed:100,engine:2,fuel:1,cargo:1000000},
    215:{baseSpeed:10000,engine:2,fuel:250,cargo:750},
    218:{baseSpeed:7000,engine:2,fuel:1100,cargo:10000},
    219:{baseSpeed:12000,engine:2,fuel:300,cargo:10000}
  };

  function buildShipsBase() {
    const map = {};
    for (const id of SHIP_IDS) map[id] = { ...BASE_SHIPS[id] };
    return map;
  }

  // ======================================================================
  // 4) TABELAS UI
  // ======================================================================

  function initLfTable() {
    const tbody = $("lf-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    SHIP_LABELS.forEach((name, i) => {
      const hidden = (i === 10) ? "ship-row-sat" : "";
      tbody.innerHTML += `
        <tr class="${hidden}">
          <td>${name}</td>
          <td><input id="lf-speed-${i}" type="number" step="0.001"></td>
          <td><input id="lf-cargo-${i}" type="number" step="0.001"></td>
          <td><input id="lf-deut-${i}" type="number" step="0.001"></td>
        </tr>`;
    });
  }

  function initFleetTable() {
    const tbody = $("fleet-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    SHIP_LABELS.forEach((name, i) => {
      const hidden = (i === 10) ? "ship-row-sat" : "";
      tbody.innerHTML += `
        <tr class="${hidden}">
          <td>${name}</td>
          <td><input id="fleet-ship-${i}" type="number" min="0"></td>
          <td id="fleet-base-speed-${i}" class="mono">0</td>
        </tr>`;
    });
  }

  // ======================================================================
  // 5) MOTORES / VELOCIDADES
  // ======================================================================

  function computeShipsData() {
    const ships = buildShipsBase();
    const imp = state.tech.impulse;
    const hyp = state.tech.hyperspace;

    // Small Cargo refit (impulse > 4) – muda baseSpeed e fuel para 20
    if (imp > 4) {
      ships[202].baseSpeed = 10000;
      ships[202].engine = 1;
      ships[202].fuel = 20;
    }

    // Bombardeiro refit (hyper > 7)
    if (hyp > 7) {
      ships[211].baseSpeed = 5000;
      ships[211].engine = 2;
      // fuel fica igual (700)
    }

    // Reciclador refit (hyper > 14 ou impulse > 16)
    if (hyp > 14) {
      ships[209].baseSpeed = 6000;
      ships[209].engine = 2;
      ships[209].fuel = 900;
    } else if (imp > 16) {
      ships[209].baseSpeed = 4000;
      ships[209].engine = 1;
      ships[209].fuel = 600;
    }

    return ships;
  }

  function getDriveBonuses() {
    return [
      state.tech.combustion * 10,
      state.tech.impulse * 20,
      state.tech.hyperspace * 30
    ];
  }

  function computeShipSpeed(idx, shipsData, driveBonuses) {
    const shipId = SHIP_IDS[idx];
    const base = shipsData[shipId];
    if (!base) return 0;

    const baseSpeed = base.baseSpeed;
    if (baseSpeed <= 0) return 0;

    const engine = base.engine;
    const driveBonus = driveBonuses[engine] || 0;

    let speed = baseSpeed * (1 + driveBonus / 100);

    const playerClass = getPlayerClassSafe();
    const allianceClass = getAllianceClassSafe();
    const classBooster = (state.tech.characterClassBooster || 0) / 100;

    // Classe de CONTA – aplicado sobre baseSpeed
    if (playerClass === 0 && (shipId === 202 || shipId === 203)) {
      // Colecionador: +100% SC/LC + characterClassBooster
      speed += baseSpeed * (1.0 + classBooster);
    } else if (playerClass === 1) {
      // General: +100% naves combate + reciclador + characterClassBooster
      // Naves: Caça Ligeiro, Caça Pesado, Cruzador, Nave Batalha, Reciclador,
      //        Bombardeiro, Destruidor, Interceptor, Ceifeira, Exploradora
      // NOTA: Estrela da Morte (214) NÃO recebe bónus - é neutra
      const generalBoosted = new Set([
        204, // Caça Ligeiro
        205, // Caça Pesado
        206, // Cruzador
        207, // Nave de Batalha
        209, // Reciclador
        211, // Bombardeiro
        213, // Destruidor
        // 214 - Estrela da Morte NÃO afetada por bónus
        215, // Interceptor
        218, // Ceifeira
        219  // Exploradora
      ]);
      if (generalBoosted.has(shipId)) {
        speed += baseSpeed * (1.0 + classBooster);
      }
    }

    // Classe de ALIANÇA – também sobre baseSpeed
    if (allianceClass === 1 && (shipId === 202 || shipId === 203)) {
      // Comerciante: +10% SC/LC
      speed += baseSpeed * 0.1;
    } else if (allianceClass === 2 && state.sameAlliance) {
      // Guerreiro: +10% naves de combate (incluindo EDM)
      // APENAS quando viagem é entre membros da mesma aliança
      const warShips = new Set([204, 205, 206, 207, 209, 211, 213, 214, 215, 218, 219]);
      if (warShips.has(shipId)) {
        speed += baseSpeed * 0.1;
      }
    }

    // LF Speed – aplica-se à baseSpeed, depois somado
    const lf = state.lfBonuses[idx] || [0, 0, 0];
    const lfSpeedPct = lf[0] || 0; // ex: 94.4134 (%)
    const lfBonus = Math.ceil(baseSpeed * (lfSpeedPct / 100));
    speed += lfBonus;

    const final = Math.round(speed);
    return final > 0 ? final : 0;
  }

  function getMinSpeed(shipsData, driveBonuses) {
    let min = Infinity;

    for (let i = 0; i < 16; i++) {
      const qty = state.fleet.ships[i];
      if (!qty || qty <= 0) continue;

      const sp = computeShipSpeed(i, shipsData, driveBonuses);
      if (sp <= 0) continue;

      const cell = $(`fleet-base-speed-${i}`);
      if (cell) cell.textContent = formatNumber(sp);

      if (sp < min) min = sp;
    }

    if (!Number.isFinite(min)) return 0;
    return min;
  }

  // ======================================================================
  // 6) DISTÂNCIA
  // ======================================================================

  function getDistance(a, b) {
    const g1 = a[0], s1 = a[1], p1 = a[2];
    const g2 = b[0], s2 = b[1], p2 = b[2];

    const u = state.universe;

    if (g1 !== g2) {
      let dg = Math.abs(g1 - g2);
      if (u.donutGalaxy) {
        dg = Math.min(dg, u.galaxies - dg);
      }
      return dg * 20000;
    }

    if (s1 !== s2) {
      let ds = Math.abs(s1 - s2);
      if (u.donutSystem) {
        ds = Math.min(ds, u.systems - ds);
      }
      return ds * 95 + 2700;
    }

    if (p1 !== p2) {
      return Math.abs(p1 - p2) * 5 + 1000;
    }

    return 5;
  }

  // Aplica "sistemas ignorados" apenas dentro da mesma galáxia e quando muda de sistema.
  // Não altera a fórmula de getDistance; apenas ajusta o valor usado para distância de sistemas.
  function getDistanceWithIgnoredSystems(origin, dest) {
    const ignored = Math.max(0, Math.trunc(num("ignored-systems", 0)));
    const u = state.universe;

    const g1 = origin[0], s1 = origin[1], p1 = origin[2];
    const g2 = dest[0],   s2 = dest[1],   p2 = dest[2];

    // Galáxias diferentes → igual ao core
    if (g1 !== g2) {
      let dg = Math.abs(g1 - g2);
      if (u.donutGalaxy) {
        dg = Math.min(dg, u.galaxies - dg);
      }
      return dg * 20000;
    }

    // Mesma galáxia, sistemas diferentes
    if (s1 !== s2) {
      let ds = Math.abs(s1 - s2);
      if (u.donutSystem) {
        ds = Math.min(ds, u.systems - ds);
      }

      // 🔑 AQUI está a correção
      ds = Math.max(0, ds - ignored);

      return 2700 + 95 * ds;
    }

    // Mesmo sistema, planetas diferentes
    if (p1 !== p2) {
      return Math.abs(p1 - p2) * 5 + 1000;
    }

    return 5;
  }

  // ======================================================================
  // 7) VELOCIDADE DO UNIVERSO (fator)
  // ======================================================================

  function getUniSpeedFactor() {
    if (state.mission === "war" || state.mission === "attack" || state.mission === "destroy") {
      return state.universe.speedWar || 1;
    }
    if (state.mission === "holding" || state.mission === "hold" || state.mission === "stay") {
      return state.universe.speedHolding || state.universe.speedWar || 1;
    }
    return state.universe.speedPeaceful || 1;
  }

  // ======================================================================
  // 8) COORDENADAS (G,S,P) + LIMITES DINÂMICOS
  // ======================================================================

  function readCoordsFromInputs(prefix) {
    const gMax = state.universe.galaxies;
    const sMax = state.universe.systems;
    const pMax = 17;

    const g = clamp(num(`${prefix}-g`, 1), 1, gMax);
    const s = clamp(num(`${prefix}-s`, 1), 1, sMax);
    const p = clamp(num(`${prefix}-p`, 1), 1, pMax);

    const gEl = $(`${prefix}-g`);
    const sEl = $(`${prefix}-s`);
    const pEl = $(`${prefix}-p`);
    if (gEl) gEl.value = g;
    if (sEl) sEl.value = s;
    if (pEl) pEl.value = p;

    return [g, s, p];
  }

  function writeCoordsToInputs(prefix, coords) {
    const [g, s, p] = coords;
    const gEl = $(`${prefix}-g`);
    const sEl = $(`${prefix}-s`);
    const pEl = $(`${prefix}-p`);
    if (gEl) gEl.value = g;
    if (sEl) sEl.value = s;
    if (pEl) pEl.value = p;
  }

  function syncCoordInputLimits() {
    const gMax = state.universe.galaxies;
    const sMax = state.universe.systems;
    const pMax = 17;

    ["coord-origin", "coord-dest"].forEach(prefix => {
      const gEl = $(`${prefix}-g`);
      const sEl = $(`${prefix}-s`);
      const pEl = $(`${prefix}-p`);
      if (gEl) gEl.max = String(gMax);
      if (sEl) sEl.max = String(sMax);
      if (pEl) pEl.max = String(pMax);
    });
  }

  // ======================================================================
  // 9) CONSUMO DE DEUTÉRIO – PIPELINE CLIENTE
  // ======================================================================

  function getFlightDuration(minSpeed, distance, speedPercent, uniSpeedFactor) {
    if (minSpeed <= 0 || distance <= 0) return 0;
    const v = speedPercent / 10;
    const t = (35000 / v) * Math.sqrt((distance * 10) / minSpeed) + 10;
    return Math.round(t / uniSpeedFactor);
  }

  function computeDeuterium(distance, duration, speedFactor, shipsData, driveBonuses) {
    if (distance <= 0 || duration <= 0) return 0;

    const u = state.universe;
    const playerClass = getPlayerClassSafe(); // ✅ respeita -1 (sem classe)

    let total = 0;
    const denom = duration * speedFactor - 10;
    if (denom <= 0) return 0;

    for (let idx = 0; idx < 16; idx++) {
      const count = state.fleet.ships[idx];
      if (!count || count <= 0) continue;

      const shipId = SHIP_IDS[idx];
      const base = shipsData[shipId];
      if (!base) continue;

      const shipSpeed = computeShipSpeed(idx, shipsData, driveBonuses);
      if (shipSpeed <= 0) continue;

      const baseFuel = base.fuel;
      if (!baseFuel || baseFuel <= 0) continue;

      // 1) fator de deutério do universo aplicado ao consumo base
      let fuelEffective = baseFuel * u.deutFactor;

      // 2) classe (General) - bónus fixo + characterClassBooster
      let classReduction = 0;
      if (playerClass === 1) {
        // Bónus fixo: -50%
        classReduction = (state.tech.deutConsReduction || 0) / 100;
        
        // Adicionar characterClassBooster
        const classBooster = (state.tech.characterClassBooster || 0) / 100;
        classReduction += classBooster;
        
        // Limitar a 90%
        if (classReduction > 0.9) classReduction = 0.9;
      }
      fuelEffective *= (1 - classReduction);

      // 3) LF Fuel (%) aplicado ao consumo base também
      let lfFuel = (state.lfBonuses[idx][2] || 0) / 100;
      if (lfFuel > 0.9) lfFuel = 0.9;
      if (lfFuel < -0.9) lfFuel = -0.9;

      fuelEffective *= (1 - lfFuel);

      // 4) consumo base final por nave (floor)
      const fuelPerShip = Math.floor(fuelEffective) || 1;

      // 5) shipSpeedValue oficial
      const shipSpeedValue =
        35000 / denom * Math.sqrt(distance * 10 / shipSpeed);

      // 6) consumo float por tipo
      const consFloat =
        fuelPerShip * count * distance / 35000 *
        Math.pow(shipSpeedValue / 10 + 1, 2);

      // 7) arredondamento por TIPO (cliente!)
      let shipConsumption = Math.round(consFloat);
      if (shipConsumption < 1) shipConsumption = 1;

      total += shipConsumption;
    }

    return total;
  }

  // ======================================================================
  // 10) CAPACIDADE DE CARGA
  // ======================================================================

  function getCargoCapacity(hyperTech, shipsData) {
    let total = 0;
    const playerClass = getPlayerClassSafe();

    for (let idx = 0; idx < 16; idx++) {
      const count = state.fleet.ships[idx];
      if (!count || count <= 0) continue;

      const shipId = SHIP_IDS[idx];
      const base = shipsData[shipId];
      if (!base) continue;

      // Sonda: usar capacidade configurável do universo
      let baseCargo = base.cargo;
      if (shipId === 210) {
        baseCargo = state.universe.probeCargo || 0;
      }

      let cargoUnit = baseCargo;
      const classBooster = (state.tech.characterClassBooster || 0) / 100;

      // Hyperspace Tech: +5% por nível
      cargoUnit += Math.floor(baseCargo * 0.05 * hyperTech);

      // Colecionador: +25% SC/LC + characterClassBooster, sobre base
      if (playerClass === 0 && (shipId === 202 || shipId === 203)) {
        cargoUnit += Math.floor(baseCargo * (0.25 + classBooster));
      }

      // General: 20% × Character Class Booster (multiplicativo)
      if (playerClass === 1 && (shipId === 209 || shipId === 219)) {
        const generalBoost = (100 + (state.tech.characterClassBooster || 0)) / 100;
        cargoUnit += Math.floor(baseCargo * 0.20 * generalBoost);
      }

      // LF Cargo% sobre base
      const lf = state.lfBonuses[idx] || [0, 0, 0];
      const lfCargoPct = (lf[1] || 0) / 100;
      cargoUnit += Math.floor(baseCargo * lfCargoPct);

      total += cargoUnit * count;
    }

    return total;
  }

  // ======================================================================
  // 11) LEITURA DO FORMULÁRIO → STATE
  // ======================================================================

  function readFormState() {
    // permite -1 (sem classe / sem aliança)
    state.player.class = parseInt($("player-class")?.value ?? "-1", 10);
    if (!Number.isFinite(state.player.class)) state.player.class = -1;

    state.player.allianceClass = parseInt($("alliance-class")?.value ?? "-1", 10);
    if (!Number.isFinite(state.player.allianceClass)) state.player.allianceClass = -1;

    state.tech.combustion = num("tech-combustion");
    state.tech.impulse    = num("tech-impulse");
    state.tech.hyperspace = num("tech-hyperspace");
    state.tech.hyperTech  = num("tech-hyperspace-tech");

    // Bónus de Classe
    state.tech.deutConsReduction = num("lf-deut-reduction") || state.tech.deutConsReduction;
    state.tech.characterClassBooster = num("character-class-booster") || state.tech.characterClassBooster;

    for (let i = 0; i < 16; i++) {
      state.lfBonuses[i][0] = num(`lf-speed-${i}`);
      state.lfBonuses[i][1] = num(`lf-cargo-${i}`);
      state.lfBonuses[i][2] = num(`lf-deut-${i}`);
    }

    for (let i = 0; i < 16; i++) {
      state.fleet.ships[i] = Math.max(0, Math.trunc(num(`fleet-ship-${i}`)));
    }

    // Coordenadas
    state.coords.origin = readCoordsFromInputs("coord-origin");
    state.coords.dest   = readCoordsFromInputs("coord-dest");

    state.mission = $("mission-type")?.value || "peaceful";
    
    // Checkbox "Membro da mesma aliança" (afeta EDM com Guerreiros)
    const sameAllianceCheckbox = $("same-alliance");
    state.sameAlliance = sameAllianceCheckbox ? sameAllianceCheckbox.checked : false;

    // % de voo removida da UI: mantemos 100 por consistência
    state.speedPercent = 100;

    // Fator de deut do universo (0.5..1.0) – valor REAL
    const dfRaw = ($("universe-deut-factor")?.value || "1.0").replace(",", ".");
    const df = parseFloat(dfRaw);
    if (Number.isFinite(df) && df > 0 && df <= 1.0) {
      state.universe.deutFactor = df;
    } else {
      state.universe.deutFactor = 1.0;
    }
  }

  // ======================================================================
  // 12) RECÁLCULO PRINCIPAL
  // ======================================================================

  function recalc() {
    try {
      readFormState();

      const shipsData = computeShipsData();
      const driveBonuses = getDriveBonuses();

      // Limpa dados anteriores do Quadro 7
      state.flightTimes = [];

      const calculatedMinSpeed = getMinSpeed(shipsData, driveBonuses);
      if (!calculatedMinSpeed) {
        setText("minspeed-read", "—");
        setText("distance-read", "—");
        const tbody = $("flight-times-table");
        if (tbody) tbody.innerHTML = "";

        state.flightTimes = [];
        syncReturnSpeedDropdown();
        recalcFleetReturn(true);
        return;
      }

      // Override assume o minspeed (se preenchido)
      const overrideSpeed = num("fleet-speed-override", 0);
      const minSpeed = (overrideSpeed > 0) ? overrideSpeed : calculatedMinSpeed;

      setText("minspeed-read", formatNumber(minSpeed));

      // ✅ distância com sistemas ignorados (sem usar função inexistente)
      const dist = getDistanceWithIgnoredSystems(
        state.coords.origin,
        state.coords.dest
      );
      setText("distance-read", formatNumber(dist));

      const uniSpeed = getUniSpeedFactor();

      const tbody = $("flight-times-table");
      if (!tbody) return;
      tbody.innerHTML = "";

      const isGeneral = getPlayerClassSafe() === 1;
      const step = isGeneral ? 5 : 10;
      const minPercent = isGeneral ? 5 : 10;

      // General: 100 → 5 (step 5)
      // Outros: 100 → 10 (step 10)
      for (let p = 100; p >= minPercent; p -= step) {
        const duration = getFlightDuration(minSpeed, dist, p, uniSpeed);
        const deut = computeDeuterium(dist, duration, uniSpeed, shipsData, driveBonuses);
        const cargo = getCargoCapacity(state.tech.hyperTech, shipsData);

        // Guardar dados para o Quadro 8
        state.flightTimes.push({
          percent: p,
          duration: duration,
          distance: dist,
          uniSpeed: uniSpeed
        });

        tbody.innerHTML += `
          <tr>
            <td>${p}%</td>
            <td class="mono">${formatDuration(duration)}</td>
            <td class="mono">${formatNumber(deut)}</td>
            <td class="mono">${formatNumber(cargo)}</td>
          </tr>
        `;
      }

      // 🔗 Atualiza dropdown do Quadro 8 e recalcula retorno (se aplicável)
      syncReturnSpeedDropdown();
      recalcFleetReturn();
    } catch (e) {
      console.error("[FlightCalc] Erro no recalc:", e);
    }
  }

  // ======================================================================
  // 12.1) SINCRONIZAR DROPDOWN DE RETORNO (Q7 -> Q8)
  // ======================================================================

  function syncReturnSpeedDropdown() {
    const sel = $("return-speed");
    if (!sel) return;

    const prev = sel.value;

    // Limpa opções anteriores
    sel.innerHTML = "";

    // Se não houver dados do Q7, deixa vazio
    if (!Array.isArray(state.flightTimes) || state.flightTimes.length === 0) return;

    for (const row of state.flightTimes) {
      const opt = document.createElement("option");
      opt.value = String(row.percent);
      opt.textContent = `${row.percent}%`;
      sel.appendChild(opt);
    }

    // tenta manter a seleção anterior, senão fica na primeira (100%)
    if (prev && Array.from(sel.options).some(o => o.value === prev)) {
      sel.value = prev;
    } else {
      sel.value = String(state.flightTimes[0].percent);
    }
  }

  // ======================================================================
  // 12.2) HELPERS DE DATA (Q8)
  // ======================================================================

  function parseDateTime(str) {
    // formato: dd/mm/aaaa hh:mm:ss
    const m = String(str || "").trim().match(
      /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
    );
    if (!m) return null;

    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const y = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = Number(m[6]);

    const dt = new Date(y, mo, d, hh, mm, ss);
    if (!Number.isFinite(dt.getTime())) return null;

    // valida que o Date não "corrigiu" para outro dia/mês (ex: 32/13/2025)
    if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;

    return dt;
  }

  function formatDateTime(dt) {
    if (!(dt instanceof Date) || !Number.isFinite(dt.getTime())) return "—";
    const pad = n => String(n).padStart(2, "0");
    return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
  }

  // ======================================================================
  // 12.3) RECÁLCULO DO RETORNO DE FROTA (Q8)
  // ======================================================================

  function recalcFleetReturn(forceClear = false) {
    const sel = $("return-speed");
    const arrivalStr = $("arrival-time")?.value || "";
    const cancelStr = $("cancel-time")?.value || "";
    const errEl = $("ret-error");

    const depEl = $("ret-departure");
    const flownEl = $("ret-flown");
    const retEl = $("ret-return");
    const phBox = $("phalanx-result");

    if (errEl) errEl.textContent = "";

    // clear helper (quando não há dados)
    if (forceClear || !sel || !Array.isArray(state.flightTimes) || state.flightTimes.length === 0) {
      if (depEl) depEl.textContent = "—";
      if (flownEl) flownEl.textContent = "—";
      if (retEl) retEl.textContent = "—";
      if (phBox) phBox.style.display = "none";
      return;
    }

    const percent = Number(sel.value);
    const row = state.flightTimes.find(r => r.percent === percent);
    if (!row) {
      if (errEl) errEl.textContent = "Velocidade inválida (sem dados do Quadro 7)";
      return;
    }

    const arrival = parseDateTime(arrivalStr);
    if (!arrival) {
      // não mostra erro se o campo estiver vazio (para não ser chato ao digitar)
      if (arrivalStr.trim()) {
        if (errEl) errEl.textContent = "Hora de chegada inválida (dd/mm/aaaa hh:mm:ss)";
      }
      if (depEl) depEl.textContent = "—";
      if (flownEl) flownEl.textContent = "—";
      if (retEl) retEl.textContent = "—";
      if (phBox) phBox.style.display = "none";
      return;
    }

    // duração de IDA (segundos -> ms) à velocidade escolhida
    const flightMs = row.duration * 1000;

    // Hora de saída (chegada conhecida - duração)
    const departure = new Date(arrival.getTime() - flightMs);
    if (depEl) depEl.textContent = formatDateTime(departure);

    // Se não houver recall, ainda dá para mostrar a duração total de ida
    if (!cancelStr.trim()) {
      if (flownEl) flownEl.textContent = formatDuration(row.duration);
      if (retEl) retEl.textContent = "—";
      if (phBox) phBox.style.display = "none";
      return;
    }

    const cancel = parseDateTime(cancelStr);
    if (!cancel) {
      if (errEl) errEl.textContent = "Hora de cancelamento inválida (dd/mm/aaaa hh:mm:ss)";
      if (flownEl) flownEl.textContent = "—";
      if (retEl) retEl.textContent = "—";
      if (phBox) phBox.style.display = "none";
      return;
    }

    // ✅ tempo efetivamente voado até ao recall = cancel - saída
    const flownMs = cancel.getTime() - departure.getTime();

    if (flownMs < 0) {
      if (errEl) errEl.textContent = "Recall antes da saída (hora inválida)";
      if (flownEl) flownEl.textContent = "—";
      if (retEl) retEl.textContent = "—";
      if (phBox) phBox.style.display = "none";
      return;
    }

    if (flownMs > flightMs) {
      if (errEl) errEl.textContent = "Recall fora da janela de voo (passou da chegada)";
      if (flownEl) flownEl.textContent = "—";
      if (retEl) retEl.textContent = "—";
      if (phBox) phBox.style.display = "none";
      return;
    }

    const flownSec = Math.round(flownMs / 1000);
    if (flownEl) flownEl.textContent = formatDuration(flownSec);

    // Hora de retorno (simétrica ao tempo voado)
    const returnTime = new Date(cancel.getTime() + flownMs);
    if (retEl) retEl.textContent = formatDateTime(returnTime);

    // =========================
    // Janela de Phalanx
    // =========================
    const freq = Math.max(0, Math.trunc(num("phalanx-freq", 0)));
    if (freq > 0 && phBox) {
      // Calcular janela em torno da HORA DE RETORNO (não da hora de cancelamento)
      const min = new Date(returnTime.getTime() - freq * 1000);
      const max = new Date(returnTime.getTime() + freq * 1000);
      
      phBox.style.display = "block";
      const minEl = $("ret-phalanx-min");
      const maxEl = $("ret-phalanx-max");
      
      // Mensagens específicas conforme pedido
      if (minEl) minEl.textContent = `A frota não chega antes de ${formatDateTime(min)}`;
      if (maxEl) maxEl.textContent = `A frota não chega depois de ${formatDateTime(max)}`;
    } else if (phBox) {
      phBox.style.display = "none";
    }
  }

  // ======================================================================
  // 13) UNIVERSE CONFIG (chamado pelo universesLoader)
  // ======================================================================

  function setUniverseConfig(cfg) {
    if (cfg.galaxies != null) state.universe.galaxies = cfg.galaxies;
    if (cfg.systems != null) state.universe.systems = cfg.systems;
    if (cfg.donutGalaxy != null) state.universe.donutGalaxy = !!cfg.donutGalaxy;
    if (cfg.donutSystem != null) state.universe.donutSystem = !!cfg.donutSystem;

    if (cfg.speedFleetPeaceful != null) state.universe.speedPeaceful = cfg.speedFleetPeaceful;
    if (cfg.speedFleetWar != null) state.universe.speedWar = cfg.speedFleetWar;
    if (cfg.speedFleetHolding != null) state.universe.speedHolding = cfg.speedFleetHolding;

    if (cfg.deutFactor != null) {
      state.universe.deutFactor = cfg.deutFactor;
      const sel = $("universe-deut-factor");
      if (sel) sel.value = String(cfg.deutFactor);
    }

    // Espionage Probe Raids: quando ativo, sondas têm capacidade de 5
    if (cfg.espionageProbeRaids != null) {
      state.universe.probeCargo = cfg.espionageProbeRaids ? 5 : 0;
    }
    // Suporte direto para probeCargo (vindo do modal de universos personalizados)
    if (cfg.probeCargo != null) {
      state.universe.probeCargo = cfg.probeCargo;
    }

    setText("fleet-speed-peaceful", state.universe.speedPeaceful + "x");
    setText("fleet-speed-war", state.universe.speedWar + "x");
    setText("fleet-speed-holding", state.universe.speedHolding + "x");
    setText("universe-galaxies", state.universe.galaxies);
    setText("universe-systems", state.universe.systems);

    const gChk = $("donut-galaxy-check");
    const sChk = $("donut-system-check");
    const probeChk = $("espionage-probe-raids-check");
    if (gChk) gChk.checked = state.universe.donutGalaxy;
    if (sChk) sChk.checked = state.universe.donutSystem;
    if (probeChk) probeChk.checked = state.universe.probeCargo > 0;
    setText("donut-galaxy", state.universe.donutGalaxy ? "Sim" : "Não");
    setText("donut-system", state.universe.donutSystem ? "Sim" : "Não");
    setText("espionage-probe-raids-text", state.universe.probeCargo > 0 ? "Sim" : "Não");

    syncCoordInputLimits();
    writeCoordsToInputs("coord-origin", state.coords.origin);
    writeCoordsToInputs("coord-dest", state.coords.dest);

    recalc();
  }

  // ======================================================================
  // 14) DONUT TOGGLES
  // ======================================================================

  function initDonutToggles() {
    const gChk = $("donut-galaxy-check");
    const sChk = $("donut-system-check");
    const probeChk = $("espionage-probe-raids-check");

    if (gChk) {
      gChk.addEventListener("change", (e) => {
        state.universe.donutGalaxy = e.target.checked;
        setText("donut-galaxy", e.target.checked ? "Sim" : "Não");
        recalc();
      });
    }

    if (sChk) {
      sChk.addEventListener("change", (e) => {
        state.universe.donutSystem = e.target.checked;
        setText("donut-system", e.target.checked ? "Sim" : "Não");
        recalc();
      });
    }

    if (probeChk) {
      probeChk.addEventListener("change", (e) => {
        state.universe.probeCargo = e.target.checked ? 5 : 0;
        setText("espionage-probe-raids-text", e.target.checked ? "Sim" : "Não");
        recalc();
      });
    }
  }

  // ======================================================================
  // 15) CONTROLE DO CHECKBOX "MEMBRO DA MESMA ALIANÇA"
  // ======================================================================

  function updateSameAllianceCheckbox() {
    const checkbox = $("same-alliance");
    const hint = $("same-alliance-hint");
    const label = $("same-alliance-label");
    
    if (!checkbox) return;
    
    const allianceClass = parseInt($("alliance-class")?.value ?? "-1", 10);
    const isWarrior = allianceClass === 2; // Guerreiros
    
    if (isWarrior) {
      // Habilitar checkbox
      checkbox.disabled = false;
      if (label) label.style.color = "";
      if (hint) hint.style.display = "block";
    } else {
      // Desabilitar e desmarcar
      checkbox.disabled = true;
      checkbox.checked = false;
      if (label) label.style.color = "var(--text-muted)";
      if (hint) hint.style.display = "none";
    }
  }

  // ======================================================================
  // 16) BOOT
  // ======================================================================

    window.FlightCalc = {
    state,
    recalc,
    setUniverseConfig
  };

  document.addEventListener("DOMContentLoaded", () => {
    initLfTable();
    initFleetTable();
    initDonutToggles();

    syncCoordInputLimits();
    writeCoordsToInputs("coord-origin", state.coords.origin);
    writeCoordsToInputs("coord-dest", state.coords.dest);

    // Botão recalc removido da UI — cálculo é automático

    [
      "player-class","alliance-class",
      "tech-combustion","tech-impulse","tech-hyperspace","tech-hyperspace-tech",
      "lf-deut-reduction","character-class-booster",
      "coord-origin-g","coord-origin-s","coord-origin-p",
      "coord-dest-g","coord-dest-s","coord-dest-p",
      "mission-type",
      "same-alliance",
      "universe-deut-factor",
      "fleet-speed-override",
      "ignored-systems"
    ].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", recalc);
      el.addEventListener("keyup", recalc);
    });

    // Inputs do Quadro 8 (não devem forçar recálculo do Quadro 7)
    [
      "return-speed",
      "arrival-time",
      "cancel-time",
      "phalanx-freq"
    ].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => recalcFleetReturn());
      el.addEventListener("keyup", () => recalcFleetReturn());
    });

    for (let i = 0; i < 16; i++) {
      ["lf-speed-","lf-cargo-","lf-deut-","fleet-ship-"].forEach(prefix => {
        const el = $(prefix + i);
        if (!el) return;
        el.addEventListener("change", recalc);
        el.addEventListener("keyup", recalc);
      });
    }

    // Controle do checkbox "Membro da mesma aliança"
    const allianceClassEl = $("alliance-class");
    if (allianceClassEl) {
      allianceClassEl.addEventListener("change", updateSameAllianceCheckbox);
      updateSameAllianceCheckbox(); // Inicializar estado do checkbox
    }

    // Setup inicial default
    setUniverseConfig({
      galaxies: 9,
      systems: 499,
      donutGalaxy: true,
      donutSystem: true,
      speedFleetPeaceful: 1,
      speedFleetWar: 1,
      speedFleetHolding: 1,
      deutFactor: 1.0
    });

    console.log("[FlightCalc] Inicializado");
  });

})();