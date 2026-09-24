from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Comando desativado na versao demonstrativa."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Demo: nenhuma fatura foi sincronizada."))
