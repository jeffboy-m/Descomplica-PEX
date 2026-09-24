import { renderDashboardBars } from "app/gestao/extrato";

let currentTab = "extrato";
const validTabs = ["extrato", "entrada", "saida", "cartao", "transferencia", "metas"];
const filterTabs = ["entrada", "saida", "cartao"];
let lastCategoryFilter = new URLSearchParams(window.location.search).get("categoria") || "";
const tabLabels = {
  extrato: "Extrato",
  entrada: "Receitas",
  saida: "Despesas",
  cartao: "Cartão",
  transferencia: "Transf. entre contas",
  metas: "Metas"
};

function canUseCategoryFilter(tab) {
  return filterTabs.includes(tab);
}

function getLaunchButtons() {
  return document.querySelectorAll(".launch-button");
}

function updateTabPanels(activeTab) {
  document.querySelectorAll("[data-tab-panel]").forEach(function (panel) {
    panel.hidden = panel.getAttribute("data-tab-panel") !== activeTab;
  });
}

function setSectionVisibility(element, visible) {
  if (element) {
    element.hidden = !visible;
  }
}

function resetTransactionItemsDisplay() {
  document.querySelectorAll(".transaction-item").forEach(function (item) {
    item.hidden = false;
  });
  document.querySelectorAll(".card-transaction-item").forEach(function (item) {
    item.hidden = false;
  });
}

function getSavedTab() {
  const requestedTab = new URLSearchParams(window.location.search).get("aba");
  if (validTabs.includes(requestedTab)) {
    return requestedTab;
  }
  return "extrato";
}

function syncTabUrl(tab) {
  if (!window.history || typeof window.history.replaceState !== "function") {
    return;
  }

  const url = new URL(window.location.href);
  if (url.pathname.replace(/\/+$/, "/") !== "/gestao/") {
    return;
  }

  const previousTab = url.searchParams.get("aba") || "extrato";
  if (previousTab !== tab) {
    url.searchParams.delete("categoria");
  }

  if (url.searchParams.get("aba") === tab && previousTab === tab) {
    return;
  }

  url.searchParams.set("aba", tab);
  window.history.replaceState({}, "", url.toString());
}

function syncCategoryUrl(categoryId) {
  if (!window.history || typeof window.history.replaceState !== "function") {
    return;
  }

  const url = new URL(window.location.href);
  if (url.pathname.replace(/\/+$/, "/") !== "/gestao/") {
    return;
  }

  if (canUseCategoryFilter(currentTab)) {
    lastCategoryFilter = categoryId || "";
  }

  if (url.searchParams.has("categoria")) {
    url.searchParams.delete("categoria");
    window.history.replaceState({}, "", url.toString());
  }
}

function removeCategoryFromUrl() {
  if (!window.history || typeof window.history.replaceState !== "function") {
    return;
  }

  const url = new URL(window.location.href);
  if (url.searchParams.has("categoria")) {
    url.searchParams.delete("categoria");
    window.history.replaceState({}, "", url.toString());
  }
}

function getCategorySelect() {
  return document.querySelector("[data-category-filter]");
}

function hasCategoryOption(select, categoryId) {
  return Boolean(select && categoryId && Array.from(select.options).some(function (option) {
    return option.value === categoryId;
  }));
}

function restoreLastCategoryFilter() {
  const select = getCategorySelect();
  if (!select || select.value || !lastCategoryFilter) {
    return;
  }

  if (hasCategoryOption(select, lastCategoryFilter)) {
    select.value = lastCategoryFilter;
  }
}

function getCategoryChip() {
  return document.querySelector("[data-category-filter-chip]");
}

function updateCategoryChip() {
  const select = getCategorySelect();
  const chip = getCategoryChip();
  if (!select || !chip) {
    return;
  }

  const label = chip.querySelector("[data-category-filter-label]");
  const selected = select.selectedOptions[0];
  const hasFilter = Boolean(select.value);

  chip.hidden = !hasFilter;
  if (label) {
    label.textContent = hasFilter ? "Categoria: " + selected.textContent.trim() : "";
  }
}

function syncActionControls(tab) {
  const actionRow = document.querySelector('[data-refresh-region="gestao-acoes"]');
  if (actionRow) {
    actionRow.hidden = tab === "extrato";
  }

  const canFilter = canUseCategoryFilter(tab);
  document.querySelectorAll(".quick-category-filter").forEach(function (filter) {
    filter.hidden = !canFilter;
  });
  document.querySelectorAll("[data-category-filter-chip]").forEach(function (chip) {
    if (!canFilter) {
      chip.hidden = true;
    }
  });
}

