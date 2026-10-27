"""P07 deterministic reading tool, not a business cleaning pipeline.

The trusted Host calls this tool on a server-authorized, immutable source. It
returns every bounded physical unit. The Agent decides how to interpret it.
Never execute formulas/macros, external relationships, embedded objects or code.
"""
import csv
import base64
import hashlib
import io
import json
import os
import pathlib
import re
import sys
import warnings
import zipfile
import xml.etree.ElementTree as ET

MAX_BYTES = 20_000_000
MAX_TEXT = 1_500_000
MAX_UNITS = 50
MAX_ROWS = 100_000
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


class ToolError(Exception):
    pass


def decode(data):
    # Never silently replace bytes. An uncertain legacy encoding is reported.
    for encoding in ("utf-8-sig", "utf-16" if data[:2] in (b"\xff\xfe", b"\xfe\xff") else "utf-8", "gb18030"):
        try:
            return data.decode(encoding), [] if encoding.startswith("utf") else ["LEGACY_ENCODING_GB18030"]
        except UnicodeError:
            pass
    raise ToolError("TEXT_ENCODING_UNREADABLE")


def xml(data):
    if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
        raise ToolError("XML_ENTITY_FORBIDDEN")
    return ET.fromstring(data)


def archive(data):
    package = zipfile.ZipFile(io.BytesIO(data))
    entries = package.infolist()
    if len(entries) > 2000 or len({e.filename for e in entries}) != len(entries):
        raise ToolError("ARCHIVE_ENTRY_LIMIT")
    size = 0
    for entry in entries:
        path = pathlib.PurePosixPath(entry.filename)
        size += entry.file_size
        if (path.is_absolute() or ".." in path.parts or "\\" in entry.filename
                or entry.flag_bits & 1 or entry.file_size > 25_000_000 or size > 80_000_000
                or entry.file_size > max(1, entry.compress_size) * 200):
            raise ToolError("ARCHIVE_UNSAFE_OR_EXPANSION_LIMIT")
        if (entry.external_attr >> 16) & 0o170000 == 0o120000:
            raise ToolError("ARCHIVE_LINK_FORBIDDEN")
    return package


def unit(text, kind, ordinal, path=None, span=None, limitations=None, confidence=None):
    if len(text) > MAX_TEXT:
        raise ToolError("SOURCE_TEXT_LIMIT")
    return {"ordinal": ordinal, "kind": kind,
            "locator": {"version": "P07-LOCATOR-1", "kind": kind,
                        "page_or_ordinal": ordinal, "span": span, "bbox": None, "path": path},
            "text": text, "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            "readability": "READABLE" if text.strip() else "UNREADABLE",
            "confidence": confidence, "limitations": limitations or ([] if text.strip() else ["NO_EXTRACTABLE_TEXT"])}


def chunks(text, kind="TEXT_SPAN", path=None, limitations=None):
    result = []
    # Fixed physical blocks for complete-scope metering; no semantic inference.
    for start in range(0, max(1, len(text)), 4000):
        result.append(unit(text[start:start + 4000], kind, len(result), path,
                           [start, min(start + 4000, len(text))], limitations))
    return result


