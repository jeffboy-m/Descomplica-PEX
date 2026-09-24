import { applyInitialTabState, filterTab, initCategoryFilters, initTabs } from "app/gestao/abas";
import { renderDashboardBars } from "app/gestao/extrato";
import { initGestaoNavigation } from "app/gestao/navegacao";
import { initAsyncToggles } from "./toggle.js";
import {
  executeDeleteChoice,
  openCreateModal,
  openCreateTransferenciaModal,
  openEditModal,
  openEditTransferenciaModal,
  openMonthPickerModal,
  openQuickPayFaturaModal,
  openQuickPayModal,
  submitDelete,
  submitDeleteTransferencia
} from "./modais.js";

applyInitialTabState();

document.addEventListener("DOMContentLoaded", function () {
  initGestaoNavigation();
  initCategoryFilters();
  initTabs();
  initAsyncToggles();

  if (document.querySelector("[data-income-expense-donut], [data-balance-chart], .ranking-list")) {
    renderDashboardBars();
  }
});

window.Gestao = {
  openCreateModal: openCreateModal,
  openEditModal: openEditModal,
  openMonthPickerModal: openMonthPickerModal,
  openQuickPayFaturaModal: openQuickPayFaturaModal,
  openQuickPayModal: openQuickPayModal,
  submitDelete: submitDelete,
  executeDeleteChoice: executeDeleteChoice,
  filterTab: filterTab,
  openCreateTransferenciaModal: openCreateTransferenciaModal,
  openEditTransferenciaModal: openEditTransferenciaModal,
  submitDeleteTransferencia: submitDeleteTransferencia
};
