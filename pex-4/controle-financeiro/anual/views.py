from decimal import Decimal
from types import SimpleNamespace

from django.utils import timezone
from django.views.generic import TemplateView


class PainelAnualView(TemplateView):
    template_name = "anual.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        hoje = timezone.localdate()
        try:
            ano = int(self.request.GET.get("ano", hoje.year))
        except ValueError:
            ano = hoje.year
        context.update(
            {
                "ano": ano,
                "anos_disponiveis": [ano - 1, ano, ano + 1],
                "saida_resultado_ano": Decimal("24840.00"),
                "receitas_ano": Decimal("69600.00"),
                "lucro_ano": Decimal("44760.00"),
                "saldo_inicial_ano": Decimal("12500.00"),
                "saldo_final_ano": Decimal("57260.00"),
                "crescimento_pct": Decimal("358.08"),
                "cartao_ano": Decimal("8460.00"),
                "ranking_rendas": [SimpleNamespace(categoria__nome="Salario", total=Decimal("69600.00"))],
                "ranking_gastos": [
                    SimpleNamespace(categoria__nome="Moradia", total=Decimal("17400.00")),
                    SimpleNamespace(categoria__nome="Alimentacao", total=Decimal("7440.00")),
                ],
                "ranking_cartao": [
                    SimpleNamespace(categoria__nome="Saude", total=Decimal("2160.00")),
                    SimpleNamespace(categoria__nome="Servicos", total=Decimal("1800.00")),
                ],
                "evolucao_saldo": [
                    SimpleNamespace(label="Jan", saldo=Decimal("15000.00")),
                    SimpleNamespace(label="Fev", saldo=Decimal("18200.00")),
                    SimpleNamespace(label="Mar", saldo=Decimal("23100.00")),
                    SimpleNamespace(label="Abr", saldo=Decimal("29600.00")),
                    SimpleNamespace(label="Mai", saldo=Decimal("35400.00")),
                    SimpleNamespace(label="Jun", saldo=Decimal("42100.00")),
                    SimpleNamespace(label="Jul", saldo=Decimal("57260.00")),
                ],
            }
        )
        return context
