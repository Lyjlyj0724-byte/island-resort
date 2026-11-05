import { regionOrder, regionPoint } from './regionLayout';
import type { Region } from './regionLayout';

export type { Region } from './regionLayout';

/**
 * 岛上的 20 个「地点」。每个地点对应场景里的一个相机标记和一张照片卡片。
 * 改名字、介绍、照片与坐标都在这个文件里完成。
 */
export type Spot =
  | 'dining'
  | 'pingpong'
  | 'surf'
  | 'sunset'
  | 'garden'
  | 'river'
  | 'karst'
  | 'climb'
  | 'scooter'
  | 'birthday'
  | 'suthep'
  | 'trail'
  | 'temple'
  | 'foresttemple'
  | 'san'
  | 'taste'
  | 'moonpond'
  | 'huizhou'
  | 'lakeside'
  | 'courtyard';

export type SpotPhoto = {
  src: string;
  caption: string;
  width: number;
  height: number;
};

export type SpotInfo = {
  region: Region;
  /** 底部导航里的短标签 */
  nav: string;
  title: string;
  /** 面板顶部的小字英文标题 */
  en: string;
  description: string;
  /** 「走近看看」按钮的文案；不写则不显示按钮 */
  inspect?: string;
  /** 场景里的点击标记位置（以场景原点计，Y 向上） */
  point: [number, number, number];
  photos: SpotPhoto[];
};

/** 四个旅行地点在顶部切换器里的名字与副标题 */
export const regions: Record<Region, { name: string; location: string }> = {
  chiangmai: { name: '清迈', location: '清迈 · 山路与古寺' },
  hongcun: { name: '宏村', location: '宏村 · 月沼与白墙黛瓦' },
  yangshuo: { name: '阳朔', location: '阳朔 · 江水与群山' },
  sabah: { name: '亚庇', location: '亚庇 · 海边的度假村' },
};

/**
 * 示例照片放在 public/examples/ 下，全部是程序生成的插画，不含真人照片。
 * 换成自己的照片时，把文件放进 public/photos/，再改下面每一处的 src 与 caption。
 */
