# OpenAI demo production kit

This kit reduces the reviewer video to a controlled recording and assembly
session. The canonical sequence is
`submission-assets/demo/demo-plan.json`.

## Generated assets

Run:

```bash
npm run demo:assets
```

This generates:

- `openai-demo-shot-list.md`
- `openai-demo-narration.md`
- `openai-demo-captions.vtt`
- `openai-demo-chapters.txt`
- `openai-demo-upload.json`

Render the visual cards with:

```bash
npm run demo:cards
```

This generates 16:9 title, closing, and thumbnail PNGs from local HTML using
headless Chrome. No network access is required.

## Recording workflow

1. Use a clean browser window with notifications, bookmarks, and unrelated tabs
   hidden.
2. Open the installed MCP Queen draft in ChatGPT Developer Mode.
3. Start macOS screen recording with `Shift-Command-5`.
4. Follow the generated shot list on web.
5. Record the short iOS discovery segment.
6. Record the short Android Trust Receipt segment.
7. Assemble the clips between the generated title and closing cards.
8. Add the generated captions and trim pauses or failed prompt attempts.
9. Export a 1080p MP4.
10. Open the hosted URL in a private browser window to confirm reviewers do not
    need access.

The recording should be approximately 5–6 minutes. It does not need elaborate
editing; reviewer clarity, readable tool activity, and evidence boundaries are
more important than polish.

## One-command assembly

Save genuine Developer Mode recordings in the ignored local working directory:

```text
.private/openai-demo/clips
```

Use these exact base filenames:

```text
web-intro
server-search
grade
tool-search
trust-receipt
field-reports
leaderboard
feedback-guardrail
ios
android
```

Each recording may use `.mp4`, `.mov`, or `.m4v`. The assembler checks those
containers in that order.

Then run:

```bash
npm run demo:assemble
```

The script uses `ffmpeg` from `PATH`. If an existing executable lives
elsewhere, set `FFMPEG_BIN=/absolute/path/to/ffmpeg`.

The assembler refuses to run if any real platform clip is missing. It
normalizes the footage to 1920×1080 at 30 fps, adds the prepared title and
closing cards, burns in the prepared captions, and verifies the final duration
is approximately 5:35. The default output is
`.private/openai-demo/output/mcpqueen-openai-demo.mp4`. Set
`MCPQUEEN_DEMO_WORKDIR` or pass `--clips-dir` and `--output` to use another
private location. The source recordings and final reviewer video are ignored
and stay out of the public Git repository.

## Assembly order

1. Title card
2. Web introduction
3. Server discovery
4. Operational-grade evidence
5. Tool-level search
6. Trust Receipt
7. Reviewed field reports
8. Operational leaderboard
9. Feedback safety boundary
10. iOS discovery
11. Android trust evidence
12. Closing card

## Hosting

Use a stable HTTPS URL that opens without login or an access request. A public
or unlisted video host is acceptable for review when the link is directly
accessible.

After review, create a public canonical page with:

- the cleaned video;
- transcript and chapters;
- links to MCP Queen, the MCP endpoint, integrations, field reports, and
  methodology;
- `VideoObject` structured data with the final thumbnail, upload date,
  duration, description, and video URL.

The repository already contains the prepared `/demo` page structure and
`public/demo/openai-demo-captions.vtt`. The page intentionally renders a
source-less player, chapter slots, transcript slots, and an explicit
not-published status. Before adding footage:

1. reconcile the public WebVTT track to the genuine final edit;
2. update chapter timing and transcript text from that verified caption track;
3. add the stable public video or embed URL to the player;
4. verify the video, thumbnail, upload date, and final duration;
5. only then add complete `VideoObject` structured data.

`npm run discovery:check` fails if the prepared page gains a video source,
`VideoObject`, claimed third-party video URL, or common publication placeholder
before that transition is deliberately implemented. Do not publish structured
data containing placeholder URLs.

## Final safety check

- No secrets, cookies, account settings, email, notifications, or private tabs
- No claims that an A grade proves security
- Existing reviewed field reports shown as qualitative evidence
- No fabricated `submit_feedback` report
- Web, iOS, and Android visibly labeled
- Every main workflow represented
- Captions readable and synchronized
- Hosted URL works in a private browser
