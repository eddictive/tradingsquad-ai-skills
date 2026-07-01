"""Shared CLI helpers for skill API scripts."""


def wants_help(argv):
    return "--help" in argv or "-h" in argv


def print_help(script_name, description, commands):
    print(script_name)
    if description:
        print(f"{description}\n")
    print("Usage:")
    for cmd in commands:
        aliases = f" (aliases: {', '.join(cmd['aliases'])})" if cmd.get("aliases") else ""
        print(f"  {cmd['usage']}{aliases}")
        if cmd.get("detail"):
            print(f"    {cmd['detail']}")
    print("\nOptions:")
    print("  --help, -h    Show this help")