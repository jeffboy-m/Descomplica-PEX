from django.contrib import admin

from gestao.models import (
    FaturaCartao,
    InscricaoPush,
    MetaCategoria,
    Notificacao,
    OrcamentoMensal,
    PagamentoFaturaCartao,
    Recorrencia,
    RecorrenciaExcecao,
    Transacao,
    TransferenciaConta,
)


@admin.register(OrcamentoMensal)
class OrcamentoMensalAdmin(admin.ModelAdmin):
    list_display = ("usuario", "mes", "ano", "renda_base", "atualizado_em")
    list_filter = ("ano", "mes")
    search_fields = ("usuario__nome", "usuario__email")
    raw_id_fields = ("usuario",)
    readonly_fields = ("criado_em", "atualizado_em")


@admin.register(MetaCategoria)
class MetaCategoriaAdmin(admin.ModelAdmin):
    list_display = ("categoria", "usuario", "mes", "ano", "valor", "atualizado_em")
    list_filter = ("ano", "mes")
    search_fields = ("categoria__nome", "usuario__nome", "usuario__email")
    raw_id_fields = ("usuario", "categoria")
    readonly_fields = ("criado_em", "atualizado_em")


@admin.register(Transacao)
class TransacaoAdmin(admin.ModelAdmin):
    list_display = (
        "data",
        "usuario",
        "tipo",
        "categoria",
        "valor",
        "status",
        "banco_origem_destino",
        "cartao",
        "criado_em",
    )
    list_filter = ("tipo", "status", "data", "criado_em")
    search_fields = (
        "beneficiario_pagador",
        "descricao",
        "usuario__nome",
        "usuario__email",
        "categoria__nome",
        "banco_origem_destino__nome",
        "cartao__nome",
    )
    raw_id_fields = ("usuario", "categoria", "banco_origem_destino", "cartao", "recorrencia")
    readonly_fields = ("criado_em", "atualizado_em")
    date_hierarchy = "data"


@admin.register(Recorrencia)
class RecorrenciaAdmin(admin.ModelAdmin):
    list_display = (
        "usuario",
        "tipo",
        "categoria",
        "valor",
        "dia",
        "data_inicio",
        "data_fim",
        "ativa",
    )
    list_filter = ("tipo", "ativa", "data_inicio", "data_fim")
    search_fields = (
        "beneficiario_pagador",
        "descricao",
        "usuario__nome",
        "usuario__email",
        "categoria__nome",
    )
    raw_id_fields = ("usuario", "categoria", "banco_origem_destino", "cartao")
    readonly_fields = ("criado_em", "atualizado_em")


@admin.register(RecorrenciaExcecao)
class RecorrenciaExcecaoAdmin(admin.ModelAdmin):
    list_display = ("recorrencia", "usuario", "mes", "ano", "criado_em")
    list_filter = ("ano", "mes", "criado_em")
    search_fields = ("usuario__nome", "usuario__email", "recorrencia__descricao")
    raw_id_fields = ("usuario", "recorrencia")
    readonly_fields = ("criado_em",)


@admin.register(FaturaCartao)
class FaturaCartaoAdmin(admin.ModelAdmin):
    list_display = (
        "cartao",
        "usuario",
        "mes",
        "ano",
        "valor_total",
        "valor_pago",
        "status",
        "data_vencimento",
    )
    list_filter = ("status", "ano", "mes", "data_vencimento")
    search_fields = ("cartao__nome", "usuario__nome", "usuario__email")
    raw_id_fields = ("usuario", "cartao")
    readonly_fields = ("criado_em", "atualizado_em", "saldo_pendente")


@admin.register(PagamentoFaturaCartao)
class PagamentoFaturaCartaoAdmin(admin.ModelAdmin):
    list_display = ("fatura", "usuario", "banco", "valor", "data_pagamento", "criado_em")
    list_filter = ("data_pagamento", "criado_em")
    search_fields = ("usuario__nome", "usuario__email", "fatura__cartao__nome", "banco__nome")
    raw_id_fields = ("usuario", "fatura", "banco", "transacao_saida")
    readonly_fields = ("criado_em", "atualizado_em")


@admin.register(Notificacao)
class NotificacaoAdmin(admin.ModelAdmin):
    list_display = (
        "titulo",
        "usuario",
        "tipo",
        "data_referencia",
        "lida_em",
        "arquivada_em",
        "push_enviada_em",
        "criado_em",
    )
    list_filter = ("tipo", "data_referencia", "lida_em", "arquivada_em", "push_enviada_em")
    search_fields = ("titulo", "mensagem", "usuario__nome", "usuario__email")
    raw_id_fields = ("usuario",)
    readonly_fields = ("criado_em", "atualizado_em", "push_enviada_em")


@admin.register(InscricaoPush)
class InscricaoPushAdmin(admin.ModelAdmin):
    list_display = ("usuario", "ativa", "ultimo_envio_em", "ultimo_erro", "criado_em", "atualizado_em")
    list_filter = ("ativa", "ultimo_envio_em", "criado_em", "atualizado_em")
    search_fields = ("usuario__nome", "usuario__email", "endpoint", "user_agent", "ultimo_erro")
    raw_id_fields = ("usuario",)
    readonly_fields = ("criado_em", "atualizado_em")


@admin.register(TransferenciaConta)
class TransferenciaContaAdmin(admin.ModelAdmin):
    list_display = ("data", "usuario", "banco_origem", "banco_destino", "valor", "criado_em")
    list_filter = ("data", "criado_em")
    search_fields = (
        "descricao",
        "usuario__nome",
        "usuario__email",
        "banco_origem__nome",
        "banco_destino__nome",
    )
    raw_id_fields = ("usuario", "banco_origem", "banco_destino", "transacao_saida", "transacao_entrada")
    readonly_fields = ("criado_em", "atualizado_em")
    date_hierarchy = "data"
