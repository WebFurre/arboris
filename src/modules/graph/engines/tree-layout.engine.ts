// src/modules/graph/engines/tree-layout.engine.ts

import type { ArborisNode, CategoryNode, TaskId } from '@/core/contracts/task.types';

export const VIRTUAL_ROOT_ID = '__virtual_core_ego__' as TaskId;

export interface PositionedNode {
  id: TaskId;
  targetX: number;
  targetY: number;
  radius: number;
  targetScale: number;
  targetAlpha: number;
  depth: number;
  node: ArborisNode;
  childrenCount: number;
  isVirtualRoot?: boolean;
  isFocusedParent?: boolean;
  swayPhase: number;
}

export interface LinkConnection {
  id: string;
  sourceId: TaskId;
  targetId: TaskId;
  targetAlpha: number;
  isOffscreenHint?: boolean;
}

export interface GraphLayoutResult {
  nodes: Map<TaskId, PositionedNode>;
  links: LinkConnection[];
  offscreenLeisureCandidates: ArborisNode[]; // Только те заметки отдыха, которых НЕТ на экране
}

export const getBaseNodeRadius = (node: ArborisNode): number => {
  if (node.kind === 'category') return 32;
  const minutes = node.estimatedMinutes ?? 15;
  if (minutes <= 5) return 16;
  if (minutes <= 15) return 20;
  if (minutes <= 30) return 24;
  if (minutes <= 60) return 28;
  return 32;
};

const hashPhase = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 1000;
  }
  return (h / 1000) * Math.PI * 2;
};

