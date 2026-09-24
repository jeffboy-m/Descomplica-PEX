(function () {
  const scrollStateKey = "app-scroll-state";
  const scrollIntentKey = "app-scroll-intent";
  const stateKeys = ["app-menu-open-panels", "app-gestao-open-cards", "app-gestao-active-tab"];

  window.AppBase = window.AppBase || {};

  function isReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  function keepElementPosition(element) {
    if (!element) {
      return;
    }

    const previousTop = element.getBoundingClientRect().top;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        const nextTop = element.getBoundingClientRect().top;
        const delta = nextTop - previousTop;
        if (Math.abs(delta) > 1) {
          window.scrollBy({ top: delta, left: 0, behavior: "auto" });
        }
      });
    });
  }

  function getCurrentPath() {
    return window.location.pathname || "/";
  }

  function shouldRestoreState() {
    try {
      const intent = sessionStorage.getItem(scrollIntentKey);
      return intent === "preserve";
    } catch (error) {
      return false;
    }
  }

  function markPreserveNavigation() {
    try {
      sessionStorage.setItem(scrollIntentKey, "preserve");
    } catch (error) {
      // Sessao indisponivel, sem restauracao.
    }
  }

  function clearPreservedState() {
    try {
      stateKeys.forEach(function (key) {
        sessionStorage.removeItem(key);
      });
      sessionStorage.removeItem(scrollStateKey);
    } catch (error) {
      // Sessao indisponivel, sem estado para limpar.
    }
  }

  function consumeNavigationIntent() {
    const preserve = shouldRestoreState();
    try {
      sessionStorage.removeItem(scrollIntentKey);
    } catch (error) {
      // Sessao indisponivel, nada para consumir.
    }

    if (!preserve) {
      clearPreservedState();
    }
    return preserve;
  }

  function saveScrollPosition() {
    try {
      const state = {
        path: getCurrentPath(),
        x: window.scrollX || 0,
        y: window.scrollY || 0
      };
      sessionStorage.setItem(scrollStateKey, JSON.stringify(state));
    } catch (error) {
      // Sessao indisponivel, sem restauracao.
    }
  }

  function restoreScrollPosition(shouldRestore) {
    if (!shouldRestore) {
      return;
    }

    let state = null;
    try {
      state = JSON.parse(sessionStorage.getItem(scrollStateKey) || "null");
    } catch (error) {
      state = null;
    }

    if (!state || state.path !== getCurrentPath()) {
      return;
    }

    requestAnimationFrame(function () {
      window.scrollTo(state.x || 0, state.y || 0);
      setTimeout(function () {
        window.scrollTo(state.x || 0, state.y || 0);
      }, 80);
    });
  }

  function isSamePageSubmission(form) {
    if (!form || form.method.toLowerCase() !== "post") {
      return false;
    }

    const action = form.getAttribute("action");
    if (!action || action === "#" || action === window.location.pathname) {
      return true;
    }

    try {
      const actionUrl = new URL(action, window.location.href);
      return actionUrl.pathname === window.location.pathname;
    } catch (error) {
      return false;
    }
  }

  function prepareFormPersistence() {
    document.addEventListener("submit", function (event) {
      if (isSamePageSubmission(event.target)) {
        saveScrollPosition();
        markPreserveNavigation();
      }
    }, true);
  }

  function prepareNavigationReset() {
    document.addEventListener("click", function (event) {
      const target = event.target instanceof Element ? event.target : null;
      const link = target ? target.closest("a[href]") : null;
      if (!link) {
        return;
      }

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || link.target) {
        return;
      }

      let url = null;
      try {
        url = new URL(href, window.location.href);
      } catch (error) {
        return;
      }

      if (url.origin !== window.location.origin) {
        return;
      }

      if (url.pathname !== getCurrentPath()) {
        clearPreservedState();
      }
    }, true);
  }

  const shouldRestore = consumeNavigationIntent();
  window.AppBase.isReducedMotion = isReducedMotion;
  window.AppBase.keepElementPosition = keepElementPosition;
  window.AppBase.onReady = onReady;
  window.AppBase.shouldRestorePageState = shouldRestore;
  window.AppBase.saveScrollPosition = saveScrollPosition;
  window.AppBase.markPreserveNavigation = markPreserveNavigation;
  window.AppBase.clearPreservedState = clearPreservedState;

  if ("scrollRestoration" in history) {
    history.scrollRestoration = shouldRestore ? "manual" : "auto";
  }

  prepareFormPersistence();
  prepareNavigationReset();

  window.addEventListener("beforeunload", function () {
    if (shouldRestoreState()) {
      saveScrollPosition();
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    restoreScrollPosition(shouldRestore);
  });
})();
