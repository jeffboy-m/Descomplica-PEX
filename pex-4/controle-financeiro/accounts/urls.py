from django.urls import path

from accounts import views


app_name = "accounts"

urlpatterns = [
    path("convite/<str:token>/", views.aceitar_convite, name="aceitar_convite"),
]
