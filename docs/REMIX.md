# 把 Island Resort 改成自己的版本

[← 回到 README](../README.md)

这是一份可以照着做的二创教程：把品牌名、欢迎语、庆祝流程和信、四个旅行地点、20 个 spot、照片、音乐、字体、昼夜节奏与配色，换成你自己的内容。

不用一次改完。建议顺序是：先让项目跑起来 → 改名字和欢迎语 → 换照片 → 换音乐 → 最后再动坐标和配色。每改完一小步就刷新页面看一眼。

- [准备：拿到自己的副本](#准备拿到自己的副本)
- [改品牌与欢迎语](#改品牌与欢迎语)
- [改庆祝文案与信](#改庆祝文案与信)
- [改四个地点与 20 个 spots](#改四个地点与-20-个-spots)
- [替换照片](#替换照片)
- [替换音乐](#替换音乐)
- [换字体](#换字体)
- [改昼夜节奏](#改昼夜节奏)
- [改配色](#改配色)
- [改近景镜头](#改近景镜头)
- [改图标与页面元信息](#改图标与页面元信息)
- [部署自己的版本](#部署自己的版本)
- [常见问题](#常见问题)
- [发布前检查](#发布前检查)

## 准备：拿到自己的副本

需要 **Node.js 22.12+** 与 npm。项目没有后端，也不需要 API Key。

1. 在 GitHub 打开仓库，点右上角 **Fork**（或直接下载 zip 解压）。
2. 克隆自己名下的仓库（把 `YOUR_USERNAME` 换成你的用户名）：

```sh
git clone https://github.com/YOUR_USERNAME/island-resort.git
cd island-resort
npm ci
npm run dev
```

3. 打开终端显示的地址（通常是 `http://localhost:5173`），点「开始假期」进岛。
4. 用 VS Code、Cursor 或其他编辑器打开项目目录，改动保存后页面会自动刷新。

`npm ci` 依赖仓库里的 `package-lock.json`，请不要删除它。普通改文案和照片不需要 Python；只有重新生成示例插画/示例音乐时才需要，见 [ARTWORK](ARTWORK.md)。

## 改品牌与欢迎语

所有页面级文案集中在 [`src/site.ts`](../src/site.ts)，顶部的 `site` 对象就是入口。第一次可以只改三处：

```ts
export const site = {
  /** 左上角品牌：短名称 + 装饰符号 + 下方小字 */
  brand: {
    name: 'Sea',          // 左上角大字的短名称
    mark: '✧',            // 名字后面的小符号
    caption: 'A LITTLE RESORT',
  },

  /** 第一次进入小岛时显示的欢迎卡 */
  welcome: {
    eyebrow: 'WHERE THE STORY BEGINS',
    title: ['欢迎回来，', '故事从这里开始。'], // 每个元素一行
    body: [
      '山路、白墙与江水，海风和一场日落。',       // 每个元素一段
      '把想去的地方，留在一座可以走进去的小岛里。',
    ],
    action: '开始假期',                            // 主按钮
    hint: '拖动环顾 · 滚轮或双指缩放',            // 按钮下方小字
  },

  loading: '正在把小岛带回来……',                  // 场景加载时的提示
  // …
} as const;
```

- 品牌名建议保持 1–8 个字符，字号是按短名称设计的；太长会挤到右侧工具栏。
- `title` 和 `body` 都是数组，想增减行数直接加减元素即可。
- 第一次进入后，欢迎卡消失；想再看一次就刷新页面。
- 页脚在同一个文件末尾：

```ts
footer: {
  left: 'ISLAND RESORT',
  right: 'A LITTLE ISLAND FOR YOU',
},
```

改完保存，浏览器会自动刷新。如果构建时报 TypeScript 错误，通常是少写了逗号或引号。

## 改庆祝文案与信

庆祝流程在 [`src/site.ts`](../src/site.ts) 的 `celebration` 里，**四步标题、三个按钮、一句祝福和信的内容都是可改的**：

```ts
celebration: {
  eyebrow: 'A DAY TO REMEMBER',
  titles: [                       // 固定 4 步，依次点击推进
    '今晚，灯为你亮。',
    '点上蜡烛，许一个愿。',
    '愿望藏好了吗？',
    '祝你，天天开心。',
  ],
  line: '这张海边的桌子，今天只为你留着。',   // 前三步的说明
  finalLine: '愿你一直做喜欢的事，去想去的地方。', // 最后一步的祝福
  buttons: ['点上蜡烛', '许好愿了', '吹灭蜡烛'], // 固定 3 个按钮
  again: '再庆祝一次',
  letter: {
    title: '写给你的信',
    paragraphs: [
      '第一段话。',
      '第二段话。',
    ],
    signature: '岛上的朋友',
  },
},
```

注意：

- `titles` 要 **4 项**、`buttons` 要 **3 项**，少一项运行时会显示空白。
- 庆祝流程不属于生日也可以：纪念日、毕业、重逢、搬家，或只是「今天过得还不错」。
- 信会跟着 `BirthdayLetter` 组件在最后一步展开；`paragraphs` 想写几段就写几段。
- 流程代码在 [`src/resort/ResortApp.tsx`](../src/resort/ResortApp.tsx) 的 `Celebration` 组件里，改文案不用动组件；想改「先许愿再吹蜡烛」之类的顺序，才需要改这个组件。
- 庆祝入口固定在亚庇的「庆祝」spot（地点 id 是 `birthday`）。想把它挪到别的地点，需要同时改场景里的蛋糕位置，见下一节。

## 改四个地点与 20 个 spots

地点数据集中在 [`src/resort/data.ts`](../src/resort/data.ts)。文件顶部有两个关键类型：

```ts
export type Spot =
  | 'dining' | 'pingpong' | 'surf' /* … */ | 'courtyard';  // 20 个地点 id

export type SpotInfo = {
  region: Region;                 // 属于哪个地点：chiangmai / hongcun / yangshuo / sabah
  nav: string;                    // 底部导航里的短标签
  title: string;                  // 照片卡标题
  en: string;                     // 标题上方的英文小字
  description: string;            // 照片卡介绍
  inspect?: string;               // 「走近看看」按钮文案；不写则不显示按钮
  point: [number, number, number];// 场景里相机标记的位置
  photos: SpotPhoto[];            // 一张或多张照片
};
```

### 地点卡片：只改显示名

四个旅行地点的名字与副标题在 `regions`：

```ts
export const regions: Record<Region, { name: string; location: string }> = {
  chiangmai: { name: '清迈', location: '清迈 · 山路与古寺' },
  hongcun: { name: '宏村', location: '宏村 · 月沼与白墙黛瓦' },
  yangshuo: { name: '阳朔', location: '阳朔 · 江水与群山' },
  sabah: { name: '亚庇', location: '亚庇 · 海边的度假村' },
};
```

只改 `name` 和 `location` 的文字即可，**不要改左边的键名**（`chiangmai` 等）。这些键还被场景、镜头、海浪声和数据分组引用，改名需要同时修改多个组件。

### spot 文案：标题、介绍、英文小标题与导航

每个地点在 `spots` 里的结构相同，例如：

```ts
temple: {
  region: 'chiangmai',
  nav: '古寺',
  title: '古寺里的好心情',
  en: 'CHIANG MAI · TEMPLE MEMORIES',
  description: '砖塔、长长的台阶、金色的佛像。阳光落在叶子上。',
  inspect: '走近古寺的砖塔',
  point: regionPoint('chiangmai', [-2, 8.5, 7]),
  photos: [ /* … */ ],
},
```

- `nav` 是底部导航按钮上的文字，建议 2–6 个汉字，太长会挤压同行按钮。
- `title`、`en`、`description` 直接写中文/英文即可。
- 底部导航的顺序由文件末尾的 `regionSpots` 决定，调整数组顺序就能改按钮顺序：

```ts
export const regionSpots: Record<Region, Spot[]> = {
  chiangmai: ['trail', 'foresttemple', 'suthep', 'temple', 'san', 'taste'],
  hongcun: ['moonpond', 'huizhou', 'lakeside', 'courtyard'],
  yangshuo: ['river', 'karst', 'climb', 'scooter'],
  sabah: ['dining', 'pingpong', 'surf', 'sunset', 'garden', 'birthday'],
};
```

### 坐标 point 怎么调

`point` 是场景里的世界坐标 `[x, y, z]`，**Y 轴向上**。大多数条目用 `regionPoint(地区, 局部坐标)` 写成相对该地区原点的位置：

```ts
point: regionPoint('chiangmai', [-2, 8.5, 7]),
```

四个地区的原点在 [`src/resort/regionLayout.ts`](../src/resort/regionLayout.ts)：清迈 `[-72, 0, 0]`、宏村 `[-24, 0, 0]`、阳朔 `[24, 0, 0]`、亚庇 `[72, 0, 0]`，沿 X 轴排开。所以局部坐标的 `x` 左右、`y` 上下、`z` 前后。

调整步骤：

1. 改一个小数值（比如 `y` 加 1），保存后看标记是否落到想要的位置。
2. 标记位置和「走近看看」的近景镜头是两套配置：近景在 [`src/resort/views.ts`](../src/resort/views.ts) 的 `closeupViews` 里，按 spot id 对应 `target` 和 `offset`，见[改近景镜头](#改近景镜头)。
3. `point` 只控制场景里那个相机图标标记的位置。场景里可以被点击的 3D 物件（蛋糕、冲浪板、球桌等）在 [`src/resort/ResortWorld.tsx`](../src/resort/ResortWorld.tsx) 及各场景组件里通过 `onClick={() => onSelect('spotId')}` 注册；移动模型后，标记和模型两边都要看。
4. 改完把四个地区都点一遍，确认标记没有埋进建筑或悬空。

### 增删 spot 需要改哪些文件

只改文字/照片时，`spots` 里的 20 个 id 都有对应的 3D 场景逻辑；**新增或删除一个 spot 不是只改数据文件**。至少需要同步：

| 位置 | 要做什么 |
| --- | --- |
| `src/resort/data.ts` | `Spot` 联合类型、`spots` 记录、`regionSpots` 分组、`spotOrder` 会自动从分组生成 |
| `src/resort/ResortApp.tsx` | `ICONS` 表补一个图标映射（lucide-react 或 `TravelIcons.tsx`） |
| `src/resort/ResortWorld.tsx` 及场景组件 | 把可点击的 3D 物件放到场景里，并调用 `onSelect('新id')` |
| `src/resort/views.ts` | 需要近景的话，在 `closeupViews` 补 `target` / `offset` |
| `public/` 与 `data.ts` 的 `photos` | 准备照片并填写真实的宽高 |

因此更省力的做法是：**保留 20 个 id，只改它们的文案、照片和坐标**。如果确实要删减，建议先从底部导航里移除（改 `regionSpots` 数组），确认没有别处引用后再动类型。`tests/site.test.ts` 固定校验「20 个 spot + 四个地区分组非空」，增删 spot 时需要同步更新测试期望。

## 替换照片

示例照片是按 `src/resort/data.ts` 里的路径从 `public/` 读取的，全部是程序生成的插画。换成自己的照片有两种方式：

### 方式一：新建自己的目录（推荐）

1. 在 `public/` 下新建 `photos/`，把处理好的图片放进去，例如 `public/photos/chiangmai-trail.webp`。
2. 在 `src/resort/data.ts` 对应 spot 的 `photos` 里改路径、宽高和说明：

```ts
photos: [
  {
    src: '/photos/chiangmai-trail.webp', // 从 public 根开始，以 / 开头
    width: 960,                          // 图片真实像素宽
    height: 1440,                        // 图片真实像素高
    caption: '清迈 · 山路上的树影',
  },
],
```

3. 保存后刷新页面，打开对应地点，点场景标记或底部导航，确认照片显示、比例正确、文字说明没有写错。

### 方式二：直接覆盖 `public/examples/` 里的示例图

文件名一致时可以只换文件、不改 `data.ts`。但这样会覆盖演示素材，之后想对照原始示例需要重新生成（见 [ARTWORK](ARTWORK.md)）。如果图片比例和原来不同，仍要同步修改 `width` / `height`。

### 尺寸、比例与 EXIF

- 建议最长边不超过 **1600 px**，使用 WebP。当前 `tests/site.test.ts` 会读取 WebP 的真实像素来核对 `width` / `height`，如果引用 JPEG/PNG 需要同步放宽这个测试。示例图最长边在 1440–1800 px 之间。
- `width` / `height` 要填图片真实像素，否则照片卡预留的空间会跳动。代码用这两个值给 `<img>` 设置宽高，避免布局抖动。
- 竖长图会被自动判断为长图：当 `height > width × 1.7` 时，照片卡默认展开显示；其它图片会显示「展开照片看细节」按钮。
- 上传前**移除 EXIF 与定位信息**（很多相机和手机照片默认带 GPS）。可以用图片处理工具导出时不保留元数据。
- 不要把原图、私密照片、带人脸的截图放进 `public/`：部署后它们都能被直接访问。

一次换多张时，建议先整理成「地区-内容.webp」的命名（`chiangmai-temple.webp`、`sabah-sunset.webp`），再对照 `data.ts` 一条条替换。`npm test` 会检查数据里引用的照片文件是否存在，能帮你发现漏改或路径写错。

## 替换音乐

示例音乐 `public/music/island-theme.wav` 是脚本生成的 32 秒无缝循环，默认静音，用户点声音按钮后才播放。换成自己的音乐：

1. 把有权公开的音频放进 `public/music/`，例如 `public/music/my-theme.mp3`。网页可直接播放 mp3、m4a、ogg、wav 等常见格式。
2. 修改 [`src/site.ts`](../src/site.ts) 的 `music`：

```ts
music: {
  src: '/music/my-theme.mp3', // 以 / 开头，指向 public 根
  volume: 0.3,                // 0–1，建议先留 0.2–0.4
  title: '我的小岛主题曲',
},
```

3. 刷新页面 → 点「开始假期」→ 点右上角声音按钮，确认能播放；切到亚庇时会叠加实时合成的海浪声，其它地点只有音乐。
4. 不再使用的旧音乐文件可以删除，避免一起被部署出去。

注意：

- 页面会在切换标签页时暂停音乐，这是浏览器行为，不是 bug。
- 背景音乐不是自动播放的：浏览器要求先有用户手势，点声音按钮就是那个手势。
- **不要使用没有授权的歌曲录音、影视原声或采样**。二创发布时请使用自己创作、已购买授权或明确可商用的音乐，并在文档里注明来源。
- 想重新生成示例音乐，运行 `npm run assets:music`，详见 [ARTWORK](ARTWORK.md)。

## 换字体

仓库自带一个 OFL 字体子集 `public/fonts/island-latin.woff2`，只覆盖页面英文小字与品牌名用到的字符；中文正文使用的是系统字体（微软雅黑 / 苹方等）。换字体步骤：

1. 把可分发的新字体（建议 `.woff2`）放进 `public/fonts/`，例如 `public/fonts/my-serif.woff2`。
2. 打开 [`src/resort/resort.css`](../src/resort/resort.css)，顶部有 `@font-face` 规则，把文件名和字体名换成你的：

```css
@font-face {
  font-family: 'MySerif';
  src: url('/fonts/my-serif.woff2') format('woff2');
  font-display: swap;
}
```

3. 在同一个文件里搜索原来的 `'Island Latin'`，替换成 `'MySerif'`（品牌大字和英文小标题等位置用到）。
4. 中文正文的字体在 `body` 的 `font-family` 里，可以一起调整：

```css
body {
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
```

5. 字体许可要一起带上。如果使用 OFL 字体，保留许可文本并更新 `public/fonts/LICENSES.md` 与 `public/fonts/font-licenses.json`；示例字体 Compagnon Roman 的版权行是 `2018 - Juliette Duhe, Lea Pradine`，许可为 SIL Open Font License 1.1。**不要把任意字体重命名后当作 OFL 字体分发。**

子集是可选的：字体越小子集越省流量，但新增字符可能显示成方框。需要自己裁剪时，可以在仓库外安装 `fonttools` 和 `brotli`，用 `pyftsubset` 生成只包含所需字符的 WOFF2。仓库本身不附带字体子集脚本；新增中文文案时用系统字体通常更省事。

## 改昼夜节奏

昼夜循环在 [`src/resort/dayCycle.ts`](../src/resort/dayCycle.ts)。默认一个完整昼夜是 **480 秒（8 分钟）**：

```ts
export const DAY_CYCLE_SECONDS = 480;
```

- 调快：改成 `240`（4 分钟一圈），`120`（2 分钟一圈，变化会很明显）。
- 调慢：改成 `960`（16 分钟一圈）或更大。
- 手动模式的三个时间点：

```ts
export const TIME_MODE_HOURS = { day: 14, sunset: 18.15, night: 22 } as const;
```

`day`、`sunset`、`night` 分别对应顶部光影菜单里的白天、日落、夜晚；数值是 24 小时制的小时，`18.15` 表示 18:09。时间会从选中的小时继续走，点「日夜流转」回到自动模式。

调色板 `palettes` 里是各个时间点的天空、雾、阳光、水色与灯光参数。改关键帧的小时值时，`tests/dayCycle.test.ts` 里的边界连续性测试也要相应更新；只改 `DAY_CYCLE_SECONDS` 不用动测试。改完运行：

```sh
npm test
```

## 改配色

页面基础色直接写在 [`src/resort/resort.css`](../src/resort/resort.css) 里（没有 CSS 变量，用编辑器的查找替换即可）。可以先用这几个值定位整体风格：

| 用途 | 当前值 |
| --- | --- |
| 页面背景 / 海天色 | `#b8d8df` |
| 正文文字 | `#344e49` |
| 主按钮背景 / 深色强调 | `#355b51` |
| 主按钮文字 / 纸面 | `#fff7e5`、`#fbf4e5` |
| 焦点描边 / 暖色点缀 | `#a16655`、`#ab755a` |

3D 场景的天空、海水、阳光与灯光颜色在 [`src/resort/dayCycle.ts`](../src/resort/dayCycle.ts) 的 `palettes` 里（`zenith`、`horizon`、`haze`、`sunColor`、`waterDeep`、`waterMid`、`waterShallow` 等），建筑、植被、道具的自有颜色分散在 `src/resort/` 的各个场景组件里。只改页面 CSS 不会改变 3D 场景的基调。

改完至少检查白天、日落、夜晚三种状态：有些文字和按钮在深色天空下要考虑对比度。

## 改近景镜头

照片卡里的「走近看看」会切到对应 spot 的近景。镜头配置在 [`src/resort/views.ts`](../src/resort/views.ts)：

```ts
export const closeupViews = {
  temple: {
    target: regionPoint('chiangmai', [-2, 3.7, 7]), // 镜头看向的点
    offset: [7, 6, 15],                              // 相机相对 target 的偏移
  },
  // …
};
```

- `target` 是镜头看向的点，`offset` 是相机相对 `target` 的位置偏移，所以相机实际位置约等于 `target + offset`。三个数分别是 `[x, y, z]`，Y 向上。
- `offset` 越大离得越远；想更近就把数值整体调小。
- 特殊条目：`pool` 是海边泳池的近景（从「海边吃饭」卡片里的第二个按钮进入），`islands` 是「四地全景」。
- 改完点「走近看看」，确认镜头没有穿进模型内部，并试试点右上角「恢复全景视角」能回来。

## 改图标与页面元信息

- 项目图标：替换 `public/favicon.svg`（建议 64×64、方形 SVG），`index.html` 里已通过 `<link rel="icon" href="/favicon.svg" />` 引用。
- 浏览器标签标题、搜索描述、主题色在 [`index.html`](../index.html)：

```html
<meta name="theme-color" content="#c6e2d7" />
<meta name="description" content="一座可以散步、看海、庆祝的小岛。开源 3D 旅行纪念页模板，基于 React Three Fiber。" />
<title>Island Resort · 小岛度假村</title>
```

改完刷新页面，看标签标题和地址栏颜色是否符合预期。

## 部署自己的版本

先在本地确认构建通过：

```sh
npm test
npm run build
npm run preview
```

`npm run preview` 会以生产构建启动本地预览，默认地址是 `http://localhost:4173`。

### 部署到 Vercel

1. 把项目推送到自己的 GitHub 仓库（推送方法见 README 的「上传到 GitHub」）。
2. 打开 [vercel.com](https://vercel.com) → **Add New… → Project** → 导入该仓库。
3. 按下面的配置确认（通常会自动识别）：

| 配置项 | 值 |
| --- | --- |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js Version | 22.x |

4. 点 Deploy。`vercel.json` 已经声明了 Vite 框架、构建命令、输出目录，并给 `/assets/` 下的指纹文件加了长期缓存头，导入后一般无需改动。

### 部署路径很重要

页面里的照片、音乐和字体使用**以 `/` 开头的绝对路径**（例如 `/examples/sabah-sunset.webp`、`/music/island-theme.wav`、`/fonts/island-latin.woff2`），因此请部署在**独立域名或子域名的根路径**：

- `https://island-resort.vercel.app/`、`https://island.your-domain.com/` 都可以。
- GitHub Pages 的**项目页**会部署在 `https://YOUR_USERNAME.github.io/island-resort/` 这样的子路径下，绝对路径会 404。要在子路径部署，需要同时修改 Vite 的 `base`、`index.html` 里的资源引用、`src/site.ts` 的音乐路径、`src/resort/data.ts` 的照片路径以及 `resort.css` 的字体路径；本仓库不提供开箱即用的子路径配置。如果一定要用 GitHub Pages，可以部署到用户/组织的根站点（`YOUR_USERNAME.github.io`）并绑定自定义域名。
- Netlify、Cloudflare Pages 等静态托管同理：构建命令 `npm run build`，发布目录 `dist`，站点要放在根路径。

## 常见问题

| 问题 | 原因与处理 |
| --- | --- |
| 照片不显示，控制台 404 | `src` 必须以 `/` 开头，文件必须放在 `public/` 下且大小写完全一致；确认 `npm run dev` 使用的是项目根目录 |
| 照片变形 / 卡片跳动 | `data.ts` 里的 `width`、`height` 与图片真实像素不一致；按原图比例填写 |
| 改完 `data.ts` 构建报错 | 多半是 `Spot` 联合类型、`spots` 记录和 `regionSpots` 分组不同步；先检查缺了哪个 id、哪条数据少字段 |
| 庆祝流程某一步空白 | `titles` 需要 4 项、`buttons` 需要 3 项，检查数组长度 |
| 没有声音 | 背景音乐要等用户点声音按钮；先在亚庇以外地点试音乐，再切到亚庇听海浪；确认 `music.src` 路径正确、音频文件没损坏 |
| 中文出现方框 | 字体子集不包含该字符时会回退到系统字体；新增中文一般走系统字体，不必扩子集 |
| 手机很卡 | 首次进入 3D 场景需要加载；把照片最长边压到 1600 px 以内、避免一次加载多张大图；等场景加载完成后再交互 |
| 改了坐标但标记没动 | 检查是否改的是当前地区的 spot；近景镜头在 `views.ts` 里是另一套配置 |
| 部署后图片全 404 | 站点部署在子路径，而资源使用绝对路径；按上面的「部署路径很重要」处理 |
| 构建提示 Node 版本不支持 | 需要 Node.js 22.12+；项目根目录的 `.nvmrc` 是 `22.12.0`，可用 `nvm use` 切换 |

## 发布前检查

发布自己的版本前，至少确认：

- [ ] `npm ci`、`npm test`、`npm run build`、`npm run preview` 都能跑通
- [ ] 换掉了所有不想公开的照片、信件、音乐与个人信息
- [ ] `public/` 里没有 EXIF/定位信息、没有你无权公开的素材
- [ ] 桌面、手机竖屏、手机横屏都点过一遍主要流程（见 [QA 文档](QA.md)）
- [ ] 部署后线上环境没有资源 404，控制台没有红色报错

更完整的发布检查清单见 [docs/QA.md](QA.md)，素材来源说明见 [docs/ARTWORK.md](ARTWORK.md)，许可与致谢见 README 的「许可与致谢」。
