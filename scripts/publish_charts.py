"""Export all full-data charts with bilingual filenames and a browsable index."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / '_build'
CHARTS = ROOT / 'charts'
BOARDS = {
    'CodeArena榜': ('code-arena', 'Code Arena'),
    'AgentArena榜': ('agent-arena', 'Agent Arena'),
    'AA智力榜': ('aa-intelligence', 'AA Intelligence'),
    'AA编程Agent榜': ('aa-coding-agent', 'AA Coding Agent'),
}


def exports():
    yield BUILD / '帕累托交互图.html', CHARTS / 'zh' / 'pareto' / '帕累托交互图.html'
    for source in sorted(BUILD.iterdir()):
        if source.suffix not in ('.svg', '.png', '.txt'):
            continue
        stem = source.stem
        language = 'en' if '_英文' in stem else 'zh'
        base = stem.replace('_英文', '')
        if base.startswith('帕累托_'):
            if not base.endswith('_全量'):
                continue
            tag = base.removeprefix('帕累托_').removesuffix('_全量')
            slug, title = BOARDS[tag]
            name = f'pareto-{slug}' if language == 'en' else f'帕累托_{tag}'
            category = 'pareto'
        elif '总览' in base:
            category = 'overview'
            name = base
            if language == 'en':
                name = ('monthly-allowance' if base.startswith('额度') else 'real-price') + '-overview'
                if '混合比例' in base:
                    name += '-hybrid-scale'
                if '表' in base:
                    name += '-table'
        elif base.startswith('前沿'):
            category = 'frontier'
            prefix, tag = base.split('_', 1)
            slug, title = BOARDS[tag]
            name = base if language == 'zh' else f'frontier-{"allowance" if "额度" in prefix else "price"}-{slug}' + ('-table' if '表' in prefix else '')
        else:
            continue
        yield source, CHARTS / language / category / (name + source.suffix)


def main():
    exported = []
    for source, destination in exports():
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        exported.append(destination)
    lines = ['# Charts / 图表目录', '',
             'All Pareto charts use the full dataset. Static charts summarize the highest archived configuration reference. / 帕累托图均使用全量套餐；静态图为最高存档配置参考汇总。', '',
             '[All-configuration interactive view / 全配置交互图（中文）](zh/pareto/帕累托交互图.html) · Download the HTML to open locally; Plotly requires network access. / 下载HTML后本地打开，Plotly需要联网。', '',
             'Dollar/credit conversions use 97.5% cache reads, 2.15% fresh input and 0.35% output; direct total-token measurements are not normalized again. / 美元或credits额度换算统一采用缓存读取97.5%、普通输入2.15%、输出0.35%；直接total-token实测不重复归一。', '',
             '| Chart / 图表 | English SVG | 中文 SVG | English PNG | 中文 PNG |',
             '|---|---|---|---|---|']
    english = [p for p in exported if p.suffix == '.svg' and p.relative_to(CHARTS).parts[0] == 'en']
    english.sort(key=lambda p: ({'pareto': 0, 'overview': 1, 'frontier': 2}[p.parent.name], p.name))
    for en in english:
        source = next(s for s, d in exports() if d == en)
        zh_source = source.with_name(source.name.replace('_英文', ''))
        zh = next(d for s, d in exports() if s == zh_source)
        links = [f'[{label}]({p.relative_to(CHARTS).as_posix()})' for label, p in [
            ('SVG', en), ('SVG', zh), ('PNG', en.with_suffix('.png')), ('PNG', zh.with_suffix('.png'))]]
        label = en.stem.replace('-', ' ').title() + ' / ' + zh.stem
        lines.append('| ' + label + ' | ' + ' | '.join(links) + ' |')
    lines += ['', '## Data tables / 数据表', '']
    lines += [f'- [{p.relative_to(CHARTS).as_posix()}]({p.relative_to(CHARTS).as_posix()})' for p in exported if p.suffix == '.txt']
    (CHARTS / 'README.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    (BUILD / 'published-charts.json').write_text(json.dumps([p.relative_to(ROOT).as_posix() for p in exported], ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Published {len(exported)} files with bilingual index')


if __name__ == '__main__':
    main()
