"""Real tool fixtures: formats, encoding, physical scope and hostile archives."""
import importlib.util
import base64
import hashlib
import json
import io
import pathlib
import shutil
import sys
import unittest
import uuid
import zipfile
from pypdf import PdfWriter
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("reader", ROOT / "agent/tools/read_document.py")
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


class DocumentReaderTests(unittest.TestCase):
    def setUp(self):
        self.root = ROOT / "runtime/tests" / ("reader-" + str(uuid.uuid4()))
        self.root.mkdir(parents=True)

    def tearDown(self):
        shutil.rmtree(self.root)

    def read(self, content, mime):
        path = self.root / "input.bin"
        path.write_bytes(content)
        return reader.read_document(path, mime)

    def package(self, files):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as package:
            for name, content in files.items():
                package.writestr(name, content)
        return output.getvalue()

    def test_multilingual_text_preserves_codepoints_and_full_scope(self):
        text = "张三😀\n" * 1001
        result = self.read(text.encode("utf-8"), "text/plain")
        self.assertEqual(len(result["units"]), 2)
        self.assertEqual("".join(u["text"] for u in result["units"]), text)
        self.assertEqual(result["units"][-1]["locator"]["span"][1], len(text))

    def test_csv_quoted_multiline_leading_zero_and_formula_remain_data(self):
        csv = '编号,内容\r\n001,"第一行\n第二行"\r\n002,=HYPERLINK(""x"")\r\n'
        result = self.read(csv.encode("utf-8"), "text/csv")
        self.assertIn('"001"', result["units"][0]["text"])
        self.assertIn("HYPERLINK", result["units"][0]["text"])
        self.assertIn("第二行", result["units"][0]["text"])

    def test_docx_reads_body_and_footer_without_running_embedded_instructions(self):
        body = '<w:document xmlns:w="%s"><w:body><w:p><w:r><w:t>客户甲</w:t></w:r></w:p></w:body></w:document>' % reader.NS["w"]
        footer = '<w:ftr xmlns:w="%s"><w:p><w:r><w:t>尾注信息</w:t></w:r></w:p></w:ftr>' % reader.NS["w"]
        result = self.read(self.package({"word/document.xml": body, "word/footer1.xml": footer}),
                           "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        self.assertEqual(len(result["units"]), 2)
        self.assertIn("客户甲", result["units"][0]["text"])
        self.assertIn("尾注信息", result["units"][1]["text"])

    def test_xlsx_includes_hidden_sheet_and_formula_cached_text(self):
        workbook = '<workbook xmlns="%s" xmlns:r="%s"><sheets><sheet name="隐藏表" sheetId="1" state="hidden" r:id="rId1"/></sheets></workbook>' % (reader.NS["s"], reader.NS["r"])
        rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
        page = '<worksheet xmlns="%s"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>001</t></is></c><c r="B1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>' % reader.NS["s"]
        result = self.read(self.package({"xl/workbook.xml": workbook, "xl/_rels/workbook.xml.rels": rels, "xl/worksheets/sheet1.xml": page}),
                           "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.assertIn('"raw": "001"', result["units"][0]["text"])
        self.assertIn('"formula": "1+1"', result["units"][0]["text"])
        self.assertIn("FORMULAS_ARE_NOT_EXECUTED", result["units"][0]["limitations"])

    def test_blank_pdf_is_not_claimed_readable(self):
        writer = PdfWriter()
        writer.add_blank_page(width=600, height=800)
        output = io.BytesIO()
        writer.write(output)
        result = self.read(output.getvalue(), "application/pdf")
        self.assertEqual(result["units"][0]["readability"], "UNREADABLE")

    def test_standard_excel_protocol_preserves_complete_rules_and_rejects_tampered_hash(self):
        definition = {"fields": [{"field_id": "amount", "scale": 2, "unit": "CNY"}],
                      "rules": [{"op": "COMPARE", "comparator": "GE", "args": [
                          {"op": "FIELD", "field_id": "amount"}, {"op": "CONST", "value": "0.00"}]}],
                      "timezone": "Asia/Shanghai", "identity_keys": ["amount"]}
        raw = json.dumps(definition, ensure_ascii=False).encode("utf-8")
        digest, encoded = hashlib.sha256(raw).hexdigest(), base64.b64encode(raw).decode("ascii")
        workbook = '<workbook xmlns="%s" xmlns:r="%s"><sheets><sheet name="__P07_SCHEMA__" sheetId="1" r:id="rId1"/></sheets></workbook>' % (reader.NS["s"], reader.NS["r"])
        rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
        def package(hash_value):
            rows = [["协议", "SHA256", "分块序号", "规范JSON(Base64)"], ["P07-SCHEMA-XLSX-1", hash_value, "0", encoded]]
            cells = ''.join('<row r="%s">%s</row>' % (i + 1, ''.join('<c r="%s%s" t="inlineStr"><is><t>%s</t></is></c>' % (chr(65 + j), i + 1, value) for j, value in enumerate(row))) for i, row in enumerate(rows))
            return self.package({"xl/workbook.xml": workbook, "xl/_rels/workbook.xml.rels": rels,
                                 "xl/worksheets/sheet1.xml": '<worksheet xmlns="%s"><sheetData>%s</sheetData></worksheet>' % (reader.NS["s"], cells)})
        mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        result = self.read(package(digest), mime)
        decoded = [json.loads(u["text"]) for u in result["units"] if u["locator"]["path"].endswith("/p07-schema")]
        self.assertEqual(decoded[0]["schema"], definition)
        with self.assertRaises(reader.ToolError):
            self.read(package("0" * 64), mime)

    def test_encrypted_pdf_is_rejected(self):
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.encrypt("fixture-password")
        output = io.BytesIO()
        writer.write(output)
        with self.assertRaisesRegex(reader.ToolError, "PASSWORD_PROTECTED"):
            self.read(output.getvalue(), "application/pdf")

    def test_image_requires_explicit_ocr(self):
        output = io.BytesIO()
        Image.new("RGB", (64, 64), "white").save(output, "PNG")
        result = self.read(output.getvalue(), "image/png")
        self.assertEqual(result["units"][0]["readability"], "UNREADABLE")
        self.assertIn("OCR_REQUIRED", result["units"][0]["limitations"])

    def test_excess_units_refused_without_silent_truncation(self):
        with self.assertRaisesRegex(reader.ToolError, "PROCESSING_UNIT_LIMIT"):
            self.read(("x" * (4000 * 50 + 1)).encode(), "text/plain")

    def test_archive_path_and_expansion_bombs_are_refused(self):
        for package in [self.package({"../secret": "x"}), self.package({"word/document.xml": "x" * 100_000})]:
            with self.assertRaises(reader.ToolError):
                reader.archive(package)

    def test_xml_external_entities_forbidden(self):
        with self.assertRaisesRegex(reader.ToolError, "XML_ENTITY_FORBIDDEN"):
            reader.xml(b'<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>')


if __name__ == "__main__":
    unittest.main(verbosity=2)
