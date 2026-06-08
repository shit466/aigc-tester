# PaperTrace

中英文论文 AIGC 风险诊断与学术写作改进工作台。

PaperTrace 不是另一个“AI 百分比”页面。它把英文检测器、中文检测报告、段落热力、误判提示和修改建议放在一个工作台里，帮助用户判断论文哪里缺少证据、引用、作者判断和真实研究痕迹。

## 功能

- 中英文/混合论文段落拆分
- 浏览器本地上传并解析 `.txt`、`.md`、`.docx`、`.pdf`
- 段落级 AIGC 风险热力
- 中文报告导入入口设计，面向知网、维普、万方等检测报告
- 英文检测器路由设计，可接 GPTZero、Copyleaks 等 API
- 只输出修改建议，不一键代写论文
- GSAP 动画工作台：扫描层、证据流、段落入场、鼠标跟随镜头
- 支持 `prefers-reduced-motion`

## 当前检测能力

当前版本可以上传或粘贴论文文本，并基于段落写作特征生成风险热力和修改建议。它还没有接入 GPTZero、知网、维普或万方的正式检测接口，因此不能替代权威检测报告。

PDF 解析依赖文档本身包含可复制文本。扫描版或图片型 PDF 需要先 OCR。

## 本地运行

```bash
npm install
npm run dev
```

打开终端输出的本地地址，通常是 `http://127.0.0.1:4173/`。

## 构建

```bash
npm run build
npm run preview
```

## 打包给用户下载

```bash
npm run package:zip
```

生成文件会放在 `release/` 目录。用户下载后可以运行：

```bash
npm install
npm run dev
```

或者直接部署 `dist/` 到 GitHub Pages、Netlify、Vercel、Cloudflare Pages 等静态托管平台。

## 产品边界

AI 检测存在误判和漏判。PaperTrace 的结果只能作为写作风险提示，不能作为学术惩罚或论文判定的唯一依据。
