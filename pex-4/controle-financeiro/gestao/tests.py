import datetime
import json
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.http import QueryDict
from django.test import TestCase, override_settings
from django.utils import timezone

from gestao.forms import TransacaoForm
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
    somar_meses,
)
from gestao.seletores import metas as metas_selector
from gestao.seletores import movimentos as movimentos_selector
from gestao.seletores import navegacao as navegacao_selector
from gestao.seletores import rankings as rankings_selector
from gestao.seletores import ui as ui_selector
from gestao.seletores.painel_mensal import montar_contexto_painel_mensal
from gestao.servicos import faturas as fatura_service
from gestao.servicos import notificacoes as notificacao_service
from gestao.servicos import orcamento as orcamento_service
from gestao.views import _montar_contexto_metas
from menu.categorias.sistema import CATEGORIA_FATURA_CARTAO
from menu.models import Banco, Cartao, Categoria

User = get_user_model()


class SomarMesesTestCase(TestCase):
    def test_somar_meses_simples(self):
        d = datetime.date(2026, 1, 15)
        self.assertEqual(somar_meses(d, 1), datetime.date(2026, 2, 15))
        self.assertEqual(somar_meses(d, 5), datetime.date(2026, 6, 15))

    def test_somar_meses_virada_ano(self):
        d = datetime.date(2026, 11, 10)
        self.assertEqual(somar_meses(d, 2), datetime.date(2027, 1, 10))

    def test_somar_meses_fim_do_mes(self):
        # 31 de Janeiro + 1 mês deve cair em 28 ou 29 de Fevereiro
        d = datetime.date(2026, 1, 31)
        self.assertEqual(somar_meses(d, 1), datetime.date(2026, 2, 28))

        # Ano bissexto
        d_bissexto = datetime.date(2028, 1, 31)
        self.assertEqual(somar_meses(d_bissexto, 1), datetime.date(2028, 2, 29))


class TransacaoTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="testuser@example.com", nome="Test User", password="password")
        self.categoria = Categoria.objects.create(
            usuario=self.user,
            nome="Aluguel",
            lado_padrao="saida",
        )
        self.cartao = Cartao.objects.create(
            usuario=self.user,
            nome="Cartao Teste",
            limite_total=Decimal("1000.00"),
            dia_fechamento=20,
            dia_vencimento=27,
        )

    def test_criar_transacao_simples(self):
        t = Transacao.objects.create(
            usuario=self.user,
            tipo="saida",
            data=datetime.date(2026, 5, 1),
            categoria=self.categoria,
            valor=1000.00,
            total_parcelas=1,
        )
        self.assertEqual(Transacao.objects.count(), 1)
        self.assertIsNone(t.grupo_parcela)
        self.assertEqual(t.parcela_atual, 1)

    def test_criar_transacao_parcelada(self):
        t = Transacao.objects.create(
            usuario=self.user,
            tipo="saida",
            data=datetime.date(2026, 5, 10),
            categoria=self.categoria,
            valor=150.00,
            total_parcelas=3,
        )

        # Deve ter gerado 3 transações no banco de dados
        self.assertEqual(Transacao.objects.count(), 3)

        transacoes = list(Transacao.objects.order_by("parcela_atual"))
        
        # Todas devem compartilhar o mesmo grupo_parcela
        self.assertIsNotNone(t.grupo_parcela)
        for tr in transacoes:
            self.assertEqual(tr.grupo_parcela, t.grupo_parcela)
            self.assertEqual(tr.total_parcelas, 3)

        # Verificar parcelas e datas
        self.assertEqual(transacoes[0].parcela_atual, 1)
        self.assertEqual(transacoes[0].data, datetime.date(2026, 5, 10))

        self.assertEqual(transacoes[1].parcela_atual, 2)
        self.assertEqual(transacoes[1].data, datetime.date(2026, 6, 10))

        self.assertEqual(transacoes[2].parcela_atual, 3)
        self.assertEqual(transacoes[2].data, datetime.date(2026, 7, 10))

    def test_converter_transacao_existente_em_parcelada(self):
        t = Transacao.objects.create(
            usuario=self.user,
            tipo="saida",
            data=datetime.date(2026, 5, 10),
            categoria=self.categoria,
            valor=150.00,
            total_parcelas=1,
        )

        t.total_parcelas = 3
        t.save()

        transacoes = list(Transacao.objects.order_by("parcela_atual"))
        self.assertEqual(len(transacoes), 3)
        self.assertIsNotNone(t.grupo_parcela)
        self.assertEqual([tr.parcela_atual for tr in transacoes], [1, 2, 3])
        self.assertEqual(transacoes[2].data, datetime.date(2026, 7, 10))

    def test_aumentar_total_de_parcelas(self):
        t = Transacao.objects.create(
            usuario=self.user,
            tipo="saida",
            data=datetime.date(2026, 5, 10),
            categoria=self.categoria,
            valor=150.00,
            total_parcelas=2,
        )

        t.total_parcelas = 4
        t.save()

        transacoes = list(Transacao.objects.order_by("parcela_atual"))
        self.assertEqual(len(transacoes), 4)
        self.assertEqual([tr.total_parcelas for tr in transacoes], [4, 4, 4, 4])
        self.assertEqual(transacoes[3].data, datetime.date(2026, 8, 10))

    def test_reduzir_total_de_parcelas(self):
        t = Transacao.objects.create(
            usuario=self.user,
            tipo="saida",
            data=datetime.date(2026, 5, 10),
            categoria=self.categoria,
            valor=150.00,
            total_parcelas=4,
        )

        t.total_parcelas = 2
        t.save()

        transacoes = list(Transacao.objects.order_by("parcela_atual"))
        self.assertEqual(len(transacoes), 2)
        self.assertEqual([tr.parcela_atual for tr in transacoes], [1, 2])
        self.assertEqual([tr.total_parcelas for tr in transacoes], [2, 2])

    def test_marcar_assinatura_recorrente_em_cadeia_a_partir_da_parcela(self):
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 5, 10),
            categoria=self.categoria,
            valor=Decimal("150.00"),
            cartao=self.cartao,
            total_parcelas=4,
        )
        terceira = Transacao.objects.get(parcela_atual=3)

        self.client.force_login(self.user)
        response = self.client.post(
            "/gestao/",
            {
                "action": "save",
                "transacao_id": str(terceira.id),
                "update_scope": "future",
                "tipo": Transacao.TipoTransacao.CARTAO,
                "data": terceira.data.isoformat(),
                "categoria": str(self.categoria.id),
                "beneficiario_pagador": terceira.beneficiario_pagador,
                "descricao": terceira.descricao,
                "valor": "150,00",
                "banco_origem_destino": "",
                "cartao": str(self.cartao.id),
                "status": "pago",
                "total_parcelas": "4",
                "assinatura_recorrente": "on",
            },
        )

        self.assertEqual(response.status_code, 302)
        transacoes = list(Transacao.objects.order_by("parcela_atual"))
        self.assertEqual(
            [transacao.assinatura_recorrente for transacao in transacoes],
            [False, False, True, True],
        )


class FaturasCartaoTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="faturauser@example.com", nome="Fatura User", password="password")
        self.banco = Banco.objects.create(
            usuario=self.user,
            nome="Banco Fatura",
            saldo_inicial=Decimal("1000.00"),
        )
        self.categoria = Categoria.objects.create(
            usuario=self.user,
            nome="Mercado Fatura",
            lado_padrao=Categoria.LadoPadrao.SAIDA,
            afeta_resultado=True,
        )
        self.cartao = Cartao.objects.create(
            usuario=self.user,
            nome="Cartao Fatura",
            limite_total=Decimal("1000.00"),
            dia_fechamento=20,
            dia_vencimento=27,
        )

    def test_compra_apos_fechamento_vai_para_proxima_fatura(self):
        mes, ano = fatura_service.get_invoice_month_year(
            self.cartao,
            datetime.date(2026, 3, 21),
        )

        self.assertEqual((mes, ano), (4, 2026))

    def test_fatura_com_vencimento_no_mes_seguinte_fecha_no_mes_anterior(self):
        self.cartao.dia_fechamento = 27
        self.cartao.dia_vencimento = 10

        fechamento, vencimento = fatura_service.get_card_billing_dates(self.cartao, 2026, 7)

        self.assertEqual(fechamento, datetime.date(2026, 6, 27))
        self.assertEqual(vencimento, datetime.date(2026, 7, 10))

    def test_compra_apos_fechamento_com_vencimento_mes_seguinte_vai_para_mes_do_vencimento(self):
        self.cartao.dia_fechamento = 27
        self.cartao.dia_vencimento = 10

        mes, ano = fatura_service.get_invoice_month_year(
            self.cartao,
            datetime.date(2026, 6, 7),
        )

        self.assertEqual((mes, ano), (7, 2026))

    def test_fechamento_em_fim_de_semana_nao_antecipa_por_padrao(self):
        fechamento, _ = fatura_service.get_card_billing_dates(self.cartao, 2026, 6)

        self.assertEqual(fechamento, datetime.date(2026, 6, 20))

    def test_fechamento_em_fim_de_semana_pode_antecipar_quando_ativado(self):
        self.cartao.altera_fim_semana = True

        fechamento, _ = fatura_service.get_card_billing_dates(self.cartao, 2026, 6)

        self.assertEqual(fechamento, datetime.date(2026, 6, 19))

    def test_sincronizar_fatura_considera_periodo_de_fechamento(self):
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 20),
            categoria=self.categoria,
            valor=Decimal("200.00"),
            cartao=self.cartao,
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 21),
            categoria=self.categoria,
            valor=Decimal("80.00"),
            cartao=self.cartao,
        )

        fatura = fatura_service.sincronizar_fatura_cartao(self.user, self.cartao, 2026, 3)

        self.assertEqual(fatura.valor_total, Decimal("200.00"))
        self.assertEqual(fatura.saldo_pendente, Decimal("200.00"))

    def test_pagamento_parcial_atualiza_status_e_limite(self):
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 10),
            categoria=self.categoria,
            valor=Decimal("200.00"),
            cartao=self.cartao,
        )
        fatura = fatura_service.sincronizar_fatura_cartao(self.user, self.cartao, 2026, 3)

        pagamento = fatura_service.registrar_pagamento_fatura(
            self.user,
            fatura,
            self.banco,
            Decimal("50.00"),
        )
        fatura.refresh_from_db()
        limite = fatura_service.calcular_limite_cartao(self.user, self.cartao)

        self.assertIsNotNone(pagamento)
        self.assertEqual(PagamentoFaturaCartao.objects.count(), 1)
        self.assertEqual(fatura.valor_pago, Decimal("50.00"))
        self.assertEqual(fatura.status, FaturaCartao.Status.PARCIAL)
        self.assertEqual(limite["limite_usado"], Decimal("150.00"))
        self.assertEqual(limite["limite_restante"], Decimal("850.00"))

    def test_limite_ignora_assinatura_recorrente_futura(self):
        hoje = timezone.localdate()
        data_futura = hoje + datetime.timedelta(days=30)

        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=hoje - datetime.timedelta(days=1),
            categoria=self.categoria,
            valor=Decimal("100.00"),
            cartao=self.cartao,
            assinatura_recorrente=True,
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=data_futura,
            categoria=self.categoria,
            valor=Decimal("80.00"),
            cartao=self.cartao,
            assinatura_recorrente=True,
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=data_futura,
            categoria=self.categoria,
            valor=Decimal("40.00"),
            cartao=self.cartao,
        )

        limite = fatura_service.calcular_limite_cartao(self.user, self.cartao)

        self.assertEqual(limite["limite_usado"], Decimal("140.00"))
        self.assertEqual(limite["limite_restante"], Decimal("860.00"))


class PainelMensalTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="painelgestao@example.com", nome="Painel Gestao", password="password")
        self.banco = Banco.objects.create(
            usuario=self.user,
            nome="Banco Gestao",
            saldo_inicial=Decimal("1000.00"),
        )
        self.categoria_receita = Categoria.objects.create(
            usuario=self.user,
            nome="Salario",
            lado_padrao=Categoria.LadoPadrao.ENTRADA,
            afeta_resultado=True,
        )
        self.categoria_despesa = Categoria.objects.create(
            usuario=self.user,
            nome="Mercado Gestao",
            lado_padrao=Categoria.LadoPadrao.SAIDA,
            afeta_resultado=True,
        )
        self.cartao = Cartao.objects.create(
            usuario=self.user,
            nome="Cartao Gestao",
            limite_total=Decimal("1000.00"),
            dia_fechamento=20,
            dia_vencimento=27,
        )

    def test_movimentos_selector_calcula_totais_resultado_do_periodo(self):
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.ENTRADA,
            data=datetime.date(2026, 3, 5),
            categoria=self.categoria_receita,
            valor=Decimal("500.00"),
            banco_origem_destino=self.banco,
            status="recebido",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.ENTRADA,
            data=datetime.date(2026, 3, 8),
            categoria=self.categoria_receita,
            valor=Decimal("300.00"),
            banco_origem_destino=self.banco,
            status="a_receber",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 6),
            categoria=self.categoria_despesa,
            valor=Decimal("100.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 7),
            categoria=self.categoria_despesa,
            valor=Decimal("40.00"),
            banco_origem_destino=self.banco,
            status="a_pagar",
        )

        transacoes = movimentos_selector.transacoes_do_periodo(
            self.user,
            datetime.date(2026, 3, 1),
            datetime.date(2026, 3, 31),
        )
        totais = movimentos_selector.totais_resultado(
            transacoes,
            {
                "total_faturas_pagas": Decimal("25.00"),
                "total_faturas_a_pagar": Decimal("35.00"),
            },
        )

        self.assertEqual(totais["receitas_mes"], Decimal("500.00"))
        self.assertEqual(totais["despesas_mes"], Decimal("125.00"))
        self.assertEqual(totais["a_receber_total"], Decimal("300.00"))
        self.assertEqual(totais["a_pagar_total"], Decimal("75.00"))

    def test_metas_selector_soma_consumo_normal_e_cartao_por_categoria(self):
        transacao_saida = Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 6),
            categoria=self.categoria_despesa,
            valor=Decimal("70.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )
        transacao_cartao = Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 10),
            categoria=self.categoria_despesa,
            valor=Decimal("20.00"),
            cartao=self.cartao,
            status="a_pagar",
        )

        transacoes_visiveis = movimentos_selector.transacoes_visiveis(
            Transacao.objects.filter(pk=transacao_saida.pk)
        )
        consumo = metas_selector.consumo_por_categoria(
            transacoes_visiveis,
            [transacao_cartao],
        )

        self.assertEqual(consumo[self.categoria_despesa.id], Decimal("90.00"))

    def test_rankings_selector_enriquece_percentuais_e_nivel_da_meta(self):
        ranking = rankings_selector.enriquecer_ranking(
            [{
                "categoria__id": self.categoria_despesa.id,
                "categoria__nome": self.categoria_despesa.nome,
                "categoria__icone": "",
                "total": Decimal("20.00"),
            }],
            Decimal("1000.00"),
            metas_vigentes={self.categoria_despesa.id: Decimal("100.00")},
            consumo_meta_por_categoria={self.categoria_despesa.id: Decimal("125.00")},
        )

        item = ranking[0]
        self.assertEqual(item["percentual_receita"], Decimal("2.0"))
        self.assertEqual(item["consumo_meta"], Decimal("125.00"))
        self.assertEqual(item["percentual_meta"], Decimal("125.0"))
        self.assertEqual(item["nivel_meta"], "alerta-meta")

    def test_navegacao_selector_adiciona_links_dos_rankings(self):
        ranking_rendas = [{
            "categoria__id": self.categoria_receita.id,
            "categoria__nome": self.categoria_receita.nome,
            "categoria__icone": "",
            "total": Decimal("500.00"),
        }]
        ranking_gastos = [{
            "categoria_id": self.categoria_despesa.id,
            "categoria__nome": self.categoria_despesa.nome,
            "categoria__icone": "",
            "total": Decimal("100.00"),
        }]
        ranking_cartao = [{
            "categoria_id": self.categoria_despesa.id,
            "categoria__nome": self.categoria_despesa.nome,
            "categoria__icone": "",
            "total": Decimal("20.00"),
        }]

        navegacao_selector.adicionar_links_rankings(
            2026,
            3,
            ranking_rendas,
            ranking_gastos,
            ranking_cartao,
        )

        self.assertEqual(ranking_rendas[0]["link"], f"?mes=3&ano=2026&aba=entrada&categoria={self.categoria_receita.id}")
        self.assertEqual(ranking_gastos[0]["link"], f"?mes=3&ano=2026&aba=saida&categoria={self.categoria_despesa.id}")
        self.assertEqual(ranking_cartao[0]["link"], f"?mes=3&ano=2026&aba=cartao&categoria={self.categoria_despesa.id}")

    def test_ui_selector_monta_json_de_acompanhamento_para_frontend(self):
        data = json.loads(ui_selector.acompanhamento_data_json(
            categorias=[self.categoria_receita, self.categoria_despesa],
            cartoes=[self.cartao],
            mes=3,
            ano=2026,
            receitas_mes=Decimal("500.00"),
            a_receber_total=Decimal("300.00"),
            despesas_mes=Decimal("125.00"),
            a_pagar_total=Decimal("75.00"),
            cartao_mes=Decimal("20.00"),
        ))

        self.assertEqual(data["categoriasLado"][str(self.categoria_receita.id)], Categoria.LadoPadrao.ENTRADA)
        self.assertEqual(data["categoriasLado"][str(self.categoria_despesa.id)], Categoria.LadoPadrao.SAIDA)
        self.assertEqual(data["cartoesFechamento"][str(self.cartao.id)], 20)
        self.assertEqual(data["mesVisualizado"], 3)
        self.assertEqual(data["anoVisualizado"], 2026)
        self.assertEqual(data["receitasMes"], 500.0)
        self.assertEqual(data["aReceberTotal"], 300.0)
        self.assertEqual(data["despesasMes"], 125.0)
        self.assertEqual(data["aPagarTotal"], 75.0)
        self.assertEqual(data["cartaoMes"], 20.0)

    def test_montar_contexto_painel_mensal_calcula_resumo(self):
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.ENTRADA,
            data=datetime.date(2026, 3, 5),
            categoria=self.categoria_receita,
            valor=Decimal("500.00"),
            banco_origem_destino=self.banco,
            status="recebido",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 6),
            categoria=self.categoria_despesa,
            valor=Decimal("100.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 10),
            categoria=self.categoria_despesa,
            valor=Decimal("200.00"),
            cartao=self.cartao,
            status="a_pagar",
        )

        context = montar_contexto_painel_mensal(
            self.user,
            QueryDict("mes=3&ano=2026"),
        )

        self.assertEqual(context["mes_nome"], "MARÇO")
        self.assertEqual(context["saldo_atual"], Decimal("1400.00"))
        self.assertEqual(context["receitas_mes"], Decimal("500.00"))
        self.assertEqual(context["despesas_mes"], Decimal("100.00"))
        self.assertEqual(context["cartao_mes"], Decimal("200.00"))
        self.assertEqual(context["a_pagar_total"], Decimal("200.00"))
        self.assertEqual(context["lucro_realizado"], Decimal("400.00"))
        self.assertEqual(context["lucro_projetado"], Decimal("200.00"))
        self.assertEqual(context["gastos_lucro_realizado"], Decimal("100.00"))
        self.assertEqual(context["saldo_projetado"], Decimal("1200.00"))

    def test_montar_contexto_inclui_renda_base_mensal(self):
        OrcamentoMensal.objects.create(
            usuario=self.user,
            ano=2026,
            mes=3,
            renda_base=Decimal("5650.00"),
        )

        context = montar_contexto_painel_mensal(
            self.user,
            QueryDict("mes=3&ano=2026"),
        )

        self.assertEqual(context["renda_base_mensal"], Decimal("5650.00"))

    def test_montar_contexto_inclui_leitura_do_plano_mensal(self):
        OrcamentoMensal.objects.create(
            usuario=self.user,
            ano=2026,
            mes=3,
            renda_base=Decimal("1000.00"),
        )
        MetaCategoria.objects.create(
            usuario=self.user,
            categoria=self.categoria_despesa,
            ano=2026,
            mes=3,
            valor=Decimal("600.00"),
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.ENTRADA,
            data=datetime.date(2026, 3, 5),
            categoria=self.categoria_receita,
            valor=Decimal("1200.00"),
            banco_origem_destino=self.banco,
            status="recebido",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 6),
            categoria=self.categoria_despesa,
            valor=Decimal("700.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 7),
            categoria=self.categoria_despesa,
            valor=Decimal("100.00"),
            banco_origem_destino=self.banco,
            status="a_pagar",
        )

        context = montar_contexto_painel_mensal(
            self.user,
            QueryDict("mes=3&ano=2026"),
        )

        self.assertEqual(context["total_metas_vigentes"], Decimal("600.00"))
        self.assertEqual(context["sobra_planejada"], Decimal("400.00"))
        self.assertEqual(context["economia_real"], Decimal("400.00"))
        self.assertEqual(context["diferenca_economia"], Decimal("0.00"))
        self.assertEqual(context["sobra_real"], Decimal("500.00"))
        self.assertEqual(context["diferenca_sobra"], Decimal("100.00"))
        self.assertEqual(context["extra_receita_mes"], Decimal("200.00"))

    def test_salvar_orcamento_usuario_atualiza_renda_base(self):
        self.client.force_login(self.user)

        response = self.client.post(
            "/gestao/orcamento/",
            {
                "renda_base_mensal": "5.650,00",
                "mes": "3",
                "ano": "2026",
                "next": "/gestao/?mes=3&ano=2026&aba=extrato",
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/gestao/?mes=3&ano=2026&aba=extrato")
        self.assertEqual(
            OrcamentoMensal.objects.get(usuario=self.user, mes=3, ano=2026).renda_base,
            Decimal("5650.00"),
        )

    def test_ranking_geral_agrega_cartao_apenas_como_fatura(self):
        categoria_cartao = Categoria.objects.create(
            usuario=self.user,
            nome="Restaurante",
            lado_padrao=Categoria.LadoPadrao.SAIDA,
            afeta_resultado=True,
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 6),
            categoria=self.categoria_despesa,
            valor=Decimal("100.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 10),
            categoria=categoria_cartao,
            valor=Decimal("200.00"),
            cartao=self.cartao,
            status="pago",
        )

        context = montar_contexto_painel_mensal(
            self.user,
            QueryDict("mes=3&ano=2026"),
        )

        ranking_gastos = {
            item["categoria__nome"]: item["total"]
            for item in context["ranking_gastos"]
        }
        ranking_cartao = {
            item["categoria__nome"]: item["total"]
            for item in context["ranking_cartao"]
        }

        self.assertEqual(ranking_gastos["Fatura de Cartão"], Decimal("200.00"))
        self.assertEqual(ranking_gastos["Mercado Gestao"], Decimal("100.00"))
        self.assertNotIn("Restaurante", ranking_gastos)
        self.assertEqual(ranking_cartao["Restaurante"], Decimal("200.00"))

        link_cartao = next(
            item["link"]
            for item in context["ranking_cartao"]
            if item["categoria__nome"] == "Restaurante"
        )
        self.assertIn("aba=cartao", link_cartao)
        self.assertIn(f"categoria={categoria_cartao.id}", link_cartao)

    def test_ranking_exibe_percentual_da_receita_e_progresso_da_meta(self):
        MetaCategoria.objects.create(
            usuario=self.user,
            categoria=self.categoria_despesa,
            ano=2026,
            mes=3,
            valor=Decimal("100.00"),
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.ENTRADA,
            data=datetime.date(2026, 3, 5),
            categoria=self.categoria_receita,
            valor=Decimal("1000.00"),
            banco_origem_destino=self.banco,
            status="recebido",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 6),
            categoria=self.categoria_despesa,
            valor=Decimal("80.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )

        context = montar_contexto_painel_mensal(self.user, QueryDict("mes=3&ano=2026"))
        mercado = next(item for item in context["ranking_gastos"] if item["categoria__nome"] == "Mercado Gestao")

        self.assertEqual(mercado["percentual_receita"], Decimal("8.0"))
        self.assertEqual(mercado["meta_reais"], Decimal("100.00"))
        self.assertEqual(mercado["percentual_meta"], Decimal("80.0"))
        self.assertEqual(mercado["nivel_meta"], "dentro-meta")

    def test_ranking_sem_meta_colore_por_percentual_da_receita(self):
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.ENTRADA,
            data=datetime.date(2026, 3, 5),
            categoria=self.categoria_receita,
            valor=Decimal("1000.00"),
            banco_origem_destino=self.banco,
            status="recebido",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 6),
            categoria=self.categoria_despesa,
            valor=Decimal("150.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )

        context = montar_contexto_painel_mensal(self.user, QueryDict("mes=3&ano=2026"))
        mercado = next(item for item in context["ranking_gastos"] if item["categoria__nome"] == "Mercado Gestao")

        self.assertEqual(mercado["percentual_receita"], Decimal("15.0"))
        self.assertEqual(mercado["meta_reais"], None)
        self.assertEqual(mercado["nivel_meta"], "sem-meta")

    def test_ranking_geral_usa_meta_da_categoria_fatura_cartao(self):
        categoria_fatura = Categoria.objects.get(usuario=self.user, nome="Fatura de Cartão")
        MetaCategoria.objects.create(
            usuario=self.user,
            categoria=categoria_fatura,
            ano=2026,
            mes=3,
            valor=Decimal("500.00"),
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.ENTRADA,
            data=datetime.date(2026, 3, 5),
            categoria=self.categoria_receita,
            valor=Decimal("1000.00"),
            banco_origem_destino=self.banco,
            status="recebido",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 10),
            categoria=self.categoria_despesa,
            valor=Decimal("250.00"),
            cartao=self.cartao,
            status="a_pagar",
        )

        context = montar_contexto_painel_mensal(self.user, QueryDict("mes=3&ano=2026"))
        fatura = next(item for item in context["ranking_gastos"] if item["categoria__nome"] == "Fatura de Cartão")

        self.assertEqual(fatura["meta_reais"], Decimal("500.00"))
        self.assertEqual(fatura["percentual_meta"], Decimal("50.0"))
        self.assertEqual(fatura["nivel_meta"], "dentro-meta")

    def test_ranking_cartao_usa_consumo_total_da_categoria_para_meta(self):
        MetaCategoria.objects.create(
            usuario=self.user,
            categoria=self.categoria_despesa,
            ano=2026,
            mes=3,
            valor=Decimal("100.00"),
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 6),
            categoria=self.categoria_despesa,
            valor=Decimal("70.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 10),
            categoria=self.categoria_despesa,
            valor=Decimal("20.00"),
            cartao=self.cartao,
            status="a_pagar",
        )

        context = montar_contexto_painel_mensal(self.user, QueryDict("mes=3&ano=2026"))
        cartao = next(item for item in context["ranking_cartao"] if item["categoria__nome"] == "Mercado Gestao")

        self.assertEqual(cartao["total"], Decimal("20.00"))
        self.assertEqual(cartao["consumo_meta"], Decimal("90.00"))
        self.assertEqual(cartao["percentual_meta"], Decimal("90.0"))

    def test_ranking_classifica_estouro_da_meta_por_faixas_de_cor(self):
        categorias = [
            self.categoria_despesa,
            Categoria.objects.create(usuario=self.user, nome="Restaurante", lado_padrao=Categoria.LadoPadrao.SAIDA),
            Categoria.objects.create(usuario=self.user, nome="Transporte", lado_padrao=Categoria.LadoPadrao.SAIDA),
        ]
        valores = ["100.00", "125.00", "140.00"]

        for categoria, valor in zip(categorias, valores, strict=True):
            MetaCategoria.objects.create(
                usuario=self.user,
                categoria=categoria,
                ano=2026,
                mes=3,
                valor=Decimal("100.00"),
            )
            Transacao.objects.create(
                usuario=self.user,
                tipo=Transacao.TipoTransacao.SAIDA,
                data=datetime.date(2026, 3, 6),
                categoria=categoria,
                valor=Decimal(valor),
                banco_origem_destino=self.banco,
                status="pago",
            )

        context = montar_contexto_painel_mensal(self.user, QueryDict("mes=3&ano=2026"))
        niveis = {
            item["categoria__nome"]: item["nivel_meta"]
            for item in context["ranking_gastos"]
        }

        self.assertEqual(niveis["Mercado Gestao"], "dentro-meta")
        self.assertEqual(niveis["Restaurante"], "alerta-meta")
        self.assertEqual(niveis["Transporte"], "estourado")

    def test_metas_herdam_valor_do_mes_anterior(self):
        MetaCategoria.objects.create(
            usuario=self.user,
            categoria=self.categoria_despesa,
            ano=2026,
            mes=3,
            valor=Decimal("600.00"),
        )

        metas_abril = orcamento_service.obter_metas_vigentes(self.user, 2026, 4)
        MetaCategoria.objects.create(
            usuario=self.user,
            categoria=self.categoria_despesa,
            ano=2026,
            mes=5,
            valor=Decimal("800.00"),
        )
        metas_junho = orcamento_service.obter_metas_vigentes(self.user, 2026, 6)

        self.assertEqual(
            metas_abril[self.categoria_despesa.id],
            Decimal("600.00"),
        )
        self.assertEqual(
            metas_junho[self.categoria_despesa.id],
            Decimal("800.00"),
        )

    def test_tela_metas_usa_renda_base_como_base_progressiva_das_barras(self):
        categoria_restaurante = Categoria.objects.create(
            usuario=self.user,
            nome="Restaurante",
            lado_padrao=Categoria.LadoPadrao.SAIDA,
        )
        OrcamentoMensal.objects.create(
            usuario=self.user,
            ano=2026,
            mes=3,
            renda_base=Decimal("2000.00"),
        )
        MetaCategoria.objects.create(
            usuario=self.user,
            categoria=self.categoria_despesa,
            ano=2026,
            mes=3,
            valor=Decimal("250.00"),
        )
        MetaCategoria.objects.create(
            usuario=self.user,
            categoria=categoria_restaurante,
            ano=2026,
            mes=3,
            valor=Decimal("750.00"),
        )

        contexto_mensal = montar_contexto_painel_mensal(self.user, QueryDict("mes=3&ano=2026&aba=metas"))
        contexto_metas = _montar_contexto_metas(
            self.user,
            QueryDict("mes=3&ano=2026&aba=metas"),
            contexto_mensal,
        )
        percentuais = {
            item["categoria"].nome: item["percentual"]
            for item in contexto_metas["metas_linhas"]
        }

        self.assertEqual(contexto_metas["total_metas"], Decimal("1000.00"))
        self.assertEqual(percentuais["Mercado Gestao"], Decimal("12.5"))
        self.assertEqual(percentuais["Restaurante"], Decimal("37.5"))

    def test_salvar_metas_cria_competencia_sem_repetir_mes_seguinte(self):
        self.client.force_login(self.user)

        response = self.client.post(
            "/gestao/metas/",
            {
                "mes": "8",
                "ano": "2026",
                "renda_base_mensal": "5.650,00",
                f"meta_{self.categoria_despesa.id}": "600,00",
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/gestao/?mes=8&ano=2026&aba=metas")
        self.assertEqual(
            OrcamentoMensal.objects.get(usuario=self.user, mes=8, ano=2026).renda_base,
            Decimal("5650.00"),
        )
        self.assertEqual(
            MetaCategoria.objects.get(
                usuario=self.user,
                categoria=self.categoria_despesa,
                mes=8,
                ano=2026,
            ).valor,
            Decimal("600.00"),
        )
        self.assertFalse(
            MetaCategoria.objects.filter(
                usuario=self.user,
                categoria=self.categoria_despesa,
                mes=9,
                ano=2026,
            ).exists()
        )

    def test_metas_nao_exibe_nem_salva_categoria_fatura_cartao(self):
        self.client.force_login(self.user)
        categoria_fatura, _ = Categoria.objects.get_or_create(
            usuario=self.user,
            nome=CATEGORIA_FATURA_CARTAO,
            defaults={
                "lado_padrao": Categoria.LadoPadrao.SAIDA,
                "afeta_resultado": True,
            },
        )

        response = self.client.get("/gestao/?mes=8&ano=2026&aba=metas")

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, CATEGORIA_FATURA_CARTAO)

        self.client.post(
            "/gestao/metas/",
            {
                "mes": "8",
                "ano": "2026",
                "renda_base_mensal": "5.650,00",
                f"meta_{categoria_fatura.id}": "2500,00",
            },
        )

        self.assertFalse(
            MetaCategoria.objects.filter(
                usuario=self.user,
                categoria=categoria_fatura,
                mes=8,
                ano=2026,
            ).exists()
        )

    def test_comparativo_ranking_compara_mes_atual_com_anterior(self):
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 2, 6),
            categoria=self.categoria_despesa,
            valor=Decimal("80.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 6),
            categoria=self.categoria_despesa,
            valor=Decimal("100.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 10),
            categoria=self.categoria_despesa,
            valor=Decimal("30.00"),
            cartao=self.cartao,
            status="pago",
        )

        context = montar_contexto_painel_mensal(self.user, QueryDict("mes=3&ano=2026"))
        mercado = next(
            item
            for item in context["comparativo_ranking_gastos"]
            if item["categoria"] == "Mercado Gestao"
        )
        mercado_unificado = next(
            item
            for item in context["comparativo_ranking_unificado"]
            if item["categoria"] == "Mercado Gestao"
        )

        self.assertEqual(context["comparativo_mes_atual"], "Mar/26")
        self.assertEqual(context["comparativo_mes_anterior"], "Fev/26")
        self.assertEqual(mercado["atual"], Decimal("100.00"))
        self.assertEqual(mercado["anterior"], Decimal("80.00"))
        self.assertEqual(mercado["diferenca"], Decimal("20.00"))
        self.assertEqual(mercado["variacao"], Decimal("25.0"))
        self.assertEqual(mercado["variacao_abs"], Decimal("25.0"))
        self.assertEqual(mercado_unificado["atual"], Decimal("130.00"))
        self.assertEqual(mercado_unificado["anterior"], Decimal("80.00"))
        self.assertEqual(mercado_unificado["diferenca"], Decimal("50.00"))

    def test_aba_cartao_lista_compras_pela_fatura_e_nao_pelo_mes_civil(self):
        compra_apos_fechamento = Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 21),
            categoria=self.categoria_despesa,
            valor=Decimal("80.00"),
            cartao=self.cartao,
        )

        contexto_marco = montar_contexto_painel_mensal(
            self.user,
            QueryDict("mes=3&ano=2026"),
        )
        contexto_abril = montar_contexto_painel_mensal(
            self.user,
            QueryDict("mes=4&ano=2026"),
        )

        transacoes_marco = contexto_marco["cartoes_com_transacoes"][0]["transacoes"]
        transacoes_abril = contexto_abril["cartoes_com_transacoes"][0]["transacoes"]

        self.assertNotIn(compra_apos_fechamento, transacoes_marco)
        self.assertIn(compra_apos_fechamento, transacoes_abril)
        self.assertEqual(transacoes_abril[0].data, datetime.date(2026, 3, 21))
        self.assertEqual(contexto_marco["cartao_mes"], Decimal("0"))
        self.assertEqual(contexto_abril["cartao_mes"], Decimal("80.00"))

    def test_filtro_categoria_na_aba_cartao_mantem_lista_completa_para_filtro_local(self):
        categoria_outros = Categoria.objects.create(
            usuario=self.user,
            nome="Outros Cartao",
            lado_padrao=Categoria.LadoPadrao.SAIDA,
            afeta_resultado=True,
        )
        compra_filtrada = Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 21),
            categoria=self.categoria_despesa,
            valor=Decimal("80.00"),
            cartao=self.cartao,
        )
        compra_oculta = Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 22),
            categoria=categoria_outros,
            valor=Decimal("40.00"),
            cartao=self.cartao,
        )

        contexto = montar_contexto_painel_mensal(
            self.user,
            QueryDict(f"mes=4&ano=2026&aba=cartao&categoria={self.categoria_despesa.id}"),
        )

        transacoes = contexto["cartoes_com_transacoes"][0]["transacoes"]
        self.assertIn(compra_filtrada, transacoes)
        self.assertIn(compra_oculta, transacoes)
        self.assertEqual(contexto["categoria_filtro"], self.categoria_despesa)

        self.client.force_login(self.user)
        response = self.client.get(f"/gestao/?mes=4&ano=2026&aba=cartao&categoria={self.categoria_despesa.id}")
        self.assertContains(response, "card-group--open")

    def test_filtro_categoria_na_aba_despesas_mantem_lista_completa_sem_alterar_resumo(self):
        categoria_outros = Categoria.objects.create(
            usuario=self.user,
            nome="Outras Despesas",
            lado_padrao=Categoria.LadoPadrao.SAIDA,
            afeta_resultado=True,
        )
        despesa_filtrada = Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 6),
            categoria=self.categoria_despesa,
            valor=Decimal("100.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )
        despesa_oculta = Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=datetime.date(2026, 3, 7),
            categoria=categoria_outros,
            valor=Decimal("50.00"),
            banco_origem_destino=self.banco,
            status="pago",
        )

        contexto = montar_contexto_painel_mensal(
            self.user,
            QueryDict(f"mes=3&ano=2026&aba=saida&categoria={self.categoria_despesa.id}"),
        )

        self.assertIn(despesa_filtrada, list(contexto["transacoes"]))
        self.assertIn(despesa_oculta, list(contexto["transacoes"]))
        self.assertEqual(contexto["categoria_filtro"], self.categoria_despesa)
        self.assertEqual(contexto["despesas_mes"], Decimal("150.00"))

    def test_navegacao_parcial_de_aba_preserva_mes_ano_e_retorna_regioes_leaf(self):
        self.client.force_login(self.user)

        response = self.client.get(
            "/gestao/?mes=4&ano=2026&aba=cartao",
            HTTP_X_REQUESTED_WITH="fetch",
            HTTP_X_GESTAO_TAB_ONLY="1",
            HTTP_ACCEPT="application/json",
        )
        data = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(data["ok"])
        self.assertEqual(data["url"], "/gestao/?mes=4&ano=2026&aba=cartao")
        self.assertEqual(data["aba"], "cartao")
        self.assertEqual(set(data["regions"].keys()), {"gestao-acoes", "gestao-lista", "gestao-modais"})
        self.assertIn('data-refresh-region="gestao-modais"', data["regions"]["gestao-modais"])
        self.assertNotIn("ranking-unificado-comparativo-modal", data["regions"]["gestao-modais"])
        self.assertNotIn("gestao-conteudo", data["regions"])

    def test_navegacao_parcial_para_despesas_inclui_faturas(self):
        self.client.force_login(self.user)
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 8, 10),
            categoria=self.categoria_despesa,
            beneficiario_pagador="Notebook",
            valor=Decimal("250.00"),
            cartao=self.cartao,
            status="pago",
        )

        response = self.client.get(
            "/gestao/?mes=8&ano=2026&aba=saida",
            HTTP_X_REQUESTED_WITH="fetch",
            HTTP_X_GESTAO_TAB_ONLY="1",
            HTTP_ACCEPT="application/json",
        )
        data = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertIn("gestao-lista", data["regions"])
        self.assertIn('data-refresh-region="gestao-faturas"', data["regions"]["gestao-lista"])
        self.assertIn("Faturas de Cartoes", data["regions"]["gestao-lista"])

    def test_navegacao_parcial_para_extrato_retorna_apenas_acoes_e_dashboard(self):
        self.client.force_login(self.user)

        response = self.client.get(
            "/gestao/?mes=4&ano=2026&aba=extrato",
            HTTP_X_REQUESTED_WITH="fetch",
            HTTP_X_GESTAO_TAB_ONLY="1",
            HTTP_ACCEPT="application/json",
        )
        data = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(data["ok"])
        self.assertEqual(data["url"], "/gestao/?mes=4&ano=2026&aba=extrato")
        self.assertEqual(data["aba"], "extrato")
        self.assertEqual(set(data["regions"].keys()), {"gestao-acoes", "gestao-extrato", "gestao-modais"})
        self.assertIn('data-refresh-region="gestao-modais"', data["regions"]["gestao-modais"])
        self.assertIn("ranking-unificado-comparativo-modal", data["regions"]["gestao-extrato"])
        self.assertNotIn("gestao-conteudo", data["regions"])

    def test_aba_metas_renderiza_conteudo_com_contexto_do_mes(self):
        OrcamentoMensal.objects.create(
            usuario=self.user,
            ano=2026,
            mes=8,
            renda_base=Decimal("5650.00"),
        )
        MetaCategoria.objects.create(
            usuario=self.user,
            categoria=self.categoria_despesa,
            ano=2026,
            mes=8,
            valor=Decimal("993.00"),
        )
        self.client.force_login(self.user)

        response = self.client.get("/gestao/?mes=8&ano=2026&aba=metas")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-active-tab="metas"')
        self.assertContains(response, 'name="mes" value="8"')
        self.assertContains(response, 'name="ano" value="2026"')
        self.assertContains(response, "5.650,00")
        self.assertContains(response, "993,00")

    def test_salvar_compra_cartao_por_fetch_preserva_mes_visual_da_fatura(self):
        compra_apos_fechamento = Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 3, 21),
            categoria=self.categoria_despesa,
            beneficiario_pagador="MP",
            descricao="Dell",
            valor=Decimal("237.45"),
            cartao=self.cartao,
            status="pago",
        )
        self.client.force_login(self.user)

        response = self.client.post(
            "/gestao/?mes=4&ano=2026&aba=cartao",
            {
                "action": "save",
                "transacao_id": str(compra_apos_fechamento.id),
                "update_scope": "single",
                "tipo": Transacao.TipoTransacao.CARTAO,
                "data": "2026-03-21",
                "categoria": str(self.categoria_despesa.id),
                "beneficiario_pagador": "MP",
                "descricao": "Dell atualizado",
                "valor": "237,45",
                "cartao": str(self.cartao.id),
                "status": "pago",
                "total_parcelas": "1",
            },
            HTTP_X_REQUESTED_WITH="fetch",
            HTTP_ACCEPT="application/json",
        )

        data = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["url"], "/gestao/?mes=4&ano=2026&aba=cartao")
        self.assertEqual(data["aba"], "cartao")
        self.assertIn("gestao-lista", data["regions"])
        self.assertNotIn("gestao-conteudo", data["regions"])
        self.assertIn("Dell atualizado", data["regions"]["gestao-lista"])

    def test_aba_cartao_usa_mes_do_vencimento_quando_fecha_antes_do_vencimento(self):
        self.cartao.dia_fechamento = 27
        self.cartao.dia_vencimento = 10
        self.cartao.save(update_fields=["dia_fechamento", "dia_vencimento"])
        compra = Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data=datetime.date(2026, 6, 7),
            categoria=self.categoria_despesa,
            valor=Decimal("80.00"),
            cartao=self.cartao,
        )

        contexto_junho = montar_contexto_painel_mensal(
            self.user,
            QueryDict("mes=6&ano=2026"),
        )
        contexto_julho = montar_contexto_painel_mensal(
            self.user,
            QueryDict("mes=7&ano=2026"),
        )

        transacoes_junho = contexto_junho["cartoes_com_transacoes"][0]["transacoes"]
        transacoes_julho = contexto_julho["cartoes_com_transacoes"][0]["transacoes"]

        self.assertNotIn(compra, transacoes_junho)
        self.assertIn(compra, transacoes_julho)
        self.assertEqual(contexto_junho["cartao_mes"], Decimal("0"))
        self.assertEqual(contexto_julho["cartao_mes"], Decimal("80.00"))

    def test_salvar_lancamento_recorrente_cria_regra_sem_parcelas(self):
        self.client.force_login(self.user)

        response = self.client.post(
            "/gestao/",
            {
                "action": "save",
                "tipo": Transacao.TipoTransacao.SAIDA,
                "data": "2026-03-10",
                "categoria": str(self.categoria_despesa.id),
                "beneficiario_pagador": "Academia",
                "descricao": "",
                "valor": "129,00",
                "banco_origem_destino": str(self.banco.id),
                "cartao": "",
                "status": "pago",
                "total_parcelas": "12",
                "assinatura_recorrente": "on",
            },
        )

        self.assertEqual(response.status_code, 302)
        transacao = Transacao.objects.get(beneficiario_pagador="Academia")
        recorrencia = Recorrencia.objects.get(beneficiario_pagador="Academia")
        self.assertEqual(transacao.total_parcelas, 1)
        self.assertEqual(transacao.recorrencia, recorrencia)
        self.assertTrue(transacao.assinatura_recorrente)
        self.assertEqual(transacao.status, "a_pagar")

    def test_recorrencia_gera_lancamento_ao_abrir_mes_sem_duplicar(self):
        Recorrencia.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data_inicio=datetime.date(2026, 3, 10),
            dia=10,
            categoria=self.categoria_despesa,
            beneficiario_pagador="Academia",
            valor=Decimal("129.00"),
            banco_origem_destino=self.banco,
            status="a_pagar",
        )

        montar_contexto_painel_mensal(self.user, QueryDict("mes=4&ano=2026"))
        montar_contexto_painel_mensal(self.user, QueryDict("mes=4&ano=2026"))

        transacoes = Transacao.objects.filter(
            beneficiario_pagador="Academia",
            data=datetime.date(2026, 4, 10),
        )
        self.assertEqual(transacoes.count(), 1)
        self.assertTrue(transacoes.get().assinatura_recorrente)

    def test_recorrencia_entra_na_previsao_do_mes(self):
        Recorrencia.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.ENTRADA,
            data_inicio=datetime.date(2026, 3, 5),
            dia=5,
            categoria=self.categoria_receita,
            beneficiario_pagador="Salario",
            valor=Decimal("5000.00"),
            banco_origem_destino=self.banco,
            status="a_receber",
        )
        Recorrencia.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data_inicio=datetime.date(2026, 3, 10),
            dia=10,
            categoria=self.categoria_despesa,
            beneficiario_pagador="Academia",
            valor=Decimal("129.00"),
            banco_origem_destino=self.banco,
            status="a_pagar",
        )

        context = montar_contexto_painel_mensal(self.user, QueryDict("mes=4&ano=2026"))

        self.assertEqual(context["a_receber_total"], Decimal("5000.00"))
        self.assertEqual(context["a_pagar_total"], Decimal("129.00"))
        self.assertEqual(context["lucro_projetado"], Decimal("4871.00"))

    def test_editar_recorrencia_em_cadeia_atualiza_proximos_lancamentos(self):
        recorrencia = Recorrencia.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data_inicio=datetime.date(2026, 3, 10),
            dia=10,
            categoria=self.categoria_despesa,
            beneficiario_pagador="Academia",
            valor=Decimal("129.00"),
            banco_origem_destino=self.banco,
            status="a_pagar",
        )
        montar_contexto_painel_mensal(self.user, QueryDict("mes=4&ano=2026"))
        montar_contexto_painel_mensal(self.user, QueryDict("mes=5&ano=2026"))
        abril = Transacao.objects.get(recorrencia=recorrencia, data=datetime.date(2026, 4, 10))

        self.client.force_login(self.user)
        response = self.client.post(
            "/gestao/",
            {
                "action": "save",
                "transacao_id": str(abril.id),
                "update_scope": "future",
                "tipo": Transacao.TipoTransacao.SAIDA,
                "data": "2026-04-10",
                "categoria": str(self.categoria_despesa.id),
                "beneficiario_pagador": "Academia",
                "descricao": "",
                "valor": "149,00",
                "banco_origem_destino": str(self.banco.id),
                "cartao": "",
                "status": "a_pagar",
                "total_parcelas": "1",
                "assinatura_recorrente": "on",
            },
        )

        self.assertEqual(response.status_code, 302)
        recorrencia.refresh_from_db()
        maio = Transacao.objects.get(recorrencia=recorrencia, data=datetime.date(2026, 5, 10))
        self.assertEqual(recorrencia.valor, Decimal("149.00"))
        self.assertEqual(maio.valor, Decimal("149.00"))

    def test_excluir_apenas_lancamento_recorrente_cria_excecao_e_nao_regenera(self):
        recorrencia = Recorrencia.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data_inicio=datetime.date(2026, 3, 10),
            dia=10,
            categoria=self.categoria_despesa,
            beneficiario_pagador="Academia",
            valor=Decimal("129.00"),
            banco_origem_destino=self.banco,
            status="a_pagar",
        )
        montar_contexto_painel_mensal(self.user, QueryDict("mes=4&ano=2026"))
        abril = Transacao.objects.get(recorrencia=recorrencia, data=datetime.date(2026, 4, 10))

        self.client.force_login(self.user)
        response = self.client.post(
            "/gestao/",
            {
                "action": "delete",
                "transacao_id": str(abril.id),
                "delete_scope": "single",
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertFalse(Transacao.objects.filter(recorrencia=recorrencia, data=datetime.date(2026, 4, 10)).exists())
        self.assertTrue(
            RecorrenciaExcecao.objects.filter(
                recorrencia=recorrencia,
                ano=2026,
                mes=4,
            ).exists()
        )

        montar_contexto_painel_mensal(self.user, QueryDict("mes=4&ano=2026"))

        self.assertFalse(Transacao.objects.filter(recorrencia=recorrencia, data=datetime.date(2026, 4, 10)).exists())

    def test_excluir_recorrencia_deste_mes_em_diante_remove_atual_e_futuros(self):
        recorrencia = Recorrencia.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data_inicio=datetime.date(2026, 3, 10),
            dia=10,
            categoria=self.categoria_despesa,
            beneficiario_pagador="Academia",
            valor=Decimal("129.00"),
            banco_origem_destino=self.banco,
            status="a_pagar",
        )
        montar_contexto_painel_mensal(self.user, QueryDict("mes=4&ano=2026"))
        montar_contexto_painel_mensal(self.user, QueryDict("mes=5&ano=2026"))
        abril = Transacao.objects.get(recorrencia=recorrencia, data=datetime.date(2026, 4, 10))

        self.client.force_login(self.user)
        response = self.client.post(
            "/gestao/",
            {
                "action": "delete",
                "transacao_id": str(abril.id),
                "delete_scope": "future",
            },
        )

        self.assertEqual(response.status_code, 302)
        recorrencia.refresh_from_db()
        self.assertFalse(recorrencia.ativa)
        self.assertEqual(recorrencia.data_fim, datetime.date(2026, 4, 9))
        self.assertFalse(Transacao.objects.filter(recorrencia=recorrencia, data__gte=datetime.date(2026, 4, 10)).exists())

    def test_transferencia_entre_contas_move_saldos_sem_afetar_lucro(self):
        banco_destino = Banco.objects.create(
            usuario=self.user,
            nome="Reserva Gestao",
            saldo_inicial=Decimal("200.00"),
        )

        self.client.force_login(self.user)
        response = self.client.post(
            "/gestao/",
            {
                "action": "save_transferencia",
                "transferencia-data": "2026-03-12",
                "transferencia-banco_origem": str(self.banco.id),
                "transferencia-banco_destino": str(banco_destino.id),
                "transferencia-valor": "300,00",
                "transferencia-descricao": "Reserva do mes",
            },
        )

        self.assertEqual(response.status_code, 302)
        transferencia = TransferenciaConta.objects.get()
        self.assertEqual(transferencia.valor, Decimal("300.00"))
        self.assertEqual(Transacao.objects.count(), 2)
        self.assertIsNotNone(transferencia.transacao_saida)
        self.assertIsNotNone(transferencia.transacao_entrada)
        self.assertFalse(transferencia.transacao_saida.categoria.afeta_resultado)
        self.assertFalse(transferencia.transacao_entrada.categoria.afeta_resultado)

        context = montar_contexto_painel_mensal(
            self.user,
            QueryDict("mes=3&ano=2026"),
        )
        saldos = {item["nome"]: item["saldo"] for item in context["bancos_balances"]}

        self.assertEqual(context["receitas_mes"], Decimal("0"))
        self.assertEqual(context["despesas_mes"], Decimal("0"))
        self.assertEqual(context["lucro_realizado"], Decimal("0"))
        self.assertEqual(context["saldo_atual"], Decimal("1200.00"))
        self.assertEqual(saldos["Banco Gestao"], Decimal("700.00"))
        self.assertEqual(saldos["Reserva Gestao"], Decimal("500.00"))
        self.assertEqual(list(context["transacoes"]), [])
        self.assertEqual(list(context["transferencias_mes"]), [transferencia])

    def test_excluir_transferencia_remove_movimentos_tecnicos(self):
        banco_destino = Banco.objects.create(
            usuario=self.user,
            nome="Reserva Gestao",
            saldo_inicial=Decimal("200.00"),
        )

        self.client.force_login(self.user)
        self.client.post(
            "/gestao/",
            {
                "action": "save_transferencia",
                "transferencia-data": "2026-03-12",
                "transferencia-banco_origem": str(self.banco.id),
                "transferencia-banco_destino": str(banco_destino.id),
                "transferencia-valor": "300,00",
                "transferencia-descricao": "Reserva do mes",
            },
        )
        transferencia = TransferenciaConta.objects.get()

        response = self.client.post(
            "/gestao/",
            {
                "action": "delete_transferencia",
                "transferencia_id": str(transferencia.id),
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertFalse(TransferenciaConta.objects.exists())
        self.assertFalse(Transacao.objects.exists())

    def test_categorias_tecnicas_nao_aparecem_no_formulario_de_lancamento(self):
        categoria_transferencia = Categoria.objects.create(
            usuario=self.user,
            nome="Transferência entre contas",
            lado_padrao=Categoria.LadoPadrao.AMBOS,
            afeta_resultado=False,
        )
        categoria_fatura = Categoria.objects.get(usuario=self.user, nome="Fatura de Cartão")

        form = TransacaoForm(usuario=self.user)

        categorias = list(form.fields["categoria"].queryset)
        self.assertNotIn(categoria_transferencia, categorias)
        self.assertNotIn(categoria_fatura, categorias)
        self.assertIn(self.categoria_despesa, categorias)


class NotificacoesTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="notificacoes@example.com", nome="Notificacoes", password="password")
        self.banco = Banco.objects.create(
            usuario=self.user,
            nome="Banco Notificacao",
            saldo_inicial=Decimal("1000.00"),
        )
        self.categoria_despesa = Categoria.objects.create(
            usuario=self.user,
            nome="Aluguel",
            lado_padrao=Categoria.LadoPadrao.SAIDA,
            afeta_resultado=True,
        )
        self.categoria_receita = Categoria.objects.create(
            usuario=self.user,
            nome="Salario",
            lado_padrao=Categoria.LadoPadrao.ENTRADA,
            afeta_resultado=True,
        )
        self.cartao = Cartao.objects.create(
            usuario=self.user,
            nome="Cartao Notificacao",
            limite_total=Decimal("1000.00"),
            dia_fechamento=20,
            dia_vencimento=27,
        )

    def test_gera_notificacao_de_vencimento_sem_duplicar(self):
        data = datetime.date(2026, 6, 10)
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=data,
            categoria=self.categoria_despesa,
            beneficiario_pagador="Aluguel",
            valor=Decimal("900.00"),
            banco_origem_destino=self.banco,
            status="a_pagar",
        )

        notificacao_service.gerar_notificacoes_do_dia(self.user, data)
        notificacao_service.gerar_notificacoes_do_dia(self.user, data)

        self.assertEqual(Notificacao.objects.count(), 1)
        notificacao = Notificacao.objects.get()
        self.assertEqual(notificacao.tipo, Notificacao.Tipo.VENCIMENTO_DESPESA)
        self.assertEqual(notificacao.titulo, "Aluguel")
        self.assertEqual(notificacao.mensagem, "R$ 900,00 a pagar em 10/06/2026.")
        self.assertEqual(notificacao.url_destino, "/gestao/?mes=6&ano=2026&aba=saida")

    @patch("django.utils.timezone.localdate")
    def test_gera_notificacao_de_vencimento_para_amanha(self, localdate_mock):
        localdate_mock.return_value = datetime.date(2026, 6, 15)
        data = datetime.date(2026, 6, 16)
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=data,
            categoria=self.categoria_despesa,
            beneficiario_pagador="Condominio",
            valor=Decimal("450.00"),
            banco_origem_destino=self.banco,
            status="a_pagar",
        )

        notificacao_service.gerar_notificacoes_do_dia(self.user, data)

        notificacao = Notificacao.objects.get()
        self.assertEqual(notificacao.titulo, "Condominio")
        self.assertEqual(notificacao.mensagem, "R$ 450,00 a pagar amanhã (16/06/2026).")

    @patch("django.utils.timezone.localdate")
    def test_gera_notificacao_de_recorrencia_no_cartao(self, localdate_mock):
        localdate_mock.return_value = datetime.date(2026, 6, 15)
        data = datetime.date(2026, 6, 16)
        recorrencia = Recorrencia.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data_inicio=datetime.date(2026, 5, 16),
            dia=16,
            categoria=self.categoria_despesa,
            beneficiario_pagador="Spotify",
            valor=Decimal("39.90"),
            cartao=self.cartao,
            status="pago",
            ativa=True,
        )

        notificacao_service.gerar_notificacoes_do_dia(self.user, data)

        transacao = Transacao.objects.get(recorrencia=recorrencia, data=data)
        self.assertTrue(transacao.assinatura_recorrente)
        notificacao = Notificacao.objects.get()
        self.assertEqual(notificacao.tipo, Notificacao.Tipo.VENCIMENTO_DESPESA)
        self.assertEqual(notificacao.chave, f"transacao:{transacao.id}")
        self.assertEqual(notificacao.titulo, "Spotify")
        self.assertEqual(notificacao.mensagem, "R$ 39,90 no Cartao Notificacao amanhã (16/06/2026). Recorrência.")
        self.assertEqual(notificacao.url_destino, "/gestao/?mes=6&ano=2026&aba=cartao")

    @patch("django.utils.timezone.localdate")
    def test_notificacao_de_amanha_atualiza_para_hoje_quando_reprocessada(self, localdate_mock):
        data = datetime.date(2026, 6, 16)
        Transacao.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.SAIDA,
            data=data,
            categoria=self.categoria_despesa,
            beneficiario_pagador="Condominio",
            valor=Decimal("450.00"),
            banco_origem_destino=self.banco,
            status="a_pagar",
        )

        localdate_mock.return_value = datetime.date(2026, 6, 15)
        notificacao_service.gerar_notificacoes_do_dia(self.user, data)
        notificacao = Notificacao.objects.get()
        self.assertEqual(notificacao.mensagem, "R$ 450,00 a pagar amanhã (16/06/2026).")
        notificacao.lida_em = timezone.now()
        notificacao.exibida_em = timezone.now()
        notificacao.push_enviada_em = timezone.now()
        notificacao.save(update_fields=["lida_em", "exibida_em", "push_enviada_em", "atualizado_em"])

        localdate_mock.return_value = data
        notificacao_service.gerar_notificacoes_do_dia(self.user, data)

        self.assertEqual(Notificacao.objects.count(), 1)
        notificacao.refresh_from_db()
        self.assertEqual(notificacao.mensagem, "R$ 450,00 a pagar hoje.")
        self.assertIsNone(notificacao.lida_em)
        self.assertIsNone(notificacao.exibida_em)
        self.assertIsNone(notificacao.push_enviada_em)

    def test_gera_notificacao_de_fatura_pendente(self):
        data_vencimento = datetime.date(2026, 6, 27)
        FaturaCartao.objects.create(
            usuario=self.user,
            cartao=self.cartao,
            mes=6,
            ano=2026,
            data_fechamento=datetime.date(2026, 6, 20),
            data_vencimento=data_vencimento,
            valor_total=Decimal("120.00"),
            valor_pago=Decimal("0.00"),
            status=FaturaCartao.Status.A_PAGAR,
        )

        notificacao_service.gerar_notificacoes_do_dia(self.user, data_vencimento)

        notificacao = Notificacao.objects.get(tipo=Notificacao.Tipo.VENCIMENTO_FATURA)
        self.assertEqual(notificacao.titulo, "Cartao Notificacao")
        self.assertEqual(notificacao.mensagem, "R$ 120,00 vence em 27/06/2026.")
        self.assertEqual(notificacao.url_destino, "/gestao/?mes=6&ano=2026&aba=saida")

    def test_fatura_considera_recorrencia_de_cartao_gerada_pelo_push(self):
        data_vencimento = datetime.date(2026, 6, 27)
        Recorrencia.objects.create(
            usuario=self.user,
            tipo=Transacao.TipoTransacao.CARTAO,
            data_inicio=datetime.date(2026, 5, 10),
            dia=10,
            categoria=self.categoria_despesa,
            beneficiario_pagador="Streaming",
            valor=Decimal("50.00"),
            cartao=self.cartao,
            status="pago",
            ativa=True,
        )

        notificacao_service.gerar_notificacoes_do_dia(self.user, data_vencimento)

        fatura = FaturaCartao.objects.get(cartao=self.cartao, mes=6, ano=2026)
        notificacao = Notificacao.objects.get(tipo=Notificacao.Tipo.VENCIMENTO_FATURA)
        self.assertEqual(fatura.valor_total, Decimal("50.00"))
        self.assertEqual(notificacao.mensagem, "R$ 50,00 vence em 27/06/2026.")

    def test_marcar_notificacao_como_lida_por_endpoint(self):
        notificacao = Notificacao.objects.create(
            usuario=self.user,
            tipo=Notificacao.Tipo.VENCIMENTO_RECEITA,
            chave="transacao:1",
            titulo="Receita vence hoje",
            mensagem="Salario - R$ 100,00 a receber hoje.",
            data_referencia=datetime.date(2026, 6, 10),
            url_destino="/gestao/?aba=entrada",
        )

        self.client.force_login(self.user)
        response = self.client.post(f"/gestao/notificacoes/{notificacao.id}/lida/")

        self.assertEqual(response.status_code, 200)
        notificacao.refresh_from_db()
        self.assertIsNotNone(notificacao.lida_em)
        self.assertEqual(response.json()["url"], "/gestao/?aba=entrada")

    @patch("django.utils.timezone.localdate")
    def test_notificacao_lida_continua_no_historico_do_dia(self, localdate_mock):
        localdate_mock.return_value = datetime.date(2026, 6, 10)
        notificacao = Notificacao.objects.create(
            usuario=self.user,
            tipo=Notificacao.Tipo.VENCIMENTO_RECEITA,
            chave="transacao:2",
            titulo="Receita vence hoje",
            mensagem="Salario - R$ 100,00 a receber hoje.",
            data_referencia=datetime.date(2026, 6, 10),
            url_destino="/gestao/?aba=entrada",
        )

        notificacao_service.marcar_como_lida(notificacao)

        self.assertEqual(list(notificacao_service.listar_notificacoes(self.user)), [notificacao])
        self.assertFalse(notificacao_service.existe_nao_lida(self.user))

    @patch("django.utils.timezone.localdate")
    def test_notificacao_amanha_vencida_nao_aparece_no_painel(self, localdate_mock):
        localdate_mock.return_value = datetime.date(2026, 6, 16)
        Notificacao.objects.create(
            usuario=self.user,
            tipo=Notificacao.Tipo.VENCIMENTO_DESPESA,
            chave="transacao:4",
            titulo="Despesa vence hoje",
            mensagem="R$ 450,00 a pagar amanhã (16/06/2026).",
            data_referencia=datetime.date(2026, 6, 16),
            url_destino="/gestao/?aba=saida",
        )

        self.assertEqual(list(notificacao_service.listar_notificacoes(self.user)), [])
        self.assertFalse(notificacao_service.existe_nao_lida(self.user))
        self.assertIsNone(notificacao_service.notificacao_para_banner(self.user))

    def test_limpar_notificacao_arquiva_e_remove_de_pendencias(self):
        notificacao = Notificacao.objects.create(
            usuario=self.user,
            tipo=Notificacao.Tipo.VENCIMENTO_DESPESA,
            chave="transacao:3",
            titulo="Despesa vence hoje",
            mensagem="Aluguel - R$ 900,00 a pagar hoje.",
            data_referencia=datetime.date(2026, 6, 10),
            url_destino="/gestao/?aba=saida",
        )

        self.client.force_login(self.user)
        response = self.client.post(f"/gestao/notificacoes/{notificacao.id}/limpar/")

        self.assertEqual(response.status_code, 200)
        notificacao.refresh_from_db()
        self.assertIsNotNone(notificacao.arquivada_em)
        self.assertEqual(list(notificacao_service.listar_notificacoes(self.user)), [])
        self.assertFalse(response.json()["temNaoLida"])

    def test_status_push_indica_quando_nao_configurado(self):
        self.client.force_login(self.user)

        response = self.client.get("/gestao/notificacoes/push/status/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["disponivel"])

    @override_settings(
        WEBPUSH_VAPID_PUBLIC_KEY="BTestePublico",
        WEBPUSH_VAPID_PRIVATE_KEY="TestePrivado",
    )
    @patch("gestao.servicos.push.webpush", object())
    def test_salvar_inscricao_push(self):
        self.client.force_login(self.user)

        response = self.client.post(
            "/gestao/notificacoes/push/salvar/",
            data=json.dumps({
                "endpoint": "https://push.example.com/sub/1",
                "keys": {
                    "p256dh": "chave-p256dh",
                    "auth": "chave-auth",
                },
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        inscricao = InscricaoPush.objects.get(usuario=self.user)
        self.assertTrue(inscricao.ativa)
        self.assertEqual(inscricao.endpoint, "https://push.example.com/sub/1")

    @override_settings(
        WEBPUSH_VAPID_PUBLIC_KEY="BTestePublico",
        WEBPUSH_VAPID_PRIVATE_KEY="TestePrivado",
    )
    @patch("gestao.servicos.push.webpush", object())
    def test_remover_inscricao_push(self):
        inscricao = InscricaoPush.objects.create(
            usuario=self.user,
            endpoint="https://push.example.com/sub/2",
            chave_p256dh="chave-p256dh",
            chave_auth="chave-auth",
        )
        self.client.force_login(self.user)

        response = self.client.post(
            "/gestao/notificacoes/push/remover/",
            data=json.dumps({"endpoint": inscricao.endpoint}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        inscricao.refresh_from_db()
        self.assertFalse(inscricao.ativa)
