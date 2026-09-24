(function () {
  const scrollStateKey = "page-scroll-state:" + window.location.pathname + window.location.search;
  const detailsStateKey = "page-details-state:" + window.location.pathname + window.location.search;

  function startGlobalLoading() {
    if (window.AppLoader) {
      window.AppLoader.start();
    }
  }

  function finishGlobalLoading() {
    if (window.AppLoader) {
      window.AppLoader.finish();
    }
  }

  function saveDetailsState() {
    const items = Array.from(document.querySelectorAll("details[id]")).map(function (details) {
      return {
        id: details.id,
        open: details.open
      };
    });

    if (!items.length) {
      return;
    }

    sessionStorage.setItem(detailsStateKey, JSON.stringify({
      items: items,
      at: Date.now()
    }));
  }

  function restoreDetailsState() {
    const raw = sessionStorage.getItem(detailsStateKey);
    if (!raw) {
      return;
    }

    sessionStorage.removeItem(detailsStateKey);

    try {
      const state = JSON.parse(raw);
      if (!state || Date.now() - state.at > 15000 || !Array.isArray(state.items)) {
        return;
      }

      state.items.forEach(function (item) {
        const details = item && item.id ? document.getElementById(item.id) : null;
        if (!(details instanceof HTMLDetailsElement)) {
          return;
        }

        if (item.open) {
          details.setAttribute("open", "");
        } else {
          details.removeAttribute("open");
        }
      });
    } catch (error) {
      sessionStorage.removeItem(detailsStateKey);
    }
  }

  function savePagePosition() {
    document.dispatchEvent(new CustomEvent("app:save-page-state"));
    saveDetailsState();
    sessionStorage.setItem(scrollStateKey, JSON.stringify({
      x: window.scrollX,
      y: window.scrollY,
      at: Date.now()
    }));
  }

  function markPageLeaving() {
    startGlobalLoading();
    if (!window.AppBase || !window.AppBase.isReducedMotion()) {
      document.documentElement.classList.add("is-page-leaving");
    }
  }

  function shouldSkipGlobalLoader(element) {
    return element && element.closest && element.closest("[data-no-global-loader]");
  }

  function isGestaoPeriodPath(pathname) {
    const normalized = pathname.replace(/\/+$/, "/");
    return normalized === "/gestao/";
  }

  function withCurrentGestaoPeriod(url) {
    const currentUrl = new URL(window.location.href);
    if (!isGestaoPeriodPath(currentUrl.pathname) || !isGestaoPeriodPath(url.pathname)) {
      return url;
    }

    const mes = currentUrl.searchParams.get("mes");
    const ano = currentUrl.searchParams.get("ano");
    if (mes && ano) {
      url.searchParams.set("mes", mes);
      url.searchParams.set("ano", ano);
    }
    return url;
  }

  function revealPage() {
    finishGlobalLoading();
    document.documentElement.classList.remove("is-restoring-scroll", "is-page-leaving");
    document.documentElement.classList.add("is-scroll-restored");
    setTimeout(function () {
      document.documentElement.classList.remove("is-scroll-restored");
    }, 320);
  }

  function restorePagePosition() {
    const raw = sessionStorage.getItem(scrollStateKey);
    if (!raw) {
      document.documentElement.classList.remove("is-restoring-scroll");
      return;
    }

    sessionStorage.removeItem(scrollStateKey);

    try {
      const state = JSON.parse(raw);
      if (!state || Date.now() - state.at > 15000) {
        document.documentElement.classList.remove("is-restoring-scroll");
        return;
      }

      const restore = function () {
        window.scrollTo(state.x || 0, state.y || 0);
        requestAnimationFrame(function () {
          revealPage();
        });
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", restore, { once: true });
      } else {
        restore();
      }
    } catch (error) {
      sessionStorage.removeItem(scrollStateKey);
      document.documentElement.classList.remove("is-restoring-scroll");
    }
  }

  window.AppNavigation = {
    start: startGlobalLoading,
    finish: finishGlobalLoading,
    savePagePosition: savePagePosition,
    markPageLeaving: markPageLeaving,
    withCurrentGestaoPeriod: withCurrentGestaoPeriod,
    go: function (url) {
      const nextUrl = withCurrentGestaoPeriod(new URL(url, window.location.href));
      if (nextUrl.href === window.location.href) {
        return;
      }

      markPageLeaving();
      setTimeout(function () {
        window.location.href = nextUrl.href;
      }, 80);
    },
    submit: function (form) {
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      if ((form.getAttribute("method") || "").toLowerCase() === "dialog") {
        form.submit();
        return;
      }

      savePagePosition();
      form.submit();
    }
  };

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const link = target.closest("a[href]");
    if (!link) {
      return;
    }

    if (shouldSkipGlobalLoader(link)) {
      return;
    }

    const href = link.getAttribute("href");
    const targetAttr = link.getAttribute("target");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || targetAttr === "_blank" || link.hasAttribute("download")) {
      return;
    }

    const nextUrl = withCurrentGestaoPeriod(new URL(href, window.location.href));
    if (nextUrl.origin !== window.location.origin || nextUrl.href === window.location.href) {
      return;
    }

    event.preventDefault();
    markPageLeaving();
    setTimeout(function () {
      window.location.href = nextUrl.href;
    }, 120);
  });

  document.addEventListener("submit", function (event) {
    if (event.defaultPrevented) {
      return;
    }

    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    if (shouldSkipGlobalLoader(form)) {
      return;
    }

    if (form.dataset.confirmBypass === "1") {
      delete form.dataset.confirmBypass;
      if ((form.getAttribute("method") || "").toLowerCase() !== "dialog") {
        savePagePosition();
      }
      return;
    }

    if (form.matches("form[data-confirm-delete]")) {
      event.preventDefault();
      if (window.AppConfirm) {
        window.AppConfirm.open(form);
      }
      return;
    }

    if ((form.getAttribute("method") || "").toLowerCase() !== "dialog") {
      savePagePosition();
    }
  });

  window.addEventListener("pageshow", function () {
    finishGlobalLoading();
    document.documentElement.classList.remove("is-restoring-scroll", "is-page-leaving");
  });

  window.addEventListener("load", function () {
    finishGlobalLoading();
  });

  window.AppBase.onReady(function () {
    document.querySelectorAll("details[id]").forEach(function (details) {
      const summary = details.querySelector("summary");
      if (summary) {
        summary.addEventListener("click", function () {
          window.AppBase.keepElementPosition(details);
        }, true);
      }
    });

    restoreDetailsState();
    restorePagePosition();
  });
})();
