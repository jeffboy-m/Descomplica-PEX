class BackupBancoErro(Exception):
    pass


class BancoNaoSuportadoErro(BackupBancoErro):
    pass


def criar_backup_postgres():
    raise BancoNaoSuportadoErro("Backup desativado na versao demonstrativa.")


def obter_versao_pg_dump():
    return "demo"
