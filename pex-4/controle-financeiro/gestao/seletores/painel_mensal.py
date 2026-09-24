ABAS_GESTAO = {"extrato", "entrada", "saida", "cartao", "transferencia", "metas"}


def montar_contexto_painel_mensal(*args, **kwargs):
    return {"mes": 1, "ano": 2026, "aba_ativa": "extrato", "renda_base_mensal": 0, "acompanhamento_data_json": "{}"}