function applyCategoryFilter(options = {}) {
  const shouldRestore = options.restore !== false;
  const select = getCategorySelect();
  if (canUseCategoryFilter(currentTab)) {
    if (!select) {
      removeCategoryFromUrl();
      return;
    }
    if (shouldRestore) {
      restoreLastCategoryFilter();
    }
  }
  const categoryId = select ? select.value : "";

  if (!canUseCategoryFilter(currentTab)) {
    if (select) {
      select.value = "";
    }
    resetTransactionItemsDisplay();
    updateCategoryChip();
    removeCategoryFromUrl();
    return;
  }

  if (currentTab === "cartao") {
    document.querySelectorAll('[data-tab-panel="cartao"] .card-group').forEach(function (group) {
      let hasVisibleTransaction = false;
      group.querySelectorAll(".card-transaction-item[data-categoria]").forEach(function (item) {
        const visible = !categoryId || item.getAttribute("data-categoria") === categoryId;
        item.hidden = !visible;
        hasVisibleTransaction = hasVisibleTransaction || visible;
      });
      group.hidden = !hasVisibleTransaction;
      group.classList.toggle("card-group--open", Boolean(categoryId) && hasVisibleTransaction);
    });
  } else {
    document.querySelectorAll('[data-tab-panel="' + currentTab + '"] .transaction-item[data-categoria]').forEach(function (item) {
      item.hidden = Boolean(categoryId) && item.getAttribute("data-categoria") !== categoryId;
    });
  }

  updateCategoryChip();
  syncCategoryUrl(categoryId);
}

export function setCategoryFilter(categoryId) {
  const select = getCategorySelect();
  if (!select) {
    return;
  }

  select.value = categoryId || "";
  if (!categoryId) {
    lastCategoryFilter = "";
  }
  applyCategoryFilter({ restore: Boolean(categoryId) });
}

export function initCategoryFilters() {
  document.addEventListener("change", function (event) {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !select.matches("[data-category-filter]")) {
      return;
    }

    if (!select.value) {
      lastCategoryFilter = "";
    }
    applyCategoryFilter({ restore: Boolean(select.value) });
  });

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const clearButton = target.closest("[data-category-filter-clear]");
    if (!clearButton) {
      return;
    }

    event.preventDefault();
    setCategoryFilter("");
  });
}

export function applyInitialTabState() {
  const savedTab = getSavedTab();
  if (savedTab !== "extrato") {
    filterTab(savedTab);
  }
}

export function filterTab(type) {
  const normalizedType = validTabs.includes(type) ? type : "extrato";
  currentTab = normalizedType;
  syncTabUrl(normalizedType);
  syncActionControls(normalizedType);
  document.querySelectorAll("[data-active-tab]").forEach(function (element) {
    element.setAttribute("data-active-tab", normalizedType);
    element.classList.toggle("metas-shell", normalizedType === "metas");
  });
  document.querySelectorAll('input[name="aba"]').forEach(function (field) {
    field.value = normalizedType;
  });
  window.dispatchEvent(new CustomEvent("gestao:tab-change", { detail: { tab: normalizedType } }));
  document.querySelectorAll("[data-active-section-title]").forEach(function (element) {
    element.textContent = tabLabels[normalizedType] || "Extrato";
  });
  const dashboardSection = document.getElementById("dashboard-section");
  const transactionsSection = document.getElementById("transactions-list-section");
  const faturasSection = document.getElementById("faturas-section");
  const transferenciasPanel = document.querySelector("[data-transferencias-panel]");
  const launchButtons = getLaunchButtons();

  launchButtons.forEach(function (button) {
    button.hidden = normalizedType === "extrato";
    button.dataset.createTransaction = normalizedType;
    button.textContent = normalizedType === "transferencia" ? "+ Transferir" : "+ Lançar";
  });

  if (normalizedType === "metas") {
    setSectionVisibility(dashboardSection, false);
    setSectionVisibility(transactionsSection, false);
    setSectionVisibility(faturasSection, false);
    setSectionVisibility(transferenciasPanel, false);
    updateTabPanels(normalizedType);
    setCategoryFilter("");
  } else if (normalizedType === "extrato") {
    setSectionVisibility(dashboardSection, true);
    setSectionVisibility(transactionsSection, false);
    setSectionVisibility(faturasSection, false);
    setSectionVisibility(transferenciasPanel, false);
    updateTabPanels(normalizedType);
    setCategoryFilter("");
    renderDashboardBars();
  } else {
    setSectionVisibility(dashboardSection, false);
    setSectionVisibility(transactionsSection, true);
    updateTabPanels(normalizedType);
    resetTransactionItemsDisplay();
    setSectionVisibility(faturasSection, normalizedType === "saida");
    setSectionVisibility(transferenciasPanel, normalizedType === "transferencia");
    applyCategoryFilter();
  }
}

export function initTabs() {
  const savedTab = getSavedTab();
  if (savedTab === "extrato") {
    setCategoryFilter("");
    renderDashboardBars();
  } else {
    filterTab(savedTab);
  }
}

export function getCurrentTab() {
  return currentTab;
}
