import re

from django import template
from django.conf import settings

register = template.Library()


def get_static_version():
    sw_path = settings.BASE_DIR / "templates" / "pwa" / "sw.js"
    try:
        content = sw_path.read_text(encoding="utf-8")
    except OSError:
        return ""

    match = re.search(r"const\s+STATIC_VERSION\s*=\s*['\"]([^'\"]+)['\"]", content)
    return match.group(1) if match else ""


@register.simple_tag
def static_version():
    return get_static_version()


@register.simple_tag
def asset(path):
    static_url = str(getattr(settings, "STATIC_URL", "/static/"))
    if not static_url.endswith("/"):
        static_url = f"{static_url}/"

    url = f"{static_url}{str(path).lstrip('/')}"
    version = get_static_version()
    if not version:
        return url

    separator = "&" if "?" in url else "?"
    return f"{url}{separator}v={version}"
