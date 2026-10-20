// src/modules/graph/engines/tree-layout.engine.ts

import type { ArborisNode, CategoryNode, TaskId } from '@/core/contracts/task.types';

export const VIRTUAL_ROOT_ID = '__virtual_core_ego__' as TaskId;

export interface PositionedNode {
  id: TaskId;
  x: number;
  y: number;
  radius: number;
  depth: number;
  node: ArborisNode;
  childrenCount: number;
  isVirtualRoot?: boolean;
}

export interface LinkConnection {
  id: string;
  sourceId: TaskId;
  targetId: TaskId;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface GraphLayoutResult {
  nodes: Map<TaskId, PositionedNode>;
  links: LinkConnection[];
  nodeById: Map<TaskId, ArborisNode>;
  childrenMap: Map<TaskId | null, ArborisNode[]>;
}

export const getNodeRadius = (node: ArborisNode): number => {
  if (node.kind === 'category') return 30;
  const minutes = node.estimatedMinutes ?? 15;
  if (minutes <= 5) return 15;
  if (minutes <= 15) return 19;
  if (minutes <= 30) return 23;
  if (minutes <= 60) return 27;
  return 32;
};

/**
 * Расчет стабильного графа в абсолютных координатах мира
 */
export const computeGraphLayout = (allNodes: ArborisNode[]): GraphLayoutResult => {
  const positionedMap = new Map<TaskId, PositionedNode>();
  const links: LinkConnection[] = [];
  const childrenMap = new Map<TaskId | null, ArborisNode[]>();
  const nodeById = new Map<TaskId, ArborisNode>();

  for (const node of allNodes) {
    nodeById.set(node.id, node);
    const parentKey = node.parentId ?? null;
    const list = childrenMap.get(parentKey) ?? [];
    list.push(node);
    childrenMap.set(parentKey, list);
  }

  // Центральное Семечко «Я»
  const virtualCoreNode: CategoryNode = {
    id: VIRTUAL_ROOT_ID,
    parentId: null,
    title: '',
    kind: 'category',
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
  };

  positionedMap.set(VIRTUAL_ROOT_ID, {
    id: VIRTUAL_ROOT_ID,
    x: 0,
    y: 0,
    radius: 44,
    depth: 0,
    node: virtualCoreNode,
    childrenCount: (childrenMap.get(null) ?? []).length,
    isVirtualRoot: true,
  });

  // Категории верхнего уровня
  const topNodes = childrenMap.get(null) ?? [];
  const count = topNodes.length;

  if (count > 0) {
    const baseOrbit = Math.max(220, Math.min(280, count * 45));
    const angleStep = (Math.PI * 2) / count;

    topNodes.forEach((node, idx) => {
      const angle = idx * angleStep - Math.PI / 2;
      const x = baseOrbit * Math.cos(angle);
      const y = baseOrbit * Math.sin(angle);
      const kids = childrenMap.get(node.id) ?? [];

      positionedMap.set(node.id, {
        id: node.id,
        x,
        y,
        radius: getNodeRadius(node),
        depth: 1,
        node,
        childrenCount: kids.length,
      });

      links.push({
        id: `${VIRTUAL_ROOT_ID}->${node.id}`,
        sourceId: VIRTUAL_ROOT_ID,
        targetId: node.id,
        startX: 0,
        startY: 0,
        endX: x,
        endY: y,
      });

      // Раскладываем поддеревья веером наружу
      layoutBranch(node.id, x, y, angle, Math.min(1.4, angleStep * 0.9), 2, childrenMap, positionedMap, links);
    });
  }

  return { nodes: positionedMap, links, nodeById, childrenMap };
};

function layoutBranch(
  parentId: TaskId,
  parentX: number,
  parentY: number,
  mainAngle: number,
  sectorSpread: number,
  depth: number,
  childrenMap: Map<TaskId | null, ArborisNode[]>,
  nodesResult: Map<TaskId, PositionedNode>,
  linksResult: LinkConnection[]
) {
  const children = childrenMap.get(parentId) ?? [];
  const count = children.length;
  if (count === 0) return;

  const startAngle = mainAngle - sectorSpread / 2;
  const angleStep = count === 1 ? 0 : sectorSpread / (count - 1);
  const orbitPatterns = [160, 230, 190, 260];

  children.forEach((child, idx) => {
    const angle = count === 1 ? mainAngle : startAngle + idx * angleStep;
    const dist = orbitPatterns[idx % orbitPatterns.length];

    const x = parentX + dist * Math.cos(angle);
    const y = parentY + dist * Math.sin(angle);
    const subKids = childrenMap.get(child.id) ?? [];

    nodesResult.set(child.id, {
      id: child.id,
      x,
      y,
      radius: getNodeRadius(child),
      depth,
      node: child,
      childrenCount: subKids.length,
    });

    linksResult.push({
      id: `${parentId}->${child.id}`,
      sourceId: parentId,
      targetId: child.id,
      startX: parentX,
      startY: parentY,
      endX: x,
      endY: y,
    });

    layoutBranch(child.id, x, y, angle, sectorSpread * 0.7, depth + 1, childrenMap, nodesResult, linksResult);
  });
}