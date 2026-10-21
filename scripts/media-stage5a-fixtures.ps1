$ErrorActionPreference='Stop'
$root=Join-Path $PSScriptRoot '../artifacts/stages/media-stage5a-evidence'
New-Item -ItemType Directory -Force $root | Out-Null
# Synthetic diagnostic fixtures only; no application transcoding or existing object changes.
& ffmpeg -hide_banner -loglevel error -f lavfi -i 'testsrc2=size=1280x720:rate=30' -f lavfi -i 'sine=frequency=440:sample_rate=48000' -t 75 -c:v libx264 -preset ultrafast -b:v 2600k -minrate 2600k -maxrate 2600k -bufsize 5200k -x264-params 'nal-hrd=cbr' -g 60 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart -y (Join-Path $root 'progressive.mp4')
if($LASTEXITCODE){throw 'MP4 fixture generation failed'}
& ffmpeg -hide_banner -loglevel error -f lavfi -i 'testsrc2=size=640x360:rate=24' -f lavfi -i 'sine=frequency=660:sample_rate=48000' -t 8 -c:v libvpx -b:v 700k -c:a libopus -y (Join-Path $root 'clip.webm')
if($LASTEXITCODE){throw 'WebM fixture generation failed'}
& ffmpeg -hide_banner -loglevel error -f lavfi -i 'sine=frequency=550:sample_rate=48000' -t 6 -c:a libopus -y (Join-Path $root 'legacy-audio.webm')
if($LASTEXITCODE){throw 'Audio fixture generation failed'}
& ffmpeg -hide_banner -loglevel error -f lavfi -i 'testsrc2=size=320x180:rate=15' -t 2 -c:v mpeg2video -y (Join-Path $root 'unsupported.mp4')
if($LASTEXITCODE){throw 'Unsupported-codec fixture generation failed'}
& ffmpeg -hide_banner -loglevel error -i (Join-Path $root 'legacy-audio.webm') -c:a libmp3lame -b:a 64k -y (Join-Path $root 'ordinary.mp3')
if($LASTEXITCODE){throw 'MP3 fixture generation failed'}
[IO.File]::WriteAllBytes((Join-Path $root 'corrupt.webm'),[byte[]](26,69,223,163,0,0,0,0,0,0,0,0))
$size=(Get-Item (Join-Path $root 'progressive.mp4')).Length
if($size -lt 20MB -or $size -gt 100MB){throw "Large fixture out of acceptance range: $size"}
Write-Output "Synthetic H264/AAC, VP8/Opus, MPEG2 and invalid fixtures ready; large MP4 $size bytes"
