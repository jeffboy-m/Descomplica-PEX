(function () {
  const METAS_VISUAL_MAX_PERCENT = 30;

  function parseMoney(value) {
    const normalized = String(value || "")
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();
    const parsed = Number.parseFloat(normalized || "0");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatMoney(value) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function getPercent(value, base) {
    if (!base) {
      return 0;
    }
    return Math.max(0, (value / base) * 100);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function serializeForm(form) {
    const data = new FormData(form);
    data.delete("csrfmiddlewaretoken");
    data.delete("next");

    return Array.from(data.entries())
      .map(function (entry) {
        const name = entry[0];
        const value = name === "renda_base_mensal" || name.startsWith("meta_")
          ? parseMoney(entry[1]).toFixed(2)
          : String(entry[1] || "");
        return name + "=" + value;
      })
      .sort()
      .join("&");
  }

  function setNextUrl(form, url) {
    const input = form.querySelector('input[name="next"]');
    if (input) {
      input.value = url.pathname + url.search + url.hash;
    }
  }

  function setRangeVisual(row, value, base) {
    const range = row.querySelector("[data-metas-range]");
    const percent = getPercent(value, base);
    const visualBase = base > 0 ? base * (METAS_VISUAL_MAX_PERCENT / 100) : Math.max(value, 100);
    const visualPercent = getPercent(value, visualBase);

    row.classList.toggle("is-empty", value <= 0);
    row.classList.toggle("is-low", value > 0 && percent <= 10);
    row.classList.toggle("is-ok", percent > 10 && percent <= 20);
    row.classList.toggle("is-attention", percent > 20 && percent <= METAS_VISUAL_MAX_PERCENT);
    row.classList.toggle("is-danger", percent > METAS_VISUAL_MAX_PERCENT);

    if (range) {
      range.style.setProperty("--range-percent", Math.min(visualPercent, 100).toFixed(1) + "%");
      range.setAttribute("aria-valuemax", visualBase.toFixed(2));
      range.setAttribute("aria-valuenow", value.toFixed(2));
    }

    const percentEl = row.querySelector("[data-metas-percent]");
    if (percentEl) {
      percentEl.textContent = base ? percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : "-";
    }
  }

  function getMetaInputs(form) {
    return Array.from(form.querySelectorAll("[data-metas-value]"));
  }

  function getOtherValuesTotal(form, inputToIgnore) {
    return getMetaInputs(form).reduce(function (sum, input) {
      return input === inputToIgnore ? sum : sum + parseMoney(input.value);
    }, 0);
  }

  function getAvailableForInput(form, input) {
    const base = parseMoney(form.querySelector("[data-metas-renda]")?.value);
    if (base <= 0) {
      return 0;
    }
    return Math.max(base - getOtherValuesTotal(form, input), 0);
  }

  function clampInputToAvailable(form, input) {
    const available = getAvailableForInput(form, input);
    const value = parseMoney(input.value);
    const clamped = clamp(value, 0, available);
    if (clamped !== value) {
      input.value = formatMoney(clamped);
    }
  }

  function clampAllToBudget(form) {
    const base = parseMoney(form.querySelector("[data-metas-renda]")?.value);
    let remaining = Math.max(base, 0);
    getMetaInputs(form).forEach(function (input) {
      const value = parseMoney(input.value);
      const clamped = clamp(value, 0, remaining);
      if (clamped !== value) {
        input.value = formatMoney(clamped);
      }
      remaining -= clamped;
    });
  }

  function isPointerOnTrack(range, event) {
    const rect = range.getBoundingClientRect();
    const trackTolerance = 14;
    const trackCenter = rect.top + rect.height / 2;
    return Math.abs(event.clientY - trackCenter) <= trackTolerance / 2;
  }

  function updateValueFromPointer(form, range, event) {
    const row = range.closest("[data-metas-row]");
    const valueInput = row?.querySelector("[data-metas-value]");
    if (!row || !valueInput) {
      return;
    }

    const base = parseMoney(form.querySelector("[data-metas-renda]")?.value);
    const max = getAvailableForInput(form, valueInput);
    const visualBase = base > 0 ? base * (METAS_VISUAL_MAX_PERCENT / 100) : 0;
    const rect = range.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const value = clamp(Math.round((ratio * visualBase) / 10) * 10, 0, max);

    valueInput.value = formatMoney(value);
    updateSummary(form, valueInput);
  }

  function updateSummary(form, changedInput) {
    const base = parseMoney(form.querySelector("[data-metas-renda]")?.value);
    if (changedInput && changedInput.matches("[data-metas-value]")) {
      clampInputToAvailable(form, changedInput);
    } else {
      clampAllToBudget(form);
    }

    const values = getMetaInputs(form).map(function (input) {
      return parseMoney(input.value);
    });
    const total = values.reduce(function (sum, value) {
      return sum + value;
    }, 0);
    const saldo = base - total;

    const totalEl = form.querySelector("[data-metas-total]");
    const saldoEl = form.querySelector("[data-metas-saldo]");
    const saldoCard = saldoEl ? saldoEl.closest(".metas-summary__item--saldo") : null;

    if (totalEl) {
      totalEl.textContent = "R$ " + formatMoney(total);
    }
    if (saldoEl) {
      saldoEl.textContent = "R$ " + formatMoney(saldo);
    }
    if (saldoCard) {
      saldoCard.classList.toggle("is-negative", saldo < 0);
    }

    form.querySelectorAll("[data-metas-row]").forEach(function (row) {
      setRangeVisual(row, parseMoney(row.querySelector("[data-metas-value]")?.value), base);
    });
  }

  function initMetasForm(form) {
    updateSummary(form);
    form.dataset.initialState = serializeForm(form);
    form.dataset.submitting = "0";

    const isDirty = function () {
      return form.dataset.submitting !== "1" && serializeForm(form) !== form.dataset.initialState;
    };

    const submitWithNextUrl = function (url) {
      form.dataset.submitting = "1";
      setNextUrl(form, url);
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.submit();
      }
    };

    const askToSaveBeforeLeaving = function (url) {
      const message = "Existem metas não salvas. O que deseja fazer?";

      const leaveWithoutSaving = function () {
        form.dataset.submitting = "1";
        window.location.assign(url.href);
      };

      if (window.AppConfirm && typeof window.AppConfirm.open === "function") {
        window.AppConfirm.open({
          message,
          okText: "Salvar",
          okClass: "panel-action-button",
          cancelText: "Voltar",
          extraText: "Sair sem salvar",
          extraClass: "danger-button",
          onConfirm: function () {
            submitWithNextUrl(url);
          },
          onExtra: function () {
            leaveWithoutSaving();
          }
        });
        return;
      }

      if (window.confirm(message)) {
        submitWithNextUrl(url);
      }
    };

    const saveBeforeLeaving = function (url) {
      if (!isDirty()) {
        return false;
      }

      askToSaveBeforeLeaving(url);
      return true;
    };

    window.AppMetas.hasUnsavedChanges = function () {
      return form.isConnected && isDirty();
    };

    window.AppMetas.confirmBeforeLeaving = function (url) {
      return form.isConnected ? saveBeforeLeaving(url) : false;
    };

    form.addEventListener("pointerdown", function (event) {
      const range = event.target.closest("[data-metas-range]");

      if (!range || !isPointerOnTrack(range, event)) {
        return;
      }

      event.preventDefault();
      range.setPointerCapture?.(event.pointerId);

      let hasDragged = false;
      const startX = event.clientX;

      const onPointerMove = function (moveEvent) {
        if (!hasDragged && Math.abs(moveEvent.clientX - startX) < 3) {
          return;
        }
        hasDragged = true;
        updateValueFromPointer(form, range, moveEvent);
      };
      const onPointerEnd = function () {
        range.removeEventListener("pointermove", onPointerMove);
      };

      range.addEventListener("pointermove", onPointerMove);
      range.addEventListener("pointerup", onPointerEnd, { once: true });
      range.addEventListener("pointercancel", onPointerEnd, { once: true });
    });

    form.addEventListener("money:formatted", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      updateSummary(form, target);
    });

    form.addEventListener("input", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.classList.contains("money-input")) {
        return;
      }

      updateSummary(form, target);
    });

    form.addEventListener("keydown", function (event) {
      const target = event.target;
      if (event.key !== "Enter" || !(target instanceof HTMLInputElement)) {
        return;
      }
      if (target.matches("[data-metas-value], [data-metas-renda]")) {
        event.preventDefault();
        target.blur();
      }
    });

    form.addEventListener("submit", function () {
      form.dataset.submitting = "1";
      form.dataset.initialState = serializeForm(form);
    });

    const handleLeavingClick = function (event) {
      if (!form.isConnected) {
        document.removeEventListener("click", handleLeavingClick, true);
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const link = target.closest("a[href]");
      if (!link) {
        return;
      }

      const href = link.getAttribute("href");
      const targetAttr = link.getAttribute("target");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || targetAttr === "_blank" || link.hasAttribute("download")) {
        return;
      }

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      if (saveBeforeLeaving(url)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", handleLeavingClick, true);
  }

  function initMetasForms() {
    const forms = document.querySelectorAll("[data-metas-form]");
    forms.forEach(function (form) {
      if (form.dataset.metasReady === "1") {
        return;
      }
      form.dataset.metasReady = "1";
      initMetasForm(form);
    });
  }

  window.AppMetas = {
    hasUnsavedChanges: function () {
      return false;
    },
    confirmBeforeLeaving: function () {
      return false;
    },
    init: initMetasForms
  };

  window.AppBase.onReady(function () {
    initMetasForms();
  });
})();
