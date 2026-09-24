import { filterTab, setCategoryFilter } from "app/gestao/abas";
import { renderDashboardBars } from "app/gestao/extrato";
import {
  REGIONAL_LOADING_REGIONS,
  REGIONAL_NAV_REFRESH_REGIONS,
  cancelRefreshRegions
} from "app/gestao/refresh-regions";

function isGestaoPage() {
  return window.location.pathname.replace(/\/+$/, "/") === "/gestao/";
}

function openMonthPicker() {
  const modal = document.getElementById("month-picker-modal");

  if (window.AppDialogs) {
    window.AppDialogs.open(modal);
  } else if (modal && typeof modal.showModal === "function" && !modal.open) {
    modal.showModal();
  }
}

function getRegion(doc, name) {
  return doc.querySelector('[data-refresh-region="' + name + '"]');
}

function setNavActive(tab) {
  document.querySelectorAll("[data-gestao-tab-link]").forEach(function (link) {
    link.classList.toggle("is-active", link.getAttribute("data-gestao-tab-link") === tab);
  });
}

function buildTabUrl(tab) {
  const url = new URL(window.location.href);
  url.pathname = "/gestao/";
  url.searchParams.set("aba", tab);
  url.searchParams.delete("categoria");
  return url;
}

function getCurrentGestaoTab() {
  const pageTab = document.querySelector("[data-active-tab]")?.getAttribute("data-active-tab");
  return pageTab || new URLSearchParams(window.location.search).get("aba") || "extrato";
}

function shouldBlockForUnsavedMetas(event, url) {
  if (!window.AppMetas || typeof window.AppMetas.confirmBeforeLeaving !== "function") {
    return false;
  }

  if (!window.AppMetas.confirmBeforeLeaving(url)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  return true;
}

function needsFullContentSwap(tab) {
  return getCurrentGestaoTab() === "metas" || tab === "metas";
}

function getRegionHtml(name, html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "").trim();
  const region = template.content.querySelector('[data-refresh-region="' + name + '"]');
  return region ? region.innerHTML : String(html || "");
}

function replaceRegionHtml(name, html) {
  const current = document.querySelector('[data-refresh-region="' + name + '"]');
  if (!current) {
    return;
  }

  const template = document.createElement("template");
  template.innerHTML = String(html || "").trim();
  const next = template.content.querySelector('[data-refresh-region="' + name + '"]');
  if (next) {
    current.outerHTML = next.outerHTML;
  }
}

async function transitionTab(tab) {
  const targetRegion = tab === "extrato" ? "gestao-extrato" : "gestao-lista";

  if (window.AppPWA) {
    window.AppPWA.checkForUpdate(true);
  }

  filterTab(tab);
  setNavActive(tab);

  const region = window.AppRefresh ? window.AppRefresh.start(targetRegion, { type: "transactions", count: 4, minDuration: 520 }) : null;
  const url = buildTabUrl(tab);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json",
        "X-Requested-With": "fetch",
        "X-Gestao-Tab-Only": "1"
      }
    });

    if (!response.ok) {
      throw new Error("Gestao tab navigation failed");
    }

    const data = await response.json();
    if (!data.ok || !data.regions) {
      throw new Error("Gestao tab response rejected");
    }

    const html = getRegionHtml(targetRegion, data.regions[targetRegion]);
    replaceRegionHtml("gestao-acoes", data.regions["gestao-acoes"]);

    if (region && window.AppRefresh) {
      await window.AppRefresh.finish(region, html);
    } else {
      const current = document.querySelector('[data-refresh-region="' + targetRegion + '"]');
      if (current) {
        current.innerHTML = html;
      }
    }

    if (data.url) {
      window.history.replaceState({}, "", data.url);
    }

    filterTab(data.aba || tab);
    setNavActive(data.aba || tab);

    if ((data.aba || tab) === "extrato") {
      renderDashboardBars();
    }
  } catch (error) {
    if (window.AppRefresh) {
      window.AppRefresh.cancel(targetRegion);
    }
    window.location.href = url.toString();
  }
}

function syncMonthPicker(url) {
  const yearSelect = document.getElementById("picker_year");
  const params = url.searchParams;
  const mes = params.get("mes");
  const ano = params.get("ano");

  if (yearSelect && ano) {
    yearSelect.value = ano;
  }

  if (mes) {
    document.querySelectorAll(".month-select-btn").forEach(function (button) {
      button.classList.toggle("month-select-btn--active", button.getAttribute("data-month") === mes);
    });
  }
}

function startRegionalLoading() {
  if (!window.AppRefresh) {
    return;
  }

  REGIONAL_LOADING_REGIONS.forEach(function (name) {
    const options = name === "gestao-saldos"
      ? { type: "pills", count: 5, minDuration: 650 }
      : name === "gestao-resumo"
        ? { type: "cards", count: 5, minDuration: 650 }
        : { type: "transactions", count: 4, minDuration: 650 };

    window.AppRefresh.start(name, options);
  });
}

function cancelRegionalLoading() {
  cancelRefreshRegions(REGIONAL_LOADING_REGIONS);
}

function replaceRegions(doc) {
  const updates = [];

  REGIONAL_NAV_REFRESH_REGIONS.forEach(function (name) {
    const current = getRegion(document, name);
    const next = getRegion(doc, name);

    if (current && next) {
      if (window.AppRefresh && current.classList.contains("is-refreshing")) {
        updates.push(window.AppRefresh.finish(current, next.innerHTML));
        return;
      }

      current.outerHTML = next.outerHTML;
    }
  });

  return Promise.all(updates);
}

function replaceSingle(selector, doc) {
  const current = document.querySelector(selector);
  const next = doc.querySelector(selector);

  if (current && next) {
    current.outerHTML = next.outerHTML;
  }
}

function initLoadedTab(tab) {
  filterTab(tab);
  setNavActive(tab);

  if (tab === "extrato") {
    renderDashboardBars();
  }

  if (tab === "metas" && window.AppMetas) {
    window.AppMetas.init();
  }
}

function updateInlineData(doc) {
  const current = document.getElementById("acompanhamento-data");
  const next = doc.getElementById("acompanhamento-data");

  if (current && next) {
    current.textContent = next.textContent;
    document.dispatchEvent(new CustomEvent("gestao:config-updated"));
  }
}

function getActiveTabFrom(doc, fallbackUrl) {
  const wrap = doc.querySelector("[data-active-tab]");
  if (wrap && wrap.dataset.activeTab) {
    return wrap.dataset.activeTab;
  }

  return fallbackUrl.searchParams.get("aba") || "extrato";
}

function closeMonthPicker() {
  const modal = document.getElementById("month-picker-modal");
  if (!modal || !modal.open) {
    return;
  }

  if (window.AppDialogs) {
    window.AppDialogs.close(modal);
    return;
  }

  modal.close();
}

async function loadGestaoUrl(url, options) {
  const config = options || {};

  if (!config.fullContent) {
    startRegionalLoading();
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "Accept": "text/html",
        "X-Requested-With": "fetch"
      }
    });

    if (!response.ok) {
      throw new Error("Gestao navigation failed");
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const requestedTab = url.searchParams.get("aba");
    const activeTab = config.fullContent && requestedTab ? requestedTab : getActiveTabFrom(doc, url);

    replaceSingle(".month-nav", doc);
    if (config.fullContent) {
      replaceSingle('[data-refresh-region="gestao-conteudo"]', doc);
    } else {
      await replaceRegions(doc);
    }
    updateInlineData(doc);
    syncMonthPicker(url);

    if (config.push !== false) {
      window.history.pushState({}, "", url.toString());
    } else {
      window.history.replaceState({}, "", url.toString());
    }

    initLoadedTab(activeTab);

    if (config.closeMonthPicker) {
      closeMonthPicker();
    }
  } catch (error) {
    cancelRegionalLoading();
    window.location.href = url.toString();
  }
}

function buildMonthUrl(month) {
  const yearSelect = document.getElementById("picker_year");
  const url = new URL(window.location.href);
  const currentTab = getCurrentGestaoTab();

  url.pathname = "/gestao/";
  url.searchParams.set("mes", month);
  url.searchParams.set("ano", yearSelect ? yearSelect.value : url.searchParams.get("ano"));
  url.searchParams.set("aba", currentTab);
  url.searchParams.delete("categoria");
  return url;
}

