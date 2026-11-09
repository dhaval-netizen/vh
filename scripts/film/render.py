"""Render the lamp concept film with CairoSVG, actual font outlines and ffmpeg.
Run from the repository root. Optional --proof-dir saves three inspection frames.
"""
import argparse, base64, functools, io, json, subprocess
from pathlib import Path
import cairosvg
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--proof-dir', type=Path)
args = parser.parse_args()
font = TTFont(ROOT/'assets/neuemontreal-medium.otf')
glyphs, cmap, metrics = font.getGlyphSet(), font.getBestCmap(), font['hmtx'].metrics
upm = font['head'].unitsPerEm
@functools.lru_cache(maxsize=None)
def text(line, size, baseline, fill='#f4f3ed'):
    scale = size/upm
    width = sum(metrics[cmap[ord(c)]][0] for c in line)*scale
    x, result = (1280-width)/2, []
    for character in line:
        name = cmap[ord(character)]
        pen = SVGPathPen(glyphs); glyphs[name].draw(pen)
        result.append(f'<path d="{pen.getCommands()}" transform="translate({x} {baseline}) scale({scale} {-scale})" fill="{fill}"/>')
        x += metrics[name][0]*scale
    return ''.join(result)
frames = json.loads(subprocess.check_output(['node', str(ROOT/'scripts/film/frames.mjs')]))
logo = base64.b64encode((ROOT/'assets/vh-email-logo.png').read_bytes()).decode()
out = ROOT/'assets/preorder/vh-lamp-film.mp4'
process = subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','png','-r','24','-i','-','-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(out)], stdin=subprocess.PIPE)
if args.proof_dir: args.proof_dir.mkdir(parents=True,exist_ok=True)
for i, f in enumerate(frames):
    background = '#000000' if f['end'] else '#252720'
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1280" height="720"><rect width="1280" height="720" fill="{background}"/>'
    if f['end']:
        svg += f'<image x="360" y="130" width="560" height="231" xlink:href="data:image/png;base64,{logo}"/>'
        svg += text('Just a better lamp.', 56, 465)
        svg += text('Follow the work at vh.do/lamp', 25, 529, '#d6d7cf')
    else:
        art = f['art'].replace('<svg ', f'<svg x="{f["x"]}" y="{f["y"]}" width="{f["width"]}" height="{f["height"]}" ',1)
        svg += art + text(f['line'], 48, 580)
    svg += text('Concept animation. Product in development.', 18, 676, '#d6d7cf') + '</svg>'
    png = cairosvg.svg2png(bytestring=svg.encode())
    process.stdin.write(png)
    if i in [48,240,504] and args.proof_dir: (args.proof_dir/f'film-{i:04d}.png').write_bytes(png)
    if i == 240: Image.open(io.BytesIO(png)).convert('RGB').save(ROOT/'assets/preorder/vh-lamp-film-poster.jpg',quality=93)
process.stdin.close()
if process.wait(): raise SystemExit('ffmpeg failed')
print(f'Rendered {len(frames)} frames, 24 seconds: {out.name}')
