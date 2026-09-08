# Provider SVG assets

`ProviderLogo` discovers `*.svg` and `*.png` here at build time. Artwork is shown at 28×28 CSS pixels next to the model name. Third-party access shows the channel followed by the model developer. PNG assets are inlined so the static deployment preserves their binary content.

## Files

openai, anthropic, xai, cursor, kimi, zhipu, minimax, alibaba, opencode, deepseek, google, command-code, ollama, xiaomi, tencent, meta, microsoft, meituan, stepfun.

Alibaba uses the Qwen mark; Tencent uses Hunyuan; Meituan uses LongCat; Google uses the official G. Muse Spark uses the Meta mark. Step models use the StepFun five-square mark. Third-party rows show the reseller first, then the model manufacturer.

## Sources

Most marks are from [lobehub/lobe-icons](https://github.com/lobehub/lobe-icons) (MIT). Xiaomi is from [Simple Icons](https://github.com/simple-icons/simple-icons) (CC0). Command Code uses the complete official avatar (rounded frame + ⌘), not a cropped command-only mark. StepFun uses the official five-square geometry from stepfun.com with the current public avatar gradient. Zhipu Z and the OpenCode window are traced from official rasters.

Brand marks remain trademarks of their owners. Rebuild recipe: `_assemble.py` (expects a `_fetch/` cache of upstream SVGs).

Prefer SVG assets without embedded rasters or scripts. Command Code intentionally uses its complete PNG avatar. Keep gradient IDs unique within each SVG.
