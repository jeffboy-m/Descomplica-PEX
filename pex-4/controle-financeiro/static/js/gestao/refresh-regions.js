export const ACTION_REFRESH_REGIONS = Object.freeze([
  "gestao-saldos",
  "gestao-resumo",
  "gestao-faturas",
  "gestao-lista",
  "gestao-receitas-lancamentos",
  "gestao-despesas-lancamentos",
  "gestao-modais"
]);

export const REGIONAL_NAV_REFRESH_REGIONS = Object.freeze([
  "gestao-saldos",
  "gestao-resumo",
  "gestao-acoes",
  "gestao-lista",
  "gestao-extrato",
  "gestao-modais"
]);

export const REGIONAL_LOADING_REGIONS = Object.freeze([
  "gestao-saldos",
  "gestao-resumo",
  "gestao-lista"
]);

export const REFRESH_CONTAINER_REGIONS = Object.freeze([
  "gestao-conteudo"
]);

export function getRefreshRegionName(region) {
  if (!region) {
    return "";
  }

  if (typeof region === "string") {
    return region;
  }

  return region.getAttribute("data-refresh-region") || "";
}

export function isRefreshContainerRegion(region) {
  return REFRESH_CONTAINER_REGIONS.includes(getRefreshRegionName(region));
}

export function cancelRefreshRegions(regions) {
  if (!window.AppRefresh) {
    return;
  }

  regions.forEach(function (name) {
    window.AppRefresh.cancel(name);
  });
}
