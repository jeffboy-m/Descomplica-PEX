from django import forms


class CategoriaForm(forms.Form):
    nome = forms.CharField(label="Nome", required=False)
    icone = forms.CharField(required=False, widget=forms.HiddenInput)
    lado_padrao = forms.ChoiceField(label="Lado padrao", required=False, choices=(("saida", "Saida"), ("entrada", "Entrada"), ("ambos", "Ambos")))
    afeta_resultado = forms.BooleanField(label="Afeta resultado", required=False)
    ativo = forms.BooleanField(label="Ativo", required=False)
