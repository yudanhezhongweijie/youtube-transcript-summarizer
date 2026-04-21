/**
 * Fixed sample dialogue summary for `USE_MOCK=1` and chunk-splitting helpers
 * (mirrors how streamed JSON arrives without calling Gemini).
 */
import {
  parseDialogueSummaryPayload,
  type ChatMessage,
  type SummarizeDialogueOptions,
} from "../../dialogueSummary";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pacing between mock chunks so `onTextChunk` mirrors token cadence (not one synchronous burst). */
const MOCK_CHUNK_GAP_MIN_MS = 200;
const MOCK_CHUNK_GAP_MAX_MS = 800;

async function delayBetweenChunks(): Promise<void> {
  const span = MOCK_CHUNK_GAP_MAX_MS - MOCK_CHUNK_GAP_MIN_MS + 1;
  const ms = MOCK_CHUNK_GAP_MIN_MS + Math.floor(Math.random() * span);
  await delay(ms);
}

/** Split a string into variable-length slices to mimic streamed response bodies. */
export function splitIntoStreamChunks(
  s: string,
  minLen = 8,
  maxLen = 72,
): string[] {
  if (!s) return [];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const span = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
    const end = Math.min(i + span, s.length);
    out.push(s.slice(i, end));
    i = end;
  }
  return out;
}

