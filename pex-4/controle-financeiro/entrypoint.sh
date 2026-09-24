#!/bin/sh
set -e

echo "Aplicando migrations..."
python manage.py migrate

echo "Sincronizando faturas de cartão..."
python manage.py sincronizar_faturas_cartao

echo "Coletando arquivos estáticos..."
python manage.py collectstatic --noinput

echo "Iniciando Django com Gunicorn..."
exec gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3
