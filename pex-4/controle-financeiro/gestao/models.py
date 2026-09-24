from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Sum

from menu.models import Banco, Cartao, Categoria


class OrcamentoMensal(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    ano = models.PositiveSmallIntegerField()
    mes = models.PositiveSmallIntegerField()
    renda_base = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gestao_orcamento_mensal"
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "ano", "mes"],
                name="uniq_orcamento_mensal_usuario_mes",
            )
        ]
        indexes = [
            models.Index(fields=["usuario", "ano", "mes"], name="orc_mensal_user_mes_idx"),
        ]
        verbose_name = "Orçamento mensal"
        verbose_name_plural = "Orçamentos mensais"

    def __str__(self):
        return f"{self.usuario} - {self.mes:02d}/{self.ano} - renda base R$ {self.renda_base}"


class MetaCategoria(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE, related_name="metas")
    ano = models.PositiveSmallIntegerField()
    mes = models.PositiveSmallIntegerField()
    valor = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gestao_meta_categoria"
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "categoria", "ano", "mes"],
                name="uniq_meta_categoria_usuario_mes",
            )
        ]
        indexes = [
            models.Index(fields=["usuario", "categoria", "ano", "mes"], name="meta_cat_user_mes_idx"),
        ]
        verbose_name = "Meta de categoria"
        verbose_name_plural = "Metas de categorias"

    def __str__(self):
        return f"{self.categoria} - {self.mes:02d}/{self.ano} - R$ {self.valor}"


