# Public edition / 公开版说明

Prepared on 2026-09-06. This repository contains redacted research records, not the untouched private evidence archive.

2026-09-06 按维护者要求制作公开脱敏版。原始文件先按原路径备份并记录 SHA-256，再对公开副本进行有记录的修改。`_backup/`、`_build/` 和临时目录由 Git 忽略，不属于发布内容。

## Removed or generalized / 移除与泛化

- Contributor account email replaced with an anonymous contributor description; subscription type retained.
- Personal absolute paths replaced with logical source names or an anonymous local-directory placeholder.
- Reference to a private diagnostic script replaced with a method reference.
- Duplicate verbatim Caijing article excerpts omitted. Numeric fields, article metadata, URLs, uncertainty and adoption rationale retained. Two quote-only observations were converted to structured numerical fields.

## Retained / 保留

- The initial 2026-09-06 public snapshot contained all 81 adopted plan × model rows and separate leaderboard scores. The current dataset has since expanded to 179 rows; later additions follow the same redaction rules.
- Aggregate usage measurements needed to understand quota estimates; these are not conversation transcripts or credentials.
- Evidence dates, public source URLs, model configurations, confidence, rejected claims and decision notes.
- Necessary technical evidence from other sources and mandatory upstream author attribution. Public source attribution is not treated as a private identifier.
- All full-data bilingual charts and tables.

脱敏不等于重新核验每个外部来源，也不将第三方内容重新许可为 MIT。历史记录仍可能互相矛盾，以采用脚本为准。数值不是全部直接实测；置信度和缺分说明必须随数据保留。

Local backup manifests contain the private before/after hashes and restoration details. Do not upload the entire working folder as a ZIP: publish the Git-selected files, excluding ignored local material.
