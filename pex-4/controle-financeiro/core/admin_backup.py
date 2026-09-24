from pathlib import Path

from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from django.db import connections
from django.http import FileResponse, HttpRequest, HttpResponse
from django.template.response import TemplateResponse
from django.urls import path

from gestao.servicos.backup_banco import (
    BancoNaoSuportadoErro,
    BackupBancoErro,
    criar_backup_postgres,
    obter_versao_pg_dump,
)


class BackupFileResponse(FileResponse):
    def __init__(self, *args, cleanup_path: Path, **kwargs):
        self.cleanup_path = cleanup_path
        super().__init__(*args, **kwargs)

    def close(self) -> None:
        super().close()
        try:
            self.cleanup_path.unlink(missing_ok=True)
        except OSError:
            pass


def backup_banco_admin_view(request: HttpRequest) -> HttpResponse:
    if not request.user.is_superuser:
        raise PermissionDenied

    context = admin.site.each_context(request)
    context.update(_contexto_banco())

    if request.method == "POST":
        try:
            backup = criar_backup_postgres()
        except BancoNaoSuportadoErro as exc:
            messages.error(request, str(exc))
        except BackupBancoErro as exc:
            messages.error(request, str(exc))
        else:
            return BackupFileResponse(
                open(backup.caminho, "rb"),
                cleanup_path=backup.caminho,
                as_attachment=True,
                filename=backup.nome_arquivo,
                content_type="application/octet-stream",
            )

    return TemplateResponse(request, "admin/backup_banco.html", context)


def _contexto_banco() -> dict[str, str | bool]:
    db_settings = connections["default"].settings_dict
    engine = str(db_settings.get("ENGINE", ""))

    return {
        "title": "Backup do banco",
        "database_engine": engine,
        "database_name": str(db_settings.get("NAME") or ""),
        "database_host": str(db_settings.get("HOST") or "localhost"),
        "pg_dump_version": obter_versao_pg_dump(),
        "is_postgres": "postgresql" in engine,
    }


def registrar_backup_no_admin() -> None:
    if getattr(admin.site, "_backup_banco_registrado", False):
        return

    original_get_urls = admin.site.get_urls

    def get_urls():
        urls = [
            path(
                "backup-banco/",
                admin.site.admin_view(backup_banco_admin_view),
                name="backup_banco",
            )
        ]
        return urls + original_get_urls()

    admin.site.get_urls = get_urls
    admin.site.index_template = "admin/index_backup.html"
    admin.site._backup_banco_registrado = True


registrar_backup_no_admin()
