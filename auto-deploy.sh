#!/bin/bash
# Auto-commit y push cuando hay cambios en el proyecto
# Uso: ./auto-deploy.sh

echo "🚀 Auto-deploy activo. Vigilando cambios..."
echo "   Presiona Ctrl+C para detener."
echo ""

while true; do
  # Verificar si hay cambios sin commitear
  if ! git -C "$(dirname "$0")" diff --quiet || ! git -C "$(dirname "$0")" diff --cached --quiet || [ -n "$(git -C "$(dirname "$0")" ls-files --others --exclude-standard)" ]; then
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    echo "[$TIMESTAMP] Cambios detectados. Subiendo..."

    cd "$(dirname "$0")"
    git add -A
    git commit -m "auto: cambios guardados $TIMESTAMP"
    git push origin main

    echo "[$TIMESTAMP] ✅ Push completado. Vercel desplegando..."
    echo ""
  fi
  sleep 5
done
