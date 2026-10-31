"""Package the user-selected existing mark and typeset the approved name locally."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import zipfile

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = Path('C:/Windows/Fonts/msyh.ttc')
BOLD = Path('C:/Windows/Fonts/msyhbd.ttc')
SIZES = (1024, 512, 256, 128, 64, 32)


def digest(file: Path) -> str:
    return hashlib.sha256(file.read_bytes()).hexdigest()


def label(draw, xy, value, size=28, fill='#203C32', bold=False, anchor=None):
    draw.text(xy, value, font=ImageFont.truetype(str(BOLD if bold else FONT), size),
              fill=fill, anchor=anchor)


def stamp(canvas, icon, xy, size):
    canvas.alpha_composite(icon.resize((size, size), Image.Resampling.LANCZOS), xy)


def save(canvas, file: Path):
    file.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(file, optimize=True)


def main():
    identity = json.loads((ROOT / 'assets/brand/current.json').read_text(encoding='utf-8'))
    if identity['status'] != 'USER_APPROVED' or identity['selection']['concept_id'] != '06':
        raise RuntimeError('The selected identity must be explicitly approved.')
    base = ROOT / identity['asset_directory']
    source = ROOT / identity['selection']['source']
    if digest(source) != identity['selection']['source_sha256']:
        raise RuntimeError('The approved original changed.')
    original = base / 'originals/06-folded-paper.png'
    original.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, original)
    exploration = source.parents[1]
    for size in SIZES:
        target = base / f'marks/logo-color-{size}.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(exploration / f'exports/06-folded-paper/{size}.png', target)
    icon = Image.open(base / 'marks/logo-color-1024.png').convert('RGBA')
    for variant, color in [('mono', '#203C32'), ('reverse', '#FFFFFF')]:
        silhouette = Image.new('RGBA', icon.size, color)
        silhouette.putalpha(icon.getchannel('A'))
        save(silhouette, base / f'marks/logo-{variant}-1024.png')

    for variant, color in [('color', '#203C32'), ('reverse', '#FFFFFF')]:
        lockup = Image.new('RGBA', (1600, 480))
        stamp(lockup, icon, (0, 0), 480)
        draw = ImageDraw.Draw(lockup)
        label(draw, (520, 196), identity['name_zh'], 152, color, True, 'lm')
        label(draw, (524, 326), identity['short_description_zh'], 35, color, anchor='lm')
        save(lockup, base / f'lockups/logo-horizontal-{variant}.png')
    stacked = Image.new('RGBA', (1200, 1280))
    stamp(stacked, icon, (220, 44), 760)
    draw = ImageDraw.Draw(stacked)
    label(draw, (600, 914), identity['name_zh'], 136, bold=True, anchor='mm')
    label(draw, (600, 1076), identity['short_description_zh'], 36, anchor='mm')
    save(stacked, base / 'lockups/logo-stacked.png')

    for variant, background in [('light', '#FFFFFF'), ('dark', '#203C32')]:
        avatar = Image.new('RGBA', (1024, 1024), background)
        stamp(avatar, icon, (0, 0), 1024)
        save(avatar.convert('RGB'), base / f'avatars/avatar-{variant}-1024.png')
    share = Image.new('RGBA', (1200, 630), '#EAF1EE')
    stamp(share, icon, (40, 75), 480)
    draw = ImageDraw.Draw(share)
    label(draw, (555, 190), identity['name_zh'], 94, bold=True)
    label(draw, (560, 336), '让零散资料，成为清晰的表。', 32)
    label(draw, (560, 408), '有规范，按规范整理。', 26, '#5E7167')
    label(draw, (560, 450), '没有规范，先帮你建立标准。', 26, '#5E7167')
    save(share.convert('RGB'), base / 'social/share-card-1200x630.png')

    board = Image.new('RGBA', (1920, 1440), '#EAF1EE')
    draw = ImageDraw.Draw(board)
    label(draw, (84, 60), identity['name_zh'], 84, bold=True)
    label(draw, (1836, 90), '品牌定稿 / APPROVED IDENTITY', 30, anchor='ra')
    label(draw, (1836, 142), '06 折纸归档 · 2026.11.01 · V1.0.0', 25, '#5E7167', anchor='ra')
    draw.rounded_rectangle((72, 214, 1190, 1040), 28, fill='white')
    stamp(board, icon, (356, 238), 550)
    label(draw, (631, 830), identity['name_zh'], 100, bold=True, anchor='mm')
    label(draw, (631, 948), identity['short_description_zh'], 31, '#5E7167', anchor='mm')
    draw.rounded_rectangle((1222, 214, 1848, 608), 28, fill='#203C32')
    stamp(board, icon, (1383, 220), 300)
    label(draw, (1535, 554), '深色背景 / Dark surface', 25, '#FFFFFF', anchor='mm')
    draw.rounded_rectangle((1222, 638, 1848, 1040), 28, fill='#FFFFFF')
    for offset, size in [(1282, 128), (1480, 64), (1610, 32)]:
        stamp(board, icon, (offset, 746 + (128 - size) // 2), size)
        label(draw, (offset + size // 2, 932), f'{size} px', 23, '#5E7167', anchor='mm')
    label(draw, (1260, 674), '正式图形与小尺寸参考', 29, bold=True)
    label(draw, (84, 1110), identity['tagline_zh'], 39, bold=True)
    label(draw, (84, 1176), '词元：资料中的信息单元。拾序：拾起零散，整理成序。', 29, '#5E7167')
    for i, color in enumerate(['#167864', '#EB9B4A', '#FADEB7', '#203C32', '#EAF1EE']):
        x = 84 + 342 * i
        draw.rounded_rectangle((x, 1270, x + 54, 1324), 10, fill=color, outline='#D4E2DA')
        label(draw, (x + 70, 1280), color, 27)
    label(draw, (84, 1373), '复用用户选定原图；字标本地排版 / Selected original retained; typography composed locally', 22, '#5E7167')
    save(board.convert('RGB'), base / 'brand-board.png')
    icon.save(base / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    # Native packages and the source preview share these exact committed bytes.
    native = ROOT / 'miniapp/src/assets/brand/logo.png'
    native.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(base / 'marks/logo-color-128.png', native)
    files = []
    for file in sorted(base.rglob('*')):
        if file.suffix not in {'.png', '.ico'}:
            continue
        with Image.open(file) as image:
            image.verify()
        with Image.open(file) as image:
            row = {'path': file.relative_to(base).as_posix(), 'bytes': file.stat().st_size,
                   'sha256': digest(file), 'width': image.width, 'height': image.height,
                   'mode': image.mode}
            if image.mode == 'RGBA':
                row['alpha_extrema'] = list(image.getchannel('A').getextrema())
            files.append(row)
    manifest = {'protocol': 'P07-BRAND-ASSETS-1', 'release_id': identity['release_id'],
                'name_zh': identity['name_zh'], 'status': 'USER_APPROVED',
                'selected_concept': '06', 'source': identity['selection'],
                'source_bytes_unchanged': digest(original) == digest(source),
                'new_image_generation': False, 'vector_master': 'NOT_CREATED',
                'typography': {'family': 'Microsoft YaHei', 'locally_typeset': True, 'font_files_distributed': False},
                'native_asset': {'path': native.relative_to(ROOT).as_posix(), 'sha256': digest(native)},
                'files': files}
    (base / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    output = ROOT / 'output/imagegen/ciyuan-shixu-brand-v1.0.0'
    output.mkdir(parents=True, exist_ok=True)
    archive = output / 'Ciyuan-Shixu-Brand-v1.0.0.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as package:
        for file in sorted(base.rglob('*')):
            if file.is_file():
                package.write(file, 'Ciyuan-Shixu-Brand-v1.0.0/' + file.relative_to(base).as_posix())
        package.write(ROOT / 'assets/brand/current.json', 'Ciyuan-Shixu-Brand-v1.0.0/identity.json')
    print(json.dumps({'status': 'PASS', 'brand': identity['name_zh'], 'concept': '06',
                      'image_assets': len(files), 'source_bytes_unchanged': True,
                      'new_image_generation': False, 'archive': str(archive),
                      'archive_sha256': digest(archive)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
