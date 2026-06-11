import type { JsonPatchOp } from '../types';
import type { AgentToolDef, ToolExecutionContext } from './registry';
import { findMapNode, getNodePath } from './helpers';

export const mapTools: Record<string, AgentToolDef> = {
// update_map — 地图管理
// ══════════════════════════════════════════════

update_map: {
  name: 'update_map',
  label: '地图管理',
  category: 'variable',
  description:
    '管理地图节点：新增子地点、更新描述/探索信息、管理异常条目。\n' +
    '工具自动在整棵地图树中搜索 location 名称（支持检索词匹配），无需手动指定完整路径。\n\n' +
    '【action 说明】\n' +
    '- add_child: 在 location 的子地图下新增子地点。提供 name+检索词+方位+wDesc(可选)+dDesc(可选)\n' +
    '- update_desc: 更新 location 的现实/梦境描述。至少提供一个 world\n' +
    '- add_info: 向 location 的地点细节.信息 追加条目\n' +
    '- add_anomaly: 向 location 添加异常条目。name+评级+描述必填\n' +
    '- update_anomaly: 更新已有异常的具现进度或描述\n' +
    '- remove_anomaly: 删除某个异常条目\n\n' +
    '【必须调用的场景】\n' +
    '- 探索到地图中不存在的新区域 → add_child\n' +
    '- 发现某地点的隐藏信息 → add_info\n' +
    '- 遭遇/击败异常 → add_anomaly / update_anomaly / remove_anomaly',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add_child', 'update_desc', 'add_info', 'add_anomaly', 'update_anomaly', 'remove_anomaly'], description: '操作类型' },
      location: { type: 'string', description: '目标地点名称（支持检索词匹配）' },
      world: { type: 'string', enum: ['现实', '梦境'], description: '（add_child/add_anomaly 时）现实或梦境' },
      name: { type: 'string', description: '（add_child/anomaly 时）名称' },
      keywords: { type: 'array', items: { type: 'string' }, description: '（add_child 时）检索词列表' },
      xMin: { type: 'number' }, xMax: { type: 'number' }, yMin: { type: 'number' }, yMax: { type: 'number' }, zMin: { type: 'number' }, zMax: { type: 'number' },
      wDesc: { type: 'string', description: '（add_child/update_desc 时）现实世界描述' },
      dDesc: { type: 'string', description: '（add_child/update_desc 时）梦境世界描述' },
      info: { type: 'string', description: '（add_info 时）要追加的信息条目' },
      anomalyName: { type: 'string', description: '（add_anomaly/update_anomaly/remove_anomaly 时）异常名称' },
      rating: { type: 'string', description: '（add_anomaly 时）异常评级' },
      desc: { type: 'string', description: '（add_anomaly/update_anomaly 时）描述' },
      progress: { type: 'number', description: '（update_anomaly 时）具现进度 0-100' },
      traits: { type: 'object', description: '（add_anomaly 时）特性：{ "特性名": { 描述, 效果:[] } }' },
      reason: { type: 'string', description: '变更原因' },
    },
    required: ['action', 'location', 'reason'],
  },
  async execute(ctx, params) {
    const action = params?.action as string;
    const location = params?.location as string;
    const world = params?.world as string;
    const reason = params?.reason as string;

    if (!action || !location) {
      return { content: [{ type: 'text', text: '参数错误：action、location 均为必填' }] };
    }
    if (!reason || !reason.trim()) {
      return { content: [{ type: 'text', text: '参数错误：reason 不能为空' }] };
    }

    const mapTree = ctx.variables?.['地图'];
    if (!mapTree) {
      return { content: [{ type: 'text', text: '变量树中没有地图数据' }] };
    }

    const node = findMapNode(mapTree, location);
    if (!node || typeof node !== 'object') {
      return { content: [{ type: 'text', text: `在地图中未找到地点: ${location}` }] };
    }

    switch (action) {
      case 'add_child': {
        const name = params?.name as string;
        const keywords = params?.keywords as string[] | undefined;
        if (!name) return { content: [{ type: 'text', text: 'action=add_child 时 name 必填' }] };
        const child: Record<string, any> = { 检索词: keywords ?? [name] };
        const xMin = params?.xMin, xMax = params?.xMax, yMin = params?.yMin, yMax = params?.yMax, zMin = params?.zMin, zMax = params?.zMax;
        if (xMin !== undefined) child['方位'] = { X: [xMin, xMax ?? xMin], Y: [yMin ?? xMin, yMax ?? xMin], Z: [zMin ?? 0, zMax ?? 0] };
        child['现实'] = { 描述: params?.wDesc ?? '', 地点细节: { 信息: [], 异常: {} } };
        child['梦境'] = { 描述: params?.dDesc ?? '', 地点细节: { 信息: [], 异常: {} } };
        child['子地图'] = {};
        const sub = node['子地图'] ?? {};
        sub[name] = child;
        ctx.patchVariables([{ op: 'replace', path: getNodePath(mapTree, node) + '/子地图', value: sub }]);
        return { content: [{ type: 'text', text: `🗺️ 在 ${location} 下新增子地点: ${name}\n  原因：${reason}` }] };
      }
      case 'update_desc': {
        const wDesc = params?.wDesc as string | undefined;
        const dDesc = params?.dDesc as string | undefined;
        if (!wDesc && !dDesc) return { content: [{ type: 'text', text: 'action=update_desc 时至少提供 wDesc 或 dDesc 中的一个' }] };
        const ops: JsonPatchOp[] = [];
        if (wDesc) ops.push({ op: 'replace', path: getNodePath(mapTree, node) + '/现实/描述', value: wDesc });
        if (dDesc) ops.push({ op: 'replace', path: getNodePath(mapTree, node) + '/梦境/描述', value: dDesc });
        ctx.patchVariables(ops);
        return { content: [{ type: 'text', text: `🗺️ 已更新 ${location} 的描述\n  原因：${reason}` }] };
      }
      case 'add_info': {
        const info = params?.info as string;
        if (!info) return { content: [{ type: 'text', text: 'action=add_info 时 info 必填' }] };
        const w = world === '梦境' ? '梦境' : '现实';
        const infoArr = node[w]?.['地点细节']?.['信息'] ?? [];
        infoArr.push(info);
        const infoPath = getNodePath(mapTree, node) + `/${w}/地点细节/信息`;
        ctx.patchVariables([{ op: 'replace', path: infoPath, value: infoArr }]);
        return { content: [{ type: 'text', text: `📝 ${location}(${w}) 新增信息: ${info}\n  原因：${reason}` }] };
      }
      case 'add_anomaly': {
        const aName = params?.anomalyName as string;
        const rating = params?.rating as string;
        const desc = params?.desc as string;
        if (!aName || !rating || !desc) return { content: [{ type: 'text', text: 'action=add_anomaly 时 anomalyName、rating、desc 必填' }] };
        const w = world === '梦境' ? '梦境' : '现实';
        const entry: Record<string, any> = { 评级: rating, 描述: desc };
        if (w === '梦境') entry['具现进度'] = 0;
        const traits = params?.traits;
        if (traits) entry['特性'] = traits;
        const aPath = getNodePath(mapTree, node) + `/${w}/地点细节/异常/${aName}`;
        ctx.patchVariables([{ op: 'insert', path: aPath, value: entry }]);
        return { content: [{ type: 'text', text: `⚠️ ${location}(${w}) 新增异常: ${aName} (${rating})\n  原因：${reason}` }] };
      }
      case 'update_anomaly': {
        const aName = params?.anomalyName as string;
        if (!aName) return { content: [{ type: 'text', text: 'action=update_anomaly 时 anomalyName 必填' }] };
        const w = world === '梦境' ? '梦境' : '现实';
        const aPath = getNodePath(mapTree, node) + `/${w}/地点细节/异常/${aName}`;
        const existing = aPath.split('/').filter(Boolean).reduce((o: any, k) => o?.[k], ctx.variables);
        if (!existing) return { content: [{ type: 'text', text: `${location}(${w}) 中不存在异常 "${aName}"` }] };
        const ops: JsonPatchOp[] = [];
        if (params?.desc) ops.push({ op: 'replace', path: `${aPath}/描述`, value: params.desc });
        if (typeof params?.progress === 'number') ops.push({ op: 'replace', path: `${aPath}/具现进度`, value: Math.max(0, Math.min(100, params.progress)) });
        if (ops.length === 0) return { content: [{ type: 'text', text: '没有需要更新的字段' }] };
        ctx.patchVariables(ops);
        return { content: [{ type: 'text', text: `⚠️ 已更新 ${location}(${w}) 异常 "${aName}"\n  原因：${reason}` }] };
      }
      case 'remove_anomaly': {
        const aName = params?.anomalyName as string;
        if (!aName) return { content: [{ type: 'text', text: 'action=remove_anomaly 时 anomalyName 必填' }] };
        const w = world === '梦境' ? '梦境' : '现实';
        const aPath = getNodePath(mapTree, node) + `/${w}/地点细节/异常/${aName}`;
        ctx.patchVariables([{ op: 'remove', path: aPath }]);
        return { content: [{ type: 'text', text: `✅ 已从 ${location}(${w}) 移除异常 "${aName}"\n  原因：${reason}` }] };
      }
      default:
        return { content: [{ type: 'text', text: `未知 action: ${action}` }] };
    }
  },
},
};
