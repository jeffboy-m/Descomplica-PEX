import datetime
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from gestao.models import Transacao
from gestao.servicos import recorrencias as recorrencia_service
from menu.models import Banco, Cartao, Categoria

User = get_user_model()


class PainelAnualTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="anual@example.com",
            nome="Painel Anual",
            password="password",
        )
        self.banco = Banco.objects.create(
            usuario=self.user,
            nome="Banco Anual",
            saldo_inicial=Decimal("500.00"),
        )
        self.categoria_salario = Categoria.objects.create(
            usuario=self.user,
            nome="Salário",
            lado_padrao=Categoria.LadoPadrao.ENTRADA,
            afeta_resultado=True,
        )
        self.categoria_aluguel = Categoria.objects.create(
            usuario=self.user,
            nome="Aluguel",
            lado_padrao=Categoria.LadoPadrao.SAIDA,
            afeta_resultado=True,
        )
        self.categoria_cartao = Categoria.objects.create(
            usuario=self.user,
            nome="Mercado",
            lado_padrao=Categoria.LadoPadrao.SAIDA,
            afeta_resultado=True,
        )
        self.cartao = Cartao.objects.create(
            usuario=self.user,
            nome="Cartão Anual",
            limite_total=Decimal("1000.00"),
            dia_fechamento=20,
            dia_vencimento=27,
        )

    def test_painel_anual_projeta_recorrencias_e_cartao_por_competencia(self):
        salario = Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.ENTRADA,
            data=datetime.date(2026, 1, 5),
            categoria=self.categoria_salario,
            valor=Decimal("1000.00"),
            banco_origem_destino=self.banco,
            status="a_receber",
            assinatura_recorrente=True,
        )
        recorrencia_service.criar_ou_atualizar_recorrencia(salario)
        aluguel = Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 1, 10),
            categoria=self.categoria_aluguel,
            valor=Decimal("100.00"),
            banco_origem_destino=self.banco,
            status="a_pagar",
            assinatura_recorrente=True,
        )
        recorrencia_service.criar_ou_atualizar_recorrencia(aluguel)
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 1, 10),
            categoria=self.categoria_cartao,
            valor=Decimal("50.00"),
            cartao=self.cartao,
            status="pago",
            total_parcelas=3,
        )
        self.client.force_login(self.user)

        response = self.client.get("/anual/?ano=2026")

        ranking_gastos = {
            item["categoria__nome"]: item["total"]
            for item in response.context["ranking_gastos"]
        }
        ranking_rendas = {
            item["categoria__nome"]: item["total"]
            for item in response.context["ranking_rendas"]
        }
        ranking_cartao = {
            item["categoria__nome"]: item["total"]
            for item in response.context["ranking_cartao"]
        }

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["receitas_ano"], Decimal("12000.00"))
        self.assertEqual(response.context["cartao_ano"], Decimal("150.00"))
        self.assertEqual(response.context["saida_resultado_ano"], Decimal("1350.00"))
        self.assertEqual(response.context["lucro_ano"], Decimal("10650.00"))
        self.assertEqual(response.context["saldo_final_ano"], Decimal("11150.00"))
        self.assertEqual(ranking_rendas["Salário"], Decimal("12000.00"))
        self.assertEqual(ranking_gastos["Aluguel"], Decimal("1200.00"))
        self.assertEqual(ranking_gastos["Fatura de Cartão"], Decimal("150.00"))
        self.assertNotIn("Mercado", ranking_gastos)
        self.assertEqual(ranking_cartao["Mercado"], Decimal("150.00"))
        self.assertEqual(Transacao.objects.filter(recorrencia=salario.recorrencia).count(), 12)
        self.assertEqual(Transacao.objects.filter(recorrencia=aluguel.recorrencia).count(), 12)

    @patch("anual.views.timezone.localdate")
    def test_grafico_anual_usa_saldo_realizado_para_mes_fechado(self, localdate_mock):
        localdate_mock.return_value = datetime.date(2026, 8, 7)
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.ENTRADA,
            data=datetime.date(2026, 6, 5),
            categoria=self.categoria_salario,
            valor=Decimal("5000.00"),
            banco_origem_destino=self.banco,
            status="recebido",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 6, 6),
            categoria=self.categoria_aluguel,
            valor=Decimal("100.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 6, 10),
            categoria=self.categoria_cartao,
            valor=Decimal("200.00"),
            cartao=self.cartao,
            status="a_pagar",
        )
        self.client.force_login(self.user)

        response = self.client.get("/anual/?ano=2026")

        junho = response.context["evolucao_saldo"][5]
        self.assertEqual(Decimal(str(junho["saldo"])).quantize(Decimal("0.01")), Decimal("5400.00"))
