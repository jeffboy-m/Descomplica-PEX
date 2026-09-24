from django.urls import path
from gestao.views import (
    AcompanhamentoView,
    ArquivarNotificacaoView,
    MarcarNotificacaoExibidaView,
    MarcarNotificacaoLidaView,
    MetasView,
    PushStatusView,
    RemoverInscricaoPushView,
    SalvarOrcamentoView,
    SalvarInscricaoPushView,
)

urlpatterns = [
    path("", AcompanhamentoView.as_view(), name="gestao-home"),
    path("metas/", MetasView.as_view(), name="gestao-metas"),
    path("orcamento/", SalvarOrcamentoView.as_view(), name="salvar-orcamento"),
    path("notificacoes/<int:notificacao_id>/lida/", MarcarNotificacaoLidaView.as_view(), name="notificacao-lida"),
    path("notificacoes/<int:notificacao_id>/limpar/", ArquivarNotificacaoView.as_view(), name="notificacao-limpar"),
    path("notificacoes/<int:notificacao_id>/exibida/", MarcarNotificacaoExibidaView.as_view(), name="notificacao-exibida"),
    path("notificacoes/push/status/", PushStatusView.as_view(), name="notificacao-push-status"),
    path("notificacoes/push/salvar/", SalvarInscricaoPushView.as_view(), name="notificacao-push-salvar"),
    path("notificacoes/push/remover/", RemoverInscricaoPushView.as_view(), name="notificacao-push-remover"),
]
