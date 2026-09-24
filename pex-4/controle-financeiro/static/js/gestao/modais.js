// Módulo de Modais e Reatividade do Formulário
const dataEl = document.getElementById('acompanhamento-data');
let config = dataEl ? JSON.parse(dataEl.textContent) : {};
let categoriasLado = config.categoriasLado || {};

let tipoSelect;
let bancoField;
let cartaoField;
let assinaturaRecorrenteField;
let statusSelect;
let categoriaSelect;
let categoriaSelectOriginal;
let originalCategoriasOptions = [];
let statusAlteradoManualmente = false;
const abasLancamento = ['entrada', 'saida', 'cartao', 'transferencia'];

function syncFormRefs() {
  tipoSelect = document.getElementById('id_tipo');
  bancoField = document.getElementById('id_banco_origem_destino');
  cartaoField = document.getElementById('id_cartao');
  assinaturaRecorrenteField = document.getElementById('id_assinatura_recorrente');
  statusSelect = document.getElementById('id_status');
  categoriaSelect = document.getElementById('id_categoria');

  if (categoriaSelect && categoriaSelect !== categoriaSelectOriginal) {
    categoriaSelectOriginal = categoriaSelect;
    originalCategoriasOptions = Array.from(categoriaSelect.options);
  }
}

syncFormRefs();

function getActiveTab() {
  const urlTab = new URLSearchParams(window.location.search).get('aba');
  const pageTab = document.querySelector('[data-active-tab]')?.getAttribute('data-active-tab');
  if (abasLancamento.includes(pageTab)) return pageTab;
  if (abasLancamento.includes(urlTab)) return urlTab;
  return 'extrato';
}

function showAppDialog(dialog) {
  if (window.AppDialogs) {
    window.AppDialogs.open(dialog);
  } else if (dialog && typeof dialog.showModal === 'function' && !dialog.open) {
    dialog.showModal();
  }
}

function closeAppDialog(dialog) {
  if (window.AppDialogs) {
    return window.AppDialogs.close(dialog);
  }
  if (dialog && dialog.open) {
    dialog.close();
  }
  return Promise.resolve();
}

function setFieldVisible(field, visible) {
  if (field) {
    field.hidden = !visible;
  }
}

export function toggleFields() {
  syncFormRefs();
  if (!tipoSelect || !bancoField || !cartaoField) return;
  const val = tipoSelect.value;
  const tipoP = tipoSelect.closest('p');
  const bancoP = bancoField.closest('p');
  const cartaoP = cartaoField.closest('p');
  const statusP = statusSelect ? statusSelect.closest('p') : null;
  const assinaturaRecorrenteP = assinaturaRecorrenteField ? assinaturaRecorrenteField.closest('p') : null;

  setFieldVisible(tipoP, false);

  if (val === 'cartao') {
    setFieldVisible(cartaoP, true);
    setFieldVisible(bancoP, false);
    setFieldVisible(statusP, false);
    if (statusSelect) statusSelect.value = 'pago';
  } else {
    setFieldVisible(cartaoP, false);
    setFieldVisible(bancoP, true);
  }

  setFieldVisible(assinaturaRecorrenteP, true);
  configurarCamposObrigatorios();
  toggleParcelasPorRecorrencia();

  // Atualiza dinamicamente o label para "Pagador" (receitas) ou "Beneficiário" (despesas/cartão)
  const label = document.querySelector('#transacao-form label[for="id_beneficiario_pagador"]');
  if (label) {
    if (val === 'entrada') {
      label.textContent = 'Pagador:';
    } else {
      label.textContent = 'Beneficiário:';
    }
  }
}

function configurarCamposObrigatorios() {
  syncFormRefs();
  if (categoriaSelect) {
    categoriaSelect.required = true;
  }

  if (!tipoSelect || !bancoField || !cartaoField) return;

  if (tipoSelect.value === 'cartao') {
    bancoField.required = false;
    bancoField.disabled = true;
    cartaoField.required = true;
    cartaoField.disabled = false;
  } else {
    bancoField.required = true;
    bancoField.disabled = false;
    cartaoField.required = false;
    cartaoField.disabled = true;
  }
}

