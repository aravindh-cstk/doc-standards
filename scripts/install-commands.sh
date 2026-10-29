#!/usr/bin/env bash
# Symlinks the repo's slash commands into ~/.claude/commands/.
#
# Why symlinks rather than copies: a repository-local .claude/commands/ is only
# discovered when Claude Code starts inside this repository, but these commands
# are used while working in a consuming docs repository. The symlink makes them
# reachable everywhere while this folder stays the git-tracked source of truth.
#
# Idempotent. Re-run after adding a command. Pass --dry-run to see what it would
# do, and --uninstall to remove the links it made.

set -euo pipefail

REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SRC="$REPO/.claude/commands"
DEST="${CLAUDE_COMMANDS_DIR:-$HOME/.claude/commands}"

DRY_RUN=0
UNINSTALL=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --uninstall) UNINSTALL=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

[ -d "$SRC" ] || { echo "No commands at $SRC" >&2; exit 2; }

run() {
  if [ "$DRY_RUN" -eq 1 ]; then echo "would: $*"; else "$@"; fi
}

mkdir -p "$DEST"

linked=0
skipped=0
backed_up=0
removed=0

for src in "$SRC"/*.md; do
  name=$(basename "$src")
  # README.md documents the folder. It is not a command.
  [ "$name" = "README.md" ] && continue
  target="$DEST/$name"

  if [ "$UNINSTALL" -eq 1 ]; then
    if [ -L "$target" ] && [ "$(readlink "$target")" = "$src" ]; then
      run rm "$target"
      removed=$((removed + 1))
    fi
    continue
  fi

  if [ -L "$target" ]; then
    if [ "$(readlink "$target")" = "$src" ]; then
      skipped=$((skipped + 1))
      continue
    fi
    run rm "$target"
  elif [ -e "$target" ]; then
    # A real file, so it predates this repo's copy. Keep it rather than
    # destroying an edit somebody made in place.
    backup="$target.pre-install.bak"
    if [ -e "$backup" ]; then
      echo "Refusing to overwrite the existing backup at $backup. Move it aside and re-run." >&2
      exit 1
    fi
    echo "Backing up $target to $backup"
    run mv "$target" "$backup"
    backed_up=$((backed_up + 1))
  fi

  run ln -s "$src" "$target"
  linked=$((linked + 1))
done

if [ "$UNINSTALL" -eq 1 ]; then
  echo "Removed $removed symlink(s) from $DEST"
  echo "Any .pre-install.bak file is still there. Restore it by hand if you want the old copy back."
  exit 0
fi

echo "Linked $linked, already current $skipped, backed up $backed_up, into $DEST"
echo "Run /doc-gate or any command from any repository now."
