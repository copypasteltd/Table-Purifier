"""Verify the selected design archive; this is not a product/UI test.

Run from any directory with Python + Pillow already available on this host.
Only --report writes a result, under this project's docs/评审 directory.
No network, browser, virtualization, or image generation is used.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DESIGN_DIR = ROOT / "assets/design"
errors: list[str] = []
checks: list[dict] = []


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def check(name: str, condition: bool, detail: str = "") -> None:
    checks.append({"check": name, "result": "PASS" if condition else "FAIL", "detail": detail})
    if not condition:
        errors.append(f"{name}: {detail}")


def inside(path: Path) -> Path:
    resolved = path.resolve()
    if not resolved.is_relative_to(ROOT):
        raise ValueError(f"Path leaves project: {path}")
    return resolved


def luminance(value: str) -> float:
    rgb = [int(value[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in rgb]
    return sum(x * w for x, w in zip(linear, (0.2126, 0.7152, 0.0722)))


def contrast(a: str, b: str) -> float:
    dark, light = sorted((luminance(a), luminance(b)))
    return (light + 0.05) / (dark + 0.05)


class ReferenceLinks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.ids = set()
        self.images = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        for key in ("href", "src"):
            if a.get(key):
                self.links.append(a[key])
        if tag == "img":
            self.images.append(a)


def verify() -> dict:
    pointer_path = DESIGN_DIR / "active.json"
    pointer = read_json(pointer_path)
    check("selected_direction", pointer["selected_style"] == "B")
    check("design_identity", pointer["design_id"] == "P07-DS-B" and pointer["design_version"] == "1.0.0")
    manifest_path = inside(DESIGN_DIR / pointer["manifest"])
    check("manifest_sha256", sha256(manifest_path) == pointer["manifest_sha256"])
    manifest = read_json(manifest_path)
    base = manifest_path.parent
    entries = manifest["files"]
    paths = [x["project_path"] for x in entries]
    check("unique_inventory_paths", len(paths) == len(set(paths)))
    check("manifest_excludes_itself", manifest_path.relative_to(ROOT).as_posix() not in paths)
    for entry in entries:
        file = inside(ROOT / entry["project_path"])
        present = file.is_file()
        check(f"retained:{entry['project_path']}", present)
        if present:
            check(f"hash:{entry['project_path']}", sha256(file) == entry["sha256"] and file.stat().st_size == entry["bytes"])
            if file.suffix == ".json":
                read_json(file)

    tokens = read_json(base / "tokens.json")
    check("token_identity", tokens["design_id"] == manifest["design_id"] and tokens["version"] == manifest["design_version"])
    check("fixed_brand", tokens["color"]["brand"] == "#17745E")
    check("touch_minimum", min(tokens["control"]["touchMinHeight"], tokens["control"]["touchMinWidth"]) >= 48)
    check("light_theme_scope", tokens["appearance"]["dark"] == "UNSPECIFIED_NOT_IN_V1")
    css = (base / "tokens.css").read_text("utf-8")
    for key, value in tokens["color"].items():
        kebab = re.sub(r"[A-Z]", lambda m: "-" + m[0].lower(), key)
        check(f"css_color:{key}", f"--p07-color-{kebab}: {value};" in css)

    contrast_report = read_json(base / "specs/contrast-report.json")
    check("declared_color_pairs", len(contrast_report["pairs"]) == 18)
    for pair in contrast_report["pairs"]:
        fg, bg = pair["foreground"], pair["background"]
        ratio = contrast(tokens["color"][fg], tokens["color"][bg])
        expected_minimum = 3 if fg in {"controlBorder", "focus"} else 4.5
        check(f"contrast:{fg}/{bg}", pair["minimum"] == expected_minimum and ratio >= expected_minimum and abs(ratio - pair["ratio"]) < 0.0001 and pair["result"] == "PASS")

    components = read_json(base / "specs/components.json")["components"]
    pages = read_json(base / "specs/pages.json")["pages"]
    component_ids = {x["id"] for x in components}
    page_ids = {x["page_id"] for x in pages}
    check("32_components", len(components) == 32 and component_ids == {f"B-C{i:02}" for i in range(1, 33)})
    check("18_pages", len(pages) == 18 and page_ids == {f"MP{i:02}" for i in range(1, 19)})
    check("four_root_tabs", {x["page_id"] for x in pages if x["navigation_type"] == "root"} == {"MP01", "MP13", "MP14", "MP15"})
    check("three_rendered_references", {x["page_id"] for x in pages if x["rendered_reference"]} == {"MP01", "MP06", "MP10"})
    reqs = set(re.findall(r"P07-F\d{2}", (ROOT / "docs/02-功能需求与用户流程.md").read_text("utf-8")))
    check("42_business_requirements", reqs == {f"P07-F{i:02}" for i in range(1, 43)})
    linked = {r for page in pages for r in page["requirement_ids"]}
    p1 = {"P07-F21", "P07-F22", "P07-F28", "P07-F42"}
    check("38_P0_page_requirements", linked == reqs - p1)
    for page in pages:
        check(f"page_contract:{page['page_id']}", bool(page["primary_action"]) and bool(page["required_states"]) and bool(page["section_order"]) and set(page["component_ids"]) <= component_ids and set(page["requirement_ids"]) <= reqs)
        if page["rendered_reference"]:
            check(f"page_image:{page['page_id']}", inside(base / page["rendered_reference"]).is_file())
    for component in components:
        reverse = {x["page_id"] for x in pages if component["id"] in x["component_ids"]}
        check(f"component_contract:{component['id']}", set(component["page_ids"]) == reverse and bool(reverse) and bool(component["states"]) and component["status"] == "SPECIFIED_NOT_IMPLEMENTED")

    decision = read_json(base / "provenance/selection-decision.json")
    selected = base / "reference/B-selected-board.png"
    check("selected_board_identity", sha256(selected) == decision["selected_reference_sha256"])
    check("implementation_truth", decision["software_implementation"] == "NOT_IMPLEMENTED")
    source = inside(ROOT / decision["source_board"])
    if source.exists():
        check("selected_is_exact_retained_copy", sha256(source) == sha256(selected))
    with Image.open(selected) as board:
        check("board_dimensions", board.size == (1536, 1024))
        crops_path = base / "provenance/crop-map.json"
        crop_map = read_json(crops_path)
        for item in crop_map["crops"]:
            with Image.open(inside(crops_path.parent / item["file"])) as crop:
                expected = board.crop(item["box"]).convert("RGBA")
                actual = crop.convert("RGBA")
                check(f"exact_crop:{Path(item['file']).name}", actual.size == expected.size and actual.tobytes() == expected.tobytes())
    with Image.open(base / "reference/B-generated-original.png") as original:
        check("original_board_dimensions", original.size == (1536, 1024))

    link_count = 0
    for entry in entries:
        file = ROOT / entry["project_path"]
        if file.suffix == ".md":
            links = re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", file.read_text("utf-8"))
        elif file.suffix == ".html":
            parser = ReferenceLinks()
            parser.feed(file.read_text("utf-8"))
            links = parser.links
            check("reference_image_alt", all(x.get("alt") for x in parser.images))
        else:
            continue
        for link in links:
            link = link.strip().strip("<>")
            if re.match(r"[a-zA-Z][\w+.-]*:", link):
                check(f"no_remote_asset:{file.name}", file.suffix != ".html", link)
                continue
            path, _, fragment = link.partition("#")
            if not path:
                if file.suffix == ".html":
                    check(f"anchor:{fragment}", fragment in parser.ids)
                continue
            target = inside(file.parent / unquote(path))
            link_count += 1
            check(f"local_link:{file.name}:{link}", target.exists())

    return {
        "design_id": pointer["design_id"],
        "design_version": pointer["design_version"],
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "result": "PASS" if not errors else "FAIL",
        "scope": "Design archive integrity and static contracts only; no product/UI/platform test",
        "retained_files": len(entries),
        "components": len(components),
        "page_specifications": len(pages),
        "rendered_reference_pages": 3,
        "color_pairs": len(contrast_report["pairs"]),
        "local_links_checked": link_count,
        "checks_passed": sum(x["result"] == "PASS" for x in checks),
        "checks_failed": len(errors),
        "product_tests": "NOT_RUN",
        "errors": errors,
        "checks": checks,
    }


def main() -> int:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--report", action="store_true", help="Save artifact integrity report, outside frozen baseline")
    args = cli.parse_args()
    try:
        report = verify()
    except (KeyError, ValueError, OSError) as exc:
        print(json.dumps({"result": "FAIL", "error": str(exc)}, ensure_ascii=True))
        return 1
    if args.report:
        destination = ROOT / "docs/评审/B-青绿资料夹-定型核验-2026-10-27.json"
        destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "checks"}, ensure_ascii=True, indent=2))
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
