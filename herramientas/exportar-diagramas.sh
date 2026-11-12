#!/usr/bin/env bash
# Exporta todos los diagramas .drawio del proyecto a PNG y SVG en un comando.
#
# drawio-desktop es una app Electron: no exporta sin un servidor gráfico. Por
# eso el script arranca un X virtual con xvfb-run. Medido el 2026-11-12:
# rc=0, PNG 1569x844, ~92 KB para documentacion/Modelo_ER.drawio.
#
# Uso:
#   bash herramientas/exportar-diagramas.sh            # exporta todo
#   bash herramientas/exportar-diagramas.sh --check    # solo verifica que existan las herramientas
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

faltan=0
for cmd in drawio xvfb-run; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Falta $cmd. Instalalo con: sudo pacman -S drawio-desktop xorg-server-xvfb" >&2
    faltan=1
  fi
done
if [ "$faltan" -ne 0 ]; then
  exit 1
fi

if [ "${1:-}" = "--check" ]; then
  echo "drawio: $(command -v drawio) · xvfb-run: $(command -v xvfb-run)"
  exit 0
fi

# Diagramas a exportar. El ER se exporta además con el nombre que usa la
# entrega ("Proyecto-informatico-1-Entidad-Relacion.png"), para no romper los
# documentos que ya lo referencian así.
diagramas=(
  "documentacion/Modelo_ER.drawio"
  "documentacion/Kanban.drawio"
  "casos_de_uso/Casos de Uso.drawio"
)

exportar() {
  local fuente="$1" formato="$2" salida="$3"
  [ -f "$fuente" ] || { echo "  salteado (no existe): $fuente"; return 0; }
  # --no-sandbox: corre como usuario normal en un contenedor X efímero.
  # --scale 2: el doble de resolución, legible al imprimir.
  if timeout 120 xvfb-run -a drawio --no-sandbox --export \
      --format "$formato" --scale 2 --output "$salida" "$fuente" >/dev/null 2>&1; then
    printf '  ok  %-52s %8s B\n' "$salida" "$(stat -c%s "$salida")"
  else
    echo "  FALLA $fuente -> $salida" >&2
    return 1
  fi
}

fallas=0
for d in "${diagramas[@]}"; do
  base="${d%.drawio}"
  [ -f "$d" ] || { echo "sin diagrama: $d"; continue; }
  echo "exportando $d"
  exportar "$d" png "${base}.png" || fallas=$((fallas + 1))
  exportar "$d" svg "${base}.svg" || fallas=$((fallas + 1))
done

# Alias del ER con el nombre histórico de la entrega.
if [ -f "documentacion/Modelo_ER.drawio" ]; then
  echo "exportando alias de entrega del ER"
  exportar "documentacion/Modelo_ER.drawio" png \
    "documentacion/Proyecto-informatico-1-Entidad-Relacion.png" || fallas=$((fallas + 1))
fi

if [ "$fallas" -ne 0 ]; then
  echo "Terminó con $fallas exportación(es) fallida(s)." >&2
  exit 1
fi
echo "Listo: todos los diagramas exportados."
