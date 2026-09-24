from django import forms


TRANSFERENCIA_FORM_PREFIX = "transferencia"


class TransacaoForm(forms.Form):
    tipo = forms.ChoiceField(label="Tipo", required=False, choices=(("entrada", "Entrada"), ("saida", "Saida"), ("cartao", "Cartao")))
    data = forms.DateField(label="Data", required=False, widget=forms.DateInput(attrs={"type": "date"}))
    categoria = forms.ChoiceField(label="Categoria", required=False, choices=((1, "Moradia"), (2, "Alimentacao"), (3, "Salario")))
    beneficiario_pagador = forms.CharField(label="Beneficiario/Pagador", required=False)
    descricao = forms.CharField(label="Descricao", required=False)
    valor = forms.DecimalField(label="Valor", required=False)
    banco_origem_destino = forms.ChoiceField(label="Banco", required=False, choices=(("", "Selecione"), (1, "Nubank"), (2, "Itau")))
    cartao = forms.ChoiceField(label="Cartao", required=False, choices=(("", "Selecione"), (1, "Nubank Platinum")))
    status = forms.ChoiceField(label="Status", required=False, choices=(("pago", "Pago"), ("a_pagar", "A pagar"), ("recebido", "Recebido"), ("a_receber", "A receber")))
    total_parcelas = forms.IntegerField(label="Parcelas", required=False)
    assinatura_recorrente = forms.BooleanField(label="Recorrente", required=False)


class TransferenciaContaForm(forms.Form):
    data = forms.DateField(label="Data", required=False, widget=forms.DateInput(attrs={"type": "date"}))
    banco_origem = forms.ChoiceField(label="Banco origem", required=False, choices=((1, "Nubank"), (2, "Itau")))
    banco_destino = forms.ChoiceField(label="Banco destino", required=False, choices=((1, "Nubank"), (2, "Itau")))
    valor = forms.DecimalField(label="Valor", required=False)
    descricao = forms.CharField(label="Descricao", required=False)


class OrcamentoMensalForm(forms.Form):
    renda_base_mensal = forms.DecimalField(label="Renda base mensal", required=False)
