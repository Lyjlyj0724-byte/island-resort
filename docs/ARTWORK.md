# 示例素材说明

[← 回到 README](../README.md)

![22 张程序生成的示例插画](artwork-preview.webp)

仓库里的示例素材都可以替换：22 张示例插画与 32 秒示例音乐由 [`scripts/`](../scripts) 下的 Python 脚本**程序生成**；项目图标是随仓库提供的简单矢量图，预览图由示例插画拼贴或页面截图得到。所有示例素材都没有真人照片、没有外部图片，也没有任何版权录音。它们只用于让模板开箱即可看到完整效果；换成自己的内容后，可以删掉不再使用的示例文件。

## 素材总览

| 素材 | 位置 | 规格 | 生成方式 |
| --- | --- | --- | --- |
| 22 张示例插画 | `public/examples/*.webp` | 横图/竖图，最长边 1440–1800 px | `scripts/generate_examples.py`（Pillow + numpy） |
| 示例音乐 | `public/music/island-theme.wav` | 32 秒无缝循环，22050 Hz、单声道、16-bit PCM | `scripts/generate_music.py`（Python 标准库） |
| 项目图标 | `public/favicon.svg` | 64×64 SVG | 随仓库提供的矢量图 |
| 插画拼贴预览 | `docs/artwork-preview.webp` | 1600×1000 | 由 `generate_examples.py` 用 22 张示例插画拼成 |
| 场景宣传图 | `docs/hero.webp` | 1600×900 | 由 `generate_examples.py` 程序生成 |
| 项目截图 | `docs/preview.webp` | 1440×900 页面截图 | 运行项目后截取，已确认不含私人内容 |
| 字体子集 | `public/fonts/island-latin.woff2` | OFL 子集，仅常用拉丁字符 | 来自上游的开源字体子集，许可见 `public/fonts/LICENSES.md` |

说明：`docs/preview.webp` 是页面截图，其余插画类文件都由脚本或拼接生成，不含人物、文字、品牌标识或水印。

## 22 张插画与 spot 的对应关系

`src/resort/data.ts` 中的每个 spot 引用 1–2 张图；同一张图可以在多个 spot 复用。

| 地区 | 文件 | 用在哪里 |
| --- | --- | --- |
| 亚庇（sabah） | `sabah-dining-1.webp`、`sabah-dining-2.webp` | 海边吃饭、椰林 |
| 亚庇（sabah） | `sabah-pingpong.webp` | 乒乓球 |
| 亚庇（sabah） | `sabah-surf.webp` | 冲浪 |
| 亚庇（sabah） | `sabah-sunset.webp` | 日落亭 |
| 亚庇（sabah） | `sabah-palms.webp` | 椰林 |
| 阳朔（yangshuo） | `yangshuo-cormorant.webp`、`yangshuo-river.webp` | 竹筏小鸟 |
| 阳朔（yangshuo） | `yangshuo-light.webp`、`yangshuo-karst.webp` | 山水光影 |
| 阳朔（yangshuo） | `yangshuo-climb-1.webp`、`yangshuo-climb-2.webp` | 攀岩 |
| 阳朔（yangshuo） | `yangshuo-scooter.webp` | 小电驴 |
| 清迈（chiangmai） | `chiangmai-trail.webp` | 和尚之路、素贴山 |
| 清迈（chiangmai） | `chiangmai-temple.webp` | 古寺 |
| 清迈（chiangmai） | `chiangmai-forest.webp` | 乌蒙寺 |
| 清迈（chiangmai） | `chiangmai-bar.webp` | Bar San |
| 清迈（chiangmai） | `chiangmai-table.webp` | 一起吃饭 |
| 宏村（hongcun） | `hongcun-moonpond.webp` | 月沼 |
| 宏村（hongcun） | `hongcun-window.webp` | 白墙黛瓦 |
| 宏村（hongcun） | `hongcun-lakeside.webp` | 树荫水岸 |
| 宏村（hongcun） | `hongcun-courtyard.webp` | 花树小院 |

共 22 个文件（亚庇 6、阳朔 7、清迈 5、宏村 4）。「庆祝」spot 的照片卡不显示照片，直接进入庆祝流程。

## 重新生成

### 依赖

- 插画：Python 3 + `Pillow`、`numpy`
- 音乐：Python 3 标准库即可，无需额外依赖

在仓库外准备一个 Python 环境（或用系统 Python），安装图片依赖：

```sh
python -m pip install pillow numpy
```

Windows 如果 `python` 命令不可用，可以用 `py -3` 代替。项目不要求虚拟环境；为了避免污染全局环境，也可以自建 venv。

### 命令

```sh
# 重新生成 22 张示例插画（写入 public/examples/）
# 同时会更新 docs/artwork-preview.webp 与 docs/hero.webp
npm run assets:images

# 重新生成 32 秒示例音乐（写入 public/music/island-theme.wav）
npm run assets:music
```

也可以直接运行脚本，效果相同：

```sh
python scripts/generate_examples.py            # 全部插画 + 两张预览图
python scripts/generate_examples.py sabah-surf # 只重画某一张
python scripts/generate_examples.py docs       # 只更新 docs/ 里的预览图
python scripts/generate_music.py               # 只生成示例音乐
```

### 会覆盖什么

- `generate_examples.py` 会按 `src/resort/data.ts` 里使用的文件名重写 `public/examples/` 下的 22 张 WebP，并重新生成 `docs/artwork-preview.webp` 与 `docs/hero.webp`。如果你已经把自己的照片放进这个目录，**不要运行它**，否则会被覆盖。
- `generate_music.py` 会重写 `public/music/island-theme.wav`。如果你已经换成了自己的音乐，也不需要再运行。
- 脚本使用固定随机种子，同一版本的脚本重复运行会得到一致的结果；生成的宽高与 `data.ts` 中的 `width`/`height` 对应。

### 耗时

在普通笔记本上，插画和音乐通常都能在**一分钟以内**完成（插画取决于 CPU 和 Pillow 版本，音乐更快）。生成完刷新页面即可看到变化；如果修改过 `data.ts` 的图片宽高，记得重新运行 `npm test` 检查素材一致性。

## 换成自己的照片或音乐

完整步骤见 [二创教程](REMIX.md) 的「替换照片」「替换音乐」。最小改动是：

1. 把自己的图片（推荐 WebP，最长边不超过 1600 px）放进 `public/photos/`，在 `src/resort/data.ts` 里改 `src`、`caption`、`width`、`height`。
2. 把自己的音乐放进 `public/music/`，在 `src/site.ts` 里改 `music.src` 与 `music.volume`。
3. 删除不再引用的示例文件（先搜索确认没人引用），避免它们被一起部署。

示例素材没有肖像权或录音版权问题，是为了演示；但换成自己的内容时，请确认你有权公开，并移除照片里的 EXIF/定位信息。

## 许可与上游

- 生成脚本属于本仓库代码，按 [MIT 许可](../LICENSE) 分发；脚本生成的示例插画与音乐、以及随仓库提供的项目图标作为演示素材包含在仓库中。
- 字体是独立授权的 OFL 字体子集：版权行与完整许可文本见 [`public/fonts/LICENSES.md`](../public/fonts/LICENSES.md) 和 [`public/fonts/font-licenses.json`](../public/fonts/font-licenses.json)。
- 本项目的场景与交互基于公开版 **An Island for You**（© 2026 Iris Zhou，MIT）二创：<https://github.com/carpediemzzsssww-cpu/island-for-you>。该上游项目中的歌曲录音、图片和模型**没有**包含在本仓库中；这里的示例插画与示例音乐由本仓库脚本生成。
