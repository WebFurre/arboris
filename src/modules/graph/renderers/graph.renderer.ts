// src/modules/graph/renderers/graph.renderer.ts

import { Container, Graphics, Text } from 'pixi.js';
import type { PositionedNode, LinkConnection } from '../engines/tree-layout.engine';
import type { TaskId, ArborisNode } from '@/core/contracts/task.types';

// Настройки редкого появления гостя-заметки отдыха (US-2.3)
const WANDERER_DELAY_MS = 5000; // Появляется, если сидишь в ветке ~45 секунд
const WANDERER_SPAWN_CHANCE = 1.00; // Не каждый раз: шанс появления 45%

export const NODE_THEME = {
  category: { fill: 0x10b981, inner: 0x064e3b, stroke: 0x34d399, text: 0x6ee7b7 },
  urgent: { fill: 0xe11d48, inner: 0x881337, stroke: 0xfb7185, text: 0xfda4af },
  routine: { fill: 0x059669, inner: 0x064e3b, stroke: 0x34d399, text: 0x6ee7b7 },
  one_off: { fill: 0xd97706, inner: 0x78350f, stroke: 0xfbbf24, text: 0xfde68a },
  leisure: { fill: 0x9333ea, inner: 0x581c87, stroke: 0xc084fc, text: 0xe9d5ff },
};

export interface RenderGraphCallbacks {
  onNodeClick: (node: ArborisNode) => void;
  onNodeHover: (nodeId: TaskId | null) => void;
}

interface NodeDisplayItem {
  container: Container;
  parentAura: Graphics;
  labelText: Text;
  baseX: number;
  baseY: number;
  targetX: number;
  targetY: number;
  targetScale: number;
  targetAlpha: number;
  depth: number;
  swayPhase: number;
  isFocusedParent: boolean;
}

interface WanderingLeisureNote {
  container: Container;
  label: Text;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  isActive: boolean;
  alpha: number;
  nodeData: ArborisNode | null;
}

export class GraphSceneManager {
  private nodeDisplayMap = new Map<TaskId, NodeDisplayItem>();
  private linksGraphics = new Graphics();
  private wanderer: WanderingLeisureNote;
  private wandererTimer: ReturnType<typeof setTimeout> | null = null;
  private currentFocusedRootId: TaskId | null = null;
  private currentLinks: LinkConnection[] = [];
  private callbacks: RenderGraphCallbacks | null = null;

  constructor(private linksLayer: Container, private nodesLayer: Container) {
    this.linksLayer.addChild(this.linksGraphics);
    this.wanderer = this.createWandererNode();
    this.nodesLayer.addChild(this.wanderer.container);
  }

