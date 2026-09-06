// SVG 是源文件，PNG 仅为等比例预览。需要 npm 包 sharp。
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const out = path.resolve(__dirname, '../_build');
const charts = JSON.parse(fs.readFileSync(path.join(out, 'SVG坐标核对.json'), 'utf8'));
async function main() {
  for (const {stem} of charts) {
    await sharp(path.join(out, stem + '.svg'), {density: 144})
      .png().toFile(path.join(out, stem + '.png'));
    console.log(stem + '.png');
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
