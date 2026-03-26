#!/bin/bash
# Install Lightsee skill for Claude Code
mkdir -p ~/.claude/skills/lightsee
cp "$(dirname "$0")/.claude/skills/lightsee/SKILL.md" ~/.claude/skills/lightsee/SKILL.md
echo "Lightsee skill installed. Use /lightsee <file.md> in Claude Code."