  /**
   * Создаем одиночного редкого гостя отдыха размером с маленькую заметку (radius = 15px)
   */
  private createWandererNode(): WanderingLeisureNote {
    const c = new Container();
    c.visible = false;
    c.alpha = 0;
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const g = new Graphics();
    const r = 15; // Размер маленькой заметки!
    // Мягкий фиолетовый ореол
    g.circle(0, 0, r + 9).fill({ color: 0xa855f7, alpha: 0.14 });
    g.circle(0, 0, r + 4).stroke({ color: 0xc084fc, width: 1, alpha: 0.35 });
    // Тело заметки отдыха
    g.circle(0, 0, r)
      .fill({ color: NODE_THEME.leisure.fill, alpha: 0.9 })
      .stroke({ color: NODE_THEME.leisure.stroke, width: 2 });
    // Маленькая искорка внутри
    g.circle(r * 0.4, -r * 0.4, 2.5).fill({ color: 0xf3e8ff, alpha: 0.9 });
    c.addChild(g);

    const label = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 10.5,
        fontWeight: '500',
        fill: NODE_THEME.leisure.text,
        align: 'center',
      },
    });
    label.anchor.set(0.5, 0);
    label.y = r + 6;
    c.addChild(label);

    const wandererObj: WanderingLeisureNote = {
      container: c,
      label,
      x: -1200,
      y: 400,
      anchorX: -420,
      anchorY: 340,
      isActive: false,
      alpha: 0,
      nodeData: null,
    };

    c.on('pointerdown', (e) => {
      e.stopPropagation();
      if (wandererObj.nodeData && this.callbacks) {
        this.callbacks.onNodeClick(wandererObj.nodeData);
      }
    });

    return wandererObj;
  }

  public syncLayout(
    layoutNodes: Map<TaskId, PositionedNode>,
    layoutLinks: LinkConnection[],
    offscreenLeisureCandidates: ArborisNode[],
    activeRootId: TaskId | null,
    callbacks: RenderGraphCallbacks
  ) {
    this.currentLinks = layoutLinks;
    this.callbacks = callbacks;
    const activeIds = new Set<TaskId>();

    layoutNodes.forEach((posNode, id) => {
      activeIds.add(id);
      let item = this.nodeDisplayMap.get(id);

      if (!item) {
        const nodeContainer = new Container();
        nodeContainer.x = posNode.targetX;
        nodeContainer.y = posNode.targetY;
        nodeContainer.alpha = posNode.targetAlpha;
        nodeContainer.scale.set(posNode.targetScale);

        const parentAura = new Graphics();
        nodeContainer.addChild(parentAura);

        const labelText = this.drawNodeGraphics(nodeContainer, parentAura, posNode, callbacks);
        this.nodesLayer.addChild(nodeContainer);

        item = {
          container: nodeContainer,
          parentAura,
          labelText,
          baseX: posNode.targetX,
          baseY: posNode.targetY,
          targetX: posNode.targetX,
          targetY: posNode.targetY,
          targetScale: posNode.targetScale,
          targetAlpha: posNode.targetAlpha,
          depth: posNode.depth,
          swayPhase: posNode.swayPhase,
          isFocusedParent: Boolean(posNode.isFocusedParent),
        };
        this.nodeDisplayMap.set(id, item);
      } else {
        if (posNode.targetAlpha > 0.01) {
          item.targetX = posNode.targetX;
          item.targetY = posNode.targetY;
        }
        item.targetScale = posNode.targetScale;
        item.targetAlpha = posNode.targetAlpha;
        item.depth = posNode.depth;
        item.isFocusedParent = Boolean(posNode.isFocusedParent);

        item.parentAura.visible = item.isFocusedParent;
        item.labelText.visible = !item.isFocusedParent;
      }
    });

    this.nodeDisplayMap.forEach((item, id) => {
      if (!activeIds.has(id)) {
        this.nodesLayer.removeChild(item.container);
        item.container.destroy({ children: true });
        this.nodeDisplayMap.delete(id);
      }
    });

    // Управление появлением редкого гостя отдыха при смене зума
    if (this.currentFocusedRootId !== activeRootId) {
      this.currentFocusedRootId = activeRootId;
      this.scheduleWandererVisit(activeRootId, offscreenLeisureCandidates);
    }
  }

  private scheduleWandererVisit(activeRootId: TaskId | null, candidates: ArborisNode[]) {
    if (this.wandererTimer) {
      clearTimeout(this.wandererTimer);
      this.wandererTimer = null;
    }

    // Убираем текущего гостя при переключении ветки
    this.wanderer.isActive = false;

    // Если мы на общем плане или нет скрытых заметок отдыха — не спавним
    if (!activeRootId || candidates.length === 0) return;

    // Проверяем случайный шанс появления
    if (Math.random() > WANDERER_SPAWN_CHANCE) return;

    this.wandererTimer = setTimeout(() => {
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      this.wanderer.nodeData = chosen;
      this.wanderer.label.text = `✨ ${chosen.title.length > 18 ? chosen.title.slice(0, 16) + '…' : chosen.title}`;

      // Вылетает далеко из-за левого/нижнего края экрана!
      this.wanderer.x = -1150;
      this.wanderer.y = 580;
      this.wanderer.anchorX = -420;
      this.wanderer.anchorY = 340;
      this.wanderer.alpha = 0;
      this.wanderer.isActive = true;
      this.wanderer.container.visible = true;
    }, WANDERER_DELAY_MS);
  }

  /**
   * 60 FPS Тикер: Медленный плавный LERP (0.042) + Легкое дыхание ветра + Полет гостя
   */
  public updatePhysics(delta: number, elapsedTime: number) {
    // Медленный, кинематографичный переход узлов (в 3 раза плавнее прежнего)
    const lerp = Math.min(1, 0.042 * delta);

    // 1. Интерполяция узлов + деликатное покачивание на ветру
    this.nodeDisplayMap.forEach((item) => {
      item.baseX += (item.targetX - item.baseX) * lerp;
      item.baseY += (item.targetY - item.baseY) * lerp;
      item.container.alpha += (item.targetAlpha - item.container.alpha) * lerp;

      const currentScale = item.container.scale.x + (item.targetScale - item.container.scale.x) * lerp;
      item.container.scale.set(currentScale);

      item.container.visible = item.container.alpha > 0.02;

      if (item.container.visible) {
        // Слегка убавленное, благородное покачивание на ветру
        const windAmp = item.isFocusedParent ? 1.5 : Math.min(5.2, item.depth * 2.1);
        const swayX = Math.sin(elapsedTime * 0.8 + item.swayPhase) * windAmp;
        const swayY = Math.cos(elapsedTime * 0.65 + item.swayPhase) * (windAmp * 0.65);

        item.container.x = item.baseX + swayX;
        item.container.y = item.baseY + swayY;
      }
    });

    // 2. Отрисовка живых изогнутых веток Безье
    this.linksGraphics.clear();

    for (const link of this.currentLinks) {
      const source = this.nodeDisplayMap.get(link.sourceId);
      const target = this.nodeDisplayMap.get(link.targetId);

      if (source && target && source.container.visible && target.container.visible) {
        const sx = source.container.x;
        const sy = source.container.y;
        const tx = target.container.x;
        const ty = target.container.y;

        const midX = (sx + tx) / 2;
        const midY = (sy + ty) / 2;
        const dx = tx - sx;
        const dy = ty - sy;
        const bend = Math.sin(elapsedTime * 0.75 + target.swayPhase) * 0.05;
        const ctrlX = midX - dy * (0.05 + bend);
        const ctrlY = midY + dx * (0.05 + bend);

        const alpha = Math.min(source.container.alpha, target.container.alpha) * link.targetAlpha;
        const width = link.isOffscreenHint ? 2.2 : 2.8;

        this.linksGraphics
          .moveTo(sx, sy)
          .quadraticCurveTo(ctrlX, ctrlY, tx, ty)
          .stroke({ width, color: 0x10b981, alpha });
      }
    }

    // 3. Кинематика редкого гостя отдыха (плавный прилет из-за края экрана и полет по восьмерке)
    if (this.wanderer.isActive) {
      this.wanderer.alpha += (0.92 - this.wanderer.alpha) * 0.02 * delta;
      // Незамысловатая траектория восьмерки (фигура Лиссажу) вокруг зоны задач
      const orbitX = this.wanderer.anchorX + Math.sin(elapsedTime * 0.35) * 140;
      const orbitY = this.wanderer.anchorY + Math.sin(elapsedTime * 0.7) * 85;

      this.wanderer.x += (orbitX - this.wanderer.x) * 0.008 * delta;
      this.wanderer.y += (orbitY - this.wanderer.y) * 0.008 * delta;

      this.wanderer.container.x = this.wanderer.x;
      this.wanderer.container.y = this.wanderer.y;
      this.wanderer.container.alpha = this.wanderer.alpha;
    } else if (this.wanderer.container.visible) {
      this.wanderer.alpha += (0 - this.wanderer.alpha) * 0.08 * delta;
      this.wanderer.container.alpha = this.wanderer.alpha;
      if (this.wanderer.alpha < 0.02) {
        this.wanderer.container.visible = false;
      }
    }
  }

  private drawNodeGraphics(
    container: Container,
    parentAura: Graphics,
    posNode: PositionedNode,
    callbacks: RenderGraphCallbacks
  ): Text {
    const { node, radius, isVirtualRoot } = posNode;

    if (isVirtualRoot) {
      const core = new Graphics();
      core.circle(0, 0, radius + 10).stroke({ color: 0x3f3f46, width: 1.5, alpha: 0.35 });
      core.circle(0, 0, radius)
        .fill({ color: 0x18181b, alpha: 0.95 })
        .stroke({ color: 0xf4f4f5, width: 3 });
      core.circle(0, 0, 9).fill({ color: 0xffffff, alpha: 0.95 });
      container.addChild(core);
      return new Text({ text: '' });
    }

    container.eventMode = 'static';
    container.cursor = 'pointer';

    container.on('pointerdown', (e) => {
      e.stopPropagation();
      callbacks.onNodeClick(node);
    });

    container.on('pointerenter', () => callbacks.onNodeHover(node.id));
    container.on('pointerleave', () => callbacks.onNodeHover(null));

    const theme = NODE_THEME[node.kind];

    parentAura.circle(0, 0, radius + 12).fill({ color: theme.fill, alpha: 0.15 });
    parentAura.circle(0, 0, radius + 6).stroke({ color: theme.stroke, width: 1.5, alpha: 0.5 });
    parentAura.visible = Boolean(posNode.isFocusedParent);

    const graphics = new Graphics();

    if (node.kind === 'routine') {
      graphics
        .circle(0, 0, radius)
        .fill({ color: theme.inner, alpha: 0.95 })
        .stroke({ color: theme.stroke, width: 2.5 });

      const budCount = 18;
      const budOrbitRadius = radius + 7;
      for (let i = 0; i < budCount; i++) {
        const angle = (i / budCount) * Math.PI * 2;
        graphics.circle(
          Math.cos(angle) * budOrbitRadius,
          Math.sin(angle) * budOrbitRadius,
          2
        ).fill({ color: 0x34d399, alpha: 0.85 });
      }
    } else if (node.kind === 'urgent') {
      graphics
        .circle(0, 0, radius)
        .fill({ color: theme.fill, alpha: 0.9 })
        .stroke({ color: 0xffe4e6, width: 2.5 });
      graphics.circle(0, 0, 4.5).fill({ color: 0xffffff, alpha: 0.95 });
      container.label = 'urgent_node';
    } else {
      graphics
        .circle(0, 0, radius)
        .fill({ color: theme.fill, alpha: 0.88 })
        .stroke({ color: theme.stroke, width: 2.5 });
    }

    container.addChild(graphics);

    const titleText = new Text({
      text: node.title.length > 20 ? `${node.title.slice(0, 18)}…` : node.title,
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 11,
        fontWeight: '600',
        fill: theme.text,
        align: 'center',
      },
    });

    titleText.anchor.set(0.5, 0);
    titleText.y = radius + 8;
    titleText.visible = !posNode.isFocusedParent;
    container.addChild(titleText);

    return titleText;
  }

  public destroy() {
    if (this.wandererTimer) clearTimeout(this.wandererTimer);
    this.nodeDisplayMap.forEach((item) => item.container.destroy({ children: true }));
    this.nodeDisplayMap.clear();
    this.linksGraphics.destroy();
    this.wanderer.container.destroy({ children: true });
  }
}