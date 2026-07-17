# Thock — CC0 sound samples

The game synthesizes every sound in code by default. Drop a recorded sample in
here and it **replaces** that material's synth voice automatically (pitched to
follow the melody). Any material without a file just keeps using the synth — so
you can add them one at a time and approve each by ear.

## How to add a sample

1. Download a **CC0** (or Pixabay-license) clip — short, clean, mono if possible,
   `.mp3` or `.wav`. Trim it to just the hit (~0.1–0.6 s) in any editor.
2. Drop the file in this folder, e.g. `honey.mp3`.
3. Add a line to `manifest.json`:

```json
[
  { "key": "honey", "file": "honey.mp3", "gain": 0.9, "baseFreq": 261.63 }
]
```

- **key** — the material's sound id (table below), or `mt3` / `xda` for keycaps.
- **gain** — 0–1.5 loudness trim (start at 1, adjust by ear).
- **baseFreq** — the pitch the clip was recorded at, in Hz. The engine shifts
  playback toward the note being typed but clamps to 0.75×–1.35× so it never
  chipmunks. If you don't care about pitch-tracking, leave it at `261.63` (C4).

Reload the page — that material now plays your sample. Commit the files + manifest.

## Where to get CC0 clips (safe for the public site)

- **Pixabay** (Pixabay Content License — free, no attribution, commercial OK):
  `https://pixabay.com/sound-effects/search/<query>/`
- **Freesound**, filtered to Creative Commons 0:
  `https://freesound.org/search/?f=license:%22Creative+Commons+0%22&q=<query>`

## Per-material search terms → `key`

| Material    | `key`     | Try searching for                                  |
|-------------|-----------|----------------------------------------------------|
| Keycap      | `mt3`     | "mechanical keyboard thock", "keyboard key press"  |
| Keycap      | `xda`     | "creamy keyboard", "soft keycap"                   |
| Jelly       | `squish`  | "jelly squish", "gummy squish", "wet squish"       |
| Chocolate   | `snap`    | "chocolate snap", "twig snap", "crack"             |
| Butter      | `butter`  | "butter spread", "knife spread", "smear"           |
| Marshmallow | `marsh`   | "marshmallow squish", "foam compress", "soft poof" |
| Bubble      | `pop`     | "bubble pop", "soap bubble", "mouth pop"           |
| Ice         | `ice`     | "ice crack", "glass clink", "ice cube tap"         |
| Honey       | `honey`   | "honey stir", "thick liquid glug", "viscous stir"  |
| Slime       | `slime`   | "slime squish", "slime poke", "wet crunch"         |

## License log (fill in as you add files)

| file | source URL | license | author |
|------|-----------|---------|--------|
| mt3.mp3 | https://freesound.org/people/Code_Redder/sounds/537618/ | Creative Commons 0 | Code_Redder |
| sticky_peel.mp3 | https://freesound.org/people/Keegan_Miner/sounds/474580/ | Creative Commons 0 | Keegan_Miner |
| ice_cubes.mp3 | https://freesound.org/people/baidonovan/sounds/187349/ | Creative Commons 0 | baidonovan |
| choc_break.mp3 | https://freesound.org/people/pbeare70/sounds/851574/ | Creative Commons 0 | pbeare70 |
| squish_impact.mp3 | https://freesound.org/people/Bertsz/sounds/500912/ | Creative Commons 0 | Bertsz |

> Keep this table honest — even CC0 is nice to credit, and Pixabay clips should
> stay on Pixabay's license. Don't add anything you can't point to a source for.
