from django import forms


class CartaoForm(forms.Form):
    nome = forms.CharField(label="Nome", required=False)
    limite_total = forms.DecimalField(label="Limite total", required=False)
    dia_fechamento = forms.IntegerField(label="Dia de fechamento", required=False)
    dia_vencimento = forms.IntegerField(label="Dia de vencimento", required=False)
    logo = forms.CharField(required=False, widget=forms.HiddenInput)