export const spots: Record<Spot, SpotInfo> = {
  dining: {
    region: 'sabah',
    nav: '海边吃饭',
    title: '一起吃点好吃的',
    en: 'SEASIDE TABLE',
    description: '海风吹过餐桌。坐下来，慢慢吃一顿。',
    inspect: '走近海边餐厅',
    point: regionPoint('sabah', [-7, 3.6, 3]),
    photos: [
      {
        src: '/examples/sabah-dining-1.webp',
        width: 1200,
        height: 1600,
        caption: '亚庇 · 海边的下午茶',
      },
      {
        src: '/examples/sabah-dining-2.webp',
        width: 1164,
        height: 1600,
        caption: '亚庇 · 露台上的餐桌',
      },
    ],
  },
  pingpong: {
    region: 'sabah',
    nav: '乒乓球',
    title: '再打一局',
    en: 'A RALLY BY THE SEA',
    description: '蓝色球桌、橙色球拍，海风把球吹得有点飘。',
    inspect: '近看球桌',
    point: regionPoint('sabah', [-8.4, 1.7, 8.1]),
    photos: [
      {
        src: '/examples/sabah-pingpong.webp',
        width: 1200,
        height: 1600,
        caption: '亚庇 · 海边的乒乓球时间',
      },
    ],
  },
  surf: {
    region: 'sabah',
    nav: '冲浪',
    title: '跟着海浪',
    en: 'FOLLOW THE WAVES',
    description: '冲浪板轻轻晃着，把海风留在岸边。',
    inspect: '走近海上的冲浪板',
    point: regionPoint('sabah', [18.4, 1, 12.1]),
    photos: [
      {
        src: '/examples/sabah-surf.webp',
        width: 1440,
        height: 989,
        caption: '亚庇 · 海边冲浪',
      },
    ],
  },
  sunset: {
    region: 'sabah',
    nav: '日落亭',
    title: '等一场日落',
    en: 'SUNSET BAR',
    description: '尖尖的屋顶亮起来了。把这一片天色，再看一次。',
    inspect: '走近落日酒吧',
    point: regionPoint('sabah', [-14, 4.8, 12]),
    photos: [
      {
        src: '/examples/sabah-sunset.webp',
        width: 1440,
        height: 1080,
        caption: '亚庇 · 落日酒吧的晚霞',
      },
    ],
  },
  garden: {
    region: 'sabah',
    nav: '椰林',
    title: '椰林里走一走',
    en: 'THE PALM GARDEN',
    description: '让风吹一会儿，在草坪上留一张合影。',
    inspect: '走进海边椰林',
    point: regionPoint('sabah', [10, 2, 6]),
    photos: [
      {
        src: '/examples/sabah-palms.webp',
        width: 1165,
        height: 1600,
        caption: '亚庇 · 椰树与草坪',
      },
      {
        src: '/examples/sabah-dining-2.webp',
        width: 1164,
        height: 1600,
        caption: '亚庇 · 草坪与露台',
      },
    ],
  },
  birthday: {
    region: 'sabah',
    nav: '庆祝',
    title: '今天，值得庆祝',
    en: 'A DAY TO CELEBRATE',
    description: '海边这张桌子，今天为你留着。',
    inspect: '近看庆祝的蛋糕',
    point: regionPoint('sabah', [1, 2.65, 10.6]),
    photos: [],
  },
  river: {
    region: 'yangshuo',
    nav: '竹筏小鸟',
    title: '竹筏旁的小鸟',
    en: 'YANGSHUO · BY THE RIVER',
    description: '竹筏靠着岸，鸬鹚站成一排。江水很慢，天色很轻。',
    inspect: '走到竹筏旁',
    point: regionPoint('yangshuo', [-0.4, 2.2, 11.4]),
    photos: [
      {
        src: '/examples/yangshuo-cormorant.webp',
        width: 1180,
        height: 1646,
        caption: '阳朔 · 岸边的鸬鹚',
      },
      {
        src: '/examples/yangshuo-river.webp',
        width: 1440,
        height: 1080,
        caption: '阳朔 · 树荫里的江水与群山',
      },
    ],
  },
  karst: {
    region: 'yangshuo',
    nav: '山水光影',
    title: '山水慢慢看',
    en: 'YANGSHUO · KARST & LIGHT',
    description: '山的轮廓，江上的碎光。想在这里再待一会儿。',
    inspect: '望向江上群山',
    point: regionPoint('yangshuo', [4, 13, -10]),
    photos: [
      {
        src: '/examples/yangshuo-light.webp',
        width: 1350,
        height: 1800,
        caption: '阳朔 · 江面闪闪发光的时候',
      },
      {
        src: '/examples/yangshuo-karst.webp',
        width: 1080,
        height: 1440,
        caption: '阳朔 · 山的形状',
      },
    ],
  },
  climb: {
    region: 'yangshuo',
    nav: '攀岩',
    title: '一起向上',
    en: 'YANGSHUO · CLIMB & GREEN',
    description: '把岩壁下的风景，和一步一步向上的心情，留在这座山里。',
    inspect: '走近攀岩山壁',
    point: regionPoint('yangshuo', [-11, 5, 1]),
    photos: [
      {
        src: '/examples/yangshuo-climb-1.webp',
        width: 960,
        height: 1440,
        caption: '阳朔 · 岩壁与绳索',
      },
      {
        src: '/examples/yangshuo-climb-2.webp',
        width: 960,
        height: 1440,
        caption: '阳朔 · 一步一步向上',
      },
    ],
  },
  scooter: {
    region: 'yangshuo',
    nav: '小电驴',
    title: '骑上小电驴',
    en: 'YANGSHUO · ROAD & VALLEY',
    description: '前面是想一起走的路，路边是慢慢退后的山。',
    inspect: '看看小电驴',
    point: regionPoint('yangshuo', [10.2, 2.3, 11.2]),
    photos: [
      {
        src: '/examples/yangshuo-scooter.webp',
        width: 1013,
        height: 1800,
        caption: '阳朔 · 路边的小电驴',
      },
    ],
  },
  suthep: {
    region: 'chiangmai',
    nav: '素贴山',
    title: '素贴山的绿意',
    en: 'CHIANG MAI · DOI SUTHEP',
    description: '绿意、寺庙的金色，还有一路慢慢走过的山路。',
    inspect: '去素贴山上看看',
    point: regionPoint('chiangmai', [-7, 23, -13]),
    photos: [
      {
        src: '/examples/chiangmai-trail.webp',
        width: 960,
        height: 1440,
        caption: '清迈 · 山路与树影',
      },
    ],
  },
  trail: {
    region: 'chiangmai',
    nav: '和尚之路',
    title: '走进山林',
    en: "MONK'S TRAIL · INTO THE GREEN",
    description: '从竹门出发，走进山林。下过雨的路，走起来更安静。',
    inspect: '沿着和尚之路上山',
    point: regionPoint('chiangmai', [-10.5082, 4.08, 8.7515]),
    photos: [
      {
        src: '/examples/chiangmai-trail.webp',
        width: 960,
        height: 1440,
        caption: '清迈 · 和尚之路',
      },
    ],
  },
  temple: {
    region: 'chiangmai',
    nav: '古寺',
    title: '古寺里的好心情',
    en: 'CHIANG MAI · TEMPLE MEMORIES',
    description: '砖塔、长长的台阶、金色的佛像。阳光落在叶子上。',
    inspect: '走近古寺的砖塔',
    point: regionPoint('chiangmai', [-2, 8.5, 7]),
    photos: [
      {
        src: '/examples/chiangmai-temple.webp',
        width: 960,
        height: 1440,
        caption: '清迈 · 古寺与金塔',
      },
    ],
  },
  foresttemple: {
    region: 'chiangmai',
    nav: '乌蒙寺',
    title: '乌蒙寺的树荫与石像',
    en: 'CHIANG MAI · WAT UMONG',
    description: '老砖墙前，苔痕慢慢爬上石像，落叶铺满地面。',
    inspect: '走近乌蒙寺的石像',
    point: regionPoint('chiangmai', [-9.8, 13.1, -4.1]),
    photos: [
      {
        src: '/examples/chiangmai-forest.webp',
        width: 1440,
        height: 1080,
        caption: '清迈 · 乌蒙寺，树荫下的砖墙与石像',
      },
    ],
  },
  san: {
    region: 'chiangmai',
    nav: 'Bar San',
    title: '在 Bar San 碰个杯',
    en: 'BAR SAN · A TOAST',
    description: '杯子里的冰、暖暖的灯光，还有坐下来的那一刻。',
    inspect: '去 Bar San 坐一会儿',
    point: regionPoint('chiangmai', [9, 3.5, 11.8]),
    photos: [
      {
        src: '/examples/chiangmai-bar.webp',
        width: 1000,
        height: 1600,
        caption: '清迈 · 酒吧的暖灯',
      },
    ],
  },
  taste: {
    region: 'chiangmai',
    nav: '一起吃饭',
    title: '清迈，慢慢吃',
    en: 'CHIANG MAI · A SLOW TABLE',
    description: '一桌好吃的，红格子桌布，还有想再吃一次的芒果甜点。',
    inspect: '坐到餐桌旁',
    point: regionPoint('chiangmai', [5, 2.9, 16]),
    photos: [
      {
        src: '/examples/chiangmai-table.webp',
        width: 1000,
        height: 1600,
        caption: '清迈 · 从早餐到甜点',
      },
    ],
  },
  moonpond: {
    region: 'hongcun',
    nav: '月沼',
    title: '月沼边，慢慢看',
    en: 'HONGCUN · MOON POND',
    description: '半月形的水面，白墙黛瓦的倒影。停下来看一眼。',
    inspect: '到月沼边看看',
    point: regionPoint('hongcun', [0, 1.8, 5]),
    photos: [
      {
        src: '/examples/hongcun-moonpond.webp',
        width: 1440,
        height: 1080,
        caption: '宏村 · 月沼里的白墙与倒影',
      },
    ],
  },
  huizhou: {
    region: 'hongcun',
    nav: '白墙黛瓦',
    title: '马头墙下的小窗',
    en: 'HONGCUN · WHITE WALLS & DARK TILES',
    description: '高高低低的马头墙，一扇木窗，还有窗下的小鱼。',
    inspect: '走近那扇小窗',
    point: regionPoint('hongcun', [-7, 5.2, -2.55]),
    photos: [
      {
        src: '/examples/hongcun-window.webp',
        width: 1200,
        height: 1600,
        caption: '宏村 · 黛瓦、木窗与小鱼',
      },
    ],
  },
  lakeside: {
    region: 'hongcun',
    nav: '树荫水岸',
    title: '沿着树荫走一走',
    en: 'HONGCUN · WATERSIDE WALK',
    description: '树影落进水里，石板路沿着岸边延伸。慢一点走。',
    inspect: '沿着水岸走走',
    point: regionPoint('hongcun', [-16, 3.6, 10.7]),
    photos: [
      {
        src: '/examples/hongcun-lakeside.webp',
        width: 1200,
        height: 1600,
        caption: '宏村 · 树荫下的水岸',
      },
    ],
  },
  courtyard: {
    region: 'hongcun',
    nav: '花树小院',
    title: '花树下坐一会儿',
    en: 'HONGCUN · A MOMENT IN BLOOM',
    description: '粉白的花，安静的小院。把这一刻收进手账。',
    inspect: '坐到花树下面',
    point: regionPoint('hongcun', [13.45, 3, 13.1]),
    photos: [
      {
        src: '/examples/hongcun-courtyard.webp',
        width: 1440,
        height: 1080,
        caption: '宏村 · 花树下的小院',
      },
    ],
  },
};

/** 每个地点里有哪些 spot，按底部导航顺序排列 */
export const regionSpots: Record<Region, Spot[]> = {
  chiangmai: ['trail', 'foresttemple', 'suthep', 'temple', 'san', 'taste'],
  hongcun: ['moonpond', 'huizhou', 'lakeside', 'courtyard'],
  yangshuo: ['river', 'karst', 'climb', 'scooter'],
  sabah: ['dining', 'pingpong', 'surf', 'sunset', 'garden', 'birthday'],
};

export const spotOrder: Spot[] = regionOrder.flatMap((region) => regionSpots[region]);
