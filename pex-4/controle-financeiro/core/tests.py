from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import ConviteUsuario


User = get_user_model()


@override_settings(
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
)
class LoginAuthenticationTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="jeff@example.com",
            nome="Jeff",
            password="senha-forte",
        )

    def test_login_por_email(self):
        response = self.client.post(
            "/login/",
            {"username": "jeff@example.com", "password": "senha-forte"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/gestao/")
        self.assertEqual(int(self.client.session["_auth_user_id"]), self.user.id)

    def test_login_por_email_ignora_maiusculas(self):
        response = self.client.post(
            "/login/",
            {"username": "JEFF@EXAMPLE.COM", "password": "senha-forte"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/gestao/")
        self.assertEqual(int(self.client.session["_auth_user_id"]), self.user.id)

    def test_login_por_username_nao_e_mais_aceito(self):
        response = self.client.post(
            "/login/",
            {"username": "jeff", "password": "senha-forte"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)


@override_settings(
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
)
class ConviteUsuarioTestCase(TestCase):
    def test_aceita_convite_cria_usuario_e_autentica(self):
        convite = ConviteUsuario.objects.create(email="novo@example.com", is_staff=True)

        response = self.client.post(
            convite.get_absolute_url(),
            {
                "nome": "Novo Usuario",
                "senha": "senha-forte",
                "confirmar_senha": "senha-forte",
            },
        )

        usuario = User.objects.get(email="novo@example.com")
        convite.refresh_from_db()

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/gestao/")
        self.assertEqual(usuario.nome, "Novo Usuario")
        self.assertTrue(usuario.is_staff)
        self.assertFalse(usuario.is_superuser)
        self.assertEqual(convite.usuario_criado, usuario)
        self.assertIsNotNone(convite.usado_em)
        self.assertEqual(int(self.client.session["_auth_user_id"]), usuario.id)

    def test_convite_usado_fica_indisponivel(self):
        usuario = User.objects.create_user(email="usado@example.com", nome="Usado", password="senha-forte")
        convite = ConviteUsuario.objects.create(email="usado@example.com")
        convite.marcar_como_usado(usuario)

        response = self.client.get(convite.get_absolute_url())

        self.assertEqual(response.status_code, 410)

    def test_convite_expirado_fica_indisponivel(self):
        convite = ConviteUsuario.objects.create(
            email="expirado@example.com",
            expira_em=timezone.now() - timedelta(days=1),
        )

        response = self.client.get(convite.get_absolute_url())

        self.assertEqual(response.status_code, 410)

    def test_nao_cria_usuario_com_email_existente(self):
        User.objects.create_user(email="existe@example.com", nome="Existe", password="senha-forte")
        convite = ConviteUsuario.objects.create(email="existe@example.com")

        response = self.client.post(
            convite.get_absolute_url(),
            {
                "nome": "Outro",
                "senha": "senha-forte",
                "confirmar_senha": "senha-forte",
            },
        )

        convite.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(convite.usado_em)
        self.assertEqual(User.objects.filter(email__iexact="existe@example.com").count(), 1)
