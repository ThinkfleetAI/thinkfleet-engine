---
name: image-processing
description: Image processing and manipulation
metadata:
  thinkfleetbot_emoji: "🖼️"
  requires_bins:
    - python3
  requires_env: []
---

# Image Processing

Image manipulation using Python and Pillow (PIL).

## Resize image

```bash
python3 -c "
from PIL import Image

img = Image.open('input.jpg')
# Resize to specific dimensions
resized = img.resize((800, 600), Image.LANCZOS)
resized.save('resized.jpg')

# Resize keeping aspect ratio
img.thumbnail((800, 800), Image.LANCZOS)
img.save('thumbnail.jpg')
print('Done')
"
```

## Convert format

```bash
python3 -c "
from PIL import Image

img = Image.open('input.png')

# PNG to JPEG (must convert RGBA to RGB)
if img.mode == 'RGBA':
    img = img.convert('RGB')
img.save('output.jpg', 'JPEG', quality=90)

# JPEG to PNG
# img = Image.open('input.jpg')
# img.save('output.png', 'PNG')

# Convert to WebP
# img.save('output.webp', 'WEBP', quality=85)
print('Converted successfully')
"
```

## Crop image

```bash
python3 -c "
from PIL import Image

img = Image.open('input.jpg')
# Crop box: (left, upper, right, lower)
cropped = img.crop((100, 100, 500, 400))
cropped.save('cropped.jpg')
print(f'Cropped from {img.size} to {cropped.size}')
"
```

## Add text overlay

```bash
python3 -c "
from PIL import Image, ImageDraw, ImageFont

img = Image.open('input.jpg')
draw = ImageDraw.Draw(img)

# Use default font (or specify a TTF path)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 36)
except OSError:
    font = ImageFont.load_default()

text = 'Hello World'
# Draw text with shadow for readability
draw.text((12, 12), text, fill='black', font=font)
draw.text((10, 10), text, fill='white', font=font)
img.save('with_text.jpg')
print('Text overlay added')
"
```

## Create thumbnail

```bash
python3 -c "
from PIL import Image

img = Image.open('input.jpg')
sizes = [(128, 128), (256, 256), (512, 512)]
for size in sizes:
    thumb = img.copy()
    thumb.thumbnail(size, Image.LANCZOS)
    thumb.save(f'thumb_{size[0]}x{size[1]}.jpg')
    print(f'Created thumb_{size[0]}x{size[1]}.jpg')
"
```

## Get image metadata

```bash
python3 -c "
from PIL import Image
from PIL.ExifTags import TAGS
import json

img = Image.open('input.jpg')
info = {
    'format': img.format,
    'mode': img.mode,
    'size': {'width': img.size[0], 'height': img.size[1]},
}

# Extract EXIF data if present
exif = img.getexif()
if exif:
    info['exif'] = {}
    for tag_id, value in exif.items():
        tag = TAGS.get(tag_id, tag_id)
        try:
            info['exif'][str(tag)] = str(value)
        except Exception:
            pass

print(json.dumps(info, indent=2))
"
```

## Optimize/compress

```bash
python3 -c "
from PIL import Image
import os

img = Image.open('input.jpg')
original_size = os.path.getsize('input.jpg')

# Optimize JPEG
if img.mode == 'RGBA':
    img = img.convert('RGB')
img.save('optimized.jpg', 'JPEG', quality=80, optimize=True)
new_size = os.path.getsize('optimized.jpg')
ratio = (1 - new_size / original_size) * 100
print(f'Original: {original_size:,} bytes')
print(f'Optimized: {new_size:,} bytes')
print(f'Saved: {ratio:.1f}%')
"
```

## Batch process

```bash
python3 -c "
from PIL import Image
import os, glob

input_dir = 'images'
output_dir = 'processed'
os.makedirs(output_dir, exist_ok=True)

for filepath in glob.glob(os.path.join(input_dir, '*')):
    try:
        img = Image.open(filepath)
        # Resize all to max 1024px wide
        if img.width > 1024:
            ratio = 1024 / img.width
            new_size = (1024, int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)
        if img.mode == 'RGBA':
            img = img.convert('RGB')
        name = os.path.splitext(os.path.basename(filepath))[0]
        out_path = os.path.join(output_dir, f'{name}.jpg')
        img.save(out_path, 'JPEG', quality=85, optimize=True)
        print(f'Processed: {filepath} -> {out_path}')
    except Exception as e:
        print(f'Skipped {filepath}: {e}')
"
```