def csv_units(text, limitations):
    try:
        dialect = csv.Sniffer().sniff(text[:8192], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    rows, result, ordinal = [], [], 0
    for row in reader:
        if ordinal >= MAX_ROWS or len(row) > 500:
            raise ToolError("SHEET_DIMENSION_LIMIT")
        ordinal += 1
        rows.append(json.dumps({"row": ordinal, "cells": row}, ensure_ascii=False))
        if len(rows) == 100:
            result.append(unit("\n".join(rows), "CSV_CELL", len(result),
                               f"rows/{ordinal - 99}-{ordinal}", limitations=limitations))
            rows = []
    if rows or not result:
        result.append(unit("\n".join(rows), "CSV_CELL", len(result),
                           f"rows/{max(1, ordinal - len(rows) + 1)}-{ordinal}", limitations=limitations))
    return result


def docx_units(data):
    with archive(data) as package:
        names = package.namelist()
        if "word/document.xml" not in names:
            raise ToolError("INVALID_DOCX")
        result = []
        # Include headers/footers/footnotes/comments as physical text, not only body.
        members = ["word/document.xml"] + sorted(n for n in names if re.fullmatch(
            r"word/(?:header\d+|footer\d+|footnotes|endnotes|comments)\.xml", n))
        limitations = ["EMBEDDED_OBJECTS_AND_DRAWING_TEXT_REQUIRE_REVIEW"]
        for name in members:
            root = xml(package.read(name))
            text = "\n".join("".join(p.itertext()) for p in root.findall(".//w:p", NS))
            for entry in chunks(text, "DOCX_PATH", name, limitations):
                entry["ordinal"] = len(result)
                entry["locator"]["page_or_ordinal"] = len(result)
                result.append(entry)
        return result


def xlsx_units(data):
    with archive(data) as package:
        root = xml(package.read("xl/workbook.xml"))
        rels = xml(package.read("xl/_rels/workbook.xml.rels"))
        targets = {}
        for rel in rels:
            if rel.attrib.get("TargetMode") == "External":
                continue
            target = rel.attrib.get("Target", "")
            if ".." in pathlib.PurePosixPath(target).parts:
                raise ToolError("OFFICE_RELATIONSHIP_INVALID")
            targets[rel.attrib.get("Id")] = target.lstrip("/") if target.startswith("/") else "xl/" + target
        shared = []
        if "xl/sharedStrings.xml" in package.namelist():
            shared = ["".join(si.itertext()) for si in xml(package.read("xl/sharedStrings.xml"))]
        result = []
        limitations = ["CELL_VALUES_ARE_RAW_XML_NOT_DISPLAY_FORMAT", "FORMULAS_ARE_NOT_EXECUTED"]
        if any(n.endswith("vbaProject.bin") for n in package.namelist()):
            limitations.append("MACROS_NOT_EXECUTED")
        for sheet in root.findall("s:sheets/s:sheet", NS):
            member = targets.get(sheet.attrib.get("{" + NS["r"] + "}id"))
            if not member or member not in package.namelist():
                raise ToolError("OFFICE_RELATIONSHIP_INVALID")
            page = xml(package.read(member))
            rows, count = [], 0
            protocol_rows = []
            for row in page.findall("s:sheetData/s:row", NS):
                count += 1
                cells = row.findall("s:c", NS)
                if count > MAX_ROWS or len(cells) > 500:
                    raise ToolError("SHEET_DIMENSION_LIMIT")
                values = []
                for cell in cells:
                    raw = cell.findtext("s:v", default="", namespaces=NS)
                    if cell.attrib.get("t") == "s":
                        index = int(raw)
                        if not 0 <= index < len(shared):
                            raise ToolError("INVALID_SHARED_STRING")
                        raw = shared[index]
                    elif cell.attrib.get("t") == "inlineStr":
                        raw = "".join(cell.find("s:is", NS).itertext())
                    formula = cell.findtext("s:f", namespaces=NS)
                    values.append({"cell": cell.attrib.get("r", ""), "raw": raw,
                                   "type": cell.attrib.get("t", "n"), "style": cell.attrib.get("s"), "formula": formula})
                rows.append(json.dumps({"sheet": sheet.attrib.get("name"), "row": row.attrib.get("r"),
                                        "hidden": row.attrib.get("hidden", "0"), "cells": values}, ensure_ascii=False))
                if sheet.attrib.get("name") == "__P07_SCHEMA__" and count > 1:
                    protocol_rows.append([value["raw"] for value in values])
                if len(rows) == 100:
                    result.append(unit("\n".join(rows), "SHEET_CELL", len(result),
                                       member + f"/rows/{count - 99}-{count}", limitations=limitations))
                    rows = []
            if rows or count == 0:
                result.append(unit("\n".join(rows), "SHEET_CELL", len(result),
                                   member + f"/rows/{max(1, count - len(rows) + 1)}-{count}", limitations=limitations))
            if sheet.attrib.get("name") == "__P07_SCHEMA__":
                try:
                    if not protocol_rows or any(len(r) != 4 or r[0] != "P07-SCHEMA-XLSX-1" or int(r[2]) != i for i, r in enumerate(protocol_rows)):
                        raise ValueError("Invalid schema chunks")
                    decoded = base64.b64decode("".join(r[3] for r in protocol_rows), validate=True)
                    if len(decoded) > 1_000_000 or any(hashlib.sha256(decoded).hexdigest() != r[1] for r in protocol_rows):
                        raise ValueError("Invalid schema hash")
                    definition = json.loads(decoded.decode("utf-8"))
                    if not isinstance(definition, dict) or not isinstance(definition.get("fields"), list):
                        raise ValueError("Invalid schema object")
                    result.append(unit(json.dumps({"protocol": "P07-SCHEMA-XLSX-1", "schema": definition}, ensure_ascii=False),
                                       "SHEET_CELL", len(result), member + "/p07-schema", limitations=["SCHEMA_REQUIRES_HOST_VALIDATION"]))
                except (ValueError, TypeError, KeyError, UnicodeDecodeError):
                    raise ToolError("INVALID_P07_SCHEMA_PROTOCOL")
        return result


def pdf_units(data):
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data), strict=True)
    if reader.is_encrypted:
        raise ToolError("PASSWORD_PROTECTED_DOCUMENT")
    if len(reader.pages) > MAX_UNITS:
        raise ToolError("PROCESSING_UNIT_LIMIT")
    result = []
    for i, page in enumerate(reader.pages):
        # Bound decompression before text interpretation.
        contents = page.get_contents()
        if contents is not None and len(contents.get_data()) > 20_000_000:
            raise ToolError("PDF_PAGE_EXPANSION_LIMIT")
        result.append(unit(page.extract_text() or "", "PDF_PAGE", i, f"pages/{i + 1}",
                           limitations=["SCANNED_OR_DRAWING_CONTENT_MAY_REQUIRE_OCR"]))
    return result


