from __future__ import annotations

import io
import os
from datetime import date
from typing import Sequence

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from weasyprint import HTML

FONT_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts", "KantumruyPro-Variable.ttf")

# ── XLSX Renderer ──────────────────────────────────────────────

THIN_BORDER = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)
HEADER_FILL = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
HEADER_FONT = Font(name="Kantumruy Pro", bold=True, color="FFFFFF", size=10)
BODY_FONT = Font(name="Kantumruy Pro", size=10)
TOTAL_FILL = PatternFill(start_color="D9E2F3", end_color="D9E2F3", fill_type="solid")


def render_xlsx(columns: list[tuple[str, int]], rows: Sequence[dict]) -> bytes:
    """Render rows to XLSX. columns = [(header_text, width_chars), ...]"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Report"

    for col_idx, (header, width) in enumerate(columns, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    for row_idx, row_data in enumerate(rows, 2):
        for col_idx, (header, _) in enumerate(columns, 1):
            val = row_data.get(header)
            if val is None:
                val = ""
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = BODY_FONT
            cell.border = THIN_BORDER
            cell.alignment = Alignment(vertical="center", wrap_text=True)

        is_total = row_data.get("no") is None
        if is_total:
            for col_idx in range(1, len(columns) + 1):
                ws.cell(row=row_idx, column=col_idx).fill = TOTAL_FILL
                ws.cell(row=row_idx, column=col_idx).font = Font(
                    name="Kantumruy Pro", bold=True, size=10
                )

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


# ── PDF Renderer ──────────────────────────────────────────────

_KHMER_NUMS = str.maketrans("0123456789", "\u17E0\u17E1\u17E2\u17E3\u17E4\u17E5\u17E6\u17E7\u17E8\u17E9")


def _kh_num(val: int | str | None) -> str:
    if val is None:
        return ""
    return str(val).translate(_KHMER_NUMS)


PDF_HTML_TPL = """\
<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="utf-8">
<style>
@page {{
  size: A4 landscape;
  margin: 15mm;
}}
@font-face {{
  font-family: "Kantumruy Pro";
  src: url("file:///{font_path}");
}}
body {{
  font-family: "Kantumruy Pro", "Noto Sans Khmer", sans-serif;
  font-size: 9pt;
  color: #222;
}}
h1 {{
  font-size: 14pt;
  margin-bottom: 4pt;
}}
h2 {{
  font-size: 10pt;
  color: #555;
  margin-top: 0;
  margin-bottom: 12pt;
}}
table {{
  width: 100%;
  border-collapse: collapse;
}}
th {{
  background-color: #4472C4;
  color: #fff;
  padding: 5pt 4pt;
  text-align: center;
  font-size: 8pt;
  font-weight: bold;
}}
td {{
  padding: 4pt;
  border: 0.5pt solid #999;
  font-size: 8pt;
  vertical-align: top;
}}
tr.total td {{
  font-weight: bold;
  background-color: #D9E2F3;
}}
tr:nth-child(even) td {{
  background-color: #f8f8f8;
}}
tr.total:nth-child(even) td {{
  background-color: #D9E2F3;
}}
.text-right {{ text-align: right; }}
.text-center {{ text-align: center; }}
</style>
</head>
<body>
<h1>{title}</h1>
<h2>{subtitle}</h2>
<table>
<thead><tr>{headers}</tr></thead>
<tbody>{rows}</tbody>
</table>
</body>
</html>"""


def _pdf_cell(value, cls=""):
    v = value if value is not None else ""
    return f'<td class="{cls}">{v}</td>'


def render_pdf(
    title: str,
    subtitle: str,
    columns: list[str],
    rows: Sequence[dict],
    col_keys: list[str],
    numeric_indices: set[int] | None = None,
) -> bytes:
    """Render rows to PDF via WeasyPrint.

    columns: display header strings
    col_keys: keys to pull from each row dict
    numeric_indices: set of column indexes whose values should use Khmer numerals
    """
    if numeric_indices is None:
        numeric_indices = set()

    header_cells = "".join(f"<th>{c}</th>" for c in columns)

    body_rows = []
    for row_idx, row_data in enumerate(rows):
        is_total = row_data.get("no") is None
        cells = []
        for col_idx, key in enumerate(col_keys):
            val = row_data.get(key, "")
            cls = "text-right" if col_idx in numeric_indices else ""
            if col_idx in numeric_indices and isinstance(val, (int, float)):
                val = _kh_num(int(val))
            elif val is None:
                val = ""
            cells.append(_pdf_cell(val, cls))
        tr_cls = ' class="total"' if is_total else ""
        body_rows.append(f"<tr{tr_cls}>{''.join(cells)}</tr>")

    html = PDF_HTML_TPL.format(
        font_path=FONT_PATH,
        title=title,
        subtitle=subtitle,
        headers=header_cells,
        rows="\n".join(body_rows),
    )
    buf = io.BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)
    return buf.read()