class Transacao(models.Model):
    class TipoTransacao(models.TextChoices):
        ENTRADA = "entrada", "Entrada"
        SAIDA = "saida", "Saída"
        CARTAO = "cartao", "Despesa no Cartão"

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    tipo = models.CharField(
        max_length=10,
        choices=TipoTransacao.choices,
        default=TipoTransacao.SAIDA,
    )
    data = models.DateField()
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT)
    beneficiario_pagador = models.CharField(max_length=255, blank=True, default="")
    descricao = models.CharField(max_length=255, blank=True, default="")
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    banco_origem_destino = models.ForeignKey(
        Banco,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    cartao = models.ForeignKey(
        Cartao,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    recorrencia = models.ForeignKey(
        "Recorrencia",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transacoes",
    )
    parcela_atual = models.PositiveIntegerField(default=1)
    total_parcelas = models.PositiveIntegerField(default=1)
    grupo_parcela = models.UUIDField(null=True, blank=True, db_index=True)
    assinatura_recorrente = models.BooleanField(default=False)
    STATUS_CHOICES = [
        ("pago", "Pago"),
        ("a_pagar", "A pagar"),
        ("recebido", "Recebido"),
        ("a_receber", "A receber"),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pago",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lancamentos_transacao"
        ordering = ["-data", "-criado_em"]
        indexes = [
            models.Index(fields=["usuario", "data"], name="trans_user_data_idx"),
            models.Index(fields=["usuario", "tipo", "data"], name="trans_user_tipo_data_idx"),
            models.Index(fields=["usuario", "status", "data"], name="trans_user_status_data_idx"),
            models.Index(fields=["usuario", "cartao", "tipo", "data"], name="trans_cartao_fluxo_idx"),
            models.Index(fields=["usuario", "recorrencia", "data"], name="trans_recorr_data_idx"),
            models.Index(
                fields=["usuario", "banco_origem_destino", "tipo", "status", "data"],
                name="trans_banco_fluxo_idx",
            ),
        ]
        verbose_name = "Transação"
        verbose_name_plural = "Transações"

    def __str__(self):
        info_parcela = f" ({self.parcela_atual}/{self.total_parcelas})" if self.total_parcelas > 1 else ""
        return f"{self.get_tipo_display()} - {self.categoria.nome} - R$ {self.valor}{info_parcela}"


class Recorrencia(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    tipo = models.CharField(
        max_length=10,
        choices=Transacao.TipoTransacao.choices,
        default=Transacao.TipoTransacao.SAIDA,
    )
    data_inicio = models.DateField()
    data_fim = models.DateField(null=True, blank=True)
    dia = models.PositiveSmallIntegerField()
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT)
    beneficiario_pagador = models.CharField(max_length=255, blank=True, default="")
    descricao = models.CharField(max_length=255, blank=True, default="")
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    banco_origem_destino = models.ForeignKey(
        Banco,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    cartao = models.ForeignKey(
        Cartao,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Transacao.STATUS_CHOICES,
        default="pago",
    )
    ativa = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lancamentos_recorrencia"
        ordering = ["beneficiario_pagador", "descricao", "id"]
        indexes = [
            models.Index(fields=["usuario", "ativa", "tipo"], name="rec_user_ativa_tipo_idx"),
            models.Index(fields=["usuario", "data_inicio", "data_fim"], name="rec_user_periodo_idx"),
        ]
        verbose_name = "Recorrencia"
        verbose_name_plural = "Recorrencias"

    def __str__(self):
        nome = self.beneficiario_pagador or self.descricao or self.categoria.nome
        return f"{nome} - R$ {self.valor}"


class RecorrenciaExcecao(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    recorrencia = models.ForeignKey(Recorrencia, on_delete=models.CASCADE, related_name="excecoes")
    ano = models.PositiveSmallIntegerField()
    mes = models.PositiveSmallIntegerField()
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "lancamentos_recorrencia_excecao"
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "recorrencia", "ano", "mes"],
                name="uniq_recorrencia_excecao_mes",
            )
        ]
        indexes = [
            models.Index(fields=["usuario", "recorrencia", "ano", "mes"], name="rec_exc_user_mes_idx"),
        ]
        verbose_name = "Excecao de recorrencia"
        verbose_name_plural = "Excecoes de recorrencia"

    def __str__(self):
        return f"{self.recorrencia} - {self.mes:02d}/{self.ano}"


class FaturaCartao(models.Model):
    class Status(models.TextChoices):
        A_PAGAR = "a_pagar", "A pagar"
        PARCIAL = "parcial", "Parcial"
        PAGO = "pago", "Pago"

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    cartao = models.ForeignKey(Cartao, on_delete=models.CASCADE, related_name="faturas")
    mes = models.PositiveSmallIntegerField()
    ano = models.PositiveSmallIntegerField()
    data_fechamento = models.DateField()
    data_vencimento = models.DateField()
    valor_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    valor_pago = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.A_PAGAR)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cartoes_fatura"
        ordering = ["-ano", "-mes", "cartao__nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "cartao", "mes", "ano"],
                name="uniq_fatura_cartao_usuario_cartao_mes_ano",
            )
        ]
        indexes = [
            models.Index(fields=["usuario", "cartao", "ano", "mes"]),
            models.Index(fields=["usuario", "status"]),
        ]
        verbose_name = "Fatura de Cartão"
        verbose_name_plural = "Faturas de Cartão"

    @property
    def saldo_pendente(self):
        return max(self.valor_total - self.valor_pago, Decimal("0.00"))

    def atualizar_totais_pagamento(self, salvar=True):
        total_pago = self.pagamentos.aggregate(total=Sum("valor"))["total"] or Decimal("0.00")
        novo_valor_pago = min(total_pago, self.valor_total) if self.valor_total > 0 else total_pago

        if self.valor_total <= 0 or novo_valor_pago <= 0:
            novo_status = self.Status.A_PAGAR
        elif novo_valor_pago >= self.valor_total:
            novo_status = self.Status.PAGO
        else:
            novo_status = self.Status.PARCIAL

        alterou = self.valor_pago != novo_valor_pago or self.status != novo_status
        self.valor_pago = novo_valor_pago
        self.status = novo_status

        if salvar and alterou:
            self.save(update_fields=["valor_pago", "status", "atualizado_em"])

    def __str__(self):
        return f"{self.cartao.nome} - {self.mes:02d}/{self.ano}"


