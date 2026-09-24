(function () {
  let globalLoader = null;
  let globalLoaderCloseTimer = null;

  function ensureGlobalLoader() {
    if (globalLoader) {
      return globalLoader;
    }

    globalLoader = document.createElement("div");
    globalLoader.className = "global-page-loader";
    if (document.documentElement.classList.contains("auth-public") || window.location.pathname === "/login/") {
      globalLoader.classList.add("global-page-loader--public");
    }
    globalLoader.setAttribute("role", "status");
    globalLoader.setAttribute("aria-live", "polite");
    globalLoader.setAttribute("aria-label", "Processando");
    globalLoader.hidden = true;
    globalLoader.innerHTML = [
      '<div class="global-page-loader__skeleton" aria-hidden="true">',
      '<span class="global-page-loader__hero skeleton"></span>',
      '<span class="global-page-loader__bar skeleton"></span>',
      '<span class="global-page-loader__item">',
      '<span class="global-page-loader__avatar skeleton"></span>',
      '<span class="global-page-loader__lines">',
      '<span class="global-page-loader__line global-page-loader__line--long skeleton"></span>',
      '<span class="global-page-loader__line global-page-loader__line--short skeleton"></span>',
      '</span>',
      '</span>',
      '<span class="global-page-loader__bar skeleton"></span>',
      '<span class="global-page-loader__item">',
      '<span class="global-page-loader__avatar skeleton"></span>',
      '<span class="global-page-loader__lines">',
      '<span class="global-page-loader__line global-page-loader__line--long skeleton"></span>',
      '<span class="global-page-loader__line global-page-loader__line--short skeleton"></span>',
      '</span>',
      '</span>',
      '<span class="global-page-loader__bar skeleton"></span>',
      '</div>'
    ].join("");
    document.body.appendChild(globalLoader);
    return globalLoader;
  }

  function startGlobalLoading() {
    const loader = ensureGlobalLoader();
    clearTimeout(globalLoaderCloseTimer);
    loader.hidden = false;
    document.documentElement.classList.add("is-loading-page");
  }

  function finishGlobalLoading() {
    if (!globalLoader) {
      return;
    }

    clearTimeout(globalLoaderCloseTimer);

    setTimeout(function () {
      document.documentElement.classList.remove("is-loading-page");
      globalLoaderCloseTimer = setTimeout(function () {
        if (globalLoader) {
          globalLoader.hidden = true;
        }
      }, 300);
    }, 220);
  }

  window.AppLoader = {
    start: startGlobalLoading,
    finish: finishGlobalLoading,
    cancel: function () {
      clearTimeout(globalLoaderCloseTimer);
      document.documentElement.classList.remove("is-loading-page", "is-page-leaving");
      if (globalLoader) {
        globalLoader.hidden = true;
      }
    }
  };
})();
