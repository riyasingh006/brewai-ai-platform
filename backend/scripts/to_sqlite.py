"""Generate the SQLite dev variant of the Prisma schema.

Prisma does not allow ``provider`` to be an environment variable, so the
dev schema is a copy of the canonical PostgreSQL schema with the datasource
swapped to SQLite. The generated client is identical for both providers.

Usage:
    python backend/scripts/to_sqlite.py
"""

from pathlib import Path

PRISMA_DIR = Path(__file__).resolve().parent.parent / "prisma"
CANONICAL = PRISMA_DIR / "schema.prisma"
DEV = PRISMA_DIR / "schema.dev.prisma"


def main() -> None:
    schema = CANONICAL.read_text(encoding="utf-8")
    schema = schema.replace('provider = "postgresql"', 'provider = "sqlite"')
    # SQLite ignores most connection params; a bare file path is all we need.
    schema = schema.replace('url      = env("DATABASE_URL")', 'url      = "file:./dev.db"')
    DEV.write_text(schema, encoding="utf-8")
    print(f"Wrote {DEV}")


if __name__ == "__main__":
    main()
