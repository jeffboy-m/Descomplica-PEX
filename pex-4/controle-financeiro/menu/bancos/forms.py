from django import forms


class BancoForm(forms.Form):
    nome = forms.CharField(label="Nome", required=False)
    saldo_inicial = forms.DecimalField(label="Saldo inicial", required=False)
    logo = forms.CharField(required=False, widget=forms.HiddenInput)
