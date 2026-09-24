import { refreshLogoPicker } from "./logos.js";
import { switchDialog } from "./modais.js";

const defaultCategoryIcon = "🏷️";
const categoryIconRules = [
  [["alimentacao", "alimentação", "comida", "lanche"], "🍔"],
  [["mercado", "supermercado", "feira"], "🛒"],
  [["restaurante", "ifood", "delivery"], "🍽️"],
  [["assinatura", "netflix", "spotify", "streaming", "apple"], "🎬"],
  [["educacao", "educação", "faculdade", "curso", "escola"], "🎓"],
  [["financiamento", "emprestimo", "empréstimo"], "🏦"],
  [["lazer", "jogo", "game", "cinema"], "🎮"],
  [["moradia", "aluguel", "casa", "apartamento", "apto", "condominio", "condomínio"], "🏠"],
  [["presente", "gift"], "🎁"],
  [["receita", "recebimento", "dividendo", "renda extra"], "💰"],
  [["salario", "salário", "trabalho"], "💼"],
  [["saude", "saúde", "medico", "médico", "farmacia", "farmácia"], "💊"],
  [["transporte", "uber", "99", "onibus", "ônibus"], "🚗"],
  [["combustivel", "combustível", "gasolina", "posto"], "⛽"],
  [["vestuario", "vestuário", "roupa"], "👕"],
  [["viagem", "hotel", "passagem"], "✈️"],
  [["tecnologia", "internet", "ti", "software"], "💻"],
  [["academia", "fitness"], "🏋️"],
  [["cartao", "cartão", "fatura"], "💳"],
  [["transferencia", "transferência"], "⇄"],
  [["despesa", "gasto"], "💸"],
  [["outro", "outros"], "📦"]
];

export function initEntityForms() {
  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const createButton = target.closest("[data-menu-create]");
    if (createButton) {
      resetEntityForm(createButton.getAttribute("data-menu-create"));
      return;
    }

    const editButton = target.closest("[data-menu-edit]");
    if (editButton) {
      event.preventDefault();
      editEntity(editButton);
    }
  });

  initCategoryIconSuggestion();
}

function suggestCategoryIcon(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) {
    return defaultCategoryIcon;
  }

  const match = categoryIconRules.find(function ([terms]) {
    return terms.some(function (term) {
      return normalized.includes(term);
    });
  });

  return match ? match[1] : defaultCategoryIcon;
}

function initCategoryIconSuggestion() {
  const modal = document.getElementById("categoria-modal");
  const form = modal ? modal.querySelector("form") : null;
  const nameField = form ? form.querySelector('[name="nome"]') : null;
  const iconField = form ? form.querySelector('[name="icone"]') : null;
  if (!form || !nameField || !iconField) {
    return;
  }

  form.querySelectorAll("[data-category-icon-option]").forEach(function (button) {
    button.addEventListener("click", function () {
      setCategoryIcon(form, button.getAttribute("data-category-icon-option"), { touched: true });
    });
  });

  nameField.addEventListener("input", function () {
    if (form.dataset.iconTouched === "1") {
      return;
    }

    setCategoryIcon(form, suggestCategoryIcon(nameField.value));
  });

  setCategoryIcon(form, iconField.value || defaultCategoryIcon);
}

function formatMoneyFromDecimal(value) {
  const numeric = Number(String(value || "0").replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return "0,00";
  }
  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function setField(form, name, value) {
  const field = form ? form.querySelector(`[name="${name}"]`) : null;
  if (!field) {
    return;
  }

  if (field.type === "checkbox") {
    field.checked = value === true || value === "true";
    return;
  }

  field.value = value == null ? "" : value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function setCategoryIcon(form, value, options = {}) {
  const icon = value || defaultCategoryIcon;
  const iconField = form ? form.querySelector('[name="icone"]') : null;
  const current = form ? form.querySelector("[data-category-icon-current]") : null;
  const optionButtons = form ? form.querySelectorAll("[data-category-icon-option]") : [];

  if (iconField) {
    iconField.value = icon;
  }

  if (current) {
    current.textContent = icon;
  }

  optionButtons.forEach(function (button) {
    button.classList.toggle("is-selected", button.getAttribute("data-category-icon-option") === icon);
  });

  if (options.touched) {
    form.dataset.iconTouched = "1";
  }
}

function resetEntityForm(kind) {
  const modal = document.getElementById(`${kind}-modal`);
  const form = modal ? modal.querySelector("form") : null;
  if (!form) {
    return;
  }

  form.reset();
  delete form.dataset.iconTouched;
  setField(form, `${kind}_id`, "");
  refreshLogoPicker(form, "");
  if (kind === "categoria") {
    setCategoryIcon(form, defaultCategoryIcon);
    delete form.dataset.iconTouched;
  }

  const title = modal.querySelector(".modal-head h3");
  const submit = form.querySelector('button[type="submit"]');
  const labels = {
    banco: ["Cadastrar banco", "Salvar banco"],
    cartao: ["Cadastrar cartao", "Salvar cartao"],
    categoria: ["Cadastrar categoria", "Salvar categoria"]
  };

  if (labels[kind]) {
    if (title) title.textContent = labels[kind][0];
    if (submit) submit.textContent = labels[kind][1];
  }
}

function editEntity(button) {
  const kind = button.getAttribute("data-menu-edit");
  const modal = document.getElementById(button.getAttribute("data-target-modal"));
  const form = modal ? modal.querySelector("form") : null;
  if (!kind || !modal || !form) {
    return;
  }

  resetEntityForm(kind);
  setField(form, `${kind}_id`, button.dataset.id || "");

  if (kind === "banco") {
    setField(form, "nome", button.dataset.nome || "");
    setField(form, "saldo_inicial", formatMoneyFromDecimal(button.dataset.saldoInicial));
    refreshLogoPicker(form, button.dataset.logo || "");
  } else if (kind === "cartao") {
    setField(form, "nome", button.dataset.nome || "");
    setField(form, "limite_total", formatMoneyFromDecimal(button.dataset.limiteTotal));
    setField(form, "dia_fechamento", button.dataset.diaFechamento || "");
    setField(form, "dia_vencimento", button.dataset.diaVencimento || "");
    refreshLogoPicker(form, button.dataset.logo || "");
  } else if (kind === "categoria") {
    setField(form, "nome", button.dataset.nome || "");
    setCategoryIcon(form, button.dataset.icone || suggestCategoryIcon(button.dataset.nome), { touched: true });
    setField(form, "lado_padrao", button.dataset.ladoPadrao || "");
    setField(form, "afeta_resultado", button.dataset.afetaResultado);
    setField(form, "ativo", button.dataset.ativo);
  }

  const title = modal.querySelector(".modal-head h3");
  const submit = form.querySelector('button[type="submit"]');
  const labels = {
    banco: ["Editar banco", "Atualizar banco"],
    cartao: ["Editar cartao", "Atualizar cartao"],
    categoria: ["Editar categoria", "Atualizar categoria"]
  };

  if (labels[kind]) {
    if (title) title.textContent = labels[kind][0];
    if (submit) submit.textContent = labels[kind][1];
  }

  switchDialog(button.closest("dialog"), modal);
}
