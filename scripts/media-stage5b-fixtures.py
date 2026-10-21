"""Deterministic valid documents for real upload tests; no private user data."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo
import hashlib
import struct
import zlib
import shutil
import subprocess
from PIL import Image

out = Path('media-stage5b-evidence/fixtures')
out.mkdir(parents=True, exist_ok=True)
def write_entry(archive, name, content):
    archive.writestr(ZipInfo(name, (2026, 10, 19, 0, 0, 0)), content)
for count in [1, 20, 100, 500]:
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'']
    kids = []
    for page in range(count):
        number = len(objects) + 1
        kids.append(f'{number} 0 R')
        content = (f'BT /F1 24 Tf 50 740 Td (Zvonok Stage 5B - page {page+1} of {count}) Tj ET\n'
                   + '%' + hashlib.sha256(str(page).encode()).hexdigest() * 40 + '\n').encode()
        objects += [f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents {number+1} 0 R >>'.encode(),
                    f'<< /Length {len(content)} >>\nstream\n'.encode() + content + b'endstream']
    objects[1] = f'<< /Type /Pages /Count {count} /Kids [{" ".join(kids)}] >>'.encode()
    data = bytearray(b'%PDF-1.7\n')
    offsets = [0]
    for i, obj in enumerate(objects):
        offsets.append(len(data))
        data += f'{i+1} 0 obj\n'.encode() + obj + b'\nendobj\n'
    xref = len(data)
    data += f'xref\n0 {len(offsets)}\n0000000000 65535 f \n'.encode()
    for offset in offsets[1:]:
        data += f'{offset:010d} 00000 n \n'.encode()
    data += f'trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    assert data[xref:xref+4] == b'xref'
    (out / f'pages-{count}.pdf').write_bytes(data)

for ext, content in [('txt', 'Zvonok UTF-8 текст\n<script>alert(1)</script>'), ('md', '# Markdown\n<img src=x onerror=alert(1)>'), ('json', '{"stage": "5B"}'), ('csv', 'stage,status\n5B,test')]:
    (out / f'preview.{ext}').write_text(content, encoding='utf-8')
(out / 'large.txt').write_text('Safe text\n' * 60000, encoding='utf-8')
(out / 'corrupt.pdf').write_bytes(b'%PDF-1.7\nintentionally corrupted')
for name, width, height in [('landscape.png', 1200, 800), ('portrait.png', 800, 1200)]:
    rows = b''.join(b'\x00' + b''.join(bytes((40 + (x // 120 % 2) * 40, 100 + (y // 100 % 2) * 65, 130 + (x // 120 % 2) * 50)) for x in range(width)) for y in range(height))
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    (out / name).write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))
with ZipFile(out / 'archive.zip', 'w') as archive:
    write_entry(archive, 'readme.txt', 'Zvonok Stage 5B')
with ZipFile(out / 'document.docx', 'w') as archive:
    write_entry(archive, '[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    write_entry(archive, '_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    write_entry(archive, 'word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Zvonok Stage 5B</w:t></w:r></w:p></w:body></w:document>')
image = Image.open(out / 'landscape.png')
image.save(out / 'sample.webp')
image.save(out / 'animation.gif', save_all=True, append_images=[image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)], duration=200, loop=0)
ffmpeg = shutil.which('ffmpeg')
if not ffmpeg:
    raise RuntimeError('The existing FFmpeg executable is required only to generate the synthetic MP4 fixture')
subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24',
                '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '2', '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', '-y', str(out / 'sample.mp4')], check=True)
print('Stage 5B fixture generation PASS')
