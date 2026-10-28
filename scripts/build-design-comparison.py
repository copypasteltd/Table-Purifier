"""Compare retained B references with real before/after source captures. No network or browser."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'docs/media/design-review'
REFERENCES = ROOT / 'assets/design/b-jade-folders/v1.0.0/reference'

def main():
    font = ImageFont.load_default(size=18)
    small = ImageFont.load_default(size=13)
    refs = {'MP01': 'MP01-home.png', 'MP06': 'MP06-schema.png', 'MP10': 'MP10-issue.png'}
    for code, reference in refs.items():
        sheet = Image.new('RGB', (1181, 970), '#EAF1EE')
        draw = ImageDraw.Draw(sheet)
        for index, (label, file, crop_chrome) in enumerate([
            ('B REFERENCE / original aspect ratio', REFERENCES / reference, False),
            ('BEFORE / a9d9699 / synthetic fixture', MEDIA / f'before-{code}.png', True),
            ('AFTER / current / same synthetic fixture', MEDIA / f'alipay-{code}.png', True),
        ]):
            image = Image.open(file).convert('RGB')
            if crop_chrome:
                # Remove only the documentation banner and mock status bar, keep native navigation.
                image = image.crop((0, 53, image.width, image.height))
            image = image.resize((375, round(image.height * 375 / image.width)), Image.Resampling.LANCZOS)
            x = 12 + index * 391
            draw.text((x, 14), label, fill='#203C32', font=small)
            sheet.paste(image, (x, 44))
        draw.text((12, 930), f'{code} | Width normalized; no stretching or pixel-perfect score. Source preview, NOT native-device proof.', fill='#875A18', font=small)
        sheet.save(MEDIA / f'comparison-{code}.png', optimize=True)
    board = Image.new('RGB', (1054, 894), '#EAF1EE')
    draw = ImageDraw.Draw(board)
    draw.text((20, 15), 'TABLE PURIFIER / B JADE FOLDERS / CURRENT SOURCE', fill='#203C32', font=font)
    draw.text((20, 44), 'Synthetic quotation fixture / Actual templates and controller / Native devices NOT_RUN', fill='#875A18', font=small)
    for index, code in enumerate(refs):
        image = Image.open(MEDIA / f'alipay-{code}.png').convert('RGB')
        image.thumbnail((330, 810), Image.Resampling.LANCZOS)
        board.paste(image, (16 + index * 346, 70))
    board.save(MEDIA / 'after-board.png', optimize=True)

if __name__ == '__main__':
    main()
