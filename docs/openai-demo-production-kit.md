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

Do not publish structured data containing placeholder URLs.

## Final safety check

- No secrets, cookies, account settings, email, notifications, or private tabs
- No claims that an A grade proves security
- Existing reviewed field reports shown as qualitative evidence
- No fabricated `submit_feedback` report
- Web, iOS, and Android visibly labeled
- Every main workflow represented
- Captions readable and synchronized
- Hosted URL works in a private browser
