// customUniverses.js – Módulo de Universos Personalizados (Modal Popup)
// Integra-se no dropdown de universos e abre modal para configuração

(() => {
  "use strict";

  const STORAGE_KEY = "flightcalc-custom-universes";
  const ACTIVE_KEY = "flightcalc-active-custom";
  
  const $ = id => document.getElementById(id);

  // ============================================================
  // CONFIGURAÇÃO PADRÃO
  // ============================================================

  function getDefaultConfig() {
    return {
      name: "Universo Personalizado",
      galaxies: 9,
      systems: 499,
      donutGalaxy: true,
      donutSystem: true,
      speedPeaceful: 1,
      speedWar: 1,
      speedHolding: 1,
      deutFactor: 1.0,
      probeCargo: 0
    };
  }

  // ============================================================
  // MAPEAMENTO DEUTÉRIO
  // ============================================================

  const DEUT_MAP = {
    100: 1.0, 90: 0.9, 80: 0.8, 70: 0.7, 60: 0.6, 50: 0.5
  };

  function percentToFactor(percent) {
    return DEUT_MAP[percent] || 1.0;
  }

  function factorToPercent(factor) {
    const rounded = Math.round(factor * 10) / 10;
    for (const [key, val] of Object.entries(DEUT_MAP)) {
      if (val === rounded) return parseInt(key);
    }
    return 100;
  }

  // ============================================================
  // STORAGE
  // ============================================================

  function loadPresets() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function savePresets(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  }

  function loadActive() {
    try {
      const data = localStorage.getItem(ACTIVE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function saveActive(config) {
    try {
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error("[CustomUniverses] Erro ao guardar ativo:", e);
    }
  }

  // ============================================================
  // CRUD PRESETS
  // ============================================================

  function addPreset(config) {
    const list = loadPresets();
    if (list.some(p => p.name === config.name)) {
      throw new Error(`Preset "${config.name}" já existe`);
    }
    list.push({ ...config, id: Date.now() });
    savePresets(list);
  }

  function updatePreset(id, config) {
    const list = loadPresets();
    const index = list.findIndex(p => p.id === id);
    if (index === -1) throw new Error("Preset não encontrado");
    
    const exists = list.some((p, i) => p.name === config.name && i !== index);
    if (exists) throw new Error(`Nome "${config.name}" já existe`);
    
    list[index] = { ...config, id };
    savePresets(list);
  }

  function deletePreset(id) {
    const list = loadPresets();
    savePresets(list.filter(p => p.id !== id));
  }

  function getPreset(id) {
    return loadPresets().find(p => p.id === id) || null;
  }

  // ============================================================
  // FORMULÁRIO MODAL
  // ============================================================

  function readModalForm() {
    const probeCargoChecked = $("modal-probe-cargo")?.checked ?? false;
    return {
      name: $("modal-name")?.value.trim() || "Universo Personalizado",
      galaxies: parseInt($("modal-galaxies")?.value || "9"),
      systems: parseInt($("modal-systems")?.value || "499"),
      donutGalaxy: $("modal-donut-galaxy")?.checked ?? true,
      donutSystem: $("modal-donut-system")?.checked ?? true,
      speedPeaceful: parseInt($("modal-speed-peaceful")?.value || "1"),
      speedWar: parseInt($("modal-speed-war")?.value || "1"),
      speedHolding: parseInt($("modal-speed-holding")?.value || "1"),
      deutFactor: percentToFactor(parseInt($("modal-deut-percent")?.value || "100")),
      probeCargo: probeCargoChecked ? 5 : 0
    };
  }

  function fillModalForm(config) {
    if ($("modal-name")) $("modal-name").value = config.name;
    if ($("modal-galaxies")) $("modal-galaxies").value = config.galaxies;
    if ($("modal-systems")) $("modal-systems").value = config.systems;
    if ($("modal-donut-galaxy")) $("modal-donut-galaxy").checked = config.donutGalaxy;
    if ($("modal-donut-system")) $("modal-donut-system").checked = config.donutSystem;
    if ($("modal-speed-peaceful")) $("modal-speed-peaceful").value = config.speedPeaceful;
    if ($("modal-speed-war")) $("modal-speed-war").value = config.speedWar;
    if ($("modal-speed-holding")) $("modal-speed-holding").value = config.speedHolding;
    if ($("modal-deut-percent")) $("modal-deut-percent").value = factorToPercent(config.deutFactor);
    if ($("modal-probe-cargo")) $("modal-probe-cargo").checked = (config.probeCargo || 0) > 0;
  }

  // ============================================================
  // APLICAR AO FLIGHTCALC
  // ============================================================

  function applyToFlightCalc(config) {
    if (!window.FlightCalc?.setUniverseConfig) {
      console.error("[CustomUniverses] FlightCalc não disponível");
      return false;
    }

    window.FlightCalc.setUniverseConfig({
      galaxies: config.galaxies,
      systems: config.systems,
      donutGalaxy: config.donutGalaxy,
      donutSystem: config.donutSystem,
      speedFleetPeaceful: config.speedPeaceful,
      speedFleetWar: config.speedWar,
      speedFleetHolding: config.speedHolding,
      deutFactor: config.deutFactor,
      probeCargo: config.probeCargo || 0
    });

    saveActive(config);
    
    // Atualizar dropdown para mostrar que está a usar custom
    const select = $("select-universe");
    if (select) {
      select.value = "CUSTOM_ACTIVE";
    }
    
    console.log(`[CustomUniverses] Aplicado: ${config.name}`);
    return true;
  }

  // ============================================================
  // MODAL - ABRIR/FECHAR
  // ============================================================

  function openModal() {
    const modal = $("custom-universe-modal");
    if (!modal) return;

    // Carregar última config ou default
    const active = loadActive() || getDefaultConfig();
    fillModalForm(active);
    renderPresetsList();
    
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    
    console.log("[CustomUniverses] Modal aberto");
  }

  function closeModal() {
    const modal = $("custom-universe-modal");
    if (!modal) return;

    modal.style.display = "none";
    document.body.style.overflow = "";
    
    // Reset dropdown para primeira opção se não aplicou
    const select = $("select-universe");
    if (select && select.value === "CUSTOM_TRIGGER") {
      select.value = "";
    }
    
    console.log("[CustomUniverses] Modal fechado");
  }

  // ============================================================
  // LISTA DE PRESETS NO MODAL
  // ============================================================

  function renderPresetsList() {
    const container = $("modal-presets-list");
    if (!container) return;

    const presets = loadPresets();
    
    if (presets.length === 0) {
      container.innerHTML = `
        <div class="modal-empty-state">
          <p>📦 Nenhum preset guardado</p>
          <small>Configura e clica "💾 Guardar Preset"</small>
        </div>
      `;
      return;
    }

    container.innerHTML = presets.map(p => {
      const probeIcon = (p.probeCargo && p.probeCargo > 0) ? ' • 🔍' : '';
      return `
        <div class="modal-preset-item">
          <div class="modal-preset-info">
            <strong>${p.name}</strong>
            <small>${p.galaxies}G × ${p.systems}S • ${p.speedPeaceful}/${p.speedWar}/${p.speedHolding}x • Deut ${factorToPercent(p.deutFactor)}%${probeIcon}</small>
          </div>
          <div class="modal-preset-actions">
            <button class="modal-btn-icon modal-btn-load" data-id="${p.id}" title="Carregar">📂</button>
            <button class="modal-btn-icon modal-btn-delete" data-id="${p.id}" title="Eliminar">🗑️</button>
          </div>
        </div>
      `;
    }).join("");

    attachPresetListeners();
  }

  function attachPresetListeners() {
    // Carregar preset
    document.querySelectorAll(".modal-btn-load").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id);
        const preset = getPreset(id);
        if (preset) {
          fillModalForm(preset);
          toast(`📂 "${preset.name}" carregado`, "info");
        }
      });
    });

    // Eliminar preset
    document.querySelectorAll(".modal-btn-delete").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id);
        const preset = getPreset(id);
        if (preset && confirm(`Eliminar "${preset.name}"?`)) {
          deletePreset(id);
          renderPresetsList();
          toast("Preset eliminado", "info");
        }
      });
    });
  }

  // ============================================================
  // HANDLERS
  // ============================================================

  function handleApply() {
    try {
      const config = readModalForm();
      applyToFlightCalc(config);
      toast(`✓ "${config.name}" aplicado!`, "success");
      closeModal();
    } catch (e) {
      toast(`Erro: ${e.message}`, "error");
    }
  }

  function handleSave() {
    try {
      const config = readModalForm();
      addPreset(config);
      renderPresetsList();
      toast(`💾 "${config.name}" guardado!`, "success");
    } catch (e) {
      toast(e.message, "error");
    }
  }

  function handleReset() {
    const def = getDefaultConfig();
    fillModalForm(def);
    toast("Configuração padrão", "info");
  }

  function handleExport() {
    try {
      const config = readModalForm();
      const json = JSON.stringify(config, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `universe-${config.name.replace(/\s+/g, "-").toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("📥 Exportado!", "success");
    } catch (e) {
      toast(`Erro: ${e.message}`, "error");
    }
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    
    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const config = JSON.parse(ev.target.result);
          if (!config.name || !config.galaxies) throw new Error("JSON inválido");
          fillModalForm(config);
          toast(`📤 "${config.name}" importado!`, "success");
        } catch (e) {
          toast(`Erro: ${e.message}`, "error");
        }
      };
      reader.readAsText(file);
    });

    input.click();
  }

  function handleCancel() {
    closeModal();
  }

  // ============================================================
  // TOAST
  // ============================================================

  function toast(msg, type = "info") {
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }

  // ============================================================
  // INTEGRAÇÃO COM DROPDOWN
  // ============================================================

  function addCustomOptionToDropdown() {
    const select = $("select-universe");
    if (!select) return;

    // Remover opções custom antigas (se existirem)
    const toRemove = [];
    Array.from(select.options).forEach(opt => {
      if (opt.value === "CUSTOM_TRIGGER" || 
          opt.value === "CUSTOM_ACTIVE" || 
          opt.value === "CUSTOM_SEPARATOR") {
        toRemove.push(opt);
      }
    });
    toRemove.forEach(opt => opt.remove());

    // Só adicionar se houver universos (mais que 1 opção - a placeholder)
    if (select.options.length <= 1) return;

    // Separador visual
    const separator = document.createElement("option");
    separator.disabled = true;
    separator.value = "CUSTOM_SEPARATOR";
    separator.textContent = "────────────────────";
    select.appendChild(separator);
    
    // Opção trigger
    const opt = document.createElement("option");
    opt.value = "CUSTOM_TRIGGER";
    opt.textContent = "⚙️ Criar Universo Personalizado";
    select.appendChild(opt);
    
    // Opção "Usando Custom" (hidden, só para mostrar estado)
    const optActive = document.createElement("option");
    optActive.value = "CUSTOM_ACTIVE";
    optActive.textContent = "⚙️ Personalizado (ativo)";
    optActive.style.display = "none";
    select.appendChild(optActive);
    
    console.log("[CustomUniverses] Opção 'Criar Personalizado' adicionada");
  }

  function setupDropdown() {
    const selectUniverse = $("select-universe");
    const selectCommunity = $("select-community");
    
    if (!selectUniverse) return;

    let isProcessing = false;
    let observer = null;

    // Função segura para adicionar opção (evita loop)
    function safeAddOption() {
      if (isProcessing) return;
      isProcessing = true;
      
      // Desconectar observer temporariamente
      if (observer) observer.disconnect();
      
      // Adicionar opção
      addCustomOptionToDropdown();
      
      // Reconectar observer após pequeno delay
      setTimeout(() => {
        if (observer) {
          observer.observe(selectUniverse, { childList: true });
        }
        isProcessing = false;
      }, 100);
    }

    // Observer para mudanças no dropdown de universos
    observer = new MutationObserver((mutations) => {
      // Só processa se houve adição de nós (novos universos)
      const hasAdditions = mutations.some(m => m.addedNodes.length > 0);
      if (hasAdditions && !isProcessing) {
        safeAddOption();
      }
    });

    observer.observe(selectUniverse, { childList: true });

    // Se existe dropdown de comunidade, adiciona listener direto
    if (selectCommunity) {
      selectCommunity.addEventListener("change", () => {
        // Aguarda um pouco para os universos carregarem
        setTimeout(safeAddOption, 500);
      });
    }

    // Listener para quando selecionar "Criar Personalizado"
    selectUniverse.addEventListener("change", (e) => {
      if (e.target.value === "CUSTOM_TRIGGER") {
        openModal();
      }
    });

    // Adicionar opção inicial (se já houver universos)
    setTimeout(safeAddOption, 1000);
  }

  // ============================================================
  // INIT MODAL
  // ============================================================

  function initModal() {
    // Event listeners dos botões do modal
    const btnApply = $("modal-btn-apply");
    const btnSave = $("modal-btn-save");
    const btnReset = $("modal-btn-reset");
    const btnExport = $("modal-btn-export");
    const btnImport = $("modal-btn-import");
    const btnCancel = $("modal-btn-cancel");
    const btnClose = $("modal-btn-close");

    if (btnApply) btnApply.addEventListener("click", handleApply);
    if (btnSave) btnSave.addEventListener("click", handleSave);
    if (btnReset) btnReset.addEventListener("click", handleReset);
    if (btnExport) btnExport.addEventListener("click", handleExport);
    if (btnImport) btnImport.addEventListener("click", handleImport);
    if (btnCancel) btnCancel.addEventListener("click", handleCancel);
    if (btnClose) btnClose.addEventListener("click", handleCancel);

    // Fechar com overlay
    const modal = $("custom-universe-modal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          handleCancel();
        }
      });
    }

    // Fechar com ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && modal.style.display === "flex") {
        handleCancel();
      }
    });
  }

  // ============================================================
  // INIT
  // ============================================================

  function init() {
    console.log("[CustomUniverses] Inicializando modal popup...");

    if (!window.FlightCalc) {
      setTimeout(init, 500);
      return;
    }

    initModal();
    
    // Setup dropdown
    if (window.UniversesLoader) {
      setTimeout(setupDropdown, 1000);
    }

    console.log("[CustomUniverses] ✓ Pronto");
  }

  // ============================================================
  // API
  // ============================================================

  window.CustomUniverses = {
    openModal,
    closeModal,
    loadPresets,
    addPreset,
    deletePreset,
    getPreset,
    applyToFlightCalc
  };

  // ============================================================
  // BOOT
  // ============================================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();