(function () {
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop().split(";").shift();
    }
    return "";
  }

  function post(url) {
    return fetch(url, {
      method: "POST",
      headers: {
        "X-CSRFToken": getCookie("csrftoken"),
        "X-Requested-With": "XMLHttpRequest"
      },
      credentials: "same-origin"
    });
  }

  function postJson(url, data) {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
        "X-Requested-With": "XMLHttpRequest"
      },
      credentials: "same-origin",
      body: JSON.stringify(data || {})
    });
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let index = 0; index < rawData.length; index += 1) {
      outputArray[index] = rawData.charCodeAt(index);
    }

    return outputArray;
  }

  function updateAppBadge(hasUnread) {
    if (!("setAppBadge" in navigator) || !("clearAppBadge" in navigator)) {
      return;
    }

    try {
      const action = hasUnread ? navigator.setAppBadge() : navigator.clearAppBadge();
      if (action && typeof action.catch === "function") {
        action.catch(function () {});
      }
    } catch (error) {
      // Alguns navegadores expõem a API, mas bloqueiam a chamada fora do PWA.
    }
  }

  function setBellState(hasUnread) {
    document.querySelectorAll("[data-notification-toggle]").forEach(function (button) {
      button.classList.toggle("notification-bell--unread", hasUnread);
    });

    document.querySelectorAll("[data-notifications-summary]").forEach(function (summary) {
      summary.textContent = hasUnread ? "Novas pendências" : "Tudo em dia";
    });

    updateAppBadge(hasUnread);
  }

  function updateBellState() {
    setBellState(Boolean(document.querySelector(".notification-item--unread")));
  }

  function updateEmptyState() {
    const list = document.querySelector("[data-notifications-panel] .notifications-panel__list");
    if (!list) return;

    let empty = list.querySelector("[data-notifications-empty]");
    const hasItems = Boolean(list.querySelector("[data-notification-item]"));
    if (hasItems && empty) {
      empty.remove();
      return;
    }

    if (!hasItems && !empty) {
      empty = document.createElement("p");
      empty.className = "notifications-panel__empty";
      empty.dataset.notificationsEmpty = "1";
      empty.textContent = "Nenhum aviso por enquanto.";
      list.appendChild(empty);
    }
  }

  function closePanel(panel, trigger) {
    if (!panel) return;
    panel.hidden = true;
    document.documentElement.classList.remove("notifications-open");
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    }
  }

  function togglePanel(trigger) {
    const panel = document.querySelector("[data-notifications-panel]");
    if (!panel) return;

    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    document.documentElement.classList.toggle("notifications-open", willOpen);
    trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
  }

  function markDisplayed(banner) {
    const id = banner ? banner.getAttribute("data-notification-id") : "";
    if (!id || banner.dataset.displayMarked === "1") return;
    banner.dataset.displayMarked = "1";
    post(`/gestao/notificacoes/${id}/exibida/`).catch(function () {});
  }

  function closeBanner(banner) {
    if (!banner) return;
    markDisplayed(banner);
    banner.classList.add("notification-toast--closing");
    setTimeout(function () {
      banner.hidden = true;
    }, 180);
  }

  function markRead(link) {
    const id = link.getAttribute("data-notification-read");
    const fallbackUrl = link.getAttribute("href") || "/gestao/";
    const shouldOpen = link.getAttribute("data-notification-open") === "1";
    if (!id) {
      if (shouldOpen) {
        window.location.href = fallbackUrl;
      }
      return;
    }

    post(`/gestao/notificacoes/${id}/lida/`)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Falha ao marcar notificacao.");
        }
        return response.json();
      })
      .then(function (payload) {
        document.querySelectorAll(`[data-notification-id="${id}"]`).forEach(function (item) {
          item.classList.remove("notification-item--unread");
        });
        document.querySelectorAll(`[data-notification-read="${id}"]`).forEach(function (item) {
          item.classList.remove("notification-item--unread");
        });
        setBellState(Boolean(payload.temNaoLida));
        if (shouldOpen) {
          window.location.href = payload.url || fallbackUrl;
        }
      })
      .catch(function () {
        if (shouldOpen) {
          window.location.href = fallbackUrl;
        }
      });
  }

  function archiveNotification(id) {
    if (!id) return;

    post(`/gestao/notificacoes/${id}/limpar/`)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Falha ao limpar notificacao.");
        }
        return response.json();
      })
      .then(function (payload) {
        document.querySelectorAll(`[data-notification-id="${id}"]`).forEach(function (item) {
          item.classList.add("notification-item--removing");
          setTimeout(function () {
            item.remove();
            updateEmptyState();
          }, 160);
        });
        setBellState(Boolean(payload.temNaoLida));
      })
      .catch(function () {});
  }

  function prepareSwipeGestures() {
    let activeItem = null;
    let startX = 0;
    let startY = 0;
    let deltaX = 0;

    document.addEventListener("touchstart", function (event) {
      const target = event.target instanceof Element ? event.target : null;
      activeItem = target ? target.closest("[data-notification-item]") : null;
      if (!activeItem) return;

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      deltaX = 0;
      activeItem.classList.add("notification-item--swiping");
    }, { passive: true });

    document.addEventListener("touchmove", function (event) {
      if (!activeItem) return;

      const touch = event.touches[0];
      deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (Math.abs(deltaX) < 10 || Math.abs(deltaX) < Math.abs(deltaY)) return;

      activeItem.style.transform = `translateX(${Math.max(-90, Math.min(90, deltaX))}px)`;
      activeItem.classList.toggle("notification-item--swipe-read", deltaX > 42);
      activeItem.classList.toggle("notification-item--swipe-clear", deltaX < -42);
    }, { passive: true });

    document.addEventListener("touchend", function () {
      if (!activeItem) return;

      const item = activeItem;
      const id = item.getAttribute("data-notification-id");
      item.classList.remove("notification-item--swiping", "notification-item--swipe-read", "notification-item--swipe-clear");
      item.style.transform = "";

      if (deltaX > 70) {
        item.dataset.notificationSwiped = "1";
        const link = item.querySelector("[data-notification-read]");
        if (link) {
          markRead(link);
        }
      } else if (deltaX < -70) {
        item.dataset.notificationSwiped = "1";
        archiveNotification(id);
      }

      setTimeout(function () {
        delete item.dataset.notificationSwiped;
      }, 250);

      activeItem = null;
      deltaX = 0;
    });
  }

  function browserSupportsPush() {
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  function setPushControlState(box, button, status, state) {
    if (!box || !button || !status) return;

    if (state === "unsupported" || state === "unconfigured") {
      box.hidden = true;
      return;
    }

    box.hidden = false;
    button.disabled = false;
    box.dataset.pushState = state;
    button.dataset.pushState = state;

    if (state === "active") {
      status.textContent = "Avisos externos ativos.";
      button.textContent = "Desativar";
    } else if (state === "blocked") {
      status.textContent = "Notificações bloqueadas no navegador.";
      button.textContent = "Bloqueado";
      button.disabled = true;
    } else if (state === "error") {
      status.textContent = "Não foi possível ativar. Verifique as chaves VAPID.";
      button.textContent = "Tentar novamente";
    } else {
      status.textContent = "Receba avisos na tela de bloqueio.";
      button.textContent = "Ativar";
    }
  }

  function getCurrentPushSubscription() {
    return navigator.serviceWorker.ready.then(function (registration) {
      return registration.pushManager.getSubscription();
    });
  }

  function enablePushNotifications(publicKey) {
    return navigator.serviceWorker.ready
      .then(function (registration) {
        return registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      })
      .then(function (subscription) {
        return postJson("/gestao/notificacoes/push/salvar/", subscription.toJSON());
      });
  }

  function disablePushNotifications(subscription) {
    if (!subscription) {
      return Promise.resolve();
    }

    return postJson("/gestao/notificacoes/push/remover/", { endpoint: subscription.endpoint })
      .then(function () {
        return subscription.unsubscribe();
      });
  }

  function initPushNotificationsControl() {
    const box = document.querySelector("[data-push-notifications-box]");
    const button = document.querySelector("[data-push-notifications-toggle]");
    const status = document.querySelector("[data-push-notifications-status]");

    if (!box || !button || !status) return;

    if (!browserSupportsPush()) {
      setPushControlState(box, button, status, "unsupported");
      return;
    }

    fetch("/gestao/notificacoes/push/status/", {
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Falha ao consultar push.");
        return response.json();
      })
      .then(function (payload) {
        if (!payload.disponivel || !payload.publicKey) {
          setPushControlState(box, button, status, "unconfigured");
          return;
        }

        if (Notification.permission === "denied") {
          setPushControlState(box, button, status, "blocked");
          return;
        }

        getCurrentPushSubscription().then(function (subscription) {
          const active = Boolean(subscription);
          if (subscription && !payload.ativo) {
            postJson("/gestao/notificacoes/push/salvar/", subscription.toJSON()).catch(function () {});
          }
          button.dataset.publicKey = payload.publicKey;
          setPushControlState(box, button, status, active ? "active" : "inactive");
        });
      })
      .catch(function () {
        setPushControlState(box, button, status, "unconfigured");
      });

    button.addEventListener("click", function () {
      const state = button.dataset.pushState;
      const publicKey = button.dataset.publicKey;

      if (button.disabled || !publicKey) return;

      button.disabled = true;
      button.textContent = state === "active" ? "Desativando..." : "Ativando...";

      if (state === "active") {
        getCurrentPushSubscription()
          .then(function (subscription) {
            return disablePushNotifications(subscription);
          })
          .then(function () {
            setPushControlState(box, button, status, "inactive");
          })
          .catch(function () {
            setPushControlState(box, button, status, "active");
          });
        return;
      }

      Notification.requestPermission()
        .then(function (permission) {
          if (permission !== "granted") {
            setPushControlState(box, button, status, permission === "denied" ? "blocked" : "inactive");
            return null;
          }
          return enablePushNotifications(publicKey);
        })
        .then(function (response) {
          if (!response) return;
          if (!response.ok) throw new Error("Falha ao salvar inscricao push.");
          setPushControlState(box, button, status, "active");
        })
        .catch(function () {
          setPushControlState(box, button, status, "error");
        });
    });
  }

  window.AppBase.onReady(function () {
    const panel = document.querySelector("[data-notifications-panel]");
    const trigger = document.querySelector("[data-notification-toggle]");
    const banner = document.querySelector("[data-notification-banner]");

    if (banner) {
      setTimeout(function () {
        markDisplayed(banner);
      }, 800);
    }

    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const toggle = target.closest("[data-notification-toggle]");
      if (toggle) {
        togglePanel(toggle);
        return;
      }

      const notificationLink = target.closest("[data-notification-read]");
      if (notificationLink) {
        event.preventDefault();
        const item = notificationLink.closest("[data-notification-item]");
        if (item && item.dataset.notificationSwiped === "1") {
          return;
        }
        markRead(notificationLink);
        return;
      }

      const clearButton = target.closest("[data-notification-clear]");
      if (clearButton) {
        event.preventDefault();
        archiveNotification(clearButton.getAttribute("data-notification-clear"));
        return;
      }

      const closeBannerButton = target.closest("[data-notification-banner-close]");
      if (closeBannerButton) {
        closeBanner(closeBannerButton.closest("[data-notification-banner]"));
        return;
      }

      if (
        panel &&
        trigger &&
        !panel.hidden &&
        !target.closest("[data-notifications-panel]") &&
        !target.closest("[data-notification-toggle]")
      ) {
        closePanel(panel, trigger);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closePanel(panel, trigger);
      }
    });

    prepareSwipeGestures();
    initPushNotificationsControl();
    updateBellState();
  });
})();
