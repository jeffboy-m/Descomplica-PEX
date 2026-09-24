from decimal import Decimal

from django.contrib.auth import get_user_model
from django.http import QueryDict
from django.test import TestCase, override_settings
from django.urls import reverse

from menu.models import Banco, Cartao, Categoria
from menu.seletores.painel_menu import montar_contexto_menu
from menu.servicos import cadastros as cadastro_service


User = get_user_model()


class CadastrosMenuTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="menuuser@example.com", nome="Menu User", password="password")

    def test_salvar_banco(self):
        sucesso, form = cadastro_service.salvar_banco(
            self.user,
            {
                "nome": "Banco Teste",
                "saldo_inicial": "1.250,50",
                "logo": "",
            },
        )

        banco = Banco.objects.get(usuario=self.user, nome="Banco Teste")
        self.assertTrue(sucesso)
        self.assertTrue(form.is_valid())
        self.assertEqual(banco.saldo_inicial, Decimal("1250.50"))

    def test_salvar_cartao(self):
        sucesso, form = cadastro_service.salvar_cartao(
            self.user,
            {
                "nome": "Cartao Teste",
                "limite_total": "5.000,00",
                "dia_fechamento": "20",
                "dia_vencimento": "27",
                "logo": "",
            },
        )

        cartao = Cartao.objects.get(usuario=self.user, nome="Cartao Teste")
        self.assertTrue(sucesso)
        self.assertTrue(form.is_valid())
        self.assertEqual(cartao.limite_total, Decimal("5000.00"))

    def test_salvar_categoria(self):
        sucesso, form = cadastro_service.salvar_categoria(
            self.user,
            {
                "nome": "Mercado",
                "lado_padrao": Categoria.LadoPadrao.SAIDA,
                "afeta_resultado": "on",
                "ativo": "on",
            },
        )

        categoria = Categoria.objects.get(usuario=self.user, nome="Mercado")
        self.assertTrue(sucesso)
        self.assertTrue(form.is_valid())
        self.assertEqual(categoria.lado_padrao, Categoria.LadoPadrao.SAIDA)
        self.assertEqual(categoria.icone, "🛒")

    def test_salvar_categoria_preserva_icone_escolhido(self):
        sucesso, form = cadastro_service.salvar_categoria(
            self.user,
            {
                "nome": "Mercado",
                "icone": "🍔",
                "lado_padrao": Categoria.LadoPadrao.SAIDA,
                "afeta_resultado": "on",
                "ativo": "on",
            },
        )

        categoria = Categoria.objects.get(usuario=self.user, nome="Mercado")
        self.assertTrue(sucesso)
        self.assertTrue(form.is_valid())
        self.assertEqual(categoria.icone, "🍔")

    def test_nao_excluir_categoria_essencial(self):
        categoria = Categoria.objects.get(usuario=self.user, nome="Fatura de Cartão")

        mensagem = cadastro_service.excluir_categoria(self.user, categoria.id)

        self.assertIsNotNone(mensagem)
        self.assertTrue(Categoria.objects.filter(pk=categoria.pk).exists())

    def test_nao_excluir_categoria_transferencia(self):
        categoria = Categoria.objects.create(
            usuario=self.user,
            nome="Transferência entre contas",
            lado_padrao=Categoria.LadoPadrao.AMBOS,
            afeta_resultado=False,
        )

        mensagem = cadastro_service.excluir_categoria(self.user, categoria.id)

        self.assertIsNotNone(mensagem)
        self.assertTrue(Categoria.objects.filter(pk=categoria.pk).exists())


@override_settings(
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
)
class PainelMenuTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="paineluser@example.com", nome="Painel User", password="password")
        self.banco = Banco.objects.create(
            usuario=self.user,
            nome="Banco Painel",
            saldo_inicial=Decimal("1200.50"),
        )
        self.cartao = Cartao.objects.create(
            usuario=self.user,
            nome="Cartao Painel",
            limite_total=Decimal("3000.00"),
            dia_fechamento=20,
            dia_vencimento=27,
        )
        self.categoria = Categoria.objects.create(
            usuario=self.user,
            nome="Categoria Painel",
            lado_padrao=Categoria.LadoPadrao.SAIDA,
        )

    def test_montar_contexto_menu_basico(self):
        context = montar_contexto_menu(self.user, QueryDict(""))

        self.assertEqual(context["patrimonio_total_inicial"], "1.200,50")
        self.assertEqual(context["cadastro_tipo"], "bancos")
        self.assertEqual(context["cadastro_titulo"], "Bancos")
        self.assertIn(self.banco, list(context["bancos"]))
        self.assertIn(self.cartao, list(context["cartoes"]))
        self.assertIn(self.categoria, list(context["categorias"]))
        self.assertEqual(context["open_modal"], None)

    def test_categoria_transferencia_nao_aparece_no_cadastro(self):
        categoria_transferencia = Categoria.objects.create(
            usuario=self.user,
            nome="Transferência entre contas",
            lado_padrao=Categoria.LadoPadrao.AMBOS,
            afeta_resultado=False,
        )

        context = montar_contexto_menu(self.user, QueryDict(""), cadastro_tipo="categorias")

        self.assertNotIn(categoria_transferencia, list(context["categorias"]))

    def test_montar_contexto_menu_edicao_abre_modal_correto(self):
        params = QueryDict(f"editar_cartao={self.cartao.id}")

        context = montar_contexto_menu(self.user, params)

        self.assertEqual(context["cartao_edicao"], self.cartao)
        self.assertEqual(context["open_modal"], "cartao-modal")

    def test_menu_antigo_redireciona_para_bancos(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("menu-home"))

        self.assertRedirects(response, reverse("cadastros-bancos"))

    def test_rotas_de_cadastros_renderizam_secao_correta(self):
        self.client.force_login(self.user)

        rotas = [
            ("cadastros-bancos", "bancos"),
            ("cadastros-cartoes", "cartoes"),
            ("cadastros-categorias", "categorias"),
        ]

        for rota, cadastro_tipo in rotas:
            with self.subTest(rota=rota):
                response = self.client.get(reverse(rota))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.context["cadastro_tipo"], cadastro_tipo)

    def test_rota_de_cadastro_pode_abrir_modal_por_parametro(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("cadastros-categorias"), {"open_modal": "categoria-modal"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["open_modal"], "categoria-modal")
