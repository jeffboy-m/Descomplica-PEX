(function () {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    if ("caches" in window) {
      caches.keys().then(function (keys) {
        keys.forEach(function (key) {
          caches.delete(key);
        });
      });
    }
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(function (registration) {
        registration.unregister();
      });
    });
    return;
  }

  const versionStorageKey = "controleFinanceiroVersion";
  const updateCheckInterval = 30000;
  let lastUpdateCheckAt = 0;
  let pendingVersionKey = null;
  let refreshing = false;

  function extractVersion(scriptText) {
    const text = String(scriptText || "");
    const cacheName = text.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/)?.[1] || "";
    const staticVersion = text.match(/STATIC_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1] || "";

    if (!cacheName && !staticVersion) {
      return null;
    }

    return {
      cacheName: cacheName,
      staticVersion: staticVersion,
      key: cacheName + "::" + staticVersion
    };
  }

  function getStoredVersion() {
    try {
      return window.localStorage.getItem(versionStorageKey);
    } catch (error) {
      return null;
    }
  }

  function storeVersion(versionKey) {
    if (!versionKey) {
      return;
    }

    try {
      window.localStorage.setItem(versionStorageKey, versionKey);
    } catch (error) {
      // localStorage pode estar indisponivel em modo privado.
    }
  }

  function readControllerVersion() {
    return new Promise(function (resolve) {
      if (!navigator.serviceWorker.controller || typeof MessageChannel === "undefined") {
        resolve(null);
        return;
      }

      const channel = new MessageChannel();
      const timeout = window.setTimeout(function () {
        resolve(null);
      }, 1200);

      channel.port1.onmessage = function (event) {
        window.clearTimeout(timeout);
        const data = event.data || {};
        if (!data.cacheName && !data.staticVersion) {
          resolve(null);
          return;
        }
        resolve((data.cacheName || "") + "::" + (data.staticVersion || ""));
      };

      navigator.serviceWorker.controller.postMessage({ type: "GET_VERSION" }, [channel.port2]);
    });
  }

  function closeToast(toast) {
    if (toast) {
      toast.remove();
    }
  }

  async function resetAppCache() {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(function (key) {
        return caches.delete(key);
      }));
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(function (registration) {
      return registration.unregister();
    }));

    storeVersion(pendingVersionKey);
    window.location.reload();
  }

  function showUpdateToast() {
    if (document.querySelector("[data-pwa-update-toast]")) {
      return;
    }

    const toast = document.createElement("div");
    toast.className = "pwa-update-toast";
    toast.setAttribute("data-pwa-update-toast", "");
    toast.innerHTML = [
      '<div class="pwa-update-toast__body">',
      '<strong>Atualização disponível</strong>',
      '<span>Uma nova versão está pronta para uso.</span>',
      '</div>',
      '<div class="pwa-update-toast__actions">',
      '<button type="button" class="pwa-update-toast__secondary" data-pwa-update-later>Depois</button>',
      '<button type="button" class="pwa-update-toast__primary" data-pwa-update-now>Atualizar</button>',
      '</div>'
    ].join("");

    toast.addEventListener("click", function (event) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) {
        return;
      }

      if (target.closest("[data-pwa-update-later]")) {
        closeToast(toast);
        return;
      }

      if (target.closest("[data-pwa-update-now]")) {
        resetAppCache().catch(function (error) {
          console.error("Falha ao atualizar o cache do app.", error);
        });
      }
    });

    document.body.appendChild(toast);
  }

  async function fetchServerVersion() {
    const response = await fetch("/sw.js?check=" + encodeURIComponent(String(Date.now())), {
      cache: "no-store",
      credentials: "same-origin"
    });

    if (!response.ok) {
      return null;
    }

    return extractVersion(await response.text());
  }

  async function checkForUpdate(force) {
    const now = Date.now();
    if (!force && now - lastUpdateCheckAt < updateCheckInterval) {
      return;
    }

    lastUpdateCheckAt = now;

    try {
      const serverVersion = await fetchServerVersion();
      if (!serverVersion) {
        return;
      }

      const currentVersionKey = await readControllerVersion() || getStoredVersion();
      const hasController = Boolean(navigator.serviceWorker.controller);

      if (currentVersionKey === serverVersion.key) {
        storeVersion(serverVersion.key);
        return;
      }

      if (hasController || currentVersionKey) {
        pendingVersionKey = serverVersion.key;
        showUpdateToast();
        return;
      }

      storeVersion(serverVersion.key);
    } catch (error) {
      console.debug("Nao foi possivel verificar atualizacao do app.", error);
    }
  }

  function scheduleUpdateCheck() {
    checkForUpdate(false);
  }

  window.AppPWA = {
    checkForUpdate: checkForUpdate
  };

  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (refreshing) {
      return;
    }

    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", function () {
    navigator.serviceWorker.getRegistration("/")
      .then(function (registration) {
        if (registration) {
          return registration;
        }

        return navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      })
      .then(function () {
        checkForUpdate(true);
      })
      .catch(function (error) {
        console.error("Falha ao preparar Service Worker: ", error);
      });
  });

  document.addEventListener("click", scheduleUpdateCheck, true);
  document.addEventListener("submit", scheduleUpdateCheck, true);
})();