function toggleParcelasPorRecorrencia() {
  syncFormRefs();
  const totalParcelasInput = document.getElementById('id_total_parcelas');
  if (!assinaturaRecorrenteField || !totalParcelasInput) return;

  const parcelasP = totalParcelasInput.closest('p');
  const transacaoId = document.getElementById('modal_transacao_id')?.value || '';
  const parcelasVal = parseInt(totalParcelasInput.value, 10) || 1;
  const ehParcelaExistente = Boolean(transacaoId) && parcelasVal > 1;

  if (assinaturaRecorrenteField.checked && !ehParcelaExistente) {
    totalParcelasInput.value = '1';
    setFieldVisible(parcelasP, false);
  } else if (parcelasP) {
    setFieldVisible(parcelasP, true);
  }
}

function sugerirStatusRecorrente() {
  syncFormRefs();
  if (!assinaturaRecorrenteField || !statusSelect || !tipoSelect) return;
  if (!assinaturaRecorrenteField.checked || statusAlteradoManualmente) return;

  if (tipoSelect.value === 'entrada') {
    updateStatusChoices('a_receber');
  } else if (tipoSelect.value === 'saida') {
    updateStatusChoices('a_pagar');
  } else if (tipoSelect.value === 'cartao') {
    updateStatusChoices('pago');
  }
}

function normalizarValorParaComparar(valor) {
  const texto = String(valor || '')
    .replace('R$', '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const numero = Number.parseFloat(texto || '0');
  return Number.isFinite(numero) ? numero.toFixed(2) : '0.00';
}

function houveMudancaDeRecorrencia(form) {
  syncFormRefs();
  if (!form.dataset.originalRecorrencia) return false;

  const campos = {
    tipo: tipoSelect?.value || '',
    data: document.getElementById('id_data')?.value || '',
    categoria: categoriaSelect?.value || '',
    beneficiario: document.getElementById('id_beneficiario_pagador')?.value || '',
    descricao: document.getElementById('id_descricao')?.value || '',
    banco: bancoField?.value || '',
    cartao: cartaoField?.value || '',
    status: statusSelect?.value || '',
    assinatura: assinaturaRecorrenteField && assinaturaRecorrenteField.checked ? '1' : '0',
    valor: normalizarValorParaComparar(document.getElementById('id_valor')?.value || ''),
  };

  return Object.entries(campos).some(([campo, valor]) => form.dataset[`original${campo}`] !== valor);
}

export function updateStatusChoices(defaultVal = null) {
  syncFormRefs();
  if (!tipoSelect || !statusSelect) return;
  const tipo = tipoSelect.value;
  const currentVal = defaultVal || statusSelect.value;

  statusSelect.innerHTML = '';
  let options = [];

  if (tipo === 'entrada') {
    options = [
      { value: 'recebido', text: 'Recebido' },
      { value: 'a_receber', text: 'A receber' }
    ];
    setFieldVisible(statusSelect.closest('p'), true);
  } else if (tipo === 'saida') {
    options = [
      { value: 'pago', text: 'Pago' },
      { value: 'a_pagar', text: 'A pagar' }
    ];
    setFieldVisible(statusSelect.closest('p'), true);
  } else {
    options = [
      { value: 'pago', text: 'Pago' }
    ];
    setFieldVisible(statusSelect.closest('p'), false);
  }

  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.text = opt.text;
    if (opt.value === currentVal) {
      o.selected = true;
    }
    statusSelect.appendChild(o);
  });
}

export function updateCategoryChoices(selectedValue = null) {
  syncFormRefs();
  if (!categoriaSelect || !tipoSelect) return;
  
  const tipo = tipoSelect.value;
  const ladoAlvo = tipo === 'entrada' ? 'entrada' : 'saida';
  const currentVal = selectedValue || categoriaSelect.value;
  
  categoriaSelect.innerHTML = '';
  
  originalCategoriasOptions.forEach(opt => {
    if (!opt.value) {
      const cloned = opt.cloneNode(true);
      cloned.selected = !currentVal;
      categoriaSelect.appendChild(cloned);
      return;
    }
    
    // Ocultar a categoria interna "Fatura de Cartão" a não ser que o lançamento já esteja usando-a
    if (opt.text.trim() === 'Fatura de Cartão' && opt.value !== currentVal) {
      return;
    }
    
    const lado = categoriasLado[opt.value];

    let matches = false;
    if (tipo === 'cartao') {
      matches = (lado === 'saida');
    } else {
      matches = (lado === ladoAlvo || lado === 'ambos');
    }

    if (matches) {
      const cloned = opt.cloneNode(true);
      if (opt.value === currentVal) {
        cloned.selected = true;
      }
      categoriaSelect.appendChild(cloned);
    }
  });
}


