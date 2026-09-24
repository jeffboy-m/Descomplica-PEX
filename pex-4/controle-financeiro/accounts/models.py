import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, Group, Permission, PermissionsMixin
from django.db import models
from django.urls import reverse
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def get_by_natural_key(self, email):
        return self.get(email__iexact=email)

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("O email e obrigatorio.")

        email = self.normalize_email(email)
        nome = extra_fields.pop("nome", "") or extra_fields.pop("first_name", "") or email.split("@")[0]
        user = self.model(email=email, nome=nome, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superusuario precisa ter is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superusuario precisa ter is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField("email", unique=True)
    nome = models.CharField("nome", max_length=150)
    password = models.CharField("senha", max_length=128)
    last_login = models.DateTimeField("ultimo login", blank=True, null=True)
    is_superuser = models.BooleanField("superusuario", default=False)
    is_staff = models.BooleanField("membro da equipe", default=False)
    is_active = models.BooleanField("ativo", default=True)
    date_joined = models.DateTimeField("data de entrada", default=timezone.now)

    groups = models.ManyToManyField(
        Group,
        verbose_name="grupos",
        blank=True,
        related_name="accounts_users",
        related_query_name="accounts_user",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name="permissoes de usuario",
        blank=True,
        related_name="accounts_users",
        related_query_name="accounts_user",
    )

    objects = UserManager()

    EMAIL_FIELD = "email"
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nome"]

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"

    def __str__(self):
        return self.nome or self.email

    def get_full_name(self):
        return self.nome

    def get_short_name(self):
        return self.nome


def gerar_token_convite():
    return secrets.token_urlsafe(32)


def expira_em_padrao():
    return timezone.now() + timedelta(days=7)


class ConviteUsuario(models.Model):
    email = models.EmailField("email")
    token = models.CharField("token", max_length=96, unique=True, default=gerar_token_convite, editable=False)
    is_staff = models.BooleanField("membro da equipe", default=False)
    is_superuser = models.BooleanField("superusuario", default=False)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="criado por",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="convites_criados",
    )
    usuario_criado = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="usuario criado",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="convites_recebidos",
    )
    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    expira_em = models.DateTimeField("expira em", default=expira_em_padrao)
    usado_em = models.DateTimeField("usado em", blank=True, null=True)

    class Meta:
        verbose_name = "convite"
        verbose_name_plural = "convites"
        ordering = ("-criado_em",)

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        self.email = User.objects.normalize_email(self.email).lower()
        if self.is_superuser:
            self.is_staff = True
        super().save(*args, **kwargs)

    @property
    def foi_usado(self):
        return self.usado_em is not None

    @property
    def expirou(self):
        return timezone.now() > self.expira_em

    @property
    def pode_ser_usado(self):
        return not self.foi_usado and not self.expirou

    def get_absolute_url(self):
        return reverse("accounts:aceitar_convite", kwargs={"token": self.token})

    def marcar_como_usado(self, usuario):
        self.usuario_criado = usuario
        self.usado_em = timezone.now()
        self.save(update_fields=("usuario_criado", "usado_em"))
