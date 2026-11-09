# Launch film renderer

`film.html` draws the 48-second launch film frame by frame from the same line art the pre-order page uses (`preorder-art.mjs`). Change the scenes, timings or words in the `scenes` list in `film.html`, then re-render.

## Re-render

You need Python with Playwright (`pip install playwright`, then `playwright install chromium`) and ffmpeg.

1. Serve the repo root: `python3 -m http.server 8765`
2. Capture frames at 24 fps into a folder outside the repo:

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    page = p.chromium.launch().new_page(viewport={'width': 1280, 'height': 720})
    page.goto('http://localhost:8765/scripts/film/film.html')
    page.wait_for_function('window.ready === true')
    film = page.locator('#film')
    for i in range(int(page.evaluate('window.DURATION') * 24)):
        page.evaluate(f'window.renderFrame({i / 24})')
        film.screenshot(path=f'/tmp/frames/f{i:04d}.png')
```

3. Encode:

```sh
ffmpeg -framerate 24 -i /tmp/frames/f%04d.png -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p -movflags +faststart assets/preorder/vh-lamp-film.mp4
ffmpeg -i /tmp/frames/f0828.png -q:v 3 assets/preorder/vh-lamp-film-poster.jpg
```

Frame 828 (34.5 seconds, "Sit down. It's on.") is the poster.