export function handleCategoryChange() {
  syncFormRefs();
  if (!categoriaSelect || !tipoSelect) return;
  const catId = categoriaSelect.value;
  const lado = categoriasLado[catId];
  if (lado === 'entrada') {
    tipoSelect.value = 'entrada';
  } else if (lado === 'saida') {
    if (tipoSelect.value === 'entrada') {
      tipoSelect.value = 'saida';
    }
  }
  toggleFields();
  updateStatusChoices();
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultDateForViewedMonth() {
  const today = new Date();
  const mesVis = config.mesVisualizado;
  const anoVis = config.anoVisualizado;

  if (mesVis && anoVis) {
    if (anoVis === today.getFullYear() && mesVis === (today.getMonth() + 1)) {
      return formatLocalDate(today);
    }
    const padMonth = String(mesVis).padStart(2, '0');
    return `${anoVis}-${padMonth}-01`;
  }

  return formatLocalDate(today);
}

export function openCreateModal(tipoLancamento = null) {
  syncFormRefs();
  if (!tipoLancamento) {
    tipoLancamento = getActiveTab();
  }
  const modal = document.getElementById('transacao-modal');
  const form = document.getElementById('transacao-form');
  if (!modal || !form || !tipoSelect) return;

  form.reset();
  form.removeAttribute('data-confirm-delete');
  statusAlteradoManualmente = false;
  delete form.dataset.originalAssinaturaRecorrente;
  delete form.dataset.originalRecorrencia;
  delete form.dataset.updateScopeSelected;

  form.querySelector('#modal_transacao_id').value = '';
  form.querySelector('#modal_action').value = 'save';
  form.querySelector('#modal_update_scope').value = 'single';
  form.querySelector('#modal_delete_btn').hidden = true;
  modal.querySelector('.modal-head h3').innerText = 'Novo Lançamento';
  setFieldVisible(form.querySelector('#id_total_parcelas').closest('p'), true);
  if (assinaturaRecorrenteField) assinaturaRecorrenteField.checked = false;

  if (!['entrada', 'saida', 'cartao'].includes(tipoLancamento)) {
    tipoLancamento = 'saida';
  }

  tipoSelect.value = tipoLancamento;
  
  form.querySelector('#id_data').value = getDefaultDateForViewedMonth();
  
  toggleFields();
  toggleParcelasPorRecorrencia();
  updateStatusChoices('pago');
  updateCategoryChoices('');
  
  showAppDialog(modal);
}

export function openEditModal(element) {
  syncFormRefs();
  const id = element.getAttribute('data-id');
  const tipo = element.getAttribute('data-tipo');
  const data = element.getAttribute('data-data');
  const categoria = element.getAttribute('data-categoria');
  const beneficiario = element.getAttribute('data-beneficiario');
  const descricao = element.getAttribute('data-descricao');
  const valor = element.getAttribute('data-valor');
  const banco = element.getAttribute('data-banco');
  const cartao = element.getAttribute('data-cartao');
  const status = element.getAttribute('data-status');
  const parcelas = element.getAttribute('data-parcelas');
  const recorrencia = element.getAttribute('data-recorrencia');
  const assinaturaRecorrente = element.getAttribute('data-assinatura-recorrente');

  const modal = document.getElementById('transacao-modal');
  const form = document.getElementById('transacao-form');
  if (!modal || !form || !tipoSelect) return;

  form.removeAttribute('data-confirm-delete');
  statusAlteradoManualmente = false;
  delete form.dataset.updateScopeSelected;
  form.dataset.originalAssinaturaRecorrente = assinaturaRecorrente === '1' ? '1' : '0';
  form.dataset.originalRecorrencia = recorrencia || '';
  form.dataset.originaltipo = tipo || '';
  form.dataset.originaldata = data || '';
  form.dataset.originalcategoria = categoria || '';
  form.dataset.originalbeneficiario = beneficiario || '';
  form.dataset.originaldescricao = descricao || '';
  form.dataset.originalvalor = normalizarValorParaComparar(valor || '');
  form.dataset.originalbanco = banco || '';
  form.dataset.originalcartao = cartao || '';
  form.dataset.originalstatus = status || '';
  form.dataset.originalassinatura = assinaturaRecorrente === '1' ? '1' : '0';
  form.querySelector('#modal_transacao_id').value = id;
  form.querySelector('#modal_action').value = 'save';
  form.querySelector('#modal_update_scope').value = 'single';
  form.querySelector('#modal_delete_btn').hidden = false;
  modal.querySelector('.modal-head h3').innerText = 'Editar Lançamento';
  
  setFieldVisible(form.querySelector('#id_total_parcelas').closest('p'), true);

  tipoSelect.value = tipo;
  updateCategoryChoices(categoria);
  form.querySelector('#id_data').value = data;
  form.querySelector('#id_categoria').value = categoria;
  form.querySelector('#id_beneficiario_pagador').value = beneficiario;
  form.querySelector('#id_descricao').value = descricao;
  
  // Define o valor e dispara o evento 'input' para acionar a máscara monetária (evita multiplicação/erros de parsing)
  const inputValor = form.querySelector('#id_valor');
  inputValor.value = valor;
  inputValor.dispatchEvent(new Event('input', { bubbles: true }));

  // Preserva a quantidade de parcelas original para que não seja reiniciada para 1 ao editar
  form.querySelector('#id_total_parcelas').value = parcelas || '1';
  if (assinaturaRecorrenteField) {
    assinaturaRecorrenteField.checked = assinaturaRecorrente === '1';
  }
  
  if (tipo === 'cartao') {
    cartaoField.value = cartao;
  } else {
    bancoField.value = banco;
  }

  toggleFields();
  toggleParcelasPorRecorrencia();
  updateStatusChoices(status);

  showAppDialog(modal);
}

function getTransferenciaField(name) {
  return document.getElementById(`id_transferencia-${name}`);
}

export function openCreateTransferenciaModal() {
  const form = document.getElementById('transferencia-form');
  if (!form) return;

  form.reset();
  form.removeAttribute('data-confirm-delete');
  delete form.dataset.confirmBypass;

  document.getElementById('transferencia_action').value = 'save_transferencia';
  document.getElementById('transferencia_id').value = '';
  document.getElementById('transferencia-modal-title').innerText = 'Transferir entre contas';

  const deleteButton = document.getElementById('transferencia_delete_btn');
  if (deleteButton) {
    deleteButton.hidden = true;
  }

  const dataField = getTransferenciaField('data');
  if (dataField) {
    dataField.value = getDefaultDateForViewedMonth();
  }

  const valorField = getTransferenciaField('valor');
  if (valorField) {
    valorField.value = '';
  }

  const modal = document.getElementById('transferencia-modal');
  showAppDialog(modal);
}

export function openEditTransferenciaModal(element) {
  const form = document.getElementById('transferencia-form');
  if (!form) return;

  form.reset();
  form.removeAttribute('data-confirm-delete');
  delete form.dataset.confirmBypass;

  document.getElementById('transferencia_action').value = 'save_transferencia';
  document.getElementById('transferencia_id').value = element.getAttribute('data-transferencia-id') || '';
  document.getElementById('transferencia-modal-title').innerText = 'Editar transferência';

  const dataField = getTransferenciaField('data');
  const origemField = getTransferenciaField('banco_origem');
  const destinoField = getTransferenciaField('banco_destino');
  const valorField = getTransferenciaField('valor');
  const descricaoField = getTransferenciaField('descricao');

  if (dataField) dataField.value = element.getAttribute('data-transferencia-data') || '';
  if (origemField) origemField.value = element.getAttribute('data-transferencia-origem') || '';
  if (destinoField) destinoField.value = element.getAttribute('data-transferencia-destino') || '';
  if (descricaoField) descricaoField.value = element.getAttribute('data-transferencia-descricao') || '';
  if (valorField) {
    valorField.value = element.getAttribute('data-transferencia-valor') || '';
    valorField.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const deleteButton = document.getElementById('transferencia_delete_btn');
  if (deleteButton) {
    deleteButton.hidden = false;
  }

  const modal = document.getElementById('transferencia-modal');
  showAppDialog(modal);
}

export function submitDeleteTransferencia() {
  const form = document.getElementById('transferencia-form');
  if (!form) return;

  document.getElementById('transferencia_action').value = 'delete_transferencia';
  form.setAttribute('data-confirm-delete', 'Deseja realmente excluir esta transferência entre contas?');

  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit();
  } else {
    form.submit();
  }
}

export function submitDelete() {
  syncFormRefs();
  const form = document.getElementById('transacao-form');
  const totalParcelasInput = document.getElementById('id_total_parcelas');
  const parcelasVal = totalParcelasInput ? parseInt(totalParcelasInput.value) || 1 : 1;
  const recorrenciaOriginal = form?.dataset.originalRecorrencia || '';

  if (parcelasVal > 1 || recorrenciaOriginal) {
    // Fecha o modal principal para não sobrepor e abre o modal de opções de exclusão
    const transacaoModal = document.getElementById('transacao-modal');
    closeAppDialog(transacaoModal);

    const choicesModal = document.getElementById('delete-choices-modal');
    if (choicesModal) {
      configurarModalExclusao(recorrenciaOriginal ? 'recorrencia' : 'parcela');
      showAppDialog(choicesModal);
    }
  } else {
    // Lançamento comum, segue o fluxo de exclusão padrão
    form.querySelector('#modal_action').value = 'delete';
    form.querySelector('#modal_delete_scope').value = 'single';
    form.setAttribute('data-confirm-delete', 'Deseja realmente excluir este lançamento?');
    
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
      form.dispatchEvent(submitEvent);
    }
  }
}