def image_units(data, path):
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = 30_000_000
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(data)) as picture:
            picture.verify()
        with Image.open(io.BytesIO(data)) as picture:
            if getattr(picture, "n_frames", 1) != 1:
                raise ToolError("MULTIFRAME_IMAGE_UNSUPPORTED")
    # OCR is a separate, explicit tool. Never fabricate recognition here.
    return [unit("", "IMAGE_BBOX", 0, "image", limitations=["OCR_REQUIRED"])]


def read_document(path, media):
    info = path.stat()
    if not path.is_file() or path.is_symlink() or info.st_size > MAX_BYTES:
        raise ToolError("SOURCE_FILE_INVALID")
    data = path.read_bytes()
    if len(data) > MAX_BYTES:
        raise ToolError("SOURCE_SIZE_LIMIT")
    if data.startswith(b"%PDF-"):
        units = pdf_units(data)
    elif data.startswith(b"PK\x03\x04"):
        with archive(data) as package:
            names = package.namelist()
        if "xl/workbook.xml" in names:
            units = xlsx_units(data)
        elif "word/document.xml" in names:
            units = docx_units(data)
        else:
            raise ToolError("UNSUPPORTED_ARCHIVE")
    elif media.startswith("image/"):
        units = image_units(data, path)
    elif media.startswith("text/") or media in ("application/json", "application/x-ndjson"):
        text, limitations = decode(data)
        units = csv_units(text, limitations) if media in ("text/csv", "text/tab-separated-values") else chunks(text, limitations=limitations)
    else:
        raise ToolError("UNSUPPORTED_MEDIA_TYPE")
    if not units:
        raise ToolError("EMPTY_DOCUMENT")
    if len(units) > MAX_UNITS or sum(len(u["text"]) for u in units) > MAX_TEXT:
        raise ToolError("PROCESSING_UNIT_LIMIT")
    return {"protocol": "P07-READ-1", "source_sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "units": units}


if __name__ == "__main__":
    # Input comes from Host, never a path chosen by an unauthenticated MCP caller.
    try:
        request = json.loads(sys.stdin.buffer.read(8193))
        path = pathlib.Path(request["path"])
        result = read_document(path, request["media_type"])
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    except ToolError as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(2)
    except Exception:
        # Parser/library exceptions can contain source text and local filenames.
        print(json.dumps({"error": "DOCUMENT_READ_FAILED"}))
        sys.exit(2)
