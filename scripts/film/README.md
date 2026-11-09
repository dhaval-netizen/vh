# Lamp concept film

The 24-second silent animation uses the contributor's original SVG lamp and room drawings. It illustrates an idea; it is not footage of a working prototype. The disclosure remains visible throughout. The end card uses the existing logo asset and invites viewers to follow development, without taking orders.

To render, install CairoSVG, fonttools and Pillow in a Python environment and have Node.js and ffmpeg available. From the repository root:

```sh
python scripts/film/render.py --proof-dir /tmp/vh-film-proof
```

`frames.mjs` defines the scene timing and captions. `render.py` outlines the actual Neue Montreal glyphs, renders frames and writes the MP4 and JPEG poster to `assets/preorder/`. Inspect the three proof frames and play the resulting video before publishing. The page includes a written description of the film.
