def notificacoes_globais(request):
    return {
        "demo_mode": True,
        "demo_user_label": "Usuario Demo",
        "notificacoes_itens": [],
        "notificacoes_tem_nao_lida": False,
        "notificacao_banner": None,
    }
