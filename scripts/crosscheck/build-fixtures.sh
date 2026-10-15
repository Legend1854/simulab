#!/usr/bin/env bash
# Rebuilds the cross-check fixtures in tests/fixtures/crosscheck/ using two independent spreadsheet tools:
#   - openpyxl (Python) writes a workbook full of awkward cell types;
#   - LibreOffice re-saves that workbook and SimuLab's template in its own .xlsx style
#     (shared strings, its own styles, recalculated formula results).
# The tests read the committed files, so this script is only needed to regenerate them.
# Requires: python3 with openpyxl, LibreOffice (soffice) on PATH. Run from the repository root.
set -euo pipefail
out="tests/fixtures/crosscheck"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$out"

python3 scripts/crosscheck/make_edge_cells.py "$out/edge-cells-openpyxl.xlsx"
cp samples/SimuLab_Template.xlsx "$work/template.xlsx"
cp "$out/edge-cells-openpyxl.xlsx" "$work/edge-cells.xlsx"
for name in template edge-cells; do
  soffice -env:UserInstallation="file://$work/profile" --headless \
    --convert-to 'xlsx:Calc MS Excel 2007 XML' --outdir "$work/out" "$work/$name.xlsx" >/dev/null
done
cp "$work/out/template.xlsx" "$out/template-resaved-by-libreoffice.xlsx"
cp "$work/out/edge-cells.xlsx" "$out/edge-cells-resaved-by-libreoffice.xlsx"
ls -l "$out"
