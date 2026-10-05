"""ตั้งที่อยู่เว็บจริงของการ์ด เพื่อให้ส่งลิงก์ใน LINE / Facebook แล้วขึ้นรูปปก (og:image)

    python tools/set_site_url.py https://<ชื่อ>.github.io/<repo>

- เขียนแท็ก og:url / og:image / twitter:image แบบ URL เต็มลงใน index.html (ระหว่าง <!-- og:site --> ... <!-- /og:site -->)
- ต่อท้ายรูปด้วย ?v=<รหัสของไฟล์> ให้ LINE ดึงรูปใหม่ทุกครั้งที่ assets/images/og.jpg เปลี่ยน
- รันซ้ำได้ทุกครั้ง (เช่น หลังแก้รูปปก หรือย้ายเว็บ)
"""
import hashlib
import re
import sys
from pathlib import Path

OG_IMAGE = 'assets/images/og.jpg'
OG_W, OG_H = 1200, 630

root = Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
if len(sys.argv) < 2:
    raise SystemExit('ใส่ที่อยู่เว็บด้วย เช่น  python tools/set_site_url.py https://thonganek.github.io/wedding-fon-tong')
site = sys.argv[1].strip().rstrip('/')
if not re.match(r'^https://[^\s/]+', site):
    raise SystemExit('ที่อยู่เว็บต้องขึ้นต้นด้วย https://  (LINE ไม่แสดงรูปจากเว็บที่ไม่ใช่ https)')

version = hashlib.md5((root / OG_IMAGE).read_bytes()).hexdigest()[:8]
image = f'{site}/{OG_IMAGE}?v={version}'
block = f'''<!-- og:site — เขียนโดย tools/set_site_url.py (อย่าแก้ด้วยมือ) -->
<meta property="og:url" content="{site}/">
<meta property="og:image" content="{image}">
<meta property="og:image:secure_url" content="{image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="{OG_W}">
<meta property="og:image:height" content="{OG_H}">
<meta property="og:image:alt" content="ฝนและโต้ง · งานมงคลสมรส 22.11.2569">
<meta name="twitter:image" content="{image}">
<link rel="canonical" href="{site}/">
<!-- /og:site -->'''

page = root / 'index.html'
html = page.read_text(encoding='utf-8')
html, found = re.subn(r'<!-- og:site.*?<!-- /og:site -->', lambda m: block, html, flags=re.S)
if not found:
    raise SystemExit('index.html: ไม่พบ <!-- og:site --> ... <!-- /og:site -->')
page.write_text(html, encoding='utf-8', newline='\n')
print(f'ตั้งที่อยู่เว็บเป็น {site}/')
print(f'รูปปกพรีวิว: {image}')
print('หลัง push ขึ้นเว็บแล้ว ถ้า LINE ยังขึ้นรูปเก่า ให้ล้างแคชที่ https://poker.line.naver.jp/')
