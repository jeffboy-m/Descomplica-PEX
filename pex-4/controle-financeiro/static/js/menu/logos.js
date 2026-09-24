export function initLogoPickers() {
  document.querySelectorAll("[data-logo-picker]").forEach(function (picker) {
    const targetId = picker.getAttribute("data-target");
    const input = document.getElementById(targetId);
    const preview = picker.querySelector("[data-logo-preview]");
    const search = picker.querySelector("[data-logo-search]");
    const options = Array.from(picker.querySelectorAll("[data-logo-path]"));

    if (!input || !preview) {
      return;
    }

    options.forEach(function (option) {
      option.addEventListener("click", function () {
        selectLogo(input, preview, options, option.getAttribute("data-logo-path"));
      });
    });

    if (search) {
      search.addEventListener("input", function () {
        filterLogoOptions(search.value, options);
      });
    }

    selectLogo(input, preview, options, input.value);
  });
}

export function refreshLogoPicker(form, path) {
  const logoField = form ? form.querySelector('[name="logo"]') : null;
  if (!logoField) {
    return;
  }

  const picker = form.querySelector(`[data-logo-picker][data-target="${logoField.id}"]`);
  const option = picker
    ? Array.from(picker.querySelectorAll("[data-logo-path]")).find(function (item) {
        return item.getAttribute("data-logo-path") === (path || "");
      })
    : null;

  if (option) {
    option.click();
    return;
  }

  logoField.value = path || "";
  logoField.dispatchEvent(new Event("input", { bubbles: true }));
  logoField.dispatchEvent(new Event("change", { bubbles: true }));
}

function selectLogo(input, preview, options, path) {
  input.value = path || "";
  options.forEach(function (option) {
    option.classList.toggle("is-selected", option.getAttribute("data-logo-path") === (path || ""));
  });
  renderPreview(preview, options, path);
}

function renderPreview(preview, options, path) {
  preview.innerHTML = "";
  if (!path) {
    const empty = document.createElement("span");
    empty.className = "hint";
    empty.textContent = "Sem logo selecionada";
    preview.appendChild(empty);
    return;
  }

  const selectedOption = options.find(function (option) {
    return option.getAttribute("data-logo-path") === path;
  });
  const selectedImage = selectedOption ? selectedOption.querySelector("img") : null;
  if (selectedImage) {
    const img = selectedImage.cloneNode(false);
    img.loading = "lazy";
    preview.appendChild(img);
  }
}

function filterLogoOptions(value, options) {
  const term = normalizeSearchText(value);
  options.forEach(function (option) {
    const name = normalizeSearchText(option.getAttribute("data-logo-name"));
    const path = normalizeSearchText(option.getAttribute("data-logo-path"));
    const shouldHide = term !== "" && !name.includes(term) && !path.includes(term);
    option.hidden = shouldHide;
    option.classList.toggle("is-hidden", shouldHide);
  });
}

function normalizeSearchText(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
