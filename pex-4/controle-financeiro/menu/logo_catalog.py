from pathlib import Path

from django.conf import settings


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}


def get_logo_options(folder):
    directory = Path(settings.BASE_DIR) / "static" / folder
    if not directory.exists():
        return []

    logos = []
    for path in sorted(directory.iterdir(), key=lambda item: item.name.lower()):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue

        name = path.stem.replace("_", " ").replace("-", " ").strip()
        logos.append(
            {
                "path": f"{folder}/{path.name}",
                "name": name or path.name,
            }
        )
    return logos


def get_logo_choices(folder):
    return [("", "Sem logo")] + [
        (logo["path"], logo["name"])
        for logo in get_logo_options(folder)
    ]
