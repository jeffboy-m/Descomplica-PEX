from django.urls import path
from anual.views import PainelAnualView

urlpatterns = [
    path("", PainelAnualView.as_view(), name="anual-home"),
]
