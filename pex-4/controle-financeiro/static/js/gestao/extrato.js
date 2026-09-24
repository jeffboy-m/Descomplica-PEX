function formatCompactCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatCenterCurrency(value) {
  if (Math.abs(value) < 10000) {
    return formatCurrency(value);
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function parseChartNumber(value) {
  const text = String(value || "0").trim();
  let parsed;
  if (text.includes(",") && text.includes(".")) {
    parsed = parseFloat(text.replace(/\./g, "").replace(",", "."));
  } else if (text.includes(",")) {
    parsed = parseFloat(text.replace(",", "."));
  } else {
    parsed = parseFloat(text);
  }
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildSmoothPath(points) {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const controlX = (previous.x + current.x) / 2;
    path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

function bindBalanceChartInteractions(chart) {
  const pointElements = Array.from(chart.querySelectorAll(".balance-chart__point"));

  pointElements.forEach(function (point) {
    point.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse") {
        return;
      }

      pointElements.forEach(function (item) {
        item.classList.remove("is-active");
      });
      point.classList.add("is-active");
    });
  });

  chart.onpointerdown = function (event) {
    if (event.target.closest(".balance-chart__point")) {
      return;
    }

    pointElements.forEach(function (point) {
      point.classList.remove("is-active");
    });
  };
}

function animateRankingBar(bar, width) {
  bar.style.width = "0%";
  bar.getBoundingClientRect();
  requestAnimationFrame(function () {
    bar.style.width = width;
  });
}

export function renderRankingBars(root = document) {
  root.querySelectorAll(".ranking-list").forEach(function (list) {
    const items = Array.from(list.querySelectorAll(".ranking-item"));
    const maxVal = items.reduce(function (max, item) {
      return Math.max(max, parseChartNumber(item.getAttribute("data-val")));
    }, 0);

    items.forEach(function (item) {
      const val = parseChartNumber(item.getAttribute("data-val"));
      const bar = item.querySelector(".ranking-bar");
      if (bar) {
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        animateRankingBar(bar, Math.min(pct, 100) + "%");
      }
    });
  });
}

export function renderBalanceChart() {
  document.querySelectorAll("[data-balance-chart]").forEach(function (chart) {
    const inlinePoints = Array.from(chart.querySelectorAll("[data-chart-point]")).map(function (point) {
      return {
        label: point.getAttribute("data-label") || "",
        value: parseChartNumber(point.getAttribute("data-value"))
      };
    }).filter(function (point) {
      return Number.isFinite(point.value);
    });
    const rawPoints = inlinePoints.length ? inlinePoints : JSON.parse(chart.dataset.points || "[]");

    if (inlinePoints.length) {
      chart.dataset.points = JSON.stringify(inlinePoints);
    }

    if (!rawPoints.length) {
      chart.innerHTML = '<p class="hint balance-chart__empty">Sem dados para exibir.</p>';
      return;
    }

    const width = 640;
    const height = 360;
    const padding = { top: 14, right: 18, bottom: 30, left: 18 };
    const values = rawPoints.map(function (point) { return point.value; });
    let min = Math.min(...values);
    let max = Math.max(...values);
    const range = max - min || Math.max(Math.abs(max), 1);
    min -= range * 0.04;
    max += range * 0.04;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const average = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
    const xStep = rawPoints.length > 1 ? chartWidth / (rawPoints.length - 1) : 0;
    const scaleY = function (value) {
      return padding.top + ((max - value) / (max - min || 1)) * chartHeight;
    };
    const points = rawPoints.map(function (point, index) {
      return {
        ...point,
        x: padding.left + (xStep * index),
        y: scaleY(point.value)
      };
    });
    const path = buildSmoothPath(points);
    const areaPath = `${path} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;
    const averageY = scaleY(average);

    chart.innerHTML = `
      <svg class="balance-chart__svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução do saldo final nos últimos meses">
        <defs>
          <linearGradient id="balanceLineGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="#38bdf8"></stop>
            <stop offset="100%" stop-color="#3b82f6"></stop>
          </linearGradient>
          <linearGradient id="balanceAreaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.28"></stop>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <line class="balance-chart__axis" x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}"></line>
        <line class="balance-chart__average" x1="${padding.left}" y1="${averageY}" x2="${width - padding.right}" y2="${averageY}"></line>
        <text class="balance-chart__average-label" x="${padding.left}" y="${averageY - 8}">média ${formatCompactCurrency(average)}</text>
        <path class="balance-chart__area" d="${areaPath}"></path>
        <path class="balance-chart__line" d="${path}" pathLength="1"></path>
        ${points.map(function (point, index) {
          const anchor = index === 0 ? "start" : index === points.length - 1 ? "end" : "middle";
          const labelY = Math.max(16, point.y - 12);
          const formattedValue = formatCompactCurrency(point.value);
          return `
            <g class="balance-chart__point" tabindex="0" role="button" aria-label="${point.label}: ${formattedValue}">
              <rect class="balance-chart__hit-area" x="${point.x - 18}" y="${point.y - 18}" width="36" height="36" fill="transparent" stroke="none"></rect>
              <circle cx="${point.x}" cy="${point.y}" r="4.5"></circle>
              <text class="balance-chart__value" x="${point.x}" y="${labelY}" text-anchor="${anchor}">${formattedValue}</text>
              <text class="balance-chart__label" x="${point.x}" y="${height - 14}" text-anchor="${anchor}">${point.label}</text>
            </g>
          `;
        }).join("")}
      </svg>
    `;

    bindBalanceChartInteractions(chart);
  });
}

export function renderIncomeExpenseDonut() {
  document.querySelectorAll("[data-income-expense-donut]").forEach(function (chart) {
    const income = Math.max(parseChartNumber(chart.dataset.income), 0);
    const expense = Math.max(parseChartNumber(chart.dataset.expense), 0);
    const total = income + expense;
    const result = income - expense;
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const incomeLength = total > 0 ? (income / total) * circumference : 0;
    const expenseLength = total > 0 ? (expense / total) * circumference : 0;
    const resultType = result < 0 ? "negative" : result > 0 ? "positive" : "neutral";
    const resultLabel = result < 0 ? "Prejuízo" : result > 0 ? "Lucro" : "Equilíbrio";
    const absoluteResult = Math.abs(result);
    const resultFullValue = formatCurrency(absoluteResult);

    chart.innerHTML = `
      <div class="income-expense-donut__figure" aria-label="Receitas ${formatCurrency(income)} e gastos ${formatCurrency(expense)}">
        <svg class="income-expense-donut__svg" viewBox="0 0 160 160" role="img">
          <circle class="income-expense-donut__track" cx="80" cy="80" r="${radius}"></circle>
          <g transform="rotate(-90 80 80)">
            <circle
              class="income-expense-donut__slice income-expense-donut__slice--income"
              style="--donut-circumference: ${circumference}; --donut-length: ${incomeLength}; --donut-rest: ${circumference - incomeLength}; --donut-offset: 0;"
              cx="80"
              cy="80"
              r="${radius}"
              stroke-dasharray="${incomeLength} ${circumference - incomeLength}"
              stroke-dashoffset="0"
            ></circle>
            <circle
              class="income-expense-donut__slice income-expense-donut__slice--expense"
              style="--donut-circumference: ${circumference}; --donut-length: ${expenseLength}; --donut-rest: ${circumference - expenseLength}; --donut-offset: ${-incomeLength};"
              cx="80"
              cy="80"
              r="${radius}"
              stroke-dasharray="${expenseLength} ${circumference - expenseLength}"
              stroke-dashoffset="${-incomeLength}"
            ></circle>
          </g>
        </svg>
        <div class="income-expense-donut__center income-expense-donut__center--${resultType}">
          <span>${resultLabel}</span>
          <strong title="${resultFullValue}">${formatCenterCurrency(absoluteResult)}</strong>
        </div>
      </div>
      <div class="income-expense-donut__legend">
        <div class="income-expense-donut__legend-row">
          <span><i class="income-expense-donut__dot income-expense-donut__dot--income"></i>Receitas</span>
          <strong>${formatCurrency(income)}</strong>
        </div>
        <div class="income-expense-donut__legend-row">
          <span><i class="income-expense-donut__dot income-expense-donut__dot--expense"></i>Gastos</span>
          <strong>${formatCurrency(expense)}</strong>
        </div>
      </div>
    `;
  });
}

export function renderDashboardBars() {
  renderRankingBars();
  renderBalanceChart();
  renderIncomeExpenseDonut();
}
