# 贡献指南

谢谢你想帮这座小岛变得更好。无论是改错别字、补文档、修 bug，还是改进移动端体验，都欢迎。

参与本项目即表示你同意遵守 [行为准则](CODE_OF_CONDUCT.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，不要开公开 Issue。

## 开始之前

- 需要 **Node.js 22.12+** 与 npm（版本要求写在 `package.json` 的 `engines` 里）。
- 项目没有后端、数据库或 API Key，`npm ci` 之后就能跑起来。
- 只有重新生成示例插画/音乐时才需要 Python；普通改文案和代码不用装。

```sh
git clone https://github.com/YOUR_USERNAME/island-resort.git
cd island-resort
npm ci
npm run dev
```

把 `YOUR_USERNAME` 换成你自己的 GitHub 用户名。如果你没有 fork 权限，也可以直接把仓库下载成 zip，解压后在目录里执行同样的 `npm ci` / `npm run dev`。第一次打开会在终端显示本地地址（通常是 `http://localhost:5173`）。

## 从哪里下手

| 想改什么 | 主要文件 |
| --- | --- |
| 品牌、欢迎卡、庆祝文案与信、音乐配置、页脚 | `src/site.ts` |
| 四个地点、20 个 spots 的标题/介绍/照片/坐标/底部导航 | `src/resort/data.ts` |
| 3D 场景、镜头、灯光、声音 | `src/resort/` |
| 页面样式与字体 | `src/resort/resort.css` |
| 示例照片、音乐 | `public/examples/`、`public/music/`（生成脚本在 `scripts/`） |
| 文档 | `README.md`、`docs/` |

详细的二创步骤见 [docs/REMIX.md](docs/REMIX.md)。原则是：**能改配置就不要改组件**。文案尽量留在 `src/site.ts` 与 `src/resort/data.ts`，这样其他 fork 的人也能只改两个文件就换成自己的内容。

## 本地检查

提交 PR 前请至少跑通：

```sh
npm test        # 昼夜循环、光照与文案/素材一致性测试
npm run build   # TypeScript 检查 + Vite 生产构建
```

如果改动涉及文案、照片或素材，再跑一次完整检查：

```sh
npm run check   # 测试（含文案/素材一致性与本机路径检查）+ 构建
```

格式方面，仓库使用 Prettier：

```sh
npm run format       # 格式化
npm run format:check # 只检查
```

CI 只跑 `npm test` 与 `npm run build`，不会因为格式问题让构建失败；但请尽量保持 `npm run format` 后的状态，减少 review 噪音。

## 提交 PR

1. Fork 仓库，从 `main` 拉一个分支，例如 `fix/mobile-dock`。
2. 小步提交，一个 PR 只做一件事；提交信息用一句话说明改动即可（中文或英文都可以）。
3. 在 PR 描述里写清楚：改了什么、为什么改、怎么验证。界面改动请附桌面（1440 宽）和手机（390 宽）截图；横屏改动再附 844×390。
4. 涉及流程变化（照片卡、庆祝流程、昼夜切换、声音）时，请写出复现步骤与检查过的状态。
5. 如果改动较大，先开 Issue 讨论方向，避免白做。

评审会关注：行为是否保持一致、移动端与键盘可用性、文案是否集中管理、是否引入了不必要的依赖。

## 素材与隐私政策（重要）

这座岛是公开仓库，**`public/` 下的所有文件都会被直接访问**。请不要提交：

- 真人照片、合影、带人脸的截图
- 私人信件、聊天记录、日记或含真实姓名的文案
- 他人的可版权录音、影视/游戏素材、带水印的图片
- 带 EXIF/定位信息的原图（请先导出并移除元数据）
- 任何你无权公开的内容

示例插画、示例音乐都是脚本程序生成的演示素材，仅用于展示效果。把它们换成自己的照片、音乐时，请确认：

- 你有权公开这些内容；
- 画面中的人、录音的参与者同意公开；
- 文件不携带定位、设备等隐私元数据；
- 在 PR 描述或仓库文档里写明素材来源与许可。

如果你不确定某份素材能不能公开，先不要提交，开 Issue 问一下。

## 文档与文案

- 中文文案改动同样需要跑测试：`tests/site.test.ts` 会检查文案配置与照片文件是否一致。
- 新增或替换照片时，记得同步 `src/resort/data.ts` 里的 `src`、`caption`、`width`、`height`。
- 改文档时请保持 `README` 为入口、`docs/` 放细节的结构，不要重复大段相同内容。

## 许可

贡献的代码与文档按 [MIT 许可](LICENSE) 授权；新增素材请确保有权以相应许可随本项目分发，并在 PR 中说明。
