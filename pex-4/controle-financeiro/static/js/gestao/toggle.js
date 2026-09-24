import { filterTab } from "./abas.js";
import {
  ACTION_REFRESH_REGIONS,
  REFRESH_CONTAINER_REGIONS,
  cancelRefreshRegions,
  isRefreshContainerRegion
} from "./refresh-regions.js";

const asyncActions = new Set([
  "toggle",
  "pay_fatura",
  "save",
  "delete",
  "save_transferencia",
  "delete_transferencia"
]);

function getAction(form) {
  const action = form.querySelector('input[name="action"]');
  return action ? action.value : "";
}

function isAsyncForm(form) {
  return asyncActions.has(getAction(form));
}

function setSubmitting(form, submitting) {
  form.querySelectorAll("button, input, select").forEach(function (control) {
    if (control.type === "hidden" || control.name === "csrfmiddlewaretoken") {
      return;
    }

    control.disabled = submitting;
  });
}

function getCsrfToken(form) {
  const field = form.querySelector('input[name="csrfmiddlewaretoken"]');
  return field ? field.value : "";
}

function getFormUrl(form) {
  return form.getAttribute("action") || window.location.href;
}

function htmlToElement(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "").trim();
  return template.content;
}

function copyFieldValues(html, selector, keyAttribute) {
  const nextContent = htmlToElement(html);

  nextContent.querySelectorAll(selector).forEach(function (nextField) {
    const key = nextField.getAttribute(keyAttribute);
    const currentField = Array.from(document.querySelectorAll(selector)).find(function (field) {
      return field.getAttribute(keyAttribute) === key;
    });

    if (!currentField) {
      return;
    }

    const nextStyle = nextField.getAttribute("style") || "";

    currentField.innerHTML = nextField.innerHTML;
    currentField.className = nextField.className;
    currentField.setAttribute("style", nextStyle);
  });
}

function replaceRegionHtml(name, html, innerOnly) {
  const currentRegion = document.querySelector('[data-refresh-region="' + name + '"]');

  if (!currentRegion) {
    return false;
  }

  if (window.AppRefresh && currentRegion.classList.contains("is-refreshing")) {
    window.AppRefresh.finish(currentRegion, innerOnly ? String(html || "") : htmlToElement(html).firstElementChild?.innerHTML || String(html || ""));
    return true;
  }

  if (innerOnly) {
    currentRegion.innerHTML = String(html || "");
  } else {
    currentRegion.innerHTML = htmlToElement(html).firstElementChild?.innerHTML || String(html || "");
  }

  currentRegion.classList.remove("is-refreshing");
  currentRegion.removeAttribute("aria-busy");
  delete currentRegion.dataset.refreshPreviousHtml;
  return true;
}

function replaceRegionFromContent(content, name) {
  const nextRegion = content.querySelector('[data-refresh-region="' + name + '"]');

  if (!nextRegion) {
    return false;
  }

  return replaceRegionHtml(name, nextRegion.innerHTML, true);
}

function replaceListParts(html) {
  const nextContent = htmlToElement(html);
  const regionNames = [
    "gestao-receitas-lancamentos",
    "gestao-despesas-lancamentos"
  ];
  let replacedAny = false;

  regionNames.forEach(function (regionName) {
    if (replaceRegionFromContent(nextContent, regionName)) {
      replacedAny = true;
    }
  });

  return replacedAny;
}

function replaceRegion(name, html, action) {
  if (name === "gestao-resumo") {
    if (window.AppRefresh && document.querySelector('[data-refresh-region="' + name + '"].is-refreshing')) {
      window.AppRefresh.finish(name, html);
      return;
    }

    copyFieldValues(html, "[data-summary-field]", "data-summary-field");
    return;
  }

  if (name === "gestao-saldos") {
    if (window.AppRefresh && document.querySelector('[data-refresh-region="' + name + '"].is-refreshing')) {
      window.AppRefresh.finish(name, html);
      return;
    }

    copyFieldValues(html, "[data-balance-value]", "data-balance-value");
    return;
  }

  if (name === "gestao-faturas" && action !== "pay_fatura") {
    return;
  }

  if (name === "gestao-lista" && replaceListParts(html)) {
    return;
  }

  if (name === "gestao-faturas" && replaceRegionHtml(name, html)) {
    return;
  }

  if (name === "gestao-extrato" && replaceRegionHtml(name, html)) {
    return;
  }

  if (name === "gestao-modais" && replaceRegionHtml(name, html)) {
    return;
  }

  if (window.AppRefresh) {
    window.AppRefresh.finish(name, html);
  }
}

