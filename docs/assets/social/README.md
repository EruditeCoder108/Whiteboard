# GitHub repo card

- [Ready-to-upload PNG](repo-card.png): 1280 × 640, solid background, under 1 MB.
- [Editable HTML template](repo-card.template.html): live text, colours and positioned local images.
- [Safe-area guide PNG](repo-card-guides.png): 80 px inset; keep important content within it.

The guide is separate from the final card. Open the template in a browser to preview it. Edit its
text and CSS to reuse it, keeping the canvas size and safe inset. Add `class="guides"` to the body
to preview the overlay; remove it for the final output.

From the app directory:

```powershell
npm run branding
```

This exports the logo sizes, README cover, final social card and guide card using bundled Electron
with disposable profiles. The card is local artwork; the script does not upload anything.

To publish it, open repository **Settings → General → Social preview**, choose **Edit**, and upload
`repo-card.png`. GitHub recommends 1280 × 640 and requires an image below 1 MB. See the
[official instructions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview).

The glass apparatus is generated cover artwork, not an in-app screenshot. The README's
[gallery](../../../README.md#a-closer-look-at-the-collection) shows the actual native models.
See [artwork provenance and prompts](../readme/GENERATION.md).
