from pathlib import Path
import re

import fitz


class ReportParsingError(ValueError):
    pass


def extract_text_from_pdf(path: Path) -> str:
    try:
        with fitz.open(path) as document:
            pages = []
            for page_number, page in enumerate(document, start=1):
                plain_text = page.get_text("text")
                layout_text = _extract_layout_lines(page)
                page_text = "\n".join(
                    part.strip()
                    for part in [
                        f"--- Page {page_number} plain text ---",
                        plain_text,
                        f"--- Page {page_number} layout rows ---",
                        layout_text,
                    ]
                    if part and part.strip()
                )
                pages.append(page_text)
    except Exception as exc:
        raise ReportParsingError("PDF text could not be extracted.") from exc

    text = _clean_text("\n".join(page.strip() for page in pages if page.strip()))
    if not text:
        raise ReportParsingError("PDF text could not be extracted.")
    return text


def _extract_layout_lines(page: fitz.Page) -> str:
    words = page.get_text("words")
    if not words:
        return ""

    rows: list[list[tuple[float, str]]] = []
    for word in sorted(words, key=lambda item: (round(item[1] / 4) * 4, item[0])):
        x0, y0, *_rest, text, _block, _line, _word = word
        if not rows or abs(rows[-1][0][0] - y0) > 4:
            rows.append([(y0, x0, text)])
        else:
            rows[-1].append((y0, x0, text))

    lines = []
    for row in rows:
        sorted_row = sorted(row, key=lambda item: item[1])
        line_parts = []
        previous_x = None
        for _y, x, text in sorted_row:
            if previous_x is not None and x - previous_x > 34:
                line_parts.append(" | ")
            line_parts.append(text)
            previous_x = x + max(len(text) * 4, 12)
        lines.append(" ".join(line_parts).replace(" |  ", "| "))
    return "\n".join(lines)


def _clean_text(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
