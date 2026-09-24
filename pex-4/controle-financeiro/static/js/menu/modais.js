export function openDialog(dialog) {
  if (window.AppDialogs) {
    window.AppDialogs.open(dialog);
    return;
  }

  if (dialog && typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
  }
}

export function closeDialog(dialog) {
  if (window.AppDialogs) {
    return window.AppDialogs.close(dialog);
  }

  if (dialog && dialog.open) {
    dialog.close();
  }
  return Promise.resolve();
}

export function switchDialog(sourceDialog, targetDialog) {
  if (window.AppDialogs) {
    window.AppDialogs.switch(sourceDialog, targetDialog);
    return;
  }

  closeDialog(sourceDialog).then(function () {
    openDialog(targetDialog);
  });
}

export function initModalParamCleanup() {
  document.querySelectorAll("dialog[data-modal]").forEach(function (dialog) {
    dialog.addEventListener("close", clearEditParams);
  });
}

function clearEditParams() {
  const url = new URL(window.location.href);
  const params = ["editar_banco", "editar_cartao", "editar_categoria"];
  let changed = false;

  params.forEach(function (param) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  });

  if (changed) {
    const nextUrl = url.pathname + url.search + url.hash;
    window.history.replaceState({}, "", nextUrl);
  }
}
