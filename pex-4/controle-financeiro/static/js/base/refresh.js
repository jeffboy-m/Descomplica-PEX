(function () {
  function findRegion(nameOrElement) {
    if (nameOrElement instanceof HTMLElement) {
      return nameOrElement;
    }

    if (!nameOrElement) {
      return null;
    }

    return document.querySelector('[data-refresh-region="' + nameOrElement + '"]');
  }

  function transactionSkeleton(count) {
    const total = count || 3;
    const items = [];

    for (let index = 0; index < total; index += 1) {
      items.push([
        '<div class="skeleton-transaction" aria-hidden="true">',
        '<span class="skeleton-avatar"></span>',
        '<span class="skeleton-transaction__body">',
        '<span class="skeleton-line skeleton-line--medium"></span>',
        '<span class="skeleton-line skeleton-line--short"></span>',
        '</span>',
        '<span class="skeleton-transaction__right">',
        '<span class="skeleton-line"></span>',
        '<span class="skeleton-line skeleton-line--short"></span>',
        '</span>',
        '</div>'
      ].join(""));
    }

    return items.join("");
  }

  function cardSkeleton(count) {
    const total = count || 4;
    const items = [];

    for (let index = 0; index < total; index += 1) {
      items.push('<span class="skeleton-card" aria-hidden="true"></span>');
    }

    return items.join("");
  }

  function pillSkeleton(count) {
    const total = count || 5;
    const items = [];

    for (let index = 0; index < total; index += 1) {
      items.push('<span class="skeleton-pill" aria-hidden="true"></span>');
    }

    return items.join("");
  }

  function getSkeletonHtml(type, count) {
    if (type === "cards") {
      return cardSkeleton(count);
    }

    if (type === "pills") {
      return pillSkeleton(count);
    }

    return transactionSkeleton(count);
  }

  function start(nameOrElement, options) {
    const region = findRegion(nameOrElement);
    const config = options || {};

    if (!region || region.classList.contains("is-refreshing")) {
      return null;
    }

    const token = String(Date.now()) + "-" + String(Math.random()).slice(2);

    region.dataset.refreshPreviousHtml = region.innerHTML;
    region.dataset.refreshStartedAt = String(Date.now());
    region.dataset.refreshMinDuration = String(config.minDuration || config.minDurationMs || 0);
    region.dataset.refreshToken = token;
    region.classList.add("is-refreshing");
    region.setAttribute("aria-busy", "true");
    region.innerHTML = getSkeletonHtml(config.type, config.count);
    return region;
  }

  function finish(nameOrElement, html) {
    const region = findRegion(nameOrElement);
    if (!region) {
      return Promise.resolve();
    }

    const token = region.dataset.refreshToken;
    const startedAt = Number(region.dataset.refreshStartedAt || 0);
    const minDuration = Number(region.dataset.refreshMinDuration || 0);
    const elapsed = startedAt ? Date.now() - startedAt : minDuration;
    const delay = Math.max(0, minDuration - elapsed);

    return new Promise(function (resolve) {
      window.setTimeout(function () {
        if (token && region.dataset.refreshToken !== token) {
          resolve();
          return;
        }

        if (typeof html === "string") {
          region.innerHTML = html;
        }

        delete region.dataset.refreshPreviousHtml;
        delete region.dataset.refreshStartedAt;
        delete region.dataset.refreshMinDuration;
        delete region.dataset.refreshToken;
        region.classList.remove("is-refreshing");
        region.removeAttribute("aria-busy");
        resolve();
      }, delay);
    });
  }

  function cancel(nameOrElement) {
    const region = findRegion(nameOrElement);
    if (!region) {
      return;
    }

    if (region.dataset.refreshPreviousHtml != null) {
      region.innerHTML = region.dataset.refreshPreviousHtml;
    }

    delete region.dataset.refreshPreviousHtml;
    delete region.dataset.refreshStartedAt;
    delete region.dataset.refreshMinDuration;
    delete region.dataset.refreshToken;
    region.classList.remove("is-refreshing");
    region.removeAttribute("aria-busy");
  }

  window.AppRefresh = {
    start: start,
    finish: finish,
    cancel: cancel,
    skeletons: {
      cards: cardSkeleton,
      pills: pillSkeleton,
      transactions: transactionSkeleton
    }
  };
})();
