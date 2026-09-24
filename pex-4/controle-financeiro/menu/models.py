from django.conf import settings
from django.db import models


def banco_logo_upload_to(instance, filename):
    return f"bancos/{filename}"


def cartao_logo_upload_to(instance, filename):
    return f"cartoes/{filename}"


class Banco(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    nome = models.CharField(max_length=100)
    saldo_inicial = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    logo = models.CharField(max_length=255, blank=True, default="")
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]
        unique_together = ("usuario", "nome")

    def __str__(self):
        return self.nome


class Cartao(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    nome = models.CharField(max_length=100)
    limite_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    dia_fechamento = models.PositiveSmallIntegerField()
    dia_vencimento = models.PositiveSmallIntegerField()
    altera_fim_semana = models.BooleanField(default=False, verbose_name="Ajustar fim de semana")
    logo = models.CharField(max_length=255, blank=True, default="")
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]
        unique_together = ("usuario", "nome")

    def __str__(self):
        return self.nome


class Categoria(models.Model):
    class LadoPadrao(models.TextChoices):
        ENTRADA = "entrada", "Entrada"
        SAIDA = "saida", "Saida"
        AMBOS = "ambos", "Ambos"

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    nome = models.CharField(max_length=100)
    icone = models.CharField(max_length=8, blank=True, default="🏷️")
    lado_padrao = models.CharField(max_length=10, choices=LadoPadrao.choices, default=LadoPadrao.SAIDA)
    afeta_resultado = models.BooleanField(default=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]
        unique_together = ("usuario", "nome")

    def __str__(self):
        return self.nome
