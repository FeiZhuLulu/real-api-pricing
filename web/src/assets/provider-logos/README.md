# Provider SVG assets

`ProviderLogo` discovers `*.svg` and `*.webp` here at build time and inlines them as data URLs, so the page, the SVG chart and exported files all carry the artwork without extra requests. Artwork is shown at 20–28 CSS pixels next to the model name. Third-party access shows the channel followed by the model developer. In dark mode, marks drawn in near-black ink (OpenAI, Anthropic, xAI, Cursor, Ollama, Kimi, Devin, Meituan) are recoloured to light ink; tile logos keep their own background.

## Files

openai, anthropic, xai, cursor, kimi, zhipu, minimax, alibaba, opencode, deepseek, google, command-code, ollama, xiaomi, tencent, meta, microsoft, meituan, stepfun, devin.

Alibaba uses the Qwen mark; Tencent uses Hunyuan; Meituan uses LongCat; Google uses the official G. Muse Spark uses the Meta mark. Step models use the StepFun five-square mark. Devin (channel) and Cognition (SWE models) both use the Devin three-hexagon mark. Third-party rows show the reseller first, then the model manufacturer.

## Sources

Most marks are from [lobehub/lobe-icons](https://github.com/lobehub/lobe-icons) (MIT). Xiaomi is from [Simple Icons](https://github.com/simple-icons/simple-icons) (CC0). Command Code uses the complete official avatar (rounded frame + ⌘), not a cropped command-only mark. StepFun uses the official five-square mark; the circle gradient is sampled from the current public avatar (lime #67FBB1 → aqua #00F4E5 → cyan #1ACDEE). Chart solid color is the mid aqua #00F4E5. Zhipu Z and the OpenCode window are traced from official rasters. Devin is redrawn by hand from the official avatar (three vertical-sided hexagons joined at a notched hub).

Brand marks remain trademarks of their owners. Rebuild recipe: `_assemble.py` (expects a `_fetch/` cache of upstream SVGs).

Prefer SVG assets without embedded rasters or scripts. Command Code intentionally uses its complete avatar, stored as a 96×96 WebP (2 KB; the 400×400 JPEG original was 25 KB). Keep gradient IDs unique within each SVG.
