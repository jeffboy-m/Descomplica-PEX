from decimal import Decimal
from types import SimpleNamespace

from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.utils import timezone
from django.views import View
from django.views.generic import TemplateView

from gestao.forms import OrcamentoMensalForm, TransacaoForm, TransferenciaContaForm


ABAS_GESTAO = {"extrato", "entrada", "saida", "cartao", "transferencia", "metas"}
ABAS_LABEL = {
    "extrato": "Extrato",
    "entrada": "Receitas",
    "saida": "Despesas",
    "cartao": "Cartao",
    "transferencia": "Transferencias",
    "metas": "Metas",
}


def _aba_ativa(request):
    aba = request.GET.get("aba", "extrato")
    return aba if aba in ABAS_GESTAO else "extrato"


def _periodo(request):
    hoje = timezone.localdate()
    try:
        mes = int(request.GET.get("mes", hoje.month))
    except ValueError:
        mes = hoje.month
    try:
        ano = int(request.GET.get("ano", hoje.year))
    except ValueError:
        ano = hoje.year
    return mes, ano


def _movimento(id, tipo, data, descricao, categoria, valor, status="pago"):
    return SimpleNamespace(
        id=id,
        tipo=tipo,
        data=data,
        descricao=descricao,
        beneficiario_pagador=descricao,
        categoria=SimpleNamespace(id=id, nome=categoria, icone=""),
        valor=Decimal(valor),
        status=status,
        banco_origem_destino=SimpleNamespace(id=1, nome="Nubank", logo=""),
        cartao=SimpleNamespace(id=1, nome="Nubank Platinum", logo="", dia_fechamento=5),
        parcela_atual=1,
        total_parcelas=1,
        assinatura_recorrente=False,
        recorrencia_id=None,
        grupo_parcela=None,
    )


class AcompanhamentoView(TemplateView):
    template_name = "gestao/index.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        mes, ano = _periodo(self.request)
        aba = _aba_ativa(self.request)
        hoje = timezone.localdate()
        receitas = [_movimento(1, "entrada", hoje, "Salario", "Renda fixa", "5800.00", "recebido")]
        despesas = [
            _movimento(2, "saida", hoje, "Aluguel", "Moradia", "1450.00", "pago"),
            _movimento(3, "saida", hoje, "Mercado", "Alimentacao", "620.00", "a_pagar"),
        ]
        cartao = [_movimento(4, "cartao", hoje, "Farmacia", "Saude", "180.00", "a_pagar")]
        transferencias = [
            SimpleNamespace(
                id=1,
                data=hoje,
                descricao="Reserva mensal",
                banco_origem=SimpleNamespace(id=1, nome="Nubank"),
                banco_destino=SimpleNamespace(id=2, nome="Itau"),
                valor=Decimal("500.00"),
            )
        ]
        bancos = [SimpleNamespace(id=1, nome="Nubank"), SimpleNamespace(id=2, nome="Itau")]
        cartoes = [SimpleNamespace(id=1, nome="Nubank Platinum", logo="", dia_fechamento=5)]
        transacao_form = kwargs.get("form") or TransacaoForm()
        transacoes = receitas + despesas + cartao
        context.update(
            {
                "mes": mes,
                "ano": ano,
                "mes_anterior": 12 if mes == 1 else mes - 1,
                "ano_anterior": ano - 1 if mes == 1 else ano,
                "mes_seguinte": 1 if mes == 12 else mes + 1,
                "ano_seguinte": ano + 1 if mes == 12 else ano,
                "mes_nome_curto": ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][mes - 1],
                "aba_ativa": aba,
                "aba_label": ABAS_LABEL[aba],
                "open_modal": "",
                "renda_base_mensal": Decimal("5800.00"),
                "saldo_atual": Decimal("4250.00"),
                "saldo_projetado": Decimal("3630.00"),
                "receitas_mes": Decimal("5800.00"),
                "despesas_mes": Decimal("2070.00"),
                "lucro_realizado": Decimal("3730.00"),
                "lucro_projetado": Decimal("3120.00"),
                "cartao_mes": Decimal("180.00"),
                "a_receber_total": Decimal("0.00"),
                "a_pagar_total": Decimal("620.00"),
                "gastos_lucro_realizado": Decimal("2250.00"),
                "sobra_planejada": Decimal("2500.00"),
                "economia_real": Decimal("3730.00"),
                "extra_receita_mes": Decimal("0.00"),
                "bancos_balances": [
                    SimpleNamespace(nome="Nubank", saldo=Decimal("2500.00"), logo=""),
                    SimpleNamespace(nome="Itau", saldo=Decimal("1750.00"), logo=""),
                ],
                "ranking_rendas": [SimpleNamespace(categoria__nome="Salario", total=Decimal("5800.00"), link="/gestao/?aba=entrada")],
                "ranking_gastos": [
                    SimpleNamespace(categoria__nome="Moradia", total=Decimal("1450.00"), link="/gestao/?aba=saida", nivel_meta="ok", meta_reais=True, percentual_meta=72, percentual_receita=25),
                    SimpleNamespace(categoria__nome="Alimentacao", total=Decimal("620.00"), link="/gestao/?aba=saida", nivel_meta="warn", meta_reais=True, percentual_meta=62, percentual_receita=10),
                ],
                "ranking_cartao": [SimpleNamespace(categoria__nome="Saude", total=Decimal("180.00"), link="/gestao/?aba=cartao", nivel_meta="ok", meta_reais=True, percentual_meta=18)],
                "evolucao_saldo": [
                    SimpleNamespace(label="Sem 1", saldo=Decimal("1500.00")),
                    SimpleNamespace(label="Sem 2", saldo=Decimal("2800.00")),
                    SimpleNamespace(label="Sem 3", saldo=Decimal("4250.00")),
                ],
                "categorias_filtro_rapido": [
                    SimpleNamespace(id=1, nome="Moradia", icone="🏠"),
                    SimpleNamespace(id=2, nome="Alimentacao", icone="🛒"),
                ],
                "transacoes": transacoes,
                "transacoes_entrada": receitas,
                "transacoes_saida": despesas,
                "transacoes_cartao": cartao,
                "transferencias": transferencias,
                "transferencias_mes": transferencias,
                "faturas_cartao": [],
                "faturas_lista": [
                    SimpleNamespace(
                        cartao_id=1,
                        cartao_nome="Nubank Platinum",
                        cartao_logo="",
                        vencimento_data=hoje,
                        banco_nome="Nubank",
                        valor_total=Decimal("180.00"),
                        valor_pago=Decimal("0.00"),
                        saldo_pendente=Decimal("180.00"),
                        status="a_pagar",
                    )
                ],
                "cartoes": cartoes,
                "cartoes_com_transacoes": [
                    SimpleNamespace(
                        cartao=cartoes[0],
                        tem_transacoes=True,
                        qtd_transacoes=len(cartao),
                        transacoes=cartao,
                        limite_total=Decimal("8000.00"),
                        limite_restante=Decimal("7820.00"),
                    )
                ],
                "bancos": bancos,
                "bancos_list_options": bancos,
                "form": transacao_form,
                "transacao_form": transacao_form,
                "transferencia_form": kwargs.get("transferencia_form") or TransferenciaContaForm(),
                "orcamento_form": OrcamentoMensalForm(initial={"renda_base_mensal": Decimal("5800.00")}),
                "acompanhamento_data_json": "{}",
                "metas_linhas": [
                    SimpleNamespace(categoria=SimpleNamespace(id=1, nome="Moradia", icone="🏠"), valor=Decimal("2000.00"), percentual=Decimal("34.5"), barra=Decimal("34.5")),
                    SimpleNamespace(categoria=SimpleNamespace(id=2, nome="Alimentacao", icone="🛒"), valor=Decimal("1000.00"), percentual=Decimal("17.2"), barra=Decimal("17.2")),
                ],
                "total_metas": Decimal("3000.00"),
                "saldo_planejado": Decimal("2800.00"),
            }
        )
        return context

    def post(self, request, *args, **kwargs):
        if request.headers.get("X-Requested-With") == "fetch":
            return JsonResponse({"ok": True, "demo": True})
        return redirect(reverse("gestao-home"))


class SalvarOrcamentoView(View):
    def post(self, request):
        return redirect(request.POST.get("next") or reverse("gestao-home"))


class MetasView(View):
    def get(self, request, *args, **kwargs):
        return redirect("/gestao/?aba=metas")

    def post(self, request):
        return redirect(request.POST.get("next") or "/gestao/?aba=metas")


class MarcarNotificacaoLidaView(View):
    def post(self, request, notificacao_id):
        return JsonResponse({"ok": True, "demo": True, "temNaoLida": False, "url": "/gestao/"})


class ArquivarNotificacaoView(View):
    def post(self, request, notificacao_id):
        return JsonResponse({"ok": True, "demo": True, "temNaoLida": False})


class MarcarNotificacaoExibidaView(View):
    def post(self, request, notificacao_id):
        return JsonResponse({"ok": True, "demo": True})


class PushStatusView(View):
    def get(self, request):
        return JsonResponse({"ok": True, "disponivel": False, "ativo": False, "publicKey": ""})


class SalvarInscricaoPushView(View):
    def post(self, request):
        return JsonResponse({"ok": True, "demo": True, "ativo": False})


class RemoverInscricaoPushView(View):
    def post(self, request):
        return JsonResponse({"ok": True, "demo": True, "ativo": False})
