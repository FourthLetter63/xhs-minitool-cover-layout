# xhs-minitool-cover-layout

为小红书小工具容器改写的离线 3:4 封面排版工具。**此仓库与原版 [`FourthLetter63/photo-collage`](https://github.com/FourthLetter63/photo-collage) 完全独立；不更改原版网页。**

## 功能

- 17 种 1–6 格及 9 格布局；网格行高/列宽比例、外边距、间距、圆角和背景色
- 画框中放置图片或文字；图片移动、缩放、吸附及框交换
- 多条叠加文字、样式/阴影、批量对齐及纵向排列
- 3:4 预览；1800 × 2400 导出；PNG、JPG 分别保存
- 在小红书容器内通过 `writeTempFile` → `saveImageToPhotosAlbum` 保存；其他浏览器只显示导出预览

## 字体

| 用途 | 字体 | 来源 |
| --- | --- | --- |
| 中文图片文字默认 | LXGW Bright Regular（完整 WOFF2） | [lxgw/LxgwBright v5.528](https://github.com/lxgw/LxgwBright/tree/v5.528) |
| 英文图片文字默认 | Cormorant Regular（完整 WOFF2） | [CatharsisFonts/Cormorant](https://github.com/CatharsisFonts/Cormorant) |
| **页面界面中文**（不在图片文字字体选择器中） | 汇文明朝体 UI 字符子集 WOFF2 | [原网页版仓库](https://github.com/FourthLetter63/photo-collage)内的原始 OTF |

构建时自动从以上公开来源下载二进制，按 Git blob SHA 校验；汇文明朝体仅保留 `app/index.html`、CSS 和 JS 源码中出现的非 ASCII 字符。未收入字体的字符回退至 LXGW Bright。**不会下载字体用于用户输入的图片文字。** 相关许可声明放在 `app/assets/font-licenses.json`。

## 打包与发布

不需要把字体二进制提交到 Git；GitHub Actions 在每次推送 `main` 或手动运行时完成：

1. 取得三份上游字体并校验 SHA；
2. 使用 `fonttools[woff]` 生成汇文明朝体 UI 子集；
3. 检查 JavaScript 语法、离线资源、ZIP 入口与 10 MiB 上限；
4. 上传 `xhs-minitool-cover-layout.zip` 构建产物。

在 [Actions → Build mini-tool ZIP](../../actions/workflows/build.yml) 选最新成功运行，下载 `xhs-minitool-cover-layout` artifact。GitHub artifact 外层可能是一个 ZIP，**上传小红书的是其中 `xhs-minitool-cover-layout.zip`，不要直接上传外层 artifact**。

源码在 `app/`；最终 ZIP 根目录必须直接有 `index.html`，不能把 `app/` 目录本身打进去。

> 官方 `minitool-zip-builder-1.8.0.skill` 已用于对照静态规范。当前小工具在线文档访问未核验，必须在创服平台模拟器验证，然后分别在 Android 和 iOS 真机扫码测试：选图、图片手势、字体显示与 PNG/JPG 相册保存。

## 手动复现构建（需要联网）

```bash
python3 -m pip install 'fonttools[woff]'
python3 scripts/build.py
```

产物写入 `build/xhs-minitool-cover-layout.zip`。