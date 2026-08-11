"""Generate the Prisma client for the backend.

Why this dance: the prisma-client-py generator on Windows silently writes
nothing when the output path passes through OneDrive folders with non-ASCII
characters, but works reliably on a plain ASCII path. So we generate into a
temp directory and copy the finished client into ``backend/generated``.

Prereqs:
    - ``pip install prisma`` (installs prisma-client-py.exe in .venv\\Scripts)

Usage:
    python backend/scripts/generate_client.py
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BACKEND = Path(__file__).resolve().parent.parent
PRISMA_DIR = BACKEND / "prisma"
DEV_SCHEMA = PRISMA_DIR / "schema.dev.prisma"
OUTPUT_DIR = BACKEND / "generated"


def _prepare_dev_schema(output_path: Path) -> None:
    canonical = (PRISMA_DIR / "schema.prisma").read_text(encoding="utf-8-sig")
    sqlite = canonical.replace('provider = "postgresql"', 'provider = "sqlite"')
    sqlite = sqlite.replace(
        'url      = env("DATABASE_URL")', 'url      = "file:./dev.db"'
    )
    sqlite = re.sub(r"(?m)^\s*output\s*=.*$\n?", "", sqlite)
    sqlite = sqlite.replace(
        'output   = "../generated"', f'output   = "{output_path.as_posix()}"'
    )
    DEV_SCHEMA.write_text(sqlite, encoding="utf-8")


def main() -> None:
    venv_scripts = Path(sys.executable).parent
    env = dict(os.environ)
    env["PATH"] = str(venv_scripts) + os.pathsep + env.get("PATH", "")

    workdir = Path(tempfile.mkdtemp(prefix="prisma_gen_"))
    try:
        _prepare_dev_schema(workdir / "gen")
        print(f"Prepared {DEV_SCHEMA}")

        print("Running prisma generate...")
        result = subprocess.run(
            [sys.executable, "-m", "prisma", "generate", "--schema", str(DEV_SCHEMA)],
            cwd=str(workdir),
            env=env,
        )
        if result.returncode != 0:
            sys.exit(result.returncode)

        src = workdir / "gen"
        if not (src / "client.py").exists():
            print("ERROR: generated client not produced.", file=sys.stderr)
            sys.exit(1)

        # 1) Keep a copy in the repo (reference / gitignore it).
        if OUTPUT_DIR.exists():
            shutil.rmtree(OUTPUT_DIR)
        shutil.copytree(src, OUTPUT_DIR)

        # 2) Make the client importable as `prisma` by installing it over the
        #    runtime package (standard prisma-client-py layout).
        runtime_prisma = Path(sys.executable).parent.parent / "Lib" / "site-packages" / "prisma"
        if runtime_prisma.exists():
            for item in src.iterdir():
                dest = runtime_prisma / item.name
                if dest.is_dir() and dest.exists():
                    shutil.rmtree(dest)
                if item.is_dir():
                    shutil.copytree(item, dest)
                else:
                    shutil.copy2(item, dest)
            print(f"Installed generated client over {runtime_prisma}")
        print(f"Prisma client ready at {OUTPUT_DIR}")
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    main()
