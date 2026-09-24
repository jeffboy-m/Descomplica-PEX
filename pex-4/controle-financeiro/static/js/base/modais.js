(function () {
  function openDialog(dialog) {
    if (!dialog || typeof dialog.showModal !== "function") {
      return;
    }
    if (!dialog.open) {
      dialog.classList.remove("is-closing");
      dialog.showModal();
    }
  }

  function closeDialog(dialog) {
    if (!dialog || !dialog.open) {
      return Promise.resolve();
    }

    if (dialog.classList.contains("is-closing")) {
      return Promise.resolve();
    }

    if (window.AppBase && window.AppBase.isReducedMotion()) {
      dialog.close();
      return Promise.resolve();
    }

    dialog.classList.add("is-closing");
    return new Promise(function (resolve) {
      setTimeout(function () {
        if (dialog.open) {
          dialog.close();
        }
        dialog.classList.remove("is-closing");
        resolve();
      }, 150);
    });
  }

  window.AppDialogs = {
    open: openDialog,
    close: closeDialog,
    switch: function (fromDialog, toDialog) {
      return closeDialog(fromDialog).then(function () {
        setTimeout(function () {
          openDialog(toDialog);
        }, 20);
      });
    }
  };

  document.addEventListener("close", function (event) {
    if (event.target instanceof HTMLDialogElement) {
      event.target.classList.remove("is-closing");
    }
  }, true);

  window.AppBase.onReady(function () {
    const navDialog = document.getElementById("global-nav-dialog");
    const navBackdrop = document.querySelector("[data-nav-backdrop]");
    const navPin = document.querySelector("[data-nav-pin]");
    const userDialog = document.getElementById("global-user-dialog");
    const confirmDialog = document.getElementById("global-confirm-dialog");
    const confirmMessage = confirmDialog ? confirmDialog.querySelector("[data-confirm-message]") : null;
    const confirmCancel = confirmDialog ? confirmDialog.querySelector("[data-confirm-cancel]") : null;
    const confirmExtra = confirmDialog ? confirmDialog.querySelector("[data-confirm-extra]") : null;
    const confirmOk = confirmDialog ? confirmDialog.querySelector("[data-confirm-ok]") : null;
    const navPinnedKey = "controle-financeiro-nav-pinned";
    const desktopQuery = window.matchMedia("(min-width: 960px)");
    const gestaoTabs = ["extrato", "entrada", "saida", "cartao", "transferencia", "metas"];
    let pendingConfirmForm = null;
    let pendingConfirmAction = null;
    let pendingConfirmExtraAction = null;
    const confirmOkDefaultText = confirmOk ? confirmOk.textContent : "OK";
    const confirmCancelDefaultText = confirmCancel ? confirmCancel.textContent : "Cancelar";
    const confirmExtraDefaultText = confirmExtra ? confirmExtra.textContent : "";
    const confirmOkDefaultClass = confirmOk ? confirmOk.className : "";
    const confirmExtraDefaultClass = confirmExtra ? confirmExtra.className : "";

    function resetConfirmButtons() {
      if (confirmOk) {
        confirmOk.textContent = confirmOkDefaultText;
        confirmOk.className = confirmOkDefaultClass;
      }
      if (confirmCancel) {
        confirmCancel.textContent = confirmCancelDefaultText;
      }
      if (confirmExtra) {
        confirmExtra.textContent = confirmExtraDefaultText;
        confirmExtra.className = confirmExtraDefaultClass;
        confirmExtra.hidden = true;
      }
    }

    function openConfirm(target) {
      if (!confirmDialog || !confirmMessage) {
        return true;
      }

      resetConfirmButtons();
      pendingConfirmForm = null;
      pendingConfirmAction = null;
      pendingConfirmExtraAction = null;

      if (target instanceof HTMLFormElement) {
        pendingConfirmForm = target;
        confirmMessage.textContent = target.dataset.confirmDelete || "Tem certeza que deseja continuar?";
      } else {
        const options = target || {};
        pendingConfirmAction = typeof options.onConfirm === "function" ? options.onConfirm : null;
        pendingConfirmExtraAction = typeof options.onExtra === "function" ? options.onExtra : null;
        confirmMessage.textContent = options.message || "Tem certeza que deseja continuar?";
        if (confirmOk && options.okText) {
          confirmOk.textContent = options.okText;
        }
        if (confirmOk && options.okClass) {
          confirmOk.className = options.okClass;
        }
        if (confirmCancel && options.cancelText) {
          confirmCancel.textContent = options.cancelText;
        }
        if (confirmExtra && options.extraText && pendingConfirmExtraAction) {
          confirmExtra.textContent = options.extraText;
          if (options.extraClass) {
            confirmExtra.className = options.extraClass;
          }
          confirmExtra.hidden = false;
        }
      }

      openDialog(confirmDialog);
      return false;
    }

    function isCurrentPath(path) {
      return window.location.pathname.replace(/\/+$/, "/") === path;
    }

    function canPinNav() {
      return desktopQuery.matches;
    }

    function isNavPinned() {
      return canPinNav() && document.documentElement.classList.contains("nav-pinned");
    }

    function wantsPinnedNav() {
      return localStorage.getItem(navPinnedKey) !== "0";
    }

    function normalizeGestaoTab(tab) {
      return gestaoTabs.indexOf(tab) >= 0 ? tab : "extrato";
    }

    function updateNavPinState() {
      const pinned = isNavPinned();
      if (navPin) {
        navPin.classList.toggle("is-active", pinned);
        navPin.setAttribute("aria-pressed", pinned ? "true" : "false");
        navPin.setAttribute("title", pinned ? "Soltar menu" : "Fixar menu");
        navPin.setAttribute("aria-label", pinned ? "Soltar menu" : "Fixar menu");
      }

      if (navDialog) {
        navDialog.setAttribute("aria-hidden", pinned ? "false" : String(!document.documentElement.classList.contains("nav-open")));
      }
    }

    function setNavPinned(pinned) {
      localStorage.setItem(navPinnedKey, pinned ? "1" : "0");

      if (pinned && canPinNav()) {
        document.documentElement.classList.add("nav-pinned");
        document.documentElement.classList.remove("nav-open");
        if (navBackdrop) {
          navBackdrop.hidden = true;
        }
      } else {
        document.documentElement.classList.remove("nav-pinned");
      }

      updateNavPinState();
      updateNavActive();
    }

    function applyNavPinnedPreference() {
      const shouldPin = canPinNav() && wantsPinnedNav();
      document.documentElement.classList.toggle("nav-pinned", shouldPin);
      if (shouldPin && canPinNav()) {
        document.documentElement.classList.remove("nav-open");
        if (navBackdrop) {
          navBackdrop.hidden = true;
        }
      } else if (navBackdrop && !document.documentElement.classList.contains("nav-open")) {
        navBackdrop.hidden = true;
      }
      updateNavPinState();
    }

    function openNav() {
      if (!navDialog) {
        return;
      }

      applyNavPinnedPreference();
      updateNavActive();
      if (isNavPinned()) {
        updateNavPinState();
        return;
      }

      if (navBackdrop) {
        navBackdrop.hidden = false;
      }

      navDialog.setAttribute("aria-hidden", "false");
      requestAnimationFrame(function () {
        document.documentElement.classList.add("nav-open");
      });
    }

    function closeNav() {
      if (isNavPinned()) {
        return;
      }

      document.documentElement.classList.remove("nav-open");
      if (navDialog) {
        navDialog.setAttribute("aria-hidden", "true");
      }
      setTimeout(function () {
        if (!document.documentElement.classList.contains("nav-open") && navBackdrop) {
          navBackdrop.hidden = true;
        }
      }, 190);
    }

    function updateNavActive() {
      const currentPath = window.location.pathname.replace(/\/+$/, "/");
      const activeGestaoTab = normalizeGestaoTab(new URLSearchParams(window.location.search).get("aba") || "extrato");

      document.querySelectorAll("[data-nav-link]").forEach(function (link) {
        const linkPath = link.getAttribute("data-nav-path");
        const gestaoTab = link.getAttribute("data-gestao-tab-link");
        const isGestaoShortcut = gestaoTab != null;
        let active = false;

        if (isGestaoShortcut && currentPath === "/gestao/") {
          active = gestaoTab === activeGestaoTab;
        } else if (!isGestaoShortcut && linkPath) {
          active = linkPath === "/menu/" ? currentPath.startsWith("/menu/") : currentPath === linkPath;
        }

        link.classList.toggle("is-active", active);
      });
    }

    window.AppConfirm = {
      open: openConfirm
    };

    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const navOpenTrigger = target.closest("[data-nav-open]");
      if (navOpenTrigger) {
        openNav();
        return;
      }

      const userOpenTrigger = target.closest("[data-user-open]");
      if (userOpenTrigger) {
        openDialog(userDialog);
        return;
      }

      const navCloseTrigger = target.closest("[data-nav-close]");
      if (navCloseTrigger) {
        closeNav();
        return;
      }

      if (target.closest("[data-nav-link]")) {
        closeNav();
      }

      const userCloseTrigger = target.closest("[data-user-close]");
      if (userCloseTrigger) {
        closeDialog(userDialog);
        return;
      }

      if (target.closest("[data-nav-backdrop]")) {
        closeNav();
        return;
      }

      const navPinTrigger = target.closest("[data-nav-pin]");
      if (navPinTrigger) {
        setNavPinned(!isNavPinned());
        return;
      }

      if (userDialog && target === userDialog) {
        closeDialog(userDialog);
        return;
      }

      const modalOpenTrigger = target.closest("[data-modal-open]");
      if (modalOpenTrigger) {
        const dialogId = modalOpenTrigger.getAttribute("data-modal-open");
        const dialog = dialogId ? document.getElementById(dialogId) : null;
        openDialog(dialog);
        return;
      }

      const modalCloseTrigger = target.closest("[data-modal-close]");
      if (modalCloseTrigger) {
        const dialog = modalCloseTrigger.closest("dialog");
        closeDialog(dialog);
        return;
      }

      const submitButton = target.closest("button[type='submit']");
      if (!submitButton) {
        return;
      }

      const form = submitButton.closest("form[data-confirm-delete]");
      if (!form) {
        return;
      }

      if (!form.dataset.confirmBypass) {
        event.preventDefault();
        openConfirm(form);
      }
    }, true);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.documentElement.classList.contains("nav-open")) {
        closeNav();
      }
    });

    if (confirmCancel) {
      confirmCancel.addEventListener("click", function () {
        pendingConfirmForm = null;
        pendingConfirmAction = null;
        pendingConfirmExtraAction = null;
        resetConfirmButtons();
        closeDialog(confirmDialog);
      });
    }

    if (confirmExtra) {
      confirmExtra.addEventListener("click", function () {
        if (!pendingConfirmExtraAction) {
          return;
        }

        const action = pendingConfirmExtraAction;
        pendingConfirmForm = null;
        pendingConfirmAction = null;
        pendingConfirmExtraAction = null;
        resetConfirmButtons();
        closeDialog(confirmDialog);
        action();
      });
    }

    if (confirmOk) {
      confirmOk.addEventListener("click", function () {
        if (pendingConfirmAction) {
          const action = pendingConfirmAction;
          pendingConfirmAction = null;
          pendingConfirmExtraAction = null;
          resetConfirmButtons();
          closeDialog(confirmDialog);
          action();
          return;
        }

        if (!pendingConfirmForm) {
          resetConfirmButtons();
          closeDialog(confirmDialog);
          return;
        }

        const form = pendingConfirmForm;
        pendingConfirmForm = null;
        pendingConfirmExtraAction = null;
        resetConfirmButtons();
        form.dataset.confirmBypass = "1";
        if (window.AppNavigation && !form.querySelector('input[name="action"]')) {
          window.AppNavigation.savePagePosition();
        }
        closeDialog(confirmDialog);
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
        } else {
          form.submit();
        }
      });
    }

    const modalState = document.querySelector("[data-open-modal]");
    if (modalState) {
      const initialModalId = modalState.getAttribute("data-open-modal");
      if (initialModalId) {
        openDialog(document.getElementById(initialModalId));
      }
    }

    updateNavActive();
    applyNavPinnedPreference();
    window.addEventListener("pageshow", applyNavPinnedPreference);
    window.addEventListener("focus", applyNavPinnedPreference);
    window.addEventListener("gestao:tab-change", updateNavActive);
    if (typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", applyNavPinnedPreference);
    } else if (typeof desktopQuery.addListener === "function") {
      desktopQuery.addListener(applyNavPinnedPreference);
    }
  });
})();
