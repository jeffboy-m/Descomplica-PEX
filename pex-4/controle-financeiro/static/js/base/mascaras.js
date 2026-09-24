(function () {
  function formatMoneyValue(value) {
    let clean = value.replace(/\D/g, "");
    if (!clean) {
      return "";
    }

    if (clean.length === 1) {
      return "0,0" + clean;
    }
    if (clean.length === 2) {
      return "0," + clean;
    }

    let integerPart = clean.slice(0, -2);
    const decimalPart = clean.slice(-2);

    integerPart = parseInt(integerPart, 10).toString();
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    return integerPart + "," + decimalPart;
  }

  function applyMoneyMask(input) {
    const selectionStart = input.selectionStart;
    const oldLength = input.value.length;
    const previousValue = input.value;
    const formatted = formatMoneyValue(input.value);

    input.value = formatted;

    const newLength = formatted.length;
    const cursorPosition = selectionStart + (newLength - oldLength);
    input.setSelectionRange(cursorPosition, cursorPosition);
    dispatchMoneyFormatted(input, previousValue);
  }

  function dispatchMoneyFormatted(input, previousValue) {
    input.dispatchEvent(new CustomEvent("money:formatted", {
      bubbles: true,
      detail: {
        value: input.value,
        previousValue
      }
    }));
  }

  function formatAllMoneyInputs() {
    document.querySelectorAll("input.money-input").forEach(function (input) {
      if (input.value) {
        const previousValue = input.value;
        input.value = formatMoneyValue(input.value);
        dispatchMoneyFormatted(input, previousValue);
      }
    });
  }

  window.AppMoney = {
    formatValue: formatMoneyValue,
    formatAll: formatAllMoneyInputs
  };

  document.addEventListener("input", function (event) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.classList.contains("money-input")) {
      applyMoneyMask(target);
    }
  });

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("[data-modal-open]")) {
      setTimeout(formatAllMoneyInputs, 100);
    }
  });

  window.AppBase.onReady(formatAllMoneyInputs);
})();
