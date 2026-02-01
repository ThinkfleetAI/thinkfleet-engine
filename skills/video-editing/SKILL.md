---
name: video-editing
description: Video editing with ffmpeg
metadata:
  moltbot_emoji: "🎥"
  requires_bins:
    - ffmpeg
  requires_env: []
---

# Video Editing

Video manipulation and conversion using ffmpeg.

## Get video info

```bash
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4
```

## Trim video

```bash
# Trim from 00:01:30 for 60 seconds
ffmpeg -i input.mp4 -ss 00:01:30 -t 60 -c copy trimmed.mp4

# Trim from start to specific end time
ffmpeg -i input.mp4 -ss 00:00:00 -to 00:02:00 -c copy trimmed.mp4
```

## Convert format

```bash
# MP4 to WebM
ffmpeg -i input.mp4 -c:v libvpx-vp9 -c:a libopus output.webm

# MOV to MP4
ffmpeg -i input.mov -c:v libx264 -c:a aac output.mp4

# AVI to MP4
ffmpeg -i input.avi -c:v libx264 -c:a aac -movflags +faststart output.mp4
```

## Extract audio

```bash
# Extract audio as MP3
ffmpeg -i input.mp4 -vn -acodec libmp3lame -q:a 2 audio.mp3

# Extract audio as WAV
ffmpeg -i input.mp4 -vn -acodec pcm_s16le audio.wav

# Extract audio as AAC
ffmpeg -i input.mp4 -vn -acodec aac audio.m4a
```

## Create thumbnail

```bash
# Extract a single frame at 10 seconds
ffmpeg -i input.mp4 -ss 00:00:10 -frames:v 1 thumbnail.jpg

# Create a thumbnail grid (4x4)
ffmpeg -i input.mp4 -frames 1 -vf "select=not(mod(n\,100)),scale=320:240,tile=4x4" grid.jpg
```

## Resize video

```bash
# Resize to 1280x720
ffmpeg -i input.mp4 -vf scale=1280:720 -c:a copy resized.mp4

# Resize keeping aspect ratio (width 1280, auto height)
ffmpeg -i input.mp4 -vf scale=1280:-2 -c:a copy resized.mp4

# Resize to 50%
ffmpeg -i input.mp4 -vf scale=iw/2:ih/2 -c:a copy half.mp4
```

## Add watermark

```bash
# Add image watermark (bottom-right corner)
ffmpeg -i input.mp4 -i watermark.png -filter_complex "overlay=W-w-10:H-h-10" watermarked.mp4

# Add text watermark
ffmpeg -i input.mp4 -vf "drawtext=text='Copyright 2025':fontsize=24:fontcolor=white:x=W-tw-10:y=H-th-10" watermarked.mp4
```

## Concatenate videos

```bash
# Create a file list
printf "file '%s'\n" part1.mp4 part2.mp4 part3.mp4 > filelist.txt

# Concatenate using the file list
ffmpeg -f concat -safe 0 -i filelist.txt -c copy output.mp4
```

## Extract frames

```bash
# Extract all frames as images
ffmpeg -i input.mp4 frames/frame_%04d.png

# Extract 1 frame per second
ffmpeg -i input.mp4 -vf fps=1 frames/frame_%04d.png

# Extract frames at specific interval (every 5 seconds)
ffmpeg -i input.mp4 -vf fps=1/5 frames/frame_%04d.png
```

## Compress video

```bash
# Compress with CRF (lower = better quality, 18-28 typical)
ffmpeg -i input.mp4 -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k compressed.mp4

# Aggressive compression for smaller file
ffmpeg -i input.mp4 -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 96k small.mp4

# Two-pass encoding for target file size
ffmpeg -i input.mp4 -c:v libx264 -b:v 1M -pass 1 -f null /dev/null
ffmpeg -i input.mp4 -c:v libx264 -b:v 1M -pass 2 -c:a aac -b:a 128k output.mp4
```