function configurarModalExclusao(tipo) {
  const title = document.getElementById('delete-choices-title');
  const text = document.getElementById('delete-choices-text');
  const single = document.querySelector('[data-delete-single-label]');
  const future = document.querySelector('[data-delete-future-label]');
  const all = document.querySelector('[data-delete-all-label]');

  if (tipo === 'recorrencia') {
    if (title) title.textContent = 'Excluir recorrencia';
    if (text) text.textContent = 'Este lançamento faz parte de uma recorrência. Como deseja excluí-lo?';
    if (single) single.textContent = 'Apenas este lançamento';
    if (future) future.textContent = 'Este e os próximos';
    if (all) all.hidden = true;
    return;
  }

  if (title) title.textContent = 'Excluir Lançamento Parcelado';
  if (text) text.textContent = 'Este lançamento faz parte de uma compra parcelada. Como deseja excluí-lo?';
  if (single) single.textContent = 'Apenas esta parcela';
  if (future) future.textContent = 'Esta e as próximas';
  if (all) {
    all.textContent = 'Todas as parcelas do grupo';
    all.hidden = false;
  }
}

// Handler de exclusão do modal de opções de parcelas
export function executeDeleteChoice(scope) {
  const form = document.getElementById('transacao-form');
  form.querySelector('#modal_action').value = 'delete';
  form.querySelector('#modal_delete_scope').value = scope;
  
  // Ignora o diálogo de confirmação padrão porque o usuário já tomou a decisão no modal de escolhas
  form.dataset.confirmBypass = "1";
  
  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit();
  } else {
    form.submit();
  }
};

