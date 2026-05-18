export enum PageType {
  HOME = 'HOME',
  PERSONA = 'PERSONA',
  WAREHOUSE = 'WAREHOUSE',
  MAP = 'MAP',
  SOCIAL = 'SOCIAL',
  ARCHIVE = 'ARCHIVE',
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

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: number;
  read: boolean;
}
