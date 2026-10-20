// src/modules/graph/canvas/TreeCanvas.tsx

import { useEffect, useRef, useState } from 'react';
import { Application, Container } from 'pixi.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { nodesRepository } from '@/shared/db/nodes.repository';
import { useTreeStore } from '@/core/store/tree.store';
import { computeGraphLayout } from '../engines/tree-layout.engine';
import { GraphSceneManager } from '../renderers/graph.renderer';
import { CreateNodeModal } from '../components/CreateNodeModal';
import { NodeInspector } from '../components/NodeInspector';
import { Plus, ArrowUp, RotateCcw } from 'lucide-react';
import type { ArborisNode } from '@/core/contracts/task.types';

interface TreeCanvasProps {
  className?: string;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const DRAG_THRESHOLD = 6;
const INSPECTOR_WIDTH = 384;

export const TreeCanvas = ({ className = '' }: TreeCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const sceneManagerRef = useRef<GraphSceneManager | null>(null);

  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const worldStartRef = useRef({ x: 0, y: 0 });

  const cameraTargetRef = useRef<{
    x: number;
    y: number;
    zoom: number;
    isAnimating: boolean;
  }>({
    x: 0,
    y: 0,
    zoom: 0.9,
    isAnimating: false,
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const activeRootId = useTreeStore((s) => s.activeRootId);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const setActiveRootId = useTreeStore((s) => s.setActiveRootId);
  const setSelectedNodeId = useTreeStore((s) => s.setSelectedNodeId);
  const setHoveredNodeId = useTreeStore((s) => s.setHoveredNodeId);
  const resetFocus = useTreeStore((s) => s.resetFocus);

  const activeNodes = useLiveQuery(() => nodesRepository.getActiveTreeNodes()) ?? [];
  const currentRootNode = activeNodes.find((n) => n.id === activeRootId);

  const handleNavigateUp = () => {
    if (!activeRootId) return;
    const parent = currentRootNode?.parentId ?? null;
    setActiveRootId(parent);
    setSelectedNodeId(parent);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isCancelled = false;
    const app = new Application();

    const initPixi = async () => {
      try {
        await app.init({
          background: '#061a12',
          resizeTo: container,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
      } catch (err) {
        console.error('Ошибка запуска PixiJS:', err);
        return;
      }

      if (isCancelled) {
        app.destroy(true, { children: true });
        return;
      }

      appRef.current = app;
      container.appendChild(app.canvas);

      const world = new Container();
      const linksLayer = new Container();
      const nodesLayer = new Container();

      world.addChild(linksLayer);
      world.addChild(nodesLayer);
      app.stage.addChild(world);

      worldRef.current = world;
      sceneManagerRef.current = new GraphSceneManager(linksLayer, nodesLayer);

      world.x = container.clientWidth / 2;
      world.y = container.clientHeight / 2;
      cameraTargetRef.current.x = world.x;
      cameraTargetRef.current.y = world.y;

      let elapsedTime = 0;
      app.ticker.add((ticker) => {
        elapsedTime += ticker.deltaTime * 0.025;

        // Медленное, плавное скольжение камеры (0.045 синхронно с узлами)
        const cam = cameraTargetRef.current;
        if (cam.isAnimating && worldRef.current) {
          const w = worldRef.current;
          const camLerp = Math.min(1, 0.045 * ticker.deltaTime);
          w.x += (cam.x - w.x) * camLerp;
          w.y += (cam.y - w.y) * camLerp;
          w.scale.x += (cam.zoom - w.scale.x) * camLerp;
          w.scale.y = w.scale.x;

          if (
            Math.abs(cam.x - w.x) < 0.5 &&
            Math.abs(cam.y - w.y) < 0.5 &&
            Math.abs(cam.zoom - w.scale.x) < 0.003
          ) {
            w.x = cam.x;
            w.y = cam.y;
            w.scale.set(cam.zoom);
            cam.isAnimating = false;
          }
        }

        sceneManagerRef.current?.updatePhysics(ticker.deltaTime, elapsedTime);
      });
    };

    initPixi();

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const world = worldRef.current;
      if (!world) return;

      cameraTargetRef.current.isAnimating = false;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - world.x) / world.scale.x;
      const worldY = (mouseY - world.y) / world.scale.y;

      const zoomFactor = Math.exp(-e.deltaY * 0.0015);
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, world.scale.x * zoomFactor));

      world.scale.set(nextScale);
      world.x = mouseX - worldX * nextScale;
      world.y = mouseY - worldY * nextScale;

      cameraTargetRef.current.x = world.x;
      cameraTargetRef.current.y = world.y;
      cameraTargetRef.current.zoom = nextScale;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      isCancelled = true;
      container.removeEventListener('wheel', handleWheel);

      sceneManagerRef.current?.destroy();
      sceneManagerRef.current = null;

      if (appRef.current) {
        if (container.contains(app.canvas)) {
          container.removeChild(app.canvas);
        }
        app.destroy(true, { children: true });
        appRef.current = null;
        worldRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const sceneManager = sceneManagerRef.current;
    const container = containerRef.current;
    if (!sceneManager || !container) return;

    const layout = computeGraphLayout(activeNodes, activeRootId);

    sceneManager.syncLayout(
      layout.nodes,
      layout.links,
      layout.offscreenLeisureCandidates,
      activeRootId,
      {
        onNodeClick: (node: ArborisNode) => {
          setActiveRootId(node.id);
          setSelectedNodeId(node.id);
        },
        onNodeHover: (nodeId) => setHoveredNodeId(nodeId),
      }
    );

    if (activeRootId) {
      const parentAnchorX = container.clientWidth - INSPECTOR_WIDTH - 35;
      const parentAnchorY = 55;

      cameraTargetRef.current = {
        x: Math.max(240, parentAnchorX),
        y: parentAnchorY,
        zoom: 1.0,
        isAnimating: true,
      };
    } else {
      cameraTargetRef.current = {
        x: container.clientWidth / 2,
        y: container.clientHeight / 2,
        zoom: 0.85,
        isAnimating: true,
      };
    }
  }, [activeNodes, activeRootId, setActiveRootId, setSelectedNodeId, setHoveredNodeId]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;

    const world = worldRef.current;
    if (world) {
      worldStartRef.current = { x: world.x, y: world.y };
    }

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDownPosRef.current) return;
    const world = worldRef.current;
    if (!world) return;

    const dx = e.clientX - pointerDownPosRef.current.x;
    const dy = e.clientY - pointerDownPosRef.current.y;

    if (!isDraggingRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      isDraggingRef.current = true;
      cameraTargetRef.current.isAnimating = false;
    }

    if (isDraggingRef.current) {
      world.x = worldStartRef.current.x + dx;
      world.y = worldStartRef.current.y + dy;
      cameraTargetRef.current.x = world.x;
      cameraTargetRef.current.y = world.y;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerDownPosRef.current = null;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Игнорируем
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleNavigateUp}
      className={`relative w-full h-full overflow-hidden bg-[#061a12] select-none touch-none cursor-grab active:cursor-grabbing ${className}`}
    >
      <div 
        className="absolute top-20 left-4 z-20 flex items-center gap-2 pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {activeRootId && (
          <>
            <button
              type="button"
              onClick={handleNavigateUp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-xs font-medium text-emerald-400 border border-emerald-500/30 backdrop-blur-md shadow-xl transition-all cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>На уровень выше</span>
            </button>

            <button
              type="button"
              onClick={() => resetFocus()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-800 backdrop-blur-md shadow-xl transition-all cursor-pointer"
              title="Вернуться ко всему дереву"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Весь граф</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-xs font-medium text-zinc-300 hover:text-white border border-zinc-800 backdrop-blur-md shadow-xl transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>{activeRootId ? 'Добавить в этот узел' : 'Создать узел'}</span>
        </button>
      </div>

      <NodeInspector
        nodeId={selectedNodeId}
        activeRootId={activeRootId}
        allNodes={activeNodes}
        onClose={() => setSelectedNodeId(null)}
        onFocusBranch={(id) => {
          setActiveRootId(id);
          setSelectedNodeId(id);
        }}
      />

      <div className="absolute bottom-4 left-4 pointer-events-none px-3 py-1.5 rounded-xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center gap-2 shadow-lg z-10">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Клик: Фокус в углу заметки • Двойной клик: Назад • Мышь: Свободный сдвиг</span>
      </div>

      <CreateNodeModal
        isOpen={isCreateModalOpen}
        parentId={activeRootId}
        parentTitle={currentRootNode?.title}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};