from django.contrib.auth import views as auth_views
from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from core.forms import EmailAuthenticationForm

import core.admin_backup  # noqa: F401

from django.views.generic.base import RedirectView

from django.contrib.auth import logout
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def custom_logout(request):
    logout(request)
    return redirect("login")


from django.views.decorators.cache import never_cache
from django.views.generic import TemplateView

urlpatterns = [
    path(
        "login/",
        auth_views.LoginView.as_view(
            template_name="login.html",
            redirect_authenticated_user=True,
            authentication_form=EmailAuthenticationForm,
        ),
        name="login",
    ),
    path("logout/", custom_logout, name="logout"),
    path("accounts/", include("accounts.urls")),
    path("", RedirectView.as_view(url="/gestao/", permanent=False)),
    path("menu/", include("menu.urls")),
    path("lancamentos/", RedirectView.as_view(url="/gestao/", permanent=True)),
    path("gestao/", include("gestao.urls")),
    path("anual/", include("anual.urls")),
    path("admin/", admin.site.urls),
    path("alterar-senha/", auth_views.PasswordChangeView.as_view(template_name="alterar_senha.html", success_url="/menu/bancos/"), name="password_change"),
    
    # PWA Assets served from root domain scope (nunca cachear sw.js e manifest.json no navegador)
    path("manifest.json", never_cache(TemplateView.as_view(template_name="pwa/manifest.json", content_type="application/json"))),
    path("sw.js", never_cache(TemplateView.as_view(template_name="pwa/sw.js", content_type="application/javascript"))),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
