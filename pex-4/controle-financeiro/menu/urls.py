from django.urls import path
from django.views.generic.base import RedirectView

from menu.views import MenuHomeView

urlpatterns = [
    path("", RedirectView.as_view(pattern_name="cadastros-bancos", permanent=False), name="menu-home"),
    path("bancos/", MenuHomeView.as_view(cadastro_tipo="bancos"), name="cadastros-bancos"),
    path("cartoes/", MenuHomeView.as_view(cadastro_tipo="cartoes"), name="cadastros-cartoes"),
    path("categorias/", MenuHomeView.as_view(cadastro_tipo="categorias"), name="cadastros-categorias"),
]
