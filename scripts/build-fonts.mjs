/**
 * 构建前自动生成 src/fonts.generated.css
 *
 * 为什么要这一步：
 * @fontsource 的 CSS 同时声明 woff2 和 woff 两种格式。现代浏览器全都支持
 * woff2，woff 永远不会被下载，但它会被打进产物（实测 16MB+），
 * 并且让 CSS 体积翻倍。这里在构建前把 woff 回退剔掉。
 *
 * 生成的文件已被 .gitignore 忽略，`npm run build` / `npm run dev` 会自动重建。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// [包名, 需要的字重] —— 与改造前 Google Fonts 请求的字重保持一致
const FONTS = [
  ['@fontsource/inter', [300, 400, 500, 600, 700]],
  ['@fontsource/noto-serif-sc', [400, 700]],
  ['@fontsource/noto-serif-kr', [400, 700]],
  ['@fontsource/geist-mono', [300, 400, 500]],
];

const chunks = [
  '/* 本文件由 scripts/build-fonts.mjs 自动生成，请勿手动修改 */',
];

let stripped = 0;

for (const [pkg, weights] of FONTS) {
  for (const weight of weights) {
    const cssPath = join(root, 'node_modules', pkg, `${weight}.css`);
    if (!existsSync(cssPath)) {
      console.error(`[build-fonts] 找不到 ${cssPath}，请先执行 npm install`);
      process.exit(1);
    }

    let css = readFileSync(cssPath, 'utf8');

    // 1. 去掉 woff 回退：", url(./files/x.woff) format('woff')"
    const before = css;
    css = css.replace(
      /,\s*url\([^)]+\.woff\)\s*format\(\s*(['"])woff\1\s*\)/g,
      ''
    );
    if (css !== before) stripped += 1;

    // 2. 把 ./files/ 换成相对本文件的路径，Vite 才能解析并打包字体文件
    css = css.replace(
      /url\(\.\/files\//g,
      `url(../node_modules/${pkg}/files/`
    );

    chunks.push(css.trim());
  }
}

const outPath = join(root, 'src', 'fonts.generated.css');
writeFileSync(outPath, chunks.join('\n\n') + '\n', 'utf8');

console.log(
  `[build-fonts] 已生成 src/fonts.generated.css（${FONTS.reduce((n, [, w]) => n + w.length, 0)} 个字重，${stripped} 处 woff 回退已剔除）`
);