export const computeGraphLayout = (
  allNodes: ArborisNode[],
  activeRootId: TaskId | null
): GraphLayoutResult => {
  const positionedMap = new Map<TaskId, PositionedNode>();
  const links: LinkConnection[] = [];
  const childrenMap = new Map<TaskId | null, ArborisNode[]>();
  const nodeById = new Map<TaskId, ArborisNode>();
  const allLeisureNodes: ArborisNode[] = [];

  for (const node of allNodes) {
    nodeById.set(node.id, node);
    if (node.kind === 'leisure') {
      allLeisureNodes.push(node);
    }
    const parentKey = node.parentId ?? null;
    const list = childrenMap.get(parentKey) ?? [];
    list.push(node);
    childrenMap.set(parentKey, list);
  }

  const weightCache = new Map<TaskId, number>();
  const getSubtreeWeight = (id: TaskId): number => {
    if (weightCache.has(id)) return weightCache.get(id)!;
    const kids = childrenMap.get(id) ?? [];
    if (kids.length === 0) {
      weightCache.set(id, 1);
      return 1;
    }
    let sum = 0;
    for (const k of kids) {
      sum += getSubtreeWeight(k.id);
    }
    const w = Math.max(1.4, sum);
    weightCache.set(id, w);
    return w;
  };

  const virtualCoreNode: CategoryNode = {
    id: VIRTUAL_ROOT_ID,
    parentId: null,
    title: '',
    kind: 'category',
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
  };

  const isGlobalMode = !activeRootId || !nodeById.has(activeRootId);

  positionedMap.set(VIRTUAL_ROOT_ID, {
    id: VIRTUAL_ROOT_ID,
    targetX: 0,
    targetY: 0,
    radius: 44,
    targetScale: isGlobalMode ? 1.0 : 0.4,
    targetAlpha: isGlobalMode ? 1.0 : 0.0,
    depth: 0,
    node: virtualCoreNode,
    childrenCount: (childrenMap.get(null) ?? []).length,
    isVirtualRoot: true,
    swayPhase: 0,
  });

  // 1. СЦЕНАРИЙ А: ГЛОБАЛЬНАЯ КАРТА (Светлячки отключены!)
  if (isGlobalMode) {
    const topNodes = childrenMap.get(null) ?? [];
    const totalWeight = topNodes.reduce((acc, n) => acc + getSubtreeWeight(n.id), 0);

    if (topNodes.length > 0) {
      let currentAngle = -Math.PI / 2;
      const baseOrbit = Math.max(210, Math.min(300, topNodes.length * 42));

      topNodes.forEach((node, idx) => {
        const weight = getSubtreeWeight(node.id);
        const sectorAngle = (weight / totalWeight) * (Math.PI * 2);
        const midAngle = currentAngle + sectorAngle / 2;
        currentAngle += sectorAngle;

        const r = topNodes.length >= 5 && idx % 2 === 1 ? baseOrbit + 65 : baseOrbit;
        const x = r * Math.cos(midAngle);
        const y = r * Math.sin(midAngle);
        const kids = childrenMap.get(node.id) ?? [];

        positionedMap.set(node.id, {
          id: node.id,
          targetX: x,
          targetY: y,
          radius: getBaseNodeRadius(node),
          targetScale: 1.0,
          targetAlpha: 1.0,
          depth: 1,
          node,
          childrenCount: kids.length,
          swayPhase: hashPhase(node.id),
        });

        links.push({
          id: `${VIRTUAL_ROOT_ID}->${node.id}`,
          sourceId: VIRTUAL_ROOT_ID,
          targetId: node.id,
          targetAlpha: 0.5,
        });

        layoutWeightedGlobalSubtree(
          node.id,
          x,
          y,
          midAngle - sectorAngle * 0.44,
          midAngle + sectorAngle * 0.44,
          2,
          childrenMap,
          getSubtreeWeight,
          positionedMap,
          links
        );
      });
    }

    return {
      nodes: positionedMap,
      links,
      offscreenLeisureCandidates: [], // На общем плане светлячки не летают
    };
  }

  // 2. СЦЕНАРИЙ Б: ФОКУС НА УЗЛЕ (По главной диагонали + фильтр светлячков)
  const rootNode = nodeById.get(activeRootId)!;
  const directChildren = childrenMap.get(activeRootId) ?? [];
  const visibleSet = new Set<TaskId>([activeRootId]);

  positionedMap.set(activeRootId, {
    id: activeRootId,
    targetX: 0,
    targetY: 0,
    radius: getBaseNodeRadius(rootNode),
    targetScale: 2.5,
    targetAlpha: 1.0,
    depth: 0,
    node: rootNode,
    childrenCount: directChildren.length,
    isFocusedParent: true,
    swayPhase: hashPhase(activeRootId),
  });

  const count = directChildren.length;
  if (count > 0) {
    // Ось главной диагонали экрана (из правого верхнего угла в центр/левый-нижний): 138°
    const diagonalCenter = (138 * Math.PI) / 180;
    // Для 2-3 узлов делаем компактный веер по центру диагонали, для многих — шире
    const stepRad = (23 * Math.PI) / 180;
    const totalSpan = count === 1 ? 0 : Math.min((82 * Math.PI) / 180, (count - 1) * stepRad);
    const startAngle = diagonalCenter - totalSpan / 2;
    const angleStep = count === 1 ? 0 : totalSpan / (count - 1);

    directChildren.forEach((child, idx) => {
      visibleSet.add(child.id);
      const angle = count === 1 ? diagonalCenter : startAngle + idx * angleStep;

      // Отодвигаем дочерние узлы дальше по диагонали (480px - 600px), чтобы было много воздуха!
      const dist = count >= 3 && idx % 2 === 1 ? 590 : 480;
      const cx = dist * Math.cos(angle);
      const cy = dist * Math.sin(angle);

      const grandChildren = childrenMap.get(child.id) ?? [];

      positionedMap.set(child.id, {
        id: child.id,
        targetX: cx,
        targetY: cy,
        radius: getBaseNodeRadius(child),
        targetScale: 1.25,
        targetAlpha: 1.0,
        depth: 1,
        node: child,
        childrenCount: grandChildren.length,
        swayPhase: hashPhase(child.id),
      });

      links.push({
        id: `${activeRootId}->${child.id}`,
        sourceId: activeRootId,
        targetId: child.id,
        targetAlpha: 0.75,
      });

      // Ветки к внукам уходят дальше за край экрана
      if (grandChildren.length > 0) {
        const subSpread = (34 * Math.PI) / 180;
        const subStart = angle - subSpread / 2;
        const subStep = grandChildren.length === 1 ? 0 : subSpread / (grandChildren.length - 1);

        grandChildren.forEach((grandChild, gIdx) => {
          visibleSet.add(grandChild.id);
          const gAngle = grandChildren.length === 1 ? angle : subStart + gIdx * subStep;
          const gx = cx + 560 * Math.cos(gAngle);
          const gy = cy + 560 * Math.sin(gAngle);
          const greatGrandKids = childrenMap.get(grandChild.id) ?? [];

          positionedMap.set(grandChild.id, {
            id: grandChild.id,
            targetX: gx,
            targetY: gy,
            radius: getBaseNodeRadius(grandChild),
            targetScale: 1.0,
            targetAlpha: 0.85,
            depth: 2,
            node: grandChild,
            childrenCount: greatGrandKids.length,
            swayPhase: hashPhase(grandChild.id),
          });

          links.push({
            id: `${child.id}->${grandChild.id}`,
            sourceId: child.id,
            targetId: grandChild.id,
            targetAlpha: 0.55,
            isOffscreenHint: true,
          });
        });
      }
    });
  }

  for (const node of allNodes) {
    if (!visibleSet.has(node.id)) {
      positionedMap.set(node.id, {
        id: node.id,
        targetX: 0,
        targetY: 0,
        radius: getBaseNodeRadius(node),
        targetScale: 0.5,
        targetAlpha: 0.0,
        depth: 99,
        node,
        childrenCount: (childrenMap.get(node.id) ?? []).length,
        swayPhase: hashPhase(node.id),
      });
    }
  }

  // Фильтруем светлячков: берем ТОЛЬКО те заметки отдыха, которых сейчас НЕТ на экране!
  const offscreenLeisureCandidates = allLeisureNodes.filter((ln) => !visibleSet.has(ln.id));

  return {
    nodes: positionedMap,
    links,
    offscreenLeisureCandidates,
  };
};

