
import { Story, Character } from './types';

export const CHARACTERS: Character[] = [
  { name: '小熊嘟嘟 (Dudu)', description: '一只温和、勇敢的小熊，穿着蓝色的背带裤。他有点憨萌，经常会有一些可爱的冷幽默。' },
  { name: '小兔闹闹 (Naonao)', description: '一只精力旺盛、古灵精怪的小兔子。她的点子特别多，说话飞快，是个天生的乐天派。' }
];

export const STORIES: Story[] = [
  {
    id: '1',
    title: '嘟嘟的超级响声',
    theme: '有趣的意外',
    content: `嘟嘟今天吃了很多红薯，肚子胀得圆滚滚的。他在森林里走着走着，突然“噗——”的一声，放了一个超级响的屁！旁边草丛里，闹闹吓得长耳朵都竖成了一个大大的“V”字。“哇！嘟嘟，你是在练习森林小喇叭吗？”闹闹捂着鼻子笑着跳。嘟嘟不好意思地挠挠头，憨憨地说：“闹闹，这是我的‘屁屁推进器’，我感觉刚才我感觉刚才我差点飞起来了！”他们决定做一个实验，看看谁能发出更好听的拟声词。闹闹学小鸡“叽叽叽”，学小鸭“嘎嘎嘎”，最后嘟嘟憋足了气，又发出了一个更响的“噗——”，惊得树上的小鸟都跟着节奏拍起了翅膀。森林里充满了欢快的笑声，原来放屁也可以变成一场有趣的音乐会呢！Mumu和Yiyi听了，一定也会忍不住哈哈大笑吧。`,
    audioGuidance: "语速缓慢、亲切。在‘噗——’的地方可以稍微加重语气并带点笑意。",
    posterPrompt: "Dudu the bear with a shy grin and Naonao the rabbit laughing together. Whimsical music notes in the air. Soft watercolor style. The text 'To: Mumu & Yiyi - By Daddy' is clearly written at the bottom of the image."
  },
  {
    id: '2',
    title: '闹闹的云朵棉花糖',
    theme: '神奇的想象',
    content: `闹闹发现今天的云朵看起来特别像大块大块的棉花糖。她拉着嘟嘟躺在草地上，指着天空说：“嘟嘟，你看那块云，像不像你最爱吃的蜂蜜蛋糕？”嘟嘟眯起眼睛看了看，咽了下口水：“闹闹，我觉得那块像你还没啃完的大胡萝卜。”正说着，云朵变幻了形状，像一只巨大的恐龙，又像一座城堡。闹闹说：“如果我们能跳到云朵上，云朵一定会托着我们飞过高山和河流。”他们闭上眼睛，在脑海里开始了一场云端大冒险。爸爸和妈妈的声音在远处响起，喊他们回家吃饭。闹闹跳起来说：“虽然吃不到真的云朵棉花糖，但妈妈做的晚饭一定比云朵还香！”嘟嘟拍拍屁股上的草屑，憨笑着跟了上去。`,
    audioGuidance: "语调轻快活泼，带着对云朵变化的惊喜和期待。",
    posterPrompt: "Dudu the bear and Naonao the rabbit lying on green grass, looking at fluffy clouds shaped like treats. Dreamy watercolor illustration. Text 'To: Mumu & Yiyi - By Daddy' in soft handwritten font at the bottom."
  }
];
