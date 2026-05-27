#!/usr/bin/env bash
# Script di rilascio per Daggerheart ITA
#
# Uso:
#   ./tools/release.sh <nuova-versione>
# Esempi:
#   ./tools/release.sh 0.1.4
#   ./tools/release.sh 0.2.0
#
# Cosa fa:
#   1. Verifica che il working tree sia pulito
#   2. Aggiorna la versione in system.json
#   3. Crea un commit "release: vX.Y.Z"
#   4. Crea un tag "vX.Y.Z"
#   5. Pusha tutto (commit + tag) su origin
#   6. GitHub Actions creerà automaticamente la release con system.zip
#
# Pre-requisiti:
#   - git remote "origin" puntante al repo
#   - jq installato (apt install jq)
#   - permessi di push sul branch principale

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Uso: $0 <nuova-versione>"
  echo "Esempio: $0 0.1.4"
  exit 1
fi

NEW_VERSION="$1"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Validazione formato versione (semver semplice)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERRORE: la versione deve essere in formato X.Y.Z (es. 0.1.4)"
  exit 1
fi

# Verifica che siamo in un repo git
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERRORE: questa cartella non è un repository git."
  exit 1
fi

# Verifica working tree pulito
if [ -n "$(git status --porcelain)" ]; then
  echo "ERRORE: il working tree non è pulito. Committa o stasha le modifiche prima."
  git status --short
  exit 1
fi

# Verifica che jq sia installato
if ! command -v jq >/dev/null 2>&1; then
  echo "ERRORE: jq non installato. Su Ubuntu/Debian: sudo apt install jq"
  exit 1
fi

# Versione corrente
CURRENT_VERSION=$(jq -r '.version' system.json)
echo "Versione corrente: $CURRENT_VERSION"
echo "Nuova versione:    $NEW_VERSION"

if [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
  echo "ERRORE: la nuova versione è uguale a quella corrente."
  exit 1
fi

# Verifica che il tag non esista già
if git rev-parse "v$NEW_VERSION" >/dev/null 2>&1; then
  echo "ERRORE: il tag v$NEW_VERSION esiste già."
  exit 1
fi

read -p "Procedere con il rilascio v$NEW_VERSION? (y/N) " -n 1 -r REPLY
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Annullato."
  exit 0
fi

# Aggiorna system.json
echo "Aggiorno system.json…"
TMP=$(mktemp)
jq ".version = \"$NEW_VERSION\"" system.json > "$TMP"
mv "$TMP" system.json

# Commit + tag + push
echo "Commit, tag e push…"
git add system.json
git commit -m "release: v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Daggerheart ITA v$NEW_VERSION"
git push origin HEAD
git push origin "v$NEW_VERSION"

echo ""
echo "✅ Rilascio avviato per v$NEW_VERSION"
echo "   GitHub Actions sta creando la release."
echo "   Controlla: https://github.com/Vaanguard1990/daggerheart-ita/actions"
echo ""
echo "   Quando l'Action ha terminato, Foundry mostrerà automaticamente"
echo "   l'aggiornamento disponibile nella schermata di setup."
