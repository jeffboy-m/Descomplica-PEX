from django.contrib import admin

from menu.models import Banco, Cartao, Categoria


@admin.register(Banco)
class BancoAdmin(admin.ModelAdmin):
    list_display = ("nome", "usuario", "saldo_inicial", "criado_em", "atualizado_em")
    list_filter = ("criado_em", "atualizado_em")
    search_fields = ("nome", "usuario__nome", "usuario__email")
    raw_id_fields = ("usuario",)
    readonly_fields = ("criado_em", "atualizado_em")


@admin.register(Cartao)
class CartaoAdmin(admin.ModelAdmin):
    list_display = (
        "nome",
        "usuario",
        "limite_total",
        "dia_fechamento",
        "dia_vencimento",
        "altera_fim_semana",
        "criado_em",
    )
    list_filter = ("altera_fim_semana", "criado_em", "atualizado_em")
    search_fields = ("nome", "usuario__nome", "usuario__email")
    raw_id_fields = ("usuario",)
    readonly_fields = ("criado_em", "atualizado_em")


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ("nome", "usuario", "lado_padrao", "afeta_resultado", "ativo", "criado_em")
    list_filter = ("lado_padrao", "afeta_resultado", "ativo", "criado_em")
    search_fields = ("nome", "usuario__nome", "usuario__email")
    raw_id_fields = ("usuario",)
    readonly_fields = ("criado_em", "atualizado_em")
