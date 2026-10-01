# Agent 自测速度（无需 API）

让任意编程 Agent（Devin、Claude Code、Codex、Droid、OpenCode、Gemini CLI、Cursor……）在自己的会话里测出**当前模型的输出速度**，不需要 API key，只用 Python 标准库。

## 怎么用

把下面这句话直接发给 Agent：

> 运行 `python3 tools/agent_speedtest/speedtest.py start --model "<你认为自己是哪个模型>"`，然后严格按它打印的指令一轮一轮执行 `step`，直到打印出结果。

Agent 会依次完成 9 轮（1 轮热身 + 4 种长度 × 2 次，顺序随机）：每轮把一段指定长度、指定主题的英文短文直接写进下一条命令的 heredoc 里。结束后结果保存在 `tools/agent_speedtest/results/`。

其它命令：

| 命令 | 作用 |
|---|---|
| `detect` | 只打印识别到的 Agent / 模型 |
| `status` | 查看进行中的测试和下一轮指令 |
| `abort` | 放弃进行中的测试 |
| `report` | 汇总 `results/` 里所有结果为 Markdown 表 |
| `start --sizes 0,200,800 --reps 3` | 自定义长度和重复次数 |
| `start --effort high --note "..."` | 记录推理档位和备注 |

## 原理

每次 `step` 进程启动时记下时间，退出前记下“下一轮指令发出”的时间。两次之间的间隔 = 工具结果回传 + 预填充 + 隐藏思考 + **生成回复** + 工具派发。用不同长度的回复做线性回归：

```
间隔秒数 = 固定开销 + 输出 token 数 / 输出速度
```

- **output speed（tok/s）**：斜率的倒数，即纯解码速度，已扣除固定开销。
- **fixed overhead**：截距，每轮固定耗时。
- **minimal turn**：只回复 `ok` 的轮次中位数，即一次工具往返的最短时间。
- **naive long-turn**：长轮次 token / 整段间隔，含开销，接近用户体感速度。

## 模型识别

- Agent / 外壳：从环境变量（`DEVIN_DIR`、`CLAUDECODE`、`CODEX_*`、`GEMINI_CLI`、`OPENCODE`、`CURSOR_*` 等）和父进程名识别。
- 模型：优先用 `--model` 自报；否则读本地配置（`ANTHROPIC_MODEL`、`~/.claude/settings.json`、`~/.codex/config.toml`、`~/.factory/settings.json`、`~/.config/opencode/opencode.json`、`GEMINI_MODEL`、`AIDER_MODEL`）。来源写在结果的 `model_source` 里。Devin 这类托管 Agent 不向虚拟机暴露底层模型，只能自报。

## 局限

- token 数是估计值：装了 `tiktoken` 用 o200k_base，否则用启发式（在英文散文上与 o200k_base 相差约 3%）。各模型自己的分词器可能差 10–20%，跨厂商比较时更推荐看 `words/s`。
- 若模型在长回复前思考得更久，思考时间会被算进斜率，速度会偏低；结果的 R² 偏低时要谨慎。
- 校验只能拦住长度不符、重复使用前文、内容重复的回复，无法证明 Agent 没有用代码生成文本，依赖 Agent 遵守规则。
- 网络与平台负载会波动，建议同一配置多跑几次再看 `report`。