export function executeUpdateChoice(scope) {
  const form = document.getElementById('transacao-form');
  form.querySelector('#modal_update_scope').value = scope || 'single';
  form.dataset.updateScopeSelected = "1";

  const choicesModal = document.getElementById('update-choices-modal');
  closeAppDialog(choicesModal).then(() => {
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.submit();
    }
  });
}

export function openMonthPickerModal() {
  const modal = document.getElementById('month-picker-modal');
  showAppDialog(modal);
}

export function openQuickPayModal(transacaoId, bancoId = '') {
  document.getElementById('quitacao_transacao_id').value = transacaoId;
  const selectBanco = document.getElementById('quitacao_banco_id');
  if (selectBanco) {
    selectBanco.value = bancoId;
  }
  const modal = document.getElementById('quitacao-modal');
  showAppDialog(modal);
}

export function openQuickPayFaturaModal(cartaoId, mes, ano, valor) {
  document.getElementById('quitacao_fatura_cartao_id').value = cartaoId;
  document.getElementById('quitacao_fatura_mes').value = mes;
  document.getElementById('quitacao_fatura_ano').value = ano;
  const valorInput = document.getElementById('quitacao_fatura_valor');
  if (valorInput) {
    valorInput.value = String(valor || '0').replace('.', ',');
    valorInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const selectBanco = document.getElementById('quitacao_fatura_banco_id');
  if (selectBanco) {
    selectBanco.value = '';
  }
  const modal = document.getElementById('quitacao-fatura-modal');
  showAppDialog(modal);
}


toggleFields();

document.addEventListener('change', function (event) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.closest('#transacao-form')) return;

  syncFormRefs();

  if (target.id === 'id_tipo') {
    toggleFields();
    updateStatusChoices();
    updateCategoryChoices();
    return;
  }

  if (target.id === 'id_categoria') {
    handleCategoryChange();
    return;
  }

  if (target.id === 'id_assinatura_recorrente') {
    toggleParcelasPorRecorrencia();
    sugerirStatusRecorrente();
    return;
  }

  if (target.id === 'id_status') {
    statusAlteradoManualmente = true;
  }
});

