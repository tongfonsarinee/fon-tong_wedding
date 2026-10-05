"""นำรูปจาก ../Picture เข้าเว็บ พร้อมตั้งหมายเลขรูป — รันซ้ำได้ทุกครั้งที่เพิ่มรูป

    python tools/import_photos.py

- รูปใหม่ได้หมายเลขถัดไป (001, 002, ...) รูปเดิมหมายเลขไม่เปลี่ยน
- สร้าง assets/couple/NNN.jpg (ยาวสุด 2000px) และ NNN-s.jpg (720px สำหรับอัลบั้ม)
- เขียนตารางหมายเลข: photo-numbers.csv และ photo-numbers.html (เปิดดูรูปคู่กับหมายเลข)
- อัปเดตอัลบั้มใน index.html ระหว่าง <!-- photos:album --> ... <!-- /photos:album -->
"""
import csv
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps  # pip install pillow

FULL_MAX_PX = 2000
THUMB_MAX_PX = 720
JPEG_QUALITY = 88
ALBUM_VISIBLE = 999  # แสดงทุกรูปในอัลบั้ม (ถ้าอยากซ่อนบางส่วนหลังปุ่ม "ดูภาพทั้งหมด" ให้ลดตัวเลขนี้)
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
# การ์ดเชิญฉบับพิมพ์ ไม่ใช่รูปในอัลบั้ม (ใช้แยกที่ assets/images/invitation.jpg)
SKIP = {'8852C954-45FA-46EA-A263-D99B723EB2A9.jpg'}

root = Path(__file__).resolve().parents[1]
source = root.parent / 'Picture'
target = root / 'assets' / 'couple'
manifest = target / 'photos.json'


def natural_key(path):
    """1.jpg, 2.jpg, 10.jpg — not 1, 10, 2."""
    return [int(part) if part.isdigit() else part for part in re.split(r'(\d+)', path.name.lower())]


def save_resized(image, max_px, path):
    copy = image.copy()
    copy.thumbnail((max_px, max_px), Image.LANCZOS)  # never upscales
    copy.save(path, 'JPEG', quality=JPEG_QUALITY, optimize=True, progressive=True)
    return copy.size


def import_photo(file, photo):
    with Image.open(file) as raw:
        image = ImageOps.exif_transpose(raw).convert('RGB')  # phone photos: apply rotation
    photo['width'], photo['height'] = save_resized(image, FULL_MAX_PX, target / photo['file'])
    save_resized(image, THUMB_MAX_PX, target / photo['thumb'])


def album_html(photos):
    rows = []
    for i, p in enumerate(photos):
        number = f"{p['number']:03d}"
        extra = ' is-extra' if i >= ALBUM_VISIBLE else ''
        rows.append(
            f'      <button class="album__item{extra}" type="button" data-full="assets/couple/{p["file"]}" data-number="{number}">'
            f'<img src="assets/couple/{p["thumb"]}" width="{p["width"]}" height="{p["height"]}" alt="ภาพหมายเลข {number}" loading="lazy">'
            f'<span class="album__number">No. {number}</span></button>'
        )
    return '\n'.join(rows)


def update_index(photos):
    page = root / 'index.html'
    html = page.read_text(encoding='utf-8')
    html, found = re.subn(
        r'(<!-- photos:album -->\n).*?(\n\s*<!-- /photos:album -->)',
        lambda m: m[1] + album_html(photos) + m[2], html, flags=re.S)
    if not found:
        raise SystemExit('index.html: ไม่พบ <!-- photos:album --> ... <!-- /photos:album -->')
    html = re.sub(r'(<div class="album" id="album" data-count=")\d+(")', rf'\g<1>{len(photos)}\2', html)
    hidden = '' if len(photos) > ALBUM_VISIBLE else ' hidden'
    html = re.sub(
        r'<button class="btn btn--ghost gallery__more" id="gallery-more"[^>]*>.*?</button>',
        f'<button class="btn btn--ghost gallery__more" id="gallery-more"{hidden} type="button">ดูภาพทั้งหมด ({len(photos)} ภาพ)</button>',
        html)
    page.write_text(html, encoding='utf-8', newline='\n')


def write_number_sheets(photos):
    with (root / 'photo-numbers.csv').open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['หมายเลขรูป', 'ชื่อไฟล์เดิม (ในโฟลเดอร์ Picture)', 'ชื่อไฟล์ในเว็บไซต์'])
        writer.writerows((f"{p['number']:03d}", p['original'], 'assets/couple/' + p['file']) for p in photos)
    cards = '\n'.join(
        f'  <figure><img src="assets/couple/{p["thumb"]}" alt="" loading="lazy">'
        f'<figcaption><b>No. {p["number"]:03d}</b><span>{p["original"]}</span></figcaption></figure>'
        for p in photos)
    (root / 'photo-numbers.html').write_text(f'''<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>หมายเลขรูป</title>
<style>
  body {{ margin: 0; padding: 24px 16px 48px; background: #FFFAF5; color: #4A2414; font-family: 'Leelawadee UI', Tahoma, sans-serif; }}
  h1 {{ margin: 0 0 4px; font-size: 22px; color: #7D3818; }}
  p {{ margin: 0 0 20px; font-size: 14px; color: #8A6450; }}
  main {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }}
  figure {{ margin: 0; border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 12px 24px -16px rgba(125, 56, 24, .6); }}
  img {{ display: block; width: 100%; aspect-ratio: 3 / 4; object-fit: cover; }}
  figcaption {{ padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 2px; }}
  b {{ font-size: 18px; color: #9A7038; }}
  span {{ font-size: 12px; color: #8A6450; word-break: break-all; }}
</style>
</head>
<body>
<h1>หมายเลขรูป ({len(photos)} รูป)</h1>
<p>ตัวเลขใหญ่คือหมายเลขรูปในเว็บ · ตัวเล็กคือชื่อไฟล์เดิมในโฟลเดอร์ Picture</p>
<main>
{cards}
</main>
</body>
</html>
''', encoding='utf-8', newline='\n')


def main():
    if not source.is_dir():
        raise SystemExit(f'ไม่พบโฟลเดอร์รูป: {source}')
    target.mkdir(parents=True, exist_ok=True)
    photos = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else []
    by_original = {photo['original']: photo for photo in photos}
    added = 0
    for file in sorted(source.iterdir(), key=natural_key):
        if not file.is_file() or file.suffix.lower() not in EXTENSIONS or file.name in SKIP:
            continue
        photo = by_original.get(file.name)
        if photo is None:
            number = max((p['number'] for p in photos), default=0) + 1
            photo = {'number': number, 'original': file.name}
            photos.append(photo)
            by_original[file.name] = photo
            added += 1
        photo['file'] = f"{photo['number']:03d}.jpg"
        photo['thumb'] = f"{photo['number']:03d}-s.jpg"
        import_photo(file, photo)
    if not photos:
        raise SystemExit('ไม่พบรูปในโฟลเดอร์ Picture')
    manifest.write_text(json.dumps(photos, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    write_number_sheets(photos)
    update_index(photos)
    print(f'รูปทั้งหมด {len(photos)} รูป (เพิ่มใหม่ {added}) · ดูหมายเลขได้ที่ photo-numbers.html / photo-numbers.csv')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')  # คอนโซล Windows ภาษาไทย (cp874) พิมพ์ · ไม่ได้
    main()
