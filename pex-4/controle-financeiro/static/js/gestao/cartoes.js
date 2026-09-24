(function () {
  const cardGroupStateKey = "card-group-state:" + window.location.pathname + window.location.search;

  function getOpenCardGroups() {
    const raw = sessionStorage.getItem(cardGroupStateKey);
    if (!raw) {
      return [];
    }

    sessionStorage.removeItem(cardGroupStateKey);

    try {
      const state = JSON.parse(raw);
      if (!state || Date.now() - state.at > 15000 || !Array.isArray(state.openIds)) {
        return [];
      }

      return state.openIds;
    } catch (error) {
      sessionStorage.removeItem(cardGroupStateKey);
      return [];
    }
  }

  function saveOpenCardGroups() {
    const openIds = Array.from(document.querySelectorAll(".card-group--open[data-card-group-id]"))
      .map(function (group) {
        return group.getAttribute("data-card-group-id");
      })
      .filter(Boolean);

    sessionStorage.setItem(cardGroupStateKey, JSON.stringify({
      openIds: openIds,
      at: Date.now()
    }));
  }

  function toggleCardGroup(header) {
    const group = header.closest(".card-group");
    if (!group) {
      return;
    }

    group.classList.toggle("card-group--open");
    if (window.AppBase) {
      window.AppBase.keepElementPosition(group);
    }
  }

  function restoreOpenCardGroups() {
    const openIds = getOpenCardGroups();
    document.querySelectorAll(".card-group[data-card-group-id]").forEach(function (group) {
      if (openIds.includes(group.getAttribute("data-card-group-id"))) {
        group.classList.add("card-group--open");
      }
    });
  }

  window.toggleCardGroup = toggleCardGroup;

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const toggleTrigger = target.closest("[data-card-toggle]");
    if (toggleTrigger) {
      toggleCardGroup(toggleTrigger);
    }
  });

  document.addEventListener("app:save-page-state", saveOpenCardGroups);

  if (window.AppBase) {
    window.AppBase.onReady(restoreOpenCardGroups);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restoreOpenCardGroups, { once: true });
  } else {
    restoreOpenCardGroups();
  }
})();