document.addEventListener('gestao:config-updated', function () {
  const currentDataEl = document.getElementById('acompanhamento-data');
  config = currentDataEl ? JSON.parse(currentDataEl.textContent) : {};
  categoriasLado = config.categoriasLado || {};
});

export function showCustomConfirm(message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-modal');
    if (!dialog) {
      resolve(false);
      return;
    }
    
    const textEl = document.getElementById('confirm-modal-text');
    if (textEl) {
      textEl.textContent = message;
    }
    
    const cancelBtn = document.getElementById('confirm-modal-cancel-btn');
    const okBtn = document.getElementById('confirm-modal-ok-btn');
    const extraBtn = document.getElementById('confirm-modal-extra-btn');

    if (extraBtn) {
      extraBtn.hidden = true;
    }
    
    const cleanUp = (result) => {
      closeAppDialog(dialog);
      const newCancel = cancelBtn.cloneNode(true);
      const newOk = okBtn.cloneNode(true);
      cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
      okBtn.parentNode.replaceChild(newOk, okBtn);
      resolve(result);
    };
    
    const activeCancelBtn = document.getElementById('confirm-modal-cancel-btn');
    const activeOkBtn = document.getElementById('confirm-modal-ok-btn');
    
    activeCancelBtn.addEventListener('click', () => cleanUp(false));
    activeOkBtn.addEventListener('click', () => cleanUp(true));
    
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      cleanUp(false);
    });
    
    showAppDialog(dialog);
  });
}

