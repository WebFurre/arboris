// src/modules/graph/renderers/graph.renderer.ts

import { Container, Graphics, Text } from 'pixi.js';
import type { PositionedNode, LinkConnection } from '../engines/tree-layout.engine';
import type { TaskId, ArborisNode } from '@/core/contracts/task.types';

export const NODE_THEME = {
  category: { fill: 0x18181b, stroke: 0x10b981, text: 0x34d399 },
  urgent: { fill: 0x450a0a, stroke: 0xf43f5e, text: 0xfb7185 },
  routine: { fill: 0x064e3b, stroke: 0x10b981, text: 0x6ee7b7 },
  one_off: { fill: 0x451a03, stroke: 0xf59e0b, text: 0xfcd34d },
  leisure: { fill: 0x3b0764, stroke: 0xa855f7, text: 0xd8b4fe },
};

export interface RenderGraphCallbacks {
  onNodeClick: (node: ArborisNode) => void;
  onNodeHover: (nodeId: TaskId | null) => void;
}

export interface NodeDisplayItem {
  container: Container;
  labelContainer: Container;
  baseRadius: number;
}

export class GraphSceneManager {
  private nodeDisplayMap = new Map<TaskId, NodeDisplayItem>();
  private linksGraphics = new Graphics();
  private currentLinks: LinkConnection[] = [];

  constructor(private linksLayer: Container, private nodesLayer: Container) {
    this.linksLayer.addChild(this.linksGraphics);
  }

  public syncLayout(
    layoutNodes: Map<TaskId, PositionedNode>,
    layoutLinks: LinkConnection[],
    callbacks: RenderGraphCallbacks
  ) {
    this.currentLinks = layoutLinks;
    const activeIds = new Set<TaskId>();

    layoutNodes.forEach((posNode, id) => {
      activeIds.add(id);
      let item = this.nodeDisplayMap.get(id);

      if (!item) {
        const nodeContainer = new Container();
        nodeContainer.x = posNode.x;
        nodeContainer.y = posNode.y;

        const labelContainer = new Container();
        nodeContainer.addChild(labelContainer);

        this.drawNodeGraphics(nodeContainer, labelContainer, posNode, callbacks);
        this.nodesLayer.addChild(nodeContainer);

        item = {
          container: nodeContainer,
          labelContainer,
          baseRadius: posNode.radius,
        };
        this.nodeDisplayMap.set(id, item);
      } else {
        // ✅ Исправлено: обращаемся строго через item.container!
        item.container.x = posNode.x;
        item.container.y = posNode.y;
      }
    });

    this.nodeDisplayMap.forEach((item, id) => {
      if (!activeIds.has(id)) {
        this.nodesLayer.removeChild(item.container);
        item.container.destroy({ children: true });
        this.nodeDisplayMap.delete(id);
      }
    });

    this.renderLinks(new Set(activeIds));
  }

  /**
   * Мягкое затемнение чужих веток при фокусе
   */
  public updateContextAlpha(activeBranchIds: Set<TaskId> | null) {
    this.nodeDisplayMap.forEach((item, id) => {
      if (!activeBranchIds) {
        item.container.alpha = 1.0;
      } else {
        item.container.alpha = activeBranchIds.has(id) ? 1.0 : 0.12;
      }
    });

    this.renderLinks(activeBranchIds);
  }

  /**
   * Контр-вращение: текст и бейджи всегда горизонтальны при повороте камеры
   */
  public updateLabelRotations(worldRotation: number) {
    this.nodeDisplayMap.forEach((item) => {
      item.labelContainer.rotation = -worldRotation;
    });
  }

  private renderLinks(activeBranchIds: Set<TaskId> | null) {
    this.linksGraphics.clear();

    for (const link of this.currentLinks) {
      const isBranchActive =
        !activeBranchIds || (activeBranchIds.has(link.sourceId) && activeBranchIds.has(link.targetId));

      const alpha = isBranchActive ? 0.45 : 0.05;
      const width = isBranchActive ? 2 : 1;

      this.linksGraphics
        .moveTo(link.startX, link.startY)
        .lineTo(link.endX, link.endY)
        .stroke({ width, color: 0x059669, alpha });
    }
  }

