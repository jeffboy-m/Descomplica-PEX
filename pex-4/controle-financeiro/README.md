# Controle Financeiro - Versao Demonstrativa

Esta copia foi reduzida para entrega academica. Ela preserva a estrutura Django,
rotas principais e telas de demonstracao, mas nao executa a logica financeira do
sistema real.

As telas usam dados demonstrativos em memoria. Cadastros, convites, notificacoes,
push, faturas, recorrencias, transferencias e comandos agendados nao executam
acoes reais.

## Rodando localmente

```bash
uv sync
uv run python manage.py check
uv run python manage.py runserver
```

Acesse:

```text
http://localhost:8000/gestao/
```

## Observacoes

- Nao e necessario criar superusuario para navegar na demo.
- Nao envie `.env`, `db.sqlite3`, arquivos `.pem`, `.venv/`, logos ou assets proprietarios.
- As migrations dos apps do projeto foram removidas para reduzir exposicao de estrutura interna.