document.addEventListener('submit', function (event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'transacao-form') return;

  syncFormRefs();

  const modalAction = form.querySelector('#modal_action').value;
  if (modalAction === 'save') {
      const tipo = tipoSelect.value;
      const transacaoId = form.querySelector('#modal_transacao_id').value;
      const totalParcelasInput = form.querySelector('#id_total_parcelas');
      const parcelasVal = totalParcelasInput ? parseInt(totalParcelasInput.value, 10) || 1 : 1;
      const assinaturaAtual = assinaturaRecorrenteField && assinaturaRecorrenteField.checked ? '1' : '0';
      const assinaturaOriginal = form.dataset.originalAssinaturaRecorrente;
      const recorrenciaOriginal = form.dataset.originalRecorrencia || '';
      const recorrenciaAlterada = houveMudancaDeRecorrencia(form);

      if (
        transacaoId &&
        ((parcelasVal > 1 && assinaturaOriginal !== assinaturaAtual) || (recorrenciaOriginal && recorrenciaAlterada)) &&
        assinaturaOriginal != null &&
        !form.dataset.updateScopeSelected
      ) {
        event.preventDefault();
        if (window.AppLoader && typeof window.AppLoader.cancel === 'function') {
          window.AppLoader.cancel();
        }
        const choicesModal = document.getElementById('update-choices-modal');
        if (choicesModal) {
          showAppDialog(choicesModal);
        }
        return;
      }

      if (tipo === 'cartao') {
        const cartaoId = cartaoField.value;
        const diaFechamento = config.cartoesFechamento ? config.cartoesFechamento[cartaoId] : null;
        if (diaFechamento) {
          const dataInput = form.querySelector('#id_data').value;
          if (dataInput) {
            // Extrai o dia da data no formato YYYY-MM-DD
            const partes = dataInput.split('-');
            const diaLancamento = parseInt(partes[2], 10);
            if (diaLancamento === parseInt(diaFechamento, 10)) {
              if (!form.dataset.confirmedCloseDay) {
                event.preventDefault();
                showCustomConfirm("Lançamento no dia do fechamento, pode haver divergência no processamento do banco. Deseja salvar mesmo assim?")
                  .then(prosseguir => {
                    if (prosseguir) {
                      form.dataset.confirmedCloseDay = "true";
                      if (typeof form.requestSubmit === 'function') {
                        form.requestSubmit();
                      } else {
                        form.submit();
                      }
                    }
                  });
              } else {
                delete form.dataset.confirmedCloseDay;
              }
            }
          }
        }
      }
    }
});

document.addEventListener('click', function (event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.closest('[data-stop-propagation]')) {
    event.stopPropagation();
    return;
  }

  const createTrigger = target.closest('[data-create-transaction]');
  if (createTrigger) {
    const triggerTab = createTrigger.getAttribute('data-create-transaction');
    const activeTab = abasLancamento.includes(triggerTab) ? triggerTab : getActiveTab();
    if (activeTab === 'transferencia') {
      openCreateTransferenciaModal();
      return;
    }
    openCreateModal(activeTab);
    return;
  }

  const monthPickerTrigger = target.closest('[data-month-picker-open]');
  if (monthPickerTrigger) {
    openMonthPickerModal();
    return;
  }

  const quickPayTrigger = target.closest('[data-quick-pay]');
  if (quickPayTrigger) {
    event.stopPropagation();
    openQuickPayModal(
      quickPayTrigger.getAttribute('data-transacao-id'),
      quickPayTrigger.getAttribute('data-banco-id') || ''
    );
    return;
  }

  const quickPayFaturaTrigger = target.closest('[data-quick-pay-fatura]');
  if (quickPayFaturaTrigger) {
    event.stopPropagation();
    openQuickPayFaturaModal(
      quickPayFaturaTrigger.getAttribute('data-cartao-id'),
      quickPayFaturaTrigger.getAttribute('data-mes'),
      quickPayFaturaTrigger.getAttribute('data-ano'),
      quickPayFaturaTrigger.getAttribute('data-valor')
    );
    return;
  }

  const editTrigger = target.closest('[data-edit-transaction]');
  if (editTrigger) {
    openEditModal(editTrigger);
    return;
  }

  const editTransferenciaTrigger = target.closest('[data-edit-transferencia]');
  if (editTransferenciaTrigger) {
    openEditTransferenciaModal(editTransferenciaTrigger);
    return;
  }

  const submitDeleteTrigger = target.closest('[data-submit-delete]');
  if (submitDeleteTrigger) {
    submitDelete();
    return;
  }

  const submitDeleteTransferenciaTrigger = target.closest('[data-submit-delete-transferencia]');
  if (submitDeleteTransferenciaTrigger) {
    submitDeleteTransferencia();
    return;
  }

  const deleteScopeTrigger = target.closest('[data-delete-scope]');
  if (deleteScopeTrigger) {
    executeDeleteChoice(deleteScopeTrigger.getAttribute('data-delete-scope'));
    return;
  }

  const updateScopeTrigger = target.closest('[data-update-scope]');
  if (updateScopeTrigger) {
    executeUpdateChoice(updateScopeTrigger.getAttribute('data-update-scope'));
  }
});