export function getMockStreamMessages(): ChatMessage[] {
  return [
    {
      speaker: "BREAK",
      text: "对话马克·安德森：AI革命、中美竞争与万亿美元的行业终极问题",
    },
    {
      speaker: "Host (Jen)",
      text: "这一波新的AI公司正在以前所未有的速度增长，真正的客户收入正转化为银行存款。我对目前人们使用的产品形态能否维持5到10年持怀疑态度，未来产品会变得更加复杂。目前关于AI的经济与策略问题仍然是‘万亿美元级别’的悬而未决的问题。今天我们请到了Mark进行AMA，将涵盖AI市场、政策监管、a16z的运作以及一些趣味话题。首先，Mark，你认为我们现在处于AI革命的哪个阶段？你最兴奋的是什么？",
    },
    {
      speaker: "Mark Andreessen",
      text: "这是我一生中见过的最大的技术革命，其规模超过了互联网，堪比微处理器、蒸汽机和电力。从历史上看，计算机产业在20世纪30年代走了一条‘加法机’的路径，追求纯粹的数学运算，而忽视了当时就有的神经网络理论。直到三年前ChatGPT的出现，这个被搁置了80年的‘人类认知模型’路径终于实现了。现在的硅谷正在经历疯狂的创新热潮，我每天都被新的研究论文和初创产品震撼。虽然过程会很曲折，且伴随着过度承诺，但AI的原始能力是神奇的，目前我们仍处于非常早期的阶段。",
    },
    {
      speaker: "BREAK",
      text: "AI的经济学：收入、成本与定价模型",
    },
    {
      speaker: "Host (Jen)",
      text: "虽然AI收入巨大，但支出也同样高昂。在关于成本与支出的讨论中，人们遗漏了什么？",
    },
    {
      speaker: "Mark Andreessen",
      text: "互联网现在已是全人类的底层网络，AI可以通过这个网络以光速扩散，这比普及电力或室内排水系统快得多。在消费端，AI公司的定价比传统的软件即服务（SAS）公司更具创意，甚至出现了每月200-300美元的层级。在企业端，智能的价值在于提高生产力和转化率。更重要的是，AI的单价（Token成本）下降速度远超摩尔定律。虽然目前存在GPU短缺，但根据历史规律，短缺最终会导致过剩。随着数万亿美元投入基础设施，未来十年的单位成本将大幅下降，这将驱动巨大的需求增长。",
    },
    {
      speaker: "Host (Jen)",
      text: "AWS最近表示他们可以延长GPU的使用寿命到7年以上，这是否也是优化成本的一种方式？",
    },
    {
      speaker: "Mark Andreessen",
      text: "是的。此外，大模型与小模型的演进也很关键。大模型的领先能力通常在6到12个月后就会被更小、成本更低的模型追平。例如中国开源的Kimmy模型，据称在推理能力上已接近GPT-5，且能在笔记本电脑上运行。我预测未来的AI产业结构会像计算机产业一样：顶端是少数几个类似超级计算机的‘神级模型’（God Models），底部则是无数运行在嵌入式系统和芯片上的小模型。关于芯片，Nvidia目前表现卓越，但这吸引了包括AMD、超大规模云服务商以及中国公司在内的所有玩家进入市场。未来5年，AI芯片将变得廉价且充足。",
    },
    {
      speaker: "BREAK",
      text: "地缘政治与开源竞争：中美AI竞赛",
    },
    {
      speaker: "Host (Jen)",
      text: "现在一些最好的开源模型来自中国。这是否令人担忧？你在华盛顿特区交流时，政策制定者如何看待中国通过‘倾销’开源模型来主导生态系统的行为？",
    },
    {
      speaker: "Mark Andreessen",
      text: "中美关系比冷战时期的美苏关系复杂得多，因为双方经济深度交织。华盛顿现在的共识是必须严厉对待中国的地缘政治挑战。AI领域目前实际上只有中美在竞争。中国的DeepSeek、Kimmy等模型的崛起让华盛顿意识到这是一场‘双马竞赛’。有趣的是，DeepSeek出自一家对冲基金，这说明即使没有顶尖实验室背景，聪明的年轻人也能做出突破。开源模型加速了知识的扩散。虽然有人认为中国在‘倾销’以实现差异化竞争，但这也迫使美国政府意识到不能通过限制本国AI来‘自废武功’。现在的政策氛围已经从‘限制AI’转向了‘确保击败中国’。",
    },
    {
      speaker: "BREAK",
      text: "政策监管：联邦 vs 州立法",
    },
    {
      speaker: "Host (Jen)",
      text: "目前各州出现了50套不同的AI法律，这是否会阻碍美国在AI竞赛中的领先地位？",
    },
    {
      speaker: "Mark Andreessen",
      text: "这种碎片化的州立法确实可能带来灾难。联邦层面目前的态度比较积极，不希望阻碍竞争。但各州出于政治动机，正在推进约1200个AI法案。加州的SB 1047法案就是一个典型的例子，它模仿了欧盟的AI法案，几乎会杀死加州的AI开发。该法案最荒谬的一点是要求开源开发者对下游的滥用承担无限责任，这会彻底摧毁开源生态。幸运的是州长否决了它。我们a16z正积极在华盛顿发声，以无党派的方式推动符合国家利益的科技议程，保护初创公司的创新自由。作为行业领导者，我们必须为自己的命运负责。",
    },
    {
      speaker: "BREAK",
      text: "定价逻辑与市场格局：谁会最终胜出？",
    },
    {
      speaker: "Host (Jen)",
      text: "与按席位付费相比，按使用量付费（Tokens）是AI定价的正确方式吗？",
    },
    {
      speaker: "Mark Andreessen",
      text: "对于初创公司来说，按需购买‘智能代币’非常友好，因为它降低了固定成本。但在应用层面，我认为定价不应基于成本，而应基于价值。如果AI能完成程序员、医生或律师的工作，那么它就应该按产生的业务价值或边际生产力的提升来分成。我一直认为‘高价格’是被低估的，因为高利润能让厂商更快地投入研发，最终让客户受益。至于开源还是闭源、现存巨头还是初创公司谁会赢，目前仍是悬而未决的问题。我们看到像XAI这样的初创公司能在不到一年内追平领先者，这说明领先地位并不是永久的。作为风投，我们的优势是不必只赌一个策略，我们会同时投资大模型、小模型、应用端等所有有潜力的方向。",
    },
    {
      speaker: "BREAK",
      text: "a16z 内部运作与个人见解",
    },
    {
      speaker: "Host (Jen)",
      text: "你和Ben（Horowitz）在哪些事情上存在‘保留意见但保持一致’（Disagree and Commit）？a16z 重组两年来，你们做对了什么？",
    },
    {
      speaker: "Mark Andreessen",
      text: "我们像一对老夫妇，虽然不断争论，但通常能达成一致。我们讨论最多的是公司的‘公共足迹’——是否应该如此直言不讳或带有争议性。事实上，勇敢表达观点是巨大的竞争优势，这让创始人甚至在见面之前就了解并信任我们。关于公司发展，跳上AI和Crypto的新浪潮是绝对正确的。风投的生命力在于从一波浪潮跳向下一波浪潮。目前我们并不缺新的垂直领域，关键在于执行和成为公司最好的合伙人。",
    },
    {
      speaker: "Host (Jen)",
      text: "关于AI取代工作的社会恐慌，你有什么看法？",
    },
    {
      speaker: "Mark Andreessen",
      text: "这种恐慌在历史上每隔几十年就会发生一次，从马克思时代到60年代都有。社会科学中有一个概念叫‘表达偏好’ vs ‘显示偏好’。如果你问选民，他们会说AI太可怕了，会毁灭一切；但如果你观察他们的行为，他们正在疯狂下载并热爱AI工具，用它来写邮件、诊断皮肤病甚至分析恋爱关系。最终，人们的实际行为会胜过口头上的恐惧。二十年后，大家会像习惯每一项过去的新技术一样，觉得没有AI的生活简直无法想象。",
    },
    {
      speaker: "Host (Jen)",
      text: "最后是快问快答：你最近改变主意的一件事是什么？你打算接受人体冷冻吗？你打算去火星吗？",
    },
    {
      speaker: "Mark Andreessen",
      text: "我每天都在改变主意，特别是被年轻人的想法震撼时。我不会接受目前的冷冻技术，因为记录太糟糕了。我通过与合伙人辩论和接受互联网的批评来保持清醒。我非常怀疑自己是否有能力准确分析一切，毕竟在这个行业，现实经常会扇你耳光——特别是当你拒绝了一个后来极其成功的公司时。至于火星，我连家门和加州都不想出，所以我大概率不会去，但我认为埃隆·马斯克能在十年内实现往返火星的常规航行。",
    },
  ];
}

export function getMockSummaryJsonString(): string {
  return JSON.stringify({ messages: getMockStreamMessages() });
}

/** Same pipeline as Gemini mock path: chunk JSON with gaps, then parse. */
export async function mockDialogueSummary(
  options?: SummarizeDialogueOptions,
): Promise<ChatMessage[]> {
  const json = getMockSummaryJsonString();
  const pieces = splitIntoStreamChunks(json);
  for (let i = 0; i < pieces.length; i++) {
    options?.onTextChunk?.(pieces[i]);
    if (i < pieces.length - 1) {
      await delayBetweenChunks();
    }
  }
  return parseDialogueSummaryPayload(JSON.parse(json) as unknown).messages;
}
