from django.shortcuts import render


def aceitar_convite(request, token):
    return render(
        request,
        "demo/shell.html",
        {
            "page_title": "Convite indisponivel",
            "page_subtitle": "Fluxo de convite removido da versao demonstrativa.",
            "active_section": "Demo",
            "active_tab": "convite",
            "nav_items": [("gestao", "Gestao", "/gestao/")],
            "cards": [("Convite", "Desativado", "Sem criacao de usuario")],
            "rows": [("Demo", "Token recebido", token[:8] + "...", "Ignorado")],
        },
        status=410,
    )
