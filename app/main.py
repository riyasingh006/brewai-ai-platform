"""Coffee Shop AI Agent - interactive Rich CLI chatbot.

Run with:

    python app/main.py

Menu questions are answered from real menu data (tools); everything else is
answered by Gemini with a friendly barista personality.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

# Allow running as a plain script:  python app/main.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Rich on Windows falls back to the legacy Win32 renderer for std streams,
# which encodes via the locale codec (e.g. cp1252) and cannot render the
# Unicode box characters used by tables/rules. Force UTF-8 to avoid crashes.
for _stream in (sys.stdout, sys.stderr):
    if getattr(_stream, "encoding", "").lower() not in ("utf-8", "utf8"):
        try:
            _stream.reconfigure(encoding="utf-8")
        except (AttributeError, OSError):
            pass

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.rule import Rule
from rich.table import Table

from app import tools
from app.agent import AgentError, CoffeeShopAgent

console = Console()

LOGO = r"""
        ((
         ))
       _|___|_
      |  o o  |
      |   ^   |
      | \___/ |
       \_____/
     __/_____\__
    (  COFFEE   )
    (    SHOP   )
     \_________/
"""

WELCOME = (
    "[bold green]Hello! I'm your friendly coffee shop barista.[/bold green]\n"
    "Ask me about the menu, prices, or recommendations - or just chat.\n"
    "[dim]Type [bold cyan]menu[/bold cyan] to see everything, "
    "[bold cyan]reset[/bold cyan] to start over, or "
    "[bold cyan]exit[/bold cyan] to leave.[/dim]"
)

CURRENCY = "$"


def print_logo() -> None:
    console.print(Panel(LOGO, border_style="bold yellow", box=box.ROUNDED))
    console.print(WELCOME)
    console.print(Rule(style="dim"))


def render_items(items: list[dict], title: str) -> None:
    """Render a list of menu items as a colored Rich table."""
    table = Table(
        title=title,
        title_style="bold cyan",
        box=box.SIMPLE_HEAVY,
        header_style="bold yellow",
        show_lines=False,
    )
    table.add_column("#", justify="right", style="dim")
    table.add_column("Item", style="bold white")
    table.add_column("Category", style="cyan")
    table.add_column("Price", justify="right", style="magenta")
    table.add_column("Description", style="dim")

    for item in items:
        name = item["name"]
        if not item["available"]:
            name = f"{name} [red][SOLD OUT][/red]"
        table.add_row(
            str(item["id"]),
            name,
            item["category"],
            f"{CURRENCY}{item['price']:.2f}",
            item["description"],
        )
    console.print(table)


def handle_menu_query(query: str) -> bool:
    """Try to answer a question from menu data. Returns True if handled."""
    try:
        routed = tools.menu_answer(query)
    except (tools.MenuError, ValueError) as exc:
        console.print(f"[bold red]Hmm, something went wrong:[/bold red] {exc}")
        return True

    if routed is None:
        return False

    title, items, prompt = routed
    if not items:
        console.print(
            f"[yellow]{title}:[/yellow] I couldn't find anything matching that. "
            "Try a different keyword or ask me for the full [cyan]menu[/cyan]."
        )
    else:
        render_items(items, title)
        if prompt:
            console.print(f"[bold yellow]{prompt}[/bold yellow]")
    return True


def handle_command(command: str, agent: CoffeeShopAgent) -> bool:
    """Handle a special CLI command. Returns True if it was a command."""
    if command in {"exit", "quit", "q", "bye"}:
        console.print("\n[yellow]Thanks for stopping by! Enjoy your coffee.[/yellow]")
        raise SystemExit(0)
    if command in {"reset", "clear"}:
        agent.reset()
        console.print("[dim]Conversation cleared. Fresh cup, coming right up![/dim]")
        return True
    if command == "menu":
        render_items(tools.get_full_menu(), "Full menu")
        return True
    if command in {"help", "?"}:
        console.print(
            "[cyan]Commands:[/cyan] [bold]menu[/bold] [dim]|[/dim] "
            "[bold]reset[/bold] [dim]|[/dim] [bold]exit[/bold]\n"
            "Try asking: \"What coffees do you have?\", \"Show burgers\", "
            "\"Tea under 5\", \"Recommend something\", "
            "\"What's good on a hot day?\", or just say \"good morning\"."
        )
        return True
    return False


def ask_barista(agent: CoffeeShopAgent, query: str) -> None:
    """Send a non-menu question to Gemini with a loading spinner."""
    with console.status("[bold yellow]Brewing your answer...[/bold yellow]", spinner="dots"):
        try:
            reply = agent.chat(query)
        except AgentError as exc:
            console.print(f"[bold red]Barista error:[/bold red] {exc}")
            return
    console.print(Panel(reply, title="[bold green]Barista[/bold green]", border_style="green"))


def main() -> int:
    logging.getLogger().setLevel(logging.WARNING)

    print_logo()

    try:
        agent = CoffeeShopAgent()
    except AgentError as exc:
        console.print(f"[bold red]Startup failed:[/bold red] {exc}")
        return 1

    while True:
        try:
            query = Prompt.ask("\n[bold cyan]You[/bold cyan]", default="")
        except (KeyboardInterrupt, EOFError):
            console.print("\n[yellow]Bye! Enjoy your coffee![/yellow]")
            return 0

        text = query.strip()
        if not text:
            continue

        if handle_command(text.lower(), agent):
            continue

        if not handle_menu_query(text):
            ask_barista(agent, text)


if __name__ == "__main__":
    raise SystemExit(main())
