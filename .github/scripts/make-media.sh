#!/usr/bin/env bash
# Generates the test media the mock Jellyfin serves: a 60 s video (with and without audio),
# German subtitles, an HLS copy for the transcode path and a trickplay tile sheet.
set -euo pipefail
DIR=${MEDIA_DIR:-/tmp/bc-media}
mkdir -p "$DIR/hls"
cd "$DIR"
[ -s test.mp4 ] && [ -s hls/index.m3u8 ] && exit 0

ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }
video=(-f lavfi -i "testsrc2=size=640x360:rate=25:duration=60")
h264=(-c:v libx264 -profile:v baseline -pix_fmt yuv420p -g 50 -keyint_min 50 -sc_threshold 0 -b:v 600k)

ff "${video[@]}" -f lavfi -i "sine=frequency=440:duration=60" "${h264[@]}" -c:a aac -b:a 96k -ac 2 -movflags +faststart test.mp4
ff "${video[@]}" "${h264[@]}" -an -movflags +faststart test-noaudio.mp4
ff -i test.mp4 -c copy -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_filename hls/seg%d.ts hls/index.m3u8
ff -i test.mp4 -vf "fps=1/10,scale=320:180,tile=10x10" -frames:v 1 -q:v 5 trickplay-0.jpg

cat > test.srt <<'EOF'
1
00:00:01,000 --> 00:00:06,000
Willkommen im Kino.

2
00:00:08,000 --> 00:00:14,000
Das ist ein Testuntertitel.

3
00:00:20,000 --> 00:00:26,000
Viel Spaß beim Zuschauen.
EOF

ls -l "$DIR" "$DIR/hls" | head -30
