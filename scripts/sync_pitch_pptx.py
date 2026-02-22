#!/usr/bin/env python3
"""Sync pitch deck text from JSON into a 7-slide PPTX.

This script intentionally uses only Python standard library to avoid
external dependency installation in constrained environments.
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
import zipfile
from pathlib import Path
from typing import Dict, List
from xml.etree import ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}


def _flatten_values(value) -> List[str]:
    lines: List[str] = []
    if value is None:
        return lines
    if isinstance(value, str):
        text = value.strip()
        if text:
            lines.append(text)
        return lines
    if isinstance(value, list):
        for item in value:
            lines.extend(_flatten_values(item))
        return lines
    if isinstance(value, dict):
        for key in (
            "headline",
            "section_title",
            "bullets",
            "chart_items",
            "nodes",
            "series",
            "layers",
            "timeline_steps",
            "footer_tags",
        ):
            if key in value:
                lines.extend(_flatten_values(value.get(key)))
        return lines
    text = str(value).strip()
    if text:
        lines.append(text)
    return lines


def _slide_to_lines(slide: Dict) -> List[str]:
    lines: List[str] = []
    lines.extend(_flatten_values(slide.get("title")))
    lines.extend(_flatten_values(slide.get("left_column")))
    lines.extend(_flatten_values(slide.get("right_column")))
    lines.extend(_flatten_values(slide.get("timeline_steps")))

    table = slide.get("table")
    if isinstance(table, dict):
        lines.extend(_flatten_values(table.get("columns")))
        lines.extend(_flatten_values(table.get("rows")))

    # Keep speaker note out of slides by default.
    return lines


def _load_slide_lines(src_json: Path) -> Dict[int, List[str]]:
    payload = json.loads(src_json.read_text(encoding="utf-8"))
    slides = payload.get("slides")
    if not isinstance(slides, list):
        raise ValueError("Invalid JSON schema: slides must be a list")

    lines_by_id: Dict[int, List[str]] = {}
    for slide in slides:
        slide_id = slide.get("id")
        if not isinstance(slide_id, int):
            raise ValueError(f"Invalid slide id: {slide_id!r}")
        lines = _slide_to_lines(slide)
        if not lines:
            raise ValueError(f"Slide {slide_id} has no textual content to sync")
        lines_by_id[slide_id] = lines
    return lines_by_id


def _replace_slide_text(xml_bytes: bytes, new_lines: List[str], slide_id: int) -> bytes:
    root = ET.fromstring(xml_bytes)
    text_nodes = list(root.findall(".//a:t", NS))
    if not text_nodes:
        raise RuntimeError(f"Slide {slide_id}: no text nodes found")

    if len(new_lines) > len(text_nodes):
        # Merge multiple source lines into available text nodes for templates that
        # have fewer editable placeholders than our semantic lines.
        if len(text_nodes) == 1:
            mapped_lines = [" | ".join(new_lines)]
        else:
            mapped_lines: List[str] = [new_lines[0]]
            remaining = new_lines[1:]
            slots = len(text_nodes) - 1
            base = len(remaining) // slots
            extra = len(remaining) % slots
            idx = 0
            for slot in range(slots):
                take = base + (1 if slot < extra else 0)
                chunk = remaining[idx : idx + take]
                idx += take
                mapped_lines.append(" • ".join(chunk))
        new_lines = mapped_lines

    for idx, node in enumerate(text_nodes):
        node.text = new_lines[idx] if idx < len(new_lines) else ""
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def sync_pptx(src_json: Path, pptx_path: Path) -> None:
    if not src_json.exists():
        raise FileNotFoundError(f"Source JSON not found: {src_json}")
    if not pptx_path.exists():
        raise FileNotFoundError(f"PPTX not found: {pptx_path}")

    lines_by_id = _load_slide_lines(src_json)
    for must_have in (1, 2, 3, 4, 5, 6, 7):
        if must_have not in lines_by_id:
            raise ValueError(f"Missing required slide id: {must_have}")

    updated_counts: Dict[int, int] = {}
    extracted_after: Dict[int, str] = {}

    tmp_dir = pptx_path.parent
    with tempfile.NamedTemporaryFile(
        suffix=".pptx", prefix="sync_pitch_", dir=tmp_dir, delete=False
    ) as tmp_file:
        tmp_name = tmp_file.name

    try:
        with zipfile.ZipFile(pptx_path, "r") as zin, zipfile.ZipFile(
            tmp_name, "w", compression=zipfile.ZIP_DEFLATED
        ) as zout:
            for info in zin.infolist():
                data = zin.read(info.filename)
                if info.filename.startswith("ppt/slides/slide") and info.filename.endswith(".xml"):
                    basename = Path(info.filename).name
                    if basename.startswith("slide") and basename.endswith(".xml"):
                        slide_num = int(basename[len("slide") : -len(".xml")])
                        if slide_num in lines_by_id:
                            new_lines = lines_by_id[slide_num]
                            data = _replace_slide_text(data, new_lines, slide_num)
                            updated_counts[slide_num] = len(new_lines)
                            extracted_after[slide_num] = "\n".join(new_lines)
                zout.writestr(info, data)

        os.replace(tmp_name, pptx_path)
    finally:
        if os.path.exists(tmp_name):
            os.remove(tmp_name)

    required_markers = [
        ("energy oracle layer",),
        ("ai load",),
        ("m2m",),
        ("c-chain", "l1"),
    ]
    full_text = "\n".join(extracted_after.get(i, "") for i in sorted(extracted_after.keys())).lower()
    missing = [
        " + ".join(group)
        for group in required_markers
        if not all(marker in full_text for marker in group)
    ]
    if missing:
        raise RuntimeError(f"PPT sync finished but required markers missing: {', '.join(missing)}")

    print("[sync] updated slides:")
    for slide_id in sorted(updated_counts):
        print(f"  - slide {slide_id}: {updated_counts[slide_id]} text nodes")
    print(f"[sync] wrote: {pptx_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync pitch pptx text from JSON")
    parser.add_argument("--src", required=True, help="Path to source JSON (e.g. guide/ppt/english.json)")
    parser.add_argument("--pptx", required=True, help="Path to target PPTX file")
    args = parser.parse_args()

    sync_pptx(Path(args.src), Path(args.pptx))


if __name__ == "__main__":
    main()