  private drawNodeGraphics(
    container: Container,
    labelContainer: Container,
    posNode: PositionedNode,
    callbacks: RenderGraphCallbacks
  ) {
    const { node, radius, isVirtualRoot, childrenCount } = posNode;

    // 1. Виртуальное ядро «Я»
    if (isVirtualRoot) {
      const core = new Graphics();
      core.circle(0, 0, radius + 10).stroke({ color: 0x3f3f46, width: 1, alpha: 0.3 });
      core.circle(0, 0, radius)
        .fill({ color: 0x18181b, alpha: 0.95 })
        .stroke({ color: 0xf4f4f5, width: 2.5 });
      core.circle(0, 0, 8).fill({ color: 0xffffff, alpha: 0.95 });
      container.addChildAt(core, 0);
      return;
    }

    container.eventMode = 'static';
    container.cursor = 'pointer';

    container.on('pointerdown', (e) => {
      e.stopPropagation();
      callbacks.onNodeClick(node);
    });

    container.on('pointerenter', () => callbacks.onNodeHover(node.id));
    container.on('pointerleave', () => callbacks.onNodeHover(null));

    const graphics = new Graphics();
    const theme = NODE_THEME[node.kind];

    // Геометрия узла
    if (node.kind === 'category') {
      graphics
        .circle(0, 0, radius)
        .fill({ color: theme.fill, alpha: 0.95 })
        .stroke({ color: theme.stroke, width: 2.5 });
      graphics
        .circle(0, 0, radius - 6)
        .stroke({ color: theme.stroke, width: 1, alpha: 0.4 });
    } else if (node.kind === 'urgent') {
      graphics
        .circle(0, 0, radius)
        .fill({ color: theme.fill, alpha: 0.95 })
        .stroke({ color: theme.stroke, width: 2.5 });
      graphics.circle(0, 0, 4).fill({ color: 0xffffff, alpha: 0.9 });
      container.label = 'urgent_node';
    } else if (node.kind === 'routine') {
      graphics
        .circle(0, 0, radius)
        .fill({ color: theme.fill, alpha: 0.9 })
        .stroke({ color: theme.stroke, width: 2 });

      const budCount = 20;
      const budOrbitRadius = radius + 8;
      for (let i = 0; i < budCount; i++) {
        const angle = (i / budCount) * Math.PI * 2;
        graphics.circle(
          Math.cos(angle) * budOrbitRadius,
          Math.sin(angle) * budOrbitRadius,
          2
        ).fill({ color: 0x34d399, alpha: 0.8 });
      }
    } else if (node.kind === 'leisure') {
      graphics
        .circle(0, 0, radius)
        .fill({ color: theme.fill, alpha: 0.9 })
        .stroke({ color: theme.stroke, width: 2 });
      graphics.circle(radius * 0.7, -radius * 0.7, 3).fill({ color: 0xd8b4fe, alpha: 0.85 });
      graphics.circle(-radius * 0.8, radius * 0.6, 2.5).fill({ color: 0xfbcfe8, alpha: 0.85 });
      container.label = 'leisure_node';
    } else {
      graphics
        .circle(0, 0, radius)
        .fill({ color: theme.fill, alpha: 0.9 })
        .stroke({ color: theme.stroke, width: 2 });
    }

    container.addChildAt(graphics, 0);

    // 2. Чип с количеством дочерних узлов
    if (childrenCount > 0) {
      const badge = new Graphics();
      badge.circle(radius - 2, radius - 2, 8)
        .fill({ color: 0x18181b })
        .stroke({ color: 0x10b981, width: 1.5 });

      const badgeText = new Text({
        text: String(childrenCount),
        style: {
          fontFamily: 'monospace',
          fontSize: 9,
          fontWeight: '700',
          fill: 0x34d399,
          align: 'center',
        },
      });
      badgeText.anchor.set(0.5);
      badgeText.x = radius - 2;
      badgeText.y = radius - 2;

      labelContainer.addChild(badge);
      labelContainer.addChild(badgeText);
    }

    // 3. Заголовок задачи
    const titleText = new Text({
      text: node.title.length > 18 ? `${node.title.slice(0, 16)}…` : node.title,
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 11,
        fontWeight: '500',
        fill: theme.text,
        align: 'center',
      },
    });

    titleText.anchor.set(0.5, 0);
    titleText.y = radius + 6;
    labelContainer.addChild(titleText);
  }

  public destroy() {
    this.nodeDisplayMap.forEach((item) => item.container.destroy({ children: true }));
    this.nodeDisplayMap.clear();
    this.linksGraphics.destroy();
  }
}