"""สร้างรูปคู่บ่าวสาวสำหรับกรอบ Photo Booth → js/booth-photo.js

    python tools/make_booth_photo.py            (ใช้รูปหมายเลข 002)
    python tools/make_booth_photo.py 004        (เลือกหมายเลขรูปอื่นจาก photo-numbers.html)

รูปถูกฝังเป็น data URI เพื่อให้ canvas บันทึกรูปได้แม้เปิดไฟล์จากเครื่อง (file://)
ซึ่งเบราว์เซอร์จะไม่ยอมให้ export ถ้าวาดรูปจากไฟล์ assets ลงไป
"""
import base64
import io
import sys
from pathlib import Path

from PIL import Image, ImageOps  # pip install pillow

# matches the polaroid photo area in js/booth.js (268 × 284 frame units), at 1.5× for sharpness
OUT_W, OUT_H = 402, 426
FOCUS_Y = 0.2      # keep faces near the top of the crop
JPEG_QUALITY = 84

root = Path(__file__).resolve().parents[1]
number = (sys.argv[1] if len(sys.argv) > 1 else '002').zfill(3)
source = root / 'assets' / 'couple' / f'{number}.jpg'
if not source.exists():
    raise SystemExit(f'ไม่พบรูป {source}')

with Image.open(source) as raw:
    image = ImageOps.exif_transpose(raw).convert('RGB')
scale = max(OUT_W / image.width, OUT_H / image.height)
resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
left = (resized.width - OUT_W) // 2
top = round((resized.height - OUT_H) * FOCUS_Y)
crop = resized.crop((left, top, left + OUT_W, top + OUT_H))

buffer = io.BytesIO()
crop.save(buffer, 'JPEG', quality=JPEG_QUALITY, optimize=True, progressive=True)
data = base64.b64encode(buffer.getvalue()).decode('ascii')
(root / 'js' / 'booth-photo.js').write_text(
    f'// รูปคู่บ่าวสาวในกรอบ Photo Booth (สร้างจาก assets/couple/{number}.jpg โดย tools/make_booth_photo.py — อย่าแก้ด้วยมือ)\n'
    f"window.BOOTH_COUPLE_PHOTO = 'data:image/jpeg;base64,{data}';\n",
    encoding='utf-8', newline='\n')
sys.stdout.reconfigure(encoding='utf-8')
print(f'js/booth-photo.js ← {number}.jpg ({len(buffer.getvalue()) // 1024} KB)')