class PagamentoFaturaCartao(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    fatura = models.ForeignKey(FaturaCartao, on_delete=models.CASCADE, related_name="pagamentos")
    banco = models.ForeignKey(Banco, on_delete=models.SET_NULL, null=True, blank=True)
    transacao_saida = models.OneToOneField(
        Transacao,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pagamento_fatura",
    )
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    data_pagamento = models.DateField()
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cartoes_pagamento_fatura"
        ordering = ["-data_pagamento", "-criado_em"]
        indexes = [
            models.Index(fields=["usuario", "fatura", "data_pagamento"]),
        ]
        verbose_name = "Pagamento de Fatura de Cartão"
        verbose_name_plural = "Pagamentos de Fatura de Cartão"

    def __str__(self):
        return f"{self.fatura} - R$ {self.valor}"


class Notificacao(models.Model):
    class Tipo(models.TextChoices):
        VENCIMENTO_DESPESA = "vencimento_despesa", "Vencimento de despesa"
        VENCIMENTO_RECEITA = "vencimento_receita", "Vencimento de receita"
        VENCIMENTO_FATURA = "vencimento_fatura", "Vencimento de fatura"

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    tipo = models.CharField(max_length=32, choices=Tipo.choices)
    chave = models.CharField(max_length=80)
    titulo = models.CharField(max_length=120)
    mensagem = models.CharField(max_length=255)
    data_referencia = models.DateField()
    url_destino = models.CharField(max_length=255, blank=True, default="")
    lida_em = models.DateTimeField(null=True, blank=True)
    exibida_em = models.DateTimeField(null=True, blank=True)
    arquivada_em = models.DateTimeField(null=True, blank=True)
    push_enviada_em = models.DateTimeField(null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notificacoes"
        ordering = ["-criado_em", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "tipo", "chave", "data_referencia"],
                name="uniq_notificacao_usuario_tipo_chave_data",
            )
        ]
        indexes = [
            models.Index(fields=["usuario", "lida_em", "criado_em"], name="notif_user_lida_criada_idx"),
            models.Index(fields=["usuario", "arquivada_em", "criado_em"], name="notif_user_arq_criada_idx"),
            models.Index(fields=["usuario", "push_enviada_em", "data_referencia"], name="notif_user_push_data_idx"),
            models.Index(fields=["usuario", "data_referencia"], name="notif_user_data_ref_idx"),
        ]
        verbose_name = "Notificacao"
        verbose_name_plural = "Notificacoes"

    @property
    def lida(self):
        return self.lida_em is not None

    def __str__(self):
        return self.titulo


class InscricaoPush(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="inscricoes_push")
    endpoint = models.TextField(unique=True)
    chave_p256dh = models.TextField()
    chave_auth = models.TextField()
    ativa = models.BooleanField(default=True)
    user_agent = models.CharField(max_length=255, blank=True, default="")
    ultimo_envio_em = models.DateTimeField(null=True, blank=True)
    ultimo_erro = models.CharField(max_length=255, blank=True, default="")
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notificacoes_inscricao_push"
        ordering = ["-atualizado_em", "-id"]
        indexes = [
            models.Index(fields=["usuario", "ativa"], name="push_user_ativa_idx"),
            models.Index(fields=["ativa", "atualizado_em"], name="push_ativa_atual_idx"),
        ]
        verbose_name = "Inscricao push"
        verbose_name_plural = "Inscricoes push"

    def __str__(self):
        return f"{self.usuario} - {'ativa' if self.ativa else 'inativa'}"


class TransferenciaConta(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    data = models.DateField()
    banco_origem = models.ForeignKey(
        Banco,
        on_delete=models.PROTECT,
        related_name="transferencias_enviadas",
    )
    banco_destino = models.ForeignKey(
        Banco,
        on_delete=models.PROTECT,
        related_name="transferencias_recebidas",
    )
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    descricao = models.CharField(max_length=255, blank=True, default="")
    transacao_saida = models.OneToOneField(
        Transacao,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transferencia_saida",
    )
    transacao_entrada = models.OneToOneField(
        Transacao,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transferencia_entrada",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lancamentos_transferencia_conta"
        ordering = ["-data", "-criado_em"]
        indexes = [
            models.Index(fields=["usuario", "data"], name="transf_user_data_idx"),
            models.Index(fields=["usuario", "banco_origem", "data"], name="transf_origem_data_idx"),
            models.Index(fields=["usuario", "banco_destino", "data"], name="transf_destino_data_idx"),
        ]
        verbose_name = "Transferencia entre contas"
        verbose_name_plural = "Transferencias entre contas"

    def __str__(self):
        return f"{self.banco_origem.nome} -> {self.banco_destino.nome} - R$ {self.valor}"