function startActionRefresh(form) {
  if (!window.AppRefresh) {
    return;
  }

  const action = getAction(form);
  const closestRegion = form.closest("[data-refresh-region]");
  const currentRegion = isRefreshContainerRegion(closestRegion) ? null : closestRegion;
  const tipoField = form.querySelector('[name="tipo"]');
  const abaField = form.querySelector('[name="aba"]');
  const tipo = tipoField ? tipoField.value : "";
  const aba = abaField ? abaField.value : "";

  window.AppRefresh.start("gestao-saldos", { type: "pills", count: 5, minDuration: 650 });
  window.AppRefresh.start("gestao-resumo", { type: "cards", count: 5, minDuration: 650 });

  if (action === "pay_fatura") {
    window.AppRefresh.start("gestao-faturas", { type: "transactions", count: 3, minDuration: 650 });
    return;
  }

  if (currentRegion) {
    window.AppRefresh.start(currentRegion, { type: "transactions", count: 3, minDuration: 650 });
    return;
  }

  if (tipo === "entrada" || aba === "entrada") {
    window.AppRefresh.start("gestao-receitas-lancamentos", { type: "transactions", count: 3, minDuration: 650 });
    return;
  }

  if (tipo === "saida" || aba === "saida") {
    window.AppRefresh.start("gestao-despesas-lancamentos", { type: "transactions", count: 3, minDuration: 650 });
    return;
  }

  window.AppRefresh.start("gestao-lista", { type: "transactions", count: 3, minDuration: 650 });
}

function cancelActionRefresh() {
  cancelRefreshRegions(ACTION_REFRESH_REGIONS.concat(REFRESH_CONTAINER_REGIONS));
}

function finishRefresh(regions, action) {
  if (!regions) {
    return;
  }

  Object.keys(regions).forEach(function (name) {
    replaceRegion(name, regions[name], action);
  });

  ACTION_REFRESH_REGIONS.concat(REFRESH_CONTAINER_REGIONS).forEach(function (name) {
    if (!Object.prototype.hasOwnProperty.call(regions, name) && window.AppRefresh) {
      window.AppRefresh.cancel(name);
    }
  });
}

function closeOpenDialogs(form) {
  const dialogs = Array.from(document.querySelectorAll("dialog[open]"));
  const formDialog = form.closest("dialog");

  if (formDialog && !dialogs.includes(formDialog)) {
    dialogs.push(formDialog);
  }

  dialogs.forEach(function (dialog) {
    if (window.AppDialogs) {
      window.AppDialogs.close(dialog);
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  });
}

function updateActiveTab(data) {
  if (!data || !data.aba) {
    return;
  }

  filterTab(data.aba);

  const actionButton = document.querySelector("[data-create-transaction]");
  if (actionButton) {
    actionButton.dataset.createTransaction = data.aba;
    actionButton.hidden = data.aba === "extrato";
    actionButton.textContent = data.aba === "transferencia" ? "+ Transferir" : "+ Lançar";
  }

  document.querySelectorAll("[data-gestao-tab-link]").forEach(function (link) {
    link.classList.toggle("is-active", link.getAttribute("data-gestao-tab-link") === data.aba);
  });
}

async function submitAsyncAction(form) {
  const formData = new FormData(form);

  setSubmitting(form, true);
  startActionRefresh(form);

  try {
    const response = await fetch(getFormUrl(form), {
      method: form.method || "POST",
      body: formData,
      credentials: "same-origin",
      headers: {
        "Accept": "application/json",
        "X-CSRFToken": getCsrfToken(form),
        "X-Requested-With": "fetch"
      }
    });

    if (!response.ok) {
      throw new Error("Toggle request failed");
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error("Toggle response rejected");
    }

    finishRefresh(data.regions, getAction(form));
    updateActiveTab(data);
    closeOpenDialogs(form);

    if (data.url) {
      window.history.replaceState({}, "", data.url);
    }
  } catch (error) {
    cancelActionRefresh();
    console.error("Falha ao processar ação sem recarregar a tela.", error);
    setSubmitting(form, false);
  } finally {
    setSubmitting(form, false);
  }
}

export function initAsyncToggles() {
  document.addEventListener("submit", function (event) {
    const form = event.target;

    if (!(form instanceof HTMLFormElement) || !isAsyncForm(form)) {
      return;
    }

    if (form.matches("form[data-confirm-delete]") && form.dataset.confirmBypass !== "1") {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    submitAsyncAction(form);
  }, true);
}
