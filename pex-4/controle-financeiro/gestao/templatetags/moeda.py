from decimal import Decimal
from django import template

register = template.Library()

@register.filter(name="moeda")
def moeda(value):
    if value is None or value == "":
        return "0,00"
    try:
        # Garante que lidamos bem com float, decimal ou str
        numero = f"{float(value):,.2f}"
        return numero.replace(",", "X").replace(".", ",").replace("X", ".")
    except (ValueError, TypeError):
        return "0,00"
