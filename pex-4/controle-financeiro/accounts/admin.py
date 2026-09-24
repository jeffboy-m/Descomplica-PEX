from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.conf import settings
from django import forms
from django.utils.html import format_html
from django.utils import timezone

from accounts.models import ConviteUsuario, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = ("email", "nome", "is_staff", "is_active")
    list_filter = ("is_staff", "is_superuser", "is_active", "groups")
    search_fields = ("email", "nome")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Dados pessoais", {"fields": ("nome",)}),
        ("Permissoes", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Datas importantes", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "nome", "password1", "password2", "is_staff", "is_active"),
            },
        ),
    )
    readonly_fields = ("last_login", "date_joined")


class ConviteUsuarioAdminForm(forms.ModelForm):
    class Meta:
        model = ConviteUsuario
        fields = "__all__"

    def clean_email(self):
        email = User.objects.normalize_email(self.cleaned_data["email"]).lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("Ja existe um usuario cadastrado com este email.")

        convite_ativo = ConviteUsuario.objects.filter(
            email__iexact=email,
            usado_em__isnull=True,
            expira_em__gte=timezone.now(),
        )
        if self.instance.pk:
            convite_ativo = convite_ativo.exclude(pk=self.instance.pk)
        if convite_ativo.exists():
            raise forms.ValidationError("Ja existe um convite ativo para este email.")

        return email


@admin.register(ConviteUsuario)
class ConviteUsuarioAdmin(admin.ModelAdmin):
    form = ConviteUsuarioAdminForm
    list_display = ("email", "status", "is_staff", "is_superuser", "expira_em", "usuario_criado", "criado_por")
    list_filter = ("is_staff", "is_superuser", "usado_em", "expira_em")
    search_fields = ("email", "usuario_criado__email", "usuario_criado__nome")
    readonly_fields = ("token", "link_convite", "criado_por", "usuario_criado", "criado_em", "usado_em")
    fields = (
        "email",
        "link_convite",
        "is_staff",
        "is_superuser",
        "expira_em",
        "token",
        "criado_por",
        "usuario_criado",
        "criado_em",
        "usado_em",
    )

    def save_model(self, request, obj, form, change):
        if not obj.criado_por_id:
            obj.criado_por = request.user
        super().save_model(request, obj, form, change)

    @admin.display(description="link do convite")
    def link_convite(self, obj):
        if not obj.pk:
            return "Salve o convite para gerar o link."

        path = obj.get_absolute_url()
        site_url = getattr(settings, "SITE_URL", "").rstrip("/")
        url = f"{site_url}{path}" if site_url else path
        return format_html('<a href="{}" target="_blank" rel="noopener">{}</a>', url, url)

    @admin.display(description="status")
    def status(self, obj):
        if obj.foi_usado:
            return "Usado"
        if obj.expirou:
            return "Expirado"
        return "Disponivel"
