#!/bin/sh
# Renders the hero background film into public/video from a folder of photos named 4.png ... 20.png
# (InnoTech'25, 1125x720). Edit storyboard.py to change shots, timing or transitions.
#   scripts/hero-video/render.sh /path/to/photos
# Needs Docker (uses the linuxserver/ffmpeg image, ffmpeg 9).
set -e
PHOTOS="$(cd "${1:?Usage: render.sh <photos folder>}" && pwd)"
cd "$(dirname "$0")"
OUT="$(cd ../../public/video && pwd)"
python3 storyboard.py
run() { docker run --rm -v "$PWD":/w -v "$PHOTOS":/src -v "$OUT":/out -w /w --entrypoint ffmpeg lscr.io/linuxserver/ffmpeg:latest -hide_banner -loglevel error -y "$@"; }
run $(cat inputs.txt) -/filter_complex filter.txt -map "[out]" -an -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p master.mp4
# H.264 for every browser, VP9 (smaller) where supported; no audio track.
run -i master.mp4 -an -c:v libx264 -preset veryslow -crf 31 -profile:v high -pix_fmt yuv420p -movflags +faststart -tune film /out/hero.mp4
run -i master.mp4 -an -c:v libvpx-vp9 -crf 46 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 /out/hero.webm
# The poster is the first full frame, so the switch from poster to video is invisible; also shown with reduced motion.
run -ss 0.4 -i master.mp4 -frames:v 1 -c:v libwebp -quality 78 /out/hero-poster.webp
rm -f master.mp4 filter.txt inputs.txt
ls -la "$OUT"
