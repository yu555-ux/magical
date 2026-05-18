export enum PageType {
  HOME = 'HOME',
  PERSONA = 'PERSONA',
  WAREHOUSE = 'WAREHOUSE',
  MAP = 'MAP',
  SOCIAL = 'SOCIAL',
  TAVERN = 'TAVERN',
}

export interface Attribute {
  name: string;
  value: number;
  label: string;
}

export interface BarAttribute {
  name: string;
  current: number;
  max: number;
  color: string;
}

export interface Skill {
  id: string;
  name: string;
  type: '主动' | '被动';
  rank: 'S' | 'A' | 'B' | 'C';
  description: string;
  effect: string;
}

export interface Item {
  id: string;
  name: string;
  category: '武器' | '防具' | '消耗品' | '特殊';
  rarity: '传世' | '罕见' | '普通' | '劣质';
  description: string;
  quantity: number;
}

export interface MapPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  type: '城市' | '遗迹' | '据点' | '未知';
  subPoints?: MapPoint[];
}

// ---- Map variable types (from DEFAULT_WORLD_VARS.地图) ----

export interface MapBounds {
  X: [number, number];
  Y: [number, number];
  Z: [number, number];
}

export interface AnomalyTrait {
  描述: string;
  效果: string[];
}

export interface MapAnomaly {
  评级: string;
  描述: string;
  具现进度: number;
  特性: Record<string, AnomalyTrait>;
}

export interface MapLayerDetail {
  描述: string;
  地点细节: {
    信息: string[];
    异常: Record<string, MapAnomaly>;
  };
}

export interface MapLocationData {
  检索词: string[];
  方位: MapBounds;
  现实: MapLayerDetail;
  梦境: MapLayerDetail;
  子地图?: Record<string, MapLocationData>;
}

export interface MapLocationRender {
  key: string;
  name: string;
  searchTerms: string[];
  cx: number;
  cy: number;
  bounds: MapBounds;
  reality: MapLayerDetail;
  dream: MapLayerDetail;
  children: MapLocationRender[];
  noDream: boolean;
}

export interface SocialNode {
  id: string;
  name: string;
  relation: string;
  level: number;
  type: '盟友' | '中立' | '敌对' | '未知';
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: number;
  read: boolean;
}

export interface Currency {
  name: string;
  label: string;
  amount: number;
  icon: string;
  color: string;
}
