import { PageType, BarAttribute, Attribute, Skill, Item, MapPoint, SocialNode, Currency } from './types';

export const MOCK_BARS: BarAttribute[] = [
  { name: '生命 (Vitality)', current: 850, max: 1000, color: 'bg-red-500' },
  { name: '能量 (Aether)', current: 420, max: 500, color: 'bg-cyan-400' },
  { name: '理智 (SAN)', current: 72, max: 100, color: 'bg-purple-400' },
];

export const MOCK_STATS: Attribute[] = [
  { name: '力量', value: 18, label: 'STR' },
  { name: '体质', value: 22, label: 'CON' },
  { name: '精神', value: 35, label: 'INT' },
  { name: '敏捷', value: 14, label: 'AGI' },
  { name: '魅力', value: 28, label: 'CHA' },
  { name: '幸运', value: 12, label: 'LCK' },
];

export const MOCK_CURRENCIES: Currency[] = [
  { name: '能量币', label: 'Credit', amount: 1240500, icon: 'circle-dollar-sign', color: '#00f2ff' },
  { name: '以太核心', label: 'Core', amount: 42, icon: 'sparkles', color: '#00a8cc' },
  { name: '声望点数', label: 'Rep', amount: 8750, icon: 'star', color: '#a78bfa' },
  { name: '情报碎片', label: 'Intel', amount: 134, icon: 'file-text', color: '#f0a43c' },
];

export const MOCK_SKILLS: Skill[] = [
  { id: 's1', name: '以太爆发', type: '主动', rank: 'A', description: '瞬间释放高浓度以太能量，对前方区域造成毁灭性打击。', effect: '造成300%精神强度的范围伤害' },
  { id: 's2', name: '虚空行走', type: '被动', rank: 'S', description: '在暗影中移动而不受物理限制，短暂进入相位空间。', effect: '闪避率增加25%' },
  { id: 's3', name: '共鸣治愈', type: '主动', rank: 'B', description: '通过频率调节恢复生命力，可对自身或友方使用。', effect: '每秒恢复2%最大生命值，持续10秒' },
  { id: 's4', name: '数据洪流', type: '主动', rank: 'A', description: '释放电磁脉冲干扰敌方电子设备与神经系统。', effect: '使目标陷入混乱状态3秒' },
  { id: 's5', name: '精密感知', type: '被动', rank: 'C', description: '提升对周围以太波动的感知精度。', effect: '探测范围增加15%' },
];

export const MOCK_ITEMS: Item[] = [
  { id: 'i1', name: '雷鸣长剑', category: '武器', rarity: '传世', description: '镶嵌了高频电池的近战利刃，挥动时可释放电弧冲击。', quantity: 1 },
  { id: 'i2', name: '战术护甲', category: '防具', rarity: '罕见', description: '能够抵御轻型枪械的轻量化装甲，内置生命体征监测。', quantity: 1 },
  { id: 'i3', name: '纳米修复剂', category: '消耗品', rarity: '普通', description: '基础型医疗物资，可快速凝血和组织再生。', quantity: 12 },
  { id: 'i4', name: '量子谐振器', category: '特殊', rarity: '传世', description: '失传科技产物，据说能打开通往其他维度的通道。', quantity: 1 },
  { id: 'i5', name: '相位护盾', category: '防具', rarity: '罕见', description: '产生短时相位偏移场，可偏转能量武器攻击。', quantity: 1 },
  { id: 'i6', name: '应急口粮', category: '消耗品', rarity: '普通', description: '高能压缩食品，一包可维持72小时基础代谢。', quantity: 25 },
  { id: 'i7', name: '废铁匕首', category: '武器', rarity: '劣质', description: '由废墟中回收的金属打制，聊胜于无。', quantity: 3 },
  { id: 'i8', name: '数据晶片', category: '特殊', rarity: '普通', description: '存储着未知来源的加密数据，价值取决于解密程度。', quantity: 7 },
  { id: 'i9', name: '脉冲手雷', category: '武器', rarity: '罕见', description: '投掷后释放EMP冲击波，对电子目标极为有效。', quantity: 4 },
  { id: 'i10', name: '抗辐射药剂', category: '消耗品', rarity: '普通', description: '可临时提升辐射抗性的注射剂。', quantity: 8 },
];

export const MOCK_MAP: MapPoint[] = [
  { id: 'm1', name: '新东京枢纽', x: 216, y: 168, type: '城市' },
  { id: 'm2', name: '以太废墟', x: 464, y: 318, type: '遗迹' },
  { id: 'm3', name: '反抗军营地', x: 136, y: 414, type: '据点' },
  { id: 'm4', name: '未知信号源', x: 608, y: 114, type: '未知' },
  { id: 'm5', name: '深渊观测站', x: 360, y: 498, type: '未知' },
];

export const MOCK_SOCIAL: { nodes: SocialNode[], edges: [string, string][] } = {
  nodes: [
    { id: 'n1', name: '林雪', relation: '引导者', level: 85, type: '盟友' },
    { id: 'n2', name: '克里斯', relation: '雇佣兵', level: 45, type: '中立' },
    { id: 'n3', name: '黑鸢', relation: '宿敌', level: 10, type: '敌对' },
    { id: 'n4', name: '苏姗', relation: '后勤官', level: 92, type: '盟友' },
    { id: 'n5', name: '泽维尔', relation: '情报商', level: 60, type: '中立' },
  ],
  edges: [
    ['n1', 'n2'],
    ['n1', 'n4'],
    ['n1', 'n5'],
    ['n2', 'n3'],
    ['n3', 'n5'],
    ['n4', 'n5'],
  ]
};
