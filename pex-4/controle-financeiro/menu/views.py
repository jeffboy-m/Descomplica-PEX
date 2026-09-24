from decimal import Decimal
from types import SimpleNamespace

from django.contrib import messages
from django.shortcuts import redirect
from django.views.generic import TemplateView

from menu.bancos.forms import BancoForm
from menu.cartoes.forms import CartaoForm
from menu.categorias.forms import CategoriaForm
from menu.categorias.icones import ICONES_CATEGORIA


class MenuHomeView(TemplateView):
    template_name = "menu/index.html"
    cadastro_tipo = "bancos"

    def _cadastro_tipo_atual(self):
        if self.cadastro_tipo in {"bancos", "cartoes", "categorias"}:
            return self.cadastro_tipo
        return "bancos"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        cadastro_tipo = self._cadastro_tipo_atual()
        context.update(
            {
                "cadastro_tipo": cadastro_tipo,
                "cadastro_titulo": {"bancos": "Bancos", "cartoes": "Cartoes", "categorias": "Categorias"}[cadastro_tipo],
                "patrimonio_total_inicial": "12.500,00",
                "bancos": [
                    SimpleNamespace(id=1, nome="Nubank", saldo_inicial=Decimal("2500.00"), logo=""),
                    SimpleNamespace(id=2, nome="Itau", saldo_inicial=Decimal("7000.00"), logo=""),
                    SimpleNamespace(id=3, nome="Dinheiro", saldo_inicial=Decimal("3000.00"), logo=""),
                ],
                "cartoes": [
                    SimpleNamespace(id=1, nome="Nubank Platinum", limite_total=Decimal("8000.00"), dia_fechamento=5, dia_vencimento=12, logo=""),
                    SimpleNamespace(id=2, nome="Inter Gold", limite_total=Decimal("5000.00"), dia_fechamento=18, dia_vencimento=25, logo=""),
                ],
                "categorias": [
                    SimpleNamespace(id=1, nome="Moradia", icone="🏠", lado_padrao="saida", ativo=True, afeta_resultado=True, get_lado_padrao_display="Saida"),
                    SimpleNamespace(id=2, nome="Mercado", icone="🛒", lado_padrao="saida", ativo=True, afeta_resultado=True, get_lado_padrao_display="Saida"),
                    SimpleNamespace(id=3, nome="Salario", icone="💼", lado_padrao="entrada", ativo=True, afeta_resultado=True, get_lado_padrao_display="Entrada"),
                    SimpleNamespace(id=4, nome="Investimentos", icone="📈", lado_padrao="ambos", ativo=True, afeta_resultado=False, get_lado_padrao_display="Ambos"),
                ],
                "banco_form": kwargs.get("banco_form") or BancoForm(),
                "cartao_form": kwargs.get("cartao_form") or CartaoForm(),
                "categoria_form": kwargs.get("categoria_form") or CategoriaForm(),
                "banco_logos": [],
                "cartao_logos": [],
                "categoria_icones": ICONES_CATEGORIA,
                "open_modal": self.request.GET.get("open_modal", ""),
            }
        )
        return context

    def post(self, request, *args, **kwargs):
        messages.info(request, "Acao desativada na versao demonstrativa.")
        return redirect(request.path)