function layoutWeightedGlobalSubtree(
  parentId: TaskId,
  parentX: number,
  parentY: number,
  sectorStart: number,
  sectorEnd: number,
  depth: number,
  childrenMap: Map<TaskId | null, ArborisNode[]>,
  getSubtreeWeight: (id: TaskId) => number,
  nodesResult: Map<TaskId, PositionedNode>,
  linksResult: LinkConnection[]
) {
  const children = childrenMap.get(parentId) ?? [];
  if (children.length === 0) return;

  const totalWeight = children.reduce((acc, c) => acc + getSubtreeWeight(c.id), 0);
  const midSector = (sectorStart + sectorEnd) / 2;
  const rawSpan = sectorEnd - sectorStart;
  const effectiveSpan = Math.max(rawSpan, Math.min(Math.PI * 0.75, children.length * 0.34));

  let currentAngle = midSector - effectiveSpan / 2;
  const orbitPatterns = [155, 215, 180, 245];

  children.forEach((child, idx) => {
    const w = getSubtreeWeight(child.id);
    const childSector = (w / totalWeight) * effectiveSpan;
    const angle = currentAngle + childSector / 2;
    currentAngle += childSector;

    const dist = orbitPatterns[idx % orbitPatterns.length];
    const x = parentX + dist * Math.cos(angle);
    const y = parentY + dist * Math.sin(angle);
    const subKids = childrenMap.get(child.id) ?? [];

    nodesResult.set(child.id, {
      id: child.id,
      targetX: x,
      targetY: y,
      radius: getBaseNodeRadius(child),
      targetScale: 1.0,
      targetAlpha: 1.0,
      depth,
      node: child,
      childrenCount: subKids.length,
      swayPhase: hashPhase(child.id),
    });

    linksResult.push({
      id: `${parentId}->${child.id}`,
      sourceId: parentId,
      targetId: child.id,
      targetAlpha: 0.45,
    });

    layoutWeightedGlobalSubtree(
      child.id,
      x,
      y,
      angle - childSector * 0.45,
      angle + childSector * 0.45,
      depth + 1,
      childrenMap,
      getSubtreeWeight,
      nodesResult,
      linksResult
    );
  });
}