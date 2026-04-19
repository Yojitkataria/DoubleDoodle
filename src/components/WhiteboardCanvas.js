import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
} from 'react';
import * as fabric from 'fabric';

const BOARD_WIDTH = 4000;
const BOARD_HEIGHT = 3000;

function makeId() {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `obj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `obj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function getPayloadAction(payload) {
  if (!payload) return null;
  if (payload.action) return payload.action;
  return payload;
}

const WhiteboardCanvas = forwardRef(
  (
    {
      roomId,
      socket,
      activeToolRef,
      brushColorRef,
      brushSizeRef,
      setCanUndo,
      setCanRedo,
    },
    ref,
  ) => {
    const canvasElRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const fabricCanvasRef = useRef(null);
    const hasAppliedBoardStateRef = useRef(false);

    // Objects added by THIS user only (for local undo/redo).
    const myHistory = useRef([]);
    const myRedo = useRef([]);

    const isShapeDraggingRef = useRef(false);
    const shapeStartRef = useRef({ x: 0, y: 0 });
    const activeShapeRef = useRef(null);

    const updateHistoryButtons = useCallback(() => {
      setCanUndo(myHistory.current.length > 0);
      setCanRedo(myRedo.current.length > 0);
    }, [setCanUndo, setCanRedo]);

    const emitAction = useCallback(
      (action) => {
        if (!socket || !roomId) return;
        socket.emit('drawing-action', { roomId, action });
      },
      [socket, roomId],
    );

    const download = useCallback(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const dataUrl = canvas.toDataURL({ format: 'png' });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `whiteboard-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, []);

    const addFabricObject = useCallback(
      (obj) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas || !obj) return;

        const id = obj.id ?? `stamp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        obj.set({
          id,
          selectable: true,
          evented: true,
        });

        // Center within the current visible scroller viewport.
        const container = scrollContainerRef.current;
        const scrollLeft = container?.scrollLeft ?? 0;
        const scrollTop = container?.scrollTop ?? 0;
        const viewCenterX = scrollLeft + (container?.clientWidth ?? BOARD_WIDTH) / 2;
        const viewCenterY = scrollTop + (container?.clientHeight ?? BOARD_HEIGHT) / 2;
        obj.set({ left: viewCenterX, top: viewCenterY, originX: 'center', originY: 'center' });
        obj.setCoords();

        canvas.add(obj);
        canvas.requestRenderAll();

        myHistory.current.push(obj);
        myRedo.current = [];
        updateHistoryButtons();

        emitAction({ type: 'ADD', data: obj.toObject(['id']) });
      },
      [emitAction, updateHistoryButtons],
    );

    const stampShapeByType = useCallback(
      (shapeType, options = {}) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const stroke = '#000000';
        const fill = '#ffffff';

        const makeRect = (left, top, width, height, extra = {}) =>
          new fabric.Rect({
            left,
            top,
            width,
            height,
            fill,
            stroke,
            strokeWidth: 1,
            ...extra,
          });

        const makeText = (text, left, top, extra = {}) =>
          new fabric.Text(text, {
            left,
            top,
            fontSize: 12,
            fill: stroke,
            ...extra,
          });

        if (shapeType === 'array') {
          const cells = Math.max(1, Number(options.cells) || 5);
          const cellSize = 50;
          const objects = [];
          for (let i = 0; i < cells; i += 1) {
            objects.push(makeRect(i * cellSize, 0, cellSize, cellSize));
          }
          const group = new fabric.Group(objects, { selectable: true });
          addFabricObject(group);
          return;
        }

        if (shapeType === 'node') {
          const circle = new fabric.Circle({
            left: 0,
            top: 0,
            radius: 35,
            fill,
            stroke,
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
          });
          const group = new fabric.Group([circle], { selectable: true });
          addFabricObject(group);
          return;
        }

        if (shapeType === 'arrow') {
          const length = 120;
          const line = new fabric.Line([0, 0, length, 0], {
            stroke,
            strokeWidth: 2,
            originX: 'left',
            originY: 'center',
          });
          const head = new fabric.Triangle({
            left: length,
            top: 0,
            width: 14,
            height: 14,
            fill: stroke,
            originX: 'center',
            originY: 'center',
            angle: 90,
          });
          const group = new fabric.Group([line, head], { selectable: true });
          addFabricObject(group);
          return;
        }

        if (shapeType === 'stack') {
          const cellW = 60;
          const cellH = 40;
          const objects = [];
          for (let i = 0; i < 4; i += 1) {
            objects.push(makeRect(0, i * cellH, cellW, cellH));
          }
          objects.push(
            makeText('TOP', cellW / 2, -18, {
              originX: 'center',
              originY: 'top',
              fontSize: 11,
              fontWeight: 'bold',
            }),
          );
          const group = new fabric.Group(objects, { selectable: true });
          addFabricObject(group);
          return;
        }

        if (shapeType === 'queue') {
          const box = 50;
          const objects = [];
          for (let i = 0; i < 4; i += 1) {
            objects.push(makeRect(i * box, 0, box, box));
          }
          objects.push(
            makeText('FRONT', -8, box / 2, {
              originX: 'right',
              originY: 'center',
              fontSize: 11,
            }),
          );
          objects.push(
            makeText('REAR', 4 * box + 8, box / 2, {
              originX: 'left',
              originY: 'center',
              fontSize: 11,
            }),
          );
          const group = new fabric.Group(objects, { selectable: true });
          addFabricObject(group);
          return;
        }

        if (shapeType === 'table') {
          const rows = Math.max(1, Number(options.rows) || 3);
          const cols = Math.max(1, Number(options.cols) || 4);
          const cellW = 60;
          const cellH = 40;
          const objects = [];
          for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
              objects.push(makeRect(c * cellW, r * cellH, cellW, cellH));
            }
          }
          const group = new fabric.Group(objects, { selectable: true });
          addFabricObject(group);
        }
      },
      [addFabricObject],
    );

    // Public method: accepts either a pre-built Fabric object, OR (back-compat) a shapeType string.
    const stampShape = useCallback(
      (arg1, arg2) => {
        if (typeof arg1 === 'string') {
          stampShapeByType(arg1, arg2);
          return;
        }
        addFabricObject(arg1);
      },
      [addFabricObject, stampShapeByType],
    );

    const undo = useCallback(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const lastObj = myHistory.current.pop();
      if (!lastObj) {
        updateHistoryButtons();
        return;
      }

      myRedo.current.push(lastObj);
      canvas.remove(lastObj);
      canvas.requestRenderAll();
      updateHistoryButtons();

      if (lastObj.id) {
        emitAction({ type: 'REMOVE', id: lastObj.id });
      }
    }, [emitAction, updateHistoryButtons]);

    const redo = useCallback(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const obj = myRedo.current.pop();
      if (!obj) {
        updateHistoryButtons();
        return;
      }

      myHistory.current.push(obj);
      canvas.add(obj);
      canvas.requestRenderAll();
      updateHistoryButtons();

      emitAction({ type: 'ADD', data: obj.toObject(['id']) });
    }, [emitAction, updateHistoryButtons]);

    useImperativeHandle(
      ref,
      () => ({
        download,
        undo,
        redo,
        stampShape,
        addFabricObject,
      }),
      [download, undo, redo, stampShape, addFabricObject],
    );

    useEffect(() => {
      const el = canvasElRef.current;
      if (!el) return undefined;

      const canvas = new fabric.Canvas(el, {
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        backgroundColor: '#ffffff',
        selection: true,
      });

      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      fabricCanvasRef.current = canvas;

      const onPathCreated = (e) => {
        const path = e?.path;
        if (!path) return;

        // Only track/broadcast if this was created while in a drawing tool.
        const tool = activeToolRef?.current;
        if (tool !== 'draw' && tool !== 'eraser') return;

        const id = makeId();
        path.set({ id });

        myHistory.current.push(path);
        myRedo.current = [];
        updateHistoryButtons();

        emitAction({ type: 'ADD', data: path.toObject(['id']) });
      };

      canvas.on('path:created', onPathCreated);

      return () => {
        canvas.off('path:created', onPathCreated);
        canvas.dispose();
        fabricCanvasRef.current = null;
      };
    }, [activeToolRef, emitAction, updateHistoryButtons]);

    // Keep canvas tool state in sync with refs (refs don't re-render).
    useEffect(() => {
      let raf = 0;
      const last = {
        tool: null,
        color: null,
        size: null,
      };

      const tick = () => {
        const canvas = fabricCanvasRef.current;
        if (canvas) {
          const tool = activeToolRef?.current ?? 'pen';
          const color = brushColorRef?.current ?? '#000000';
          const size = Number(brushSizeRef?.current ?? 5);

          if (tool !== last.tool || color !== last.color || size !== last.size) {
            const isDrawing = tool === 'draw' || tool === 'eraser' || tool === 'pen';
            canvas.isDrawingMode = isDrawing;

            if (canvas.freeDrawingBrush) {
              // Improve writing smoothness for mouse users.
              canvas.freeDrawingBrush.strokeLineCap = 'round';
              canvas.freeDrawingBrush.strokeLineJoin = 'round';

              if (tool === 'eraser') {
                canvas.freeDrawingBrush.color = '#ffffff';
                canvas.freeDrawingBrush.width = Math.max(1, size * 4);
                canvas.freeDrawingBrush.decimate = 2;
              } else if (tool === 'pen') {
                canvas.freeDrawingBrush.color = color;
                canvas.freeDrawingBrush.width = 2;
                canvas.freeDrawingBrush.decimate = 1;
              } else {
                canvas.freeDrawingBrush.color = color;
                canvas.freeDrawingBrush.width = Math.max(1, size);
                canvas.freeDrawingBrush.decimate = 2;
              }
            }

            last.tool = tool;
            last.color = color;
            last.size = size;
          }
        }

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [activeToolRef, brushColorRef, brushSizeRef]);

    // Shape tools (line / rect / circle).
    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return undefined;

      const getStroke = () => brushColorRef?.current ?? '#000000';

      const onMouseDown = (opt) => {
        const tool = activeToolRef?.current;
        if (tool !== 'line' && tool !== 'rect' && tool !== 'circle') return;

        canvas.isDrawingMode = false;

        const pointer = canvas.getPointer(opt.e);
        isShapeDraggingRef.current = true;
        shapeStartRef.current = { x: pointer.x, y: pointer.y };

        const common = {
          stroke: getStroke(),
          strokeWidth: 2,
          fill: 'rgba(0,0,0,0)',
          selectable: false,
          evented: false,
        };

        let shape;
        if (tool === 'line') {
          shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], common);
        } else if (tool === 'rect') {
          shape = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            ...common,
          });
        } else {
          shape = new fabric.Ellipse({
            left: pointer.x,
            top: pointer.y,
            rx: 0,
            ry: 0,
            originX: 'left',
            originY: 'top',
            ...common,
          });
        }

        activeShapeRef.current = shape;
        canvas.add(shape);
      };

      const onMouseMove = (opt) => {
        if (!isShapeDraggingRef.current) return;

        const tool = activeToolRef?.current;
        if (tool !== 'line' && tool !== 'rect' && tool !== 'circle') return;

        const shape = activeShapeRef.current;
        if (!shape) return;

        const pointer = canvas.getPointer(opt.e);
        const { x: x0, y: y0 } = shapeStartRef.current;
        const x1 = pointer.x;
        const y1 = pointer.y;

        if (tool === 'line') {
          shape.set({ x1, y1 });
        } else if (tool === 'rect') {
          const left = Math.min(x0, x1);
          const top = Math.min(y0, y1);
          const width = Math.abs(x1 - x0);
          const height = Math.abs(y1 - y0);
          shape.set({ left, top, width, height });
        } else {
          const left = Math.min(x0, x1);
          const top = Math.min(y0, y1);
          const rx = Math.abs(x1 - x0) / 2;
          const ry = Math.abs(y1 - y0) / 2;
          shape.set({ left, top, rx, ry });
        }

        shape.setCoords();
        canvas.requestRenderAll();
      };

      const onMouseUp = () => {
        if (!isShapeDraggingRef.current) return;
        isShapeDraggingRef.current = false;

        const shape = activeShapeRef.current;
        activeShapeRef.current = null;
        if (!shape) return;

        const id = makeId();
        shape.set({
          id,
          selectable: true,
          evented: true,
        });
        shape.setCoords();
        canvas.requestRenderAll();

        myHistory.current.push(shape);
        myRedo.current = [];
        updateHistoryButtons();

        emitAction({ type: 'ADD', data: shape.toObject(['id']) });
      };

      canvas.on('mouse:down', onMouseDown);
      canvas.on('mouse:move', onMouseMove);
      canvas.on('mouse:up', onMouseUp);

      return () => {
        canvas.off('mouse:down', onMouseDown);
        canvas.off('mouse:move', onMouseMove);
        canvas.off('mouse:up', onMouseUp);
      };
    }, [activeToolRef, brushColorRef, emitAction, updateHistoryButtons]);

    // Socket sync (Fabric v6 async enlivenObjects; REMOVE by id).
    useEffect(() => {
      if (!socket) return undefined;

      const handle = async (payload) => {
        // Support either `{roomId, action}` or plain `action`.
        if (payload?.roomId && roomId && payload.roomId !== roomId) return;

        const action = getPayloadAction(payload);
        if (!action) return;

        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        if (action.type === 'ADD' && action.data) {
          // Fabric v6 async API (callback form is broken).
          const objects = await fabric.util.enlivenObjects([action.data]);
          const obj = objects?.[0];
          if (!obj) return;

          // If we already have an object with this id, don't duplicate it.
          if (obj.id && canvas.getObjects().some((o) => o.id === obj.id)) return;

          canvas.add(obj);
          canvas.requestRenderAll();
          return;
        }

        if (action.type === 'REMOVE' && action.id) {
          const obj = canvas.getObjects().find((o) => o.id === action.id);
          if (obj) {
            canvas.remove(obj);
            canvas.requestRenderAll();
          }

          // If a remote user removed something we had in local stacks, keep stacks consistent.
          myHistory.current = myHistory.current.filter((o) => o?.id !== action.id);
          myRedo.current = myRedo.current.filter((o) => o?.id !== action.id);
          updateHistoryButtons();
        }
      };

      socket.on('drawing-action', handle);
      return () => socket.off('drawing-action', handle);
    }, [roomId, socket, updateHistoryButtons]);

    // Initial board replay for mid-session joiners.
    useEffect(() => {
      if (!socket) return undefined;

      const handleBoardState = async (payload) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const objectsData = payload?.objects;
        if (!Array.isArray(objectsData) || objectsData.length === 0) return;

        // Apply only once per mount to avoid duplicating on reconnect chatter.
        if (hasAppliedBoardStateRef.current) return;
        hasAppliedBoardStateRef.current = true;

        try {
          const objects = await fabric.util.enlivenObjects(objectsData);
          for (const obj of objects) {
            if (!obj) continue;
            if (obj.id && canvas.getObjects().some((o) => o.id === obj.id)) continue;
            canvas.add(obj);
          }
          canvas.requestRenderAll();
        } catch {
          // Ignore replay errors to avoid breaking drawing session.
        }
      };

      socket.on('board-state', handleBoardState);
      return () => socket.off('board-state', handleBoardState);
    }, [socket]);

    return (
      <div className="w-full h-full">
        <div ref={scrollContainerRef} className="w-full h-full overflow-auto">
          <canvas ref={canvasElRef} />
        </div>
      </div>
    );
  },
);

export default WhiteboardCanvas;