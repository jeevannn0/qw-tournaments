# Image credits

## Runtime Free Fire artwork

The tournament UI uses locally stored images sourced from Garena’s [official Free Fire wallpaper library](https://ff.garena.com/en/wallpaper/) and live official-site media. Copyright and trademarks remain with Garena and their respective owners. Files were only resized proportionally and JPEG-compressed for web delivery; they were not recolored, distorted, composited, or rearranged.

| Runtime file | UI role | Official source |
|---|---|---|
| `assets/free-fire-hero-1920.jpg` | Desktop/tablet Home hero | [2880×1020 Garena source](https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20226/8912a8052c3c736ac49e836a7947fd4f.png) |
| `assets/free-fire-hero-960.jpg` | Phone Home hero | Same 2880×1020 Garena source above |
| `assets/free-fire-solo.jpg` | Solo event identity | [Garena CDN source](https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202210/3339313cfb446d61ce907b5efc2b4fd7.jpg) |
| `assets/free-fire-squad.jpg` | Squad Battle Royale identity | [Garena CDN source](https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202210/82fe305f7dbb9f25e68996f8f719e576.jpg) |
| `assets/free-fire-clash.jpg` | Clash Squad / TDM event identity | [Garena CDN source](https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202210/aa959aa3d8790d3a44f7f20f16adfa01.jpg) |

The uncompressed `assets/free-fire-hero-hd.png` is the retained 2880×1020 source used to generate the two responsive hero variants. Provenance stays in this document rather than being overlaid on the artwork. Garena’s [brand-asset guidance](https://ff.garena.com/en/brand/) says its assets should retain their original form. Before operating a public paid tournament, the site owner should independently confirm that the intended artwork use and tournament operation comply with Garena’s current policies.

## Original QW artwork

- `assets/favicon.svg` — original QW shield mark used only as the website favicon.
- `assets/battle-arena.svg` — original fictional QW arena illustration retained in the repository but no longer loaded by the public pages.

## Legacy and unused files

The older `ff-arena-*.jpg`, `event-*.jpg`, and `qw-*-source.jpg` files are not referenced by the current public UI. They should not be published as implied endorsements. Remove them in a separate asset-cleanup change after confirming no external consumer relies on those filenames.

Content was rephrased for compliance with licensing restrictions.