function handleGestaoTabLink(event, link) {
  if (!isGestaoPage()) {
    return;
  }

  const tab = link.getAttribute("data-gestao-tab-link") || "extrato";
  const url = buildTabUrl(tab);
  if (shouldBlockForUnsavedMetas(event, url)) {
    return;
  }

  event.preventDefault();
  if (needsFullContentSwap(tab)) {
    loadGestaoUrl(url, { fullContent: true });
  } else {
    transitionTab(tab);
  }
}

function handleMonthLink(event, link) {
  if (!isGestaoPage()) {
    return;
  }

  const url = new URL(link.getAttribute("href"), window.location.href);
  if (url.pathname.replace(/\/+$/, "/") !== "/gestao/") {
    return;
  }

  const currentTab = getCurrentGestaoTab();
  url.searchParams.set("aba", currentTab);
  url.searchParams.delete("categoria");
  if (shouldBlockForUnsavedMetas(event, url)) {
    return;
  }

  event.preventDefault();
  loadGestaoUrl(url, { fullContent: getCurrentGestaoTab() === "metas" });
}

async function handleRankingLink(event, link) {
  if (!isGestaoPage()) {
    return;
  }

  const url = new URL(link.getAttribute("href"), window.location.href);
  if (url.pathname.replace(/\/+$/, "/") !== "/gestao/") {
    return;
  }

  const categoryId = url.searchParams.get("categoria") || "";
  const tab = url.searchParams.get("aba") || "extrato";
  if (shouldBlockForUnsavedMetas(event, url)) {
    return;
  }

  event.preventDefault();
  await transitionTab(tab);
  setCategoryFilter(categoryId);
}

function handleMonthButton(event, button) {
  if (!isGestaoPage()) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const url = buildMonthUrl(button.getAttribute("data-month"));
  if (shouldBlockForUnsavedMetas(event, url)) {
    return;
  }

  loadGestaoUrl(url, {
    closeMonthPicker: true,
    fullContent: getCurrentGestaoTab() === "metas"
  });
}

function syncOrcamentoFormPeriod() {
  const form = document.querySelector("#orcamento-modal form");
  if (!form) {
    return;
  }

  const url = new URL(window.location.href);
  const today = new Date();
  const mes = url.searchParams.get("mes") || String(today.getMonth() + 1);
  const ano = url.searchParams.get("ano") || String(today.getFullYear());
  const aba = url.searchParams.get("aba") || getCurrentGestaoTab();
  const next = new URL("/gestao/", window.location.origin);

  next.searchParams.set("mes", mes);
  next.searchParams.set("ano", ano);
  next.searchParams.set("aba", aba);

  form.elements.mes.value = mes;
  form.elements.ano.value = ano;
  form.elements.next.value = next.pathname + next.search;
}

export function initGestaoNavigation() {
  if (document.documentElement.dataset.gestaoNavigationReady === "1") {
    return;
  }
  document.documentElement.dataset.gestaoNavigationReady = "1";

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const tabLink = target.closest("[data-gestao-tab-link]");
    if (tabLink) {
      handleGestaoTabLink(event, tabLink);
      return;
    }

    const rankingLink = target.closest(".ranking-link[href]");
    if (rankingLink) {
      handleRankingLink(event, rankingLink);
      return;
    }

    if (target.closest('[data-modal-open="orcamento-modal"]')) {
      syncOrcamentoFormPeriod();
      return;
    }

    const monthPickerTrigger = target.closest("[data-month-picker-open]");
    if (monthPickerTrigger) {
      event.preventDefault();
      event.stopPropagation();
      openMonthPicker();
      return;
    }

    const monthButton = target.closest(".month-select-btn");
    if (monthButton) {
      handleMonthButton(event, monthButton);
      return;
    }

    const monthLink = target.closest(".month-nav a[href]");
    if (monthLink) {
      handleMonthLink(event, monthLink);
    }
  }, true);

  document.addEventListener("submit", function (event) {
    if (event.target instanceof HTMLFormElement && event.target.closest("#orcamento-modal")) {
      syncOrcamentoFormPeriod();
    }
  }, true);

  window.addEventListener("popstate", function () {
    if (!isGestaoPage()) {
      return;
    }

    const url = new URL(window.location.href);
    const targetTab = url.searchParams.get("aba") || "extrato";
    loadGestaoUrl(url, {
      push: false,
      fullContent: needsFullContentSwap(targetTab)
    });
  });
}
