def push_disponivel():
    return False


def usuario_tem_inscricao_ativa(*args, **kwargs):
    return False


def salvar_inscricao(*args, **kwargs):
    return None


def remover_inscricao(*args, **kwargs):
    return None


def enviar_push_pendentes(*args, **kwargs):
    return {"pendentes": 0, "notificacoes_enviadas": 0, "dispositivos_notificados": 0, "sem_dispositivo": 0, "sem_envio": 0, "erros": []}
