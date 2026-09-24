from django import forms
from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError


class AceitarConviteForm(forms.Form):
    nome = forms.CharField(label="Nome", max_length=150)
    senha = forms.CharField(label="Senha", widget=forms.PasswordInput)
    confirmar_senha = forms.CharField(label="Repetir senha", widget=forms.PasswordInput)

    def __init__(self, *args, convite, **kwargs):
        super().__init__(*args, **kwargs)
        self.convite = convite

    def clean(self):
        cleaned_data = super().clean()
        senha = cleaned_data.get("senha")
        confirmar_senha = cleaned_data.get("confirmar_senha")

        if senha and confirmar_senha and senha != confirmar_senha:
            self.add_error("confirmar_senha", "As senhas nao conferem.")

        if senha:
            try:
                password_validation.validate_password(senha)
            except ValidationError as exc:
                self.add_error("senha", exc)

        User = get_user_model()
        if User.objects.filter(email__iexact=self.convite.email).exists():
            raise forms.ValidationError("Ja existe um usuario cadastrado com este email.")

        return cleaned_data
