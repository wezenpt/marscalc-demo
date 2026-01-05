(function() {
  'use strict';

  // ========== ACCORDION ==========
  function initAccordion() {
    const toggleButtons = document.querySelectorAll('.accordion-toggle');
    
    toggleButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-target');
        const content = document.getElementById(targetId);
        
        if (!content) return;
        
        const isCollapsed = content.classList.contains('collapsed');
        
        if (isCollapsed) {
          // Expandir
          content.classList.remove('collapsed');
          button.textContent = '−';
        } else {
          // Fechar
          content.classList.add('collapsed');
          button.textContent = '+';
        }
      });
    });
    
    console.log('[Accordion] ✓ Inicializado');
  }

  // ========== NAVIGATION ==========
  function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    
    function setActiveNav() {
      let current = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.scrollY >= sectionTop - 100) {
          current = section.getAttribute('id');
        }
      });
      
      navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href') === `#${current}`) {
          item.classList.add('active');
        }
      });
    }
    
    window.addEventListener('scroll', setActiveNav);
    setActiveNav();
  }

  // ========== SMOOTH SCROLL ==========
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ========== THEME TOGGLE ==========
  function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) {
      console.warn('[Theme] Botão não encontrado');
      return;
    }
    
    const themeIcon = themeToggle.querySelector('.theme-icon');
    const themeLabel = themeToggle.querySelector('.theme-label');
    
    // Carregar tema salvo
    const savedTheme = localStorage.getItem('flightcalc-theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
      if (themeIcon) themeIcon.textContent = '☀️';
      if (themeLabel) themeLabel.textContent = 'Tema Claro';
    }
    
    // Toggle ao clicar
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      
      if (isDark) {
        localStorage.setItem('flightcalc-theme', 'dark');
        if (themeIcon) themeIcon.textContent = '☀️';
        if (themeLabel) themeLabel.textContent = 'Tema Claro';
        console.log('[Theme] ✓ Escuro ativado');
      } else {
        localStorage.setItem('flightcalc-theme', 'light');
        if (themeIcon) themeIcon.textContent = '🌙';
        if (themeLabel) themeLabel.textContent = 'Tema Escuro';
        console.log('[Theme] ✓ Claro ativado');
      }
    });
    
    console.log('[Theme] ✓ Inicializado');
  }

  // ========== SWAP COORDINATES ==========
  function initSwapCoordinates() {
    const swapBtn = document.getElementById('swap-coords-btn');
    if (!swapBtn) return;
    
    swapBtn.addEventListener('click', () => {
      const originG = document.getElementById('coord-origin-g');
      const originS = document.getElementById('coord-origin-s');
      const originP = document.getElementById('coord-origin-p');
      const destG = document.getElementById('coord-dest-g');
      const destS = document.getElementById('coord-dest-s');
      const destP = document.getElementById('coord-dest-p');
      
      if (!originG || !originS || !originP || !destG || !destS || !destP) return;
      
      // Swap values
      [originG.value, destG.value] = [destG.value, originG.value];
      [originS.value, destS.value] = [destS.value, originS.value];
      [originP.value, destP.value] = [destP.value, originP.value];
      
      // Trigger events
      [originG, originS, originP, destG, destS, destP].forEach(input => {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      console.log('[Swap] ✓ Coordenadas trocadas');
    });
  }

  // ========== HIDE SOLAR SATELLITE IN LF TABLE ==========
  function hideSolarSatelliteInLFTable() {
    const lfTableBody = document.getElementById('lf-table-body');
    if (!lfTableBody) return;
    
    const observer = new MutationObserver(() => {
      const rows = lfTableBody.querySelectorAll('tr');
      if (rows[10]) {
        rows[10].style.display = 'none';
        console.log('[LF Table] Satélite Solar escondido');
      }
    });
    
    observer.observe(lfTableBody, { childList: true });
    
    setTimeout(() => {
      const rows = lfTableBody.querySelectorAll('tr');
      if (rows[10]) {
        rows[10].style.display = 'none';
      }
    }, 500);
  }

  // ========== SPLIT FLEET TABLE ==========
  function splitFleetTable() {
    const tbody1 = document.getElementById('fleet-table-body');
    const tbody2 = document.getElementById('fleet-table-body-2');
    
    if (!tbody1 || !tbody2) return;
    
    let isProcessing = false;
    let hasProcessed = false;
    
    function processFleetTable() {
      if (isProcessing || hasProcessed) return;
      
      const allRows = Array.from(tbody1.querySelectorAll('tr'));
      if (allRows.length < 10) return;
      
      isProcessing = true;
      hasProcessed = true;
      
      console.log('[Fleet Split] Processando', allRows.length, 'naves');
      
      observer.disconnect();
      
      try {
        // Esconder Satélite Solar (índice 10)
        if (allRows[10]) {
          allRows[10].style.display = 'none';
          console.log('[Fleet Split] Satélite Solar escondido');
        }
        
        // Filtrar linhas visíveis
        const rows = allRows.filter((row, index) => index !== 10);
        
        console.log('[Fleet Split] Após filtro:', rows.length, 'naves visíveis');
        
        if (rows.length === 0) return;
        
        const midPoint = Math.ceil(rows.length / 2);
        
        // Limpar tbody2
        tbody2.innerHTML = '';
        
        // Clonar segunda metade para tbody2
        for (let i = midPoint; i < rows.length; i++) {
          const clonedRow = rows[i].cloneNode(true);
          clonedRow.style.display = '';
          tbody2.appendChild(clonedRow);
        }
        
        // Limpar tbody1 e adicionar primeira metade
        tbody1.innerHTML = '';
        for (let i = 0; i < midPoint; i++) {
          const clonedRow = rows[i].cloneNode(true);
          clonedRow.style.display = '';
          tbody1.appendChild(clonedRow);
        }
        
        // Re-adicionar Satélite Solar escondido ao tbody1 (para apiImporter)
        if (allRows[10]) {
          tbody1.appendChild(allRows[10]);
        }
        
        console.log('[Fleet Split] ✓ Tabela dividida:', midPoint, '+', (rows.length - midPoint), 'naves');
        
      } finally {
        isProcessing = false;
      }
    }
    
    const observer = new MutationObserver((mutations) => {
      const hasAdditions = mutations.some(m => m.addedNodes.length > 0);
      if (hasAdditions) {
        processFleetTable();
      }
    });
    
    observer.observe(tbody1, { childList: true });
    
    setTimeout(() => {
      if (!hasProcessed) {
        processFleetTable();
      }
    }, 500);
    
    setTimeout(() => {
      if (!hasProcessed) {
        console.log('[Fleet Split] Tentativa fallback...');
        processFleetTable();
      }
    }, 2000);
  }

  // ========== INIT ==========
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Accordion v3] Inicializando...');
    
    initAccordion();
    initNavigation();
    initSmoothScroll();
    initThemeToggle();
    initSwapCoordinates();
    hideSolarSatelliteInLFTable();
    splitFleetTable();
    
    console.log('[Accordion v3] ✓ Inicialização completa');
  });

})();