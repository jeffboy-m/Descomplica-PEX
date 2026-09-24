(function () {
  const promptId = "ios-install-prompt";
  const closedAtKey = "ios-prompt-closed-at";

  function closeIosPrompt() {
    const prompt = document.getElementById(promptId);
    if (prompt) {
      prompt.hidden = true;
    }
    localStorage.setItem(closedAtKey, Date.now().toString());
  }

  function shouldShowPrompt() {
    const closedAt = localStorage.getItem(closedAtKey);
    if (!closedAt) {
      return true;
    }

    const hoursDiff = (Date.now() - parseInt(closedAt, 10)) / (1000 * 60 * 60);
    return hoursDiff >= 1;
  }

  function initIosPrompt() {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

    if (isIos && !isStandalone && shouldShowPrompt()) {
      setTimeout(function () {
        const prompt = document.getElementById(promptId);
        if (prompt) {
          prompt.hidden = false;
        }
      }, 4000);
    }
  }

  document.addEventListener("click", function (event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) {
      return;
    }

    const alertClose = target.closest("[data-alert-close]");
    if (alertClose) {
      const alert = alertClose.closest(".alert");
      if (alert) {
        alert.remove();
      }
      return;
    }

    if (target.closest("[data-ios-prompt-close]")) {
      closeIosPrompt();
    }
  });

  if (window.AppBase) {
    window.AppBase.onReady(initIosPrompt);
  } else {
    document.addEventListener("DOMContentLoaded", initIosPrompt, { once: true });
  }
})();
