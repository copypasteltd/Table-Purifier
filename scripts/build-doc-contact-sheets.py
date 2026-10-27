"""Build screenshot indexes from captured source previews, without browser or network."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'docs/media'

def main():
    font = ImageFont.load_default(size=15)
    small = ImageFont.load_default(size=12)
    for provider in ('alipay', 'douyin'):
        sheet = Image.new('RGB', (924, 4170), '#EAF1EE')
        draw = ImageDraw.Draw(sheet)
        draw.text((26, 20), f'TABLE PURIFIER / {provider.upper()} / 18 SOURCE PAGES', fill='#203C32', font=font)
        draw.text((26, 47), 'Synthetic fixtures / Browser documentation preview / NOT native-device evidence', fill='#875A18', font=small)
        for index in range(18):
            code = f'MP{index + 1:02d}'
            image = Image.open(MEDIA / f'screenshots/{provider}/{code}.png').convert('RGB')
            image.thumbnail((274, 586), Image.Resampling.LANCZOS)
            x = 26 + (index % 3) * 302
            y = 90 + (index // 3) * 676
            sheet.paste(image, (x, y))
            draw.text((x, y + 598), f'{code} / {provider.upper()}', fill='#203C32', font=font)
        sheet.save(MEDIA / f'{provider}-pages.png', optimize=True)

if __name__ == '__main__':
    main()
