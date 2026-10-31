"""Retain Sub2 originals and typeset the ten-logo selection package; no image generation here."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import shutil
import zipfile
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'assets/brand/logo-exploration/2026-11-01'
OUTPUT = ROOT / 'output/imagegen/table-purifier-logos-2026-11-01'
FONT = Path('C:/Windows/Fonts/msyh.ttc')
BOLD = Path('C:/Windows/Fonts/msyhbd.ttc')
INK = '#203C32'
MUTED = '#607267'
SIZES = (1024, 512, 256, 128, 64, 32)


def font(size: int, bold: bool = False):
    return ImageFont.truetype(str(BOLD if bold else FONT), size)


def text(draw, xy, value, size=28, fill=INK, bold=False, anchor=None):
    draw.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)


def fit_mark(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.contain(image, size, Image.Resampling.LANCZOS)


def place(canvas: Image.Image, image: Image.Image, box, fraction=0.76):
    x1, y1, x2, y2 = box
    image = fit_mark(image, (round((x2 - x1) * fraction), round((y2 - y1) * fraction)))
    canvas.alpha_composite(image, (round((x1 + x2 - image.width) / 2), round((y1 + y2 - image.height) / 2)))


def wrap(draw, value, max_width, size):
    lines, line = [], ''
    for char in value:
        if line and draw.textlength(line + char, font=font(size)) > max_width:
            lines.append(line)
            line = ''
        line += char
    if line:
        lines.append(line)
    return lines


def make_card(row, mark, icons):
    card = Image.new('RGBA', (1600, 1320), '#F0F4F1')
    draw = ImageDraw.Draw(card)
    text(draw, (64, 46), row['id'], 34, '#17745E', True)
    text(draw, (64, 97), row['name_zh'], 62, INK, True)
    text(draw, (1534, 65), 'TABLE PURIFIER · LOGO EXPLORATION', 23, MUTED, anchor='ra')
    text(draw, (1534, 112), row['name_en'], 32, MUTED, anchor='ra')
    text(draw, (64, 186), row['style'], 28, MUTED)
    draw.rounded_rectangle((64, 254, 1038, 1054), radius=30, fill='white')
    place(card, mark, (120, 285, 984, 775), 0.86)
    text(draw, (551, 828), '表格修复站', 58, INK, True, 'mm')
    text(draw, (551, 906), 'Table Purifier', 32, MUTED, anchor='mm')
    text(draw, (551, 994), '把零散资料，整理成有依据的表格', 25, MUTED, anchor='mm')
    draw.rounded_rectangle((1070, 254, 1536, 620), radius=30, fill='#E2EBE4')
    place(card, mark, (1124, 270, 1482, 552), 0.80)
    text(draw, (1303, 578), '浅色界面应用', 23, MUTED, anchor='mm')
    draw.rounded_rectangle((1070, 650, 1536, 1054), radius=30, fill='#203C32')
    draw.rounded_rectangle((1191, 702, 1415, 926), radius=46, fill='white')
    card.alpha_composite(icons[256].resize((224, 224), Image.Resampling.LANCZOS), (1191, 702))
    text(draw, (1303, 994), '小程序 / 社媒头像示意', 23, '#EAF1EE', anchor='mm')
    for j, line in enumerate(wrap(draw, row['meaning'], 1400, 29)):
        text(draw, (64, 1095 + j * 44), line, 29)
    for j, color in enumerate(row['palette']):
        cx = 80 + j * 197
        draw.ellipse((cx, 1200, cx + 30, 1230), fill=color)
        text(draw, (cx + 42, 1196), color, 22, MUTED)
    text(draw, (1536, 1232), '候选方案 · 2026.11.01', 22, MUTED, anchor='ra')
    return card.convert('RGB')


def make_overview(rows, marks, icons):
    board = Image.new('RGBA', (2600, 1620), '#EAF0EB')
    draw = ImageDraw.Draw(board)
    text(draw, (48, 30), '表格修复站', 62, INK, True)
    text(draw, (490, 48), '10 款品牌 Logo 选型', 42, INK)
    text(draw, (2552, 43), 'TABLE PURIFIER / 2026.11.01', 25, MUTED, anchor='ra')
    text(draw, (48, 119), '资料成表 · 规范先行 · 依据可查     /     图形、中英字标及小尺寸效果另见单款展示图', 27, MUTED)
    width, height, gap = 481, 664, 24
    for index, row in enumerate(rows):
        x, y = 48 + index % 5 * (width + gap), 193 + index // 5 * (height + gap)
        draw.rounded_rectangle((x, y, x + width, y + height), radius=20, fill='white')
        text(draw, (x + 25, y + 20), row['id'], 31, '#17745E', True)
        for j, color in enumerate(row['palette']):
            draw.ellipse((x + 368 + 27 * j, y + 30, x + 385 + 27 * j, y + 47), fill=color)
        place(board, marks[row['id']], (x + 50, y + 70, x + width - 50, y + 402), 0.88)
        text(draw, (x + 26, y + 421), row['name_zh'], 35, INK, True)
        text(draw, (x + 26, y + 474), row['name_en'], 23, MUTED)
        for j, line in enumerate(wrap(draw, row['style'], width - 52, 22)):
            text(draw, (x + 26, y + 520 + 31 * j), line, 22, MUTED)
        text(draw, (x + 26, y + 611), '小尺寸', 18, MUTED)
        board.alpha_composite(icons[row['id']][32], (x + 112, y + 606))
        board.alpha_composite(icons[row['id']][64], (x + 202, y + 582))
        text(draw, (x + 155, y + 610), '32', 17, MUTED)
        text(draw, (x + 278, y + 610), '64 px', 17, MUTED)
    text(draw, (48, 1570), '10 个候选方向 / 尚未替换已定型的 B 方案 · 原始图、透明 PNG 与展示稿均已留存', 22, MUTED)
    return board.convert('RGB')


def main():
    catalog = json.loads((BASE / 'concepts.json').read_text(encoding='utf-8'))
    for part in ['originals', 'previews', 'exports', 'receipts']:
        (BASE / part).mkdir(parents=True, exist_ok=True)
    marks, all_icons, paths = {}, {}, []
    for row in catalog['concepts']:
        original = OUTPUT / (row['slug'] + '.png')
        receipt = json.loads((OUTPUT / (row['slug'] + '.receipt.json')).read_text(encoding='utf-8'))
        if receipt['status'] != 'GENERATED' or receipt['fallback_model_used']:
            raise RuntimeError('A successful generation from the requested model is required: ' + row['id'])
        with Image.open(original) as picture:
            image = picture.convert('RGBA')
        alpha = image.getchannel('A')
        if alpha.getextrema() != (0, 255):
            raise RuntimeError('Expected verified transparent source: ' + row['id'])
        bounds = alpha.point(lambda value: 255 if value > 12 else 0).getbbox()
        if not bounds:
            raise RuntimeError('Empty image: ' + row['id'])
        mark = image.crop(bounds)
        marks[row['id']] = mark
        retained = BASE / 'originals' / original.name
        shutil.copyfile(original, retained)
        if hashlib.sha256(retained.read_bytes()).hexdigest() != receipt['sha256']:
            raise RuntimeError('Source digest mismatch.')
        receipt['original_output'] = receipt.pop('file')
        receipt['retained_file'] = retained.relative_to(BASE).as_posix()
        receipt_path = BASE / 'receipts' / (row['slug'] + '.json')
        receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        icons = {}
        for size in SIZES:
            icon = Image.new('RGBA', (size, size), (255, 255, 255, 0))
            place(icon, mark, (0, 0, size, size), 0.78)
            icon_path = BASE / 'exports' / row['slug'] / f'{size}.png'
            icon_path.parent.mkdir(parents=True, exist_ok=True)
            icon.save(icon_path)
            icons[size] = icon
        all_icons[row['id']] = icons
        preview = BASE / 'previews' / (row['slug'] + '.png')
        make_card(row, mark, icons).save(preview, optimize=True)
        row.update({'status': 'GENERATED_AWAITING_SELECTION', 'original': retained.relative_to(BASE).as_posix(),
                    'preview': preview.relative_to(BASE).as_posix(), 'exports': f"exports/{row['slug']}",
                    'native_size': [image.width, image.height], 'transparent_background_verified': True,
                    'normalization': {'alpha_threshold_for_crop': 12, 'crop_bbox': list(bounds), 'visible_mark_canvas_fraction': 0.78},
                    'receipt': receipt_path.relative_to(BASE).as_posix()})
    overview = make_overview(catalog['concepts'], marks, all_icons)
    overview.save(BASE / 'logo-overview.png', optimize=True)
    catalog['status'] = 'TEN_GENERATED_CANDIDATES_AWAITING_SELECTION'
    catalog['exports'] = list(SIZES)
    catalog['typography'] = {'zh': 'Microsoft YaHei', 'en': 'Microsoft YaHei', 'typeset_after_generation': True, 'font_files_distributed': False}
    (BASE / 'concepts.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for path in sorted(BASE.rglob('*.png')):
        with Image.open(path) as picture:
            picture.verify()
        with Image.open(path) as picture:
            paths.append({'path': path.relative_to(BASE).as_posix(), 'bytes': path.stat().st_size,
                          'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'width': picture.width, 'height': picture.height})
    manifest = {'protocol': 'P07-LOGO-ASSETS-1', 'date': '2026-11-01', 'selection_status': 'AWAITING_USER_SELECTION',
                'requested_model': 'gpt-image-2.5', 'provider_route': 'sub2-image-gen', 'fallback_model_used': False,
                'generated_originals': len(catalog['concepts']), 'raster_artwork': True, 'vector_master': 'NOT_CREATED',
                'existing_design_baseline_modified': False, 'browser_or_virtualization_used': False, 'files': paths}
    (BASE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    archive = OUTPUT / 'Table-Purifier-10-Logo-Options-2026-11-01.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as package:
        for path in sorted(BASE.rglob('*')):
            if path.is_file():
                package.write(path, 'Table-Purifier-10-Logo-Options/' + path.relative_to(BASE).as_posix())
    shutil.copyfile(BASE / 'logo-overview.png', OUTPUT / 'logo-overview.png')
    print(json.dumps({'status': 'PASS', 'originals': len(catalog['concepts']), 'png_files': len(paths),
                      'overview': str(BASE / 'logo-overview.png'), 'archive': str(archive), 'archive_bytes': archive.stat().st_size}, ensure_ascii=False))


if __name__ == '__main__':
    main()
