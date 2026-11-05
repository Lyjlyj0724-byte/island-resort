/**
 * 页面上所有「文案」都集中在这里；改完直接 `npm run build` 就能看到效果。
 * 更细的地点、照片与菜单内容在 src/resort/data.ts。
 */
export const site = {
  /** 左上角品牌：短名称 + 装饰符号 + 下方小字 */
  brand: {
    name: 'Island',
    mark: '✧',
    caption: 'A LITTLE RESORT',
  },

  /** 第一次进入小岛时显示的欢迎卡 */
  welcome: {
    eyebrow: 'WHERE THE STORY BEGINS',
    /** 每次换行一条，渲染成两行标题 */
    title: ['欢迎回来，', '故事从这里开始。'],
    /** 每行一句，渲染成段落 */
    body: ['山路、白墙与江水，海风和一场日落。', '把想去的地方，留在一座可以走进去的小岛里。'],
    action: '开始假期',
    hint: '拖动环顾 · 滚轮或双指缩放',
  },

  /** 场景加载与出错时的提示 */
  loading: '正在把小岛带回来……',

  /** 「庆祝」仪式：生日、纪念日、毕业，或只是今天过得还不错 */
  celebration: {
    eyebrow: 'A DAY TO REMEMBER',
    /** 四个步骤的标题，依次点击蜡烛推进 */
    titles: ['今晚，灯为你亮。', '点上蜡烛，许一个愿。', '愿望藏好了吗？', '祝你，天天开心。'],
    /** 前三步显示的一句说明 */
    line: '这张海边的桌子，今天只为你留着。',
    /** 最后一步显示的一句祝福 */
    finalLine: '愿你一直做喜欢的事，去想去的地方。',
    /** 三个推进按钮 */
    buttons: ['点上蜡烛', '许好愿了', '吹灭蜡烛'],
    /** 结束后的重开按钮 */
    again: '再庆祝一次',
    /** 信封里的小笺 */
    letter: {
      title: '写给你的信',
      paragraphs: ['把想说的话写在 src/site.ts 里。', '这封信会在打开的时候，从信封里慢慢展开。'],
      signature: '岛上的朋友',
    },
  },

  /** 背景音乐：默认静音，用户点声音按钮后才播放 */
  music: {
    src: '/music/island-theme.wav',
    volume: 0.3,
    title: '小岛主题曲',
  },

  /** 页脚两段文字，中间用圆点隔开 */
  footer: {
    left: 'ISLAND RESORT',
    right: 'A LITTLE ISLAND FOR YOU',
  },
} as const;
