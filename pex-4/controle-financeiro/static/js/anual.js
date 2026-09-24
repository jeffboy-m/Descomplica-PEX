import { renderBalanceChart, renderIncomeExpenseDonut, renderRankingBars } from "app/gestao/extrato";

function renderAnnualVisuals() {
  renderRankingBars();
  renderBalanceChart();
  renderIncomeExpenseDonut();
}

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("[data-anual-year-select]").forEach(function (select) {
    select.addEventListener("change", function () {
      if (window.AppNavigation) {
        window.AppNavigation.submit(select.form);
      } else if (select.form) {
        select.form.submit();
      }
    });
  });

  renderAnnualVisuals();
});
