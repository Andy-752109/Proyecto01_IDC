import type Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage, Transformer } from 'react-konva';
import type { Annotation, Category, DraftAnnotation } from './types';
import { MAX_ZOOM, MIN_ZOOM, toWorldPoint, zoomIn, zoomOut } from './zoom';

type AnnotationCanvasProps = {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  annotations: Annotation[];
  categories: Category[];
  draft: DraftAnnotation | null;
  selectedId: number | null;
  onDrawEnd: (box: DraftAnnotation) => void;
  onSelect: (id: number | null) => void;
  onChange: (
    id: number,
    changes: Partial<Pick<Annotation, 'x' | 'y' | 'width' | 'height'>>,
  ) => void;
};

// Konva's <Image> needs a loaded HTMLImageElement, not just a URL string.
// No extra dependency (like use-image) — this is small enough to own directly.
function useHtmlImage(src: string): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);

  useEffect(() => {
    const element = new window.Image();
    element.src = src;
    element.onload = () => setImage(element);
    return () => {
      element.onload = null;
    };
  }, [src]);

  return image;
}

function colorForCategory(categories: Category[], categoryId: number): string {
  return categories.find((category) => category.id === categoryId)?.color ?? '#999999';
}

export function AnnotationCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  annotations,
  categories,
  draft,
  selectedId,
  onDrawEnd,
  onSelect,
  onChange,
}: AnnotationCanvasProps) {
  const image = useHtmlImage(imageUrl);
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Map<number, Konva.Rect>>(new Map());
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<DraftAnnotation | null>(null);
  const [zoom, setZoom] = useState(1);

  // Keep the Transformer attached to whichever shape is currently selected.
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }
    if (selectedId === null) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }
    const node = shapeRefs.current.get(selectedId);
    if (node) {
      transformer.nodes([node]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedId]);

  function handleStageMouseDown(event: Konva.KonvaEventObject<MouseEvent>) {
    // Only start drawing when clicking empty canvas — clicking a shape is
    // handled by that shape's own onClick (see the Rect below).
    if (event.target !== event.target.getStage()) {
      return;
    }
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) {
      return;
    }
    // getPointerPosition() returns screen pixels within the canvas element,
    // NOT adjusted for the Stage's own scale — toWorldPoint recovers the
    // "real" image-pixel coordinate (what we draw with and eventually
    // save), regardless of how zoomed in/out the view currently is.
    const realPoint = toWorldPoint(pointer, zoom);
    onSelect(null);
    setDrawStart(realPoint);
    setDrawRect({ x: realPoint.x, y: realPoint.y, width: 0, height: 0 });
  }

  function handleStageMouseMove(event: Konva.KonvaEventObject<MouseEvent>) {
    if (!drawStart) {
      return;
    }
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) {
      return;
    }
    const realPoint = toWorldPoint(pointer, zoom);
    setDrawRect({
      x: Math.min(drawStart.x, realPoint.x),
      y: Math.min(drawStart.y, realPoint.y),
      width: Math.abs(realPoint.x - drawStart.x),
      height: Math.abs(realPoint.y - drawStart.y),
    });
  }

  function handleStageMouseUp() {
    setDrawStart(null);
    // Ignore accidental clicks that never really dragged a box.
    if (drawRect && drawRect.width > 4 && drawRect.height > 4) {
      // Konva pointer positions are floats; the backend schema requires
      // integers (matches the `int` columns in the annotations table).
      onDrawEnd({
        x: Math.round(drawRect.x),
        y: Math.round(drawRect.y),
        width: Math.round(drawRect.width),
        height: Math.round(drawRect.height),
      });
    }
    setDrawRect(null);
  }

  function handleZoomIn() {
    setZoom((current) => zoomIn(current));
  }

  function handleZoomOut() {
    setZoom((current) => zoomOut(current));
  }

  function handleZoomReset() {
    setZoom(1);
  }

  return (
    <div className="annotation-canvas__wrapper">
      <div className="annotation-canvas__toolbar">
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Alejar"
        >
          −
        </button>
        <span className="annotation-canvas__zoom-level">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Acercar"
        >
          +
        </button>
        <button type="button" onClick={handleZoomReset} disabled={zoom === 1}>
          Restablecer
        </button>
      </div>

      <div className="annotation-canvas__scroll">
        <Stage
          width={imageWidth * zoom}
          height={imageHeight * zoom}
          scaleX={zoom}
          scaleY={zoom}
          className="annotation-canvas__stage"
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
        >
          <Layer>
            {image && (
              <KonvaImage image={image} width={imageWidth} height={imageHeight} listening={false} />
            )}

            {annotations.map((annotation) => (
              <Rect
                key={annotation.id}
                ref={(node: Konva.Rect | null) => {
                  if (node) {
                    shapeRefs.current.set(annotation.id, node);
                  } else {
                    shapeRefs.current.delete(annotation.id);
                  }
                }}
                x={annotation.x}
                y={annotation.y}
                width={annotation.width}
                height={annotation.height}
                stroke={colorForCategory(categories, annotation.categoryId)}
                strokeWidth={2 / zoom}
                fill="transparent"
                draggable
                onClick={() => onSelect(annotation.id)}
                onTap={() => onSelect(annotation.id)}
                onDragEnd={(event) => {
                  onChange(annotation.id, {
                    x: Math.round(event.target.x()),
                    y: Math.round(event.target.y()),
                  });
                }}
                onTransformEnd={(event) => {
                  const node = event.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  // Konva resizes by scaling the node rather than changing
                  // width/height directly — convert that scale back into real
                  // pixel dimensions and reset it to 1, so the next resize
                  // starts from accurate values instead of compounding scales.
                  node.scaleX(1);
                  node.scaleY(1);
                  onChange(annotation.id, {
                    x: Math.round(node.x()),
                    y: Math.round(node.y()),
                    width: Math.round(Math.max(5, node.width() * scaleX)),
                    height: Math.round(Math.max(5, node.height() * scaleY)),
                  });
                }}
              />
            ))}

            {draft && (
              <Rect
                x={draft.x}
                y={draft.y}
                width={draft.width}
                height={draft.height}
                stroke="#888888"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                fill="transparent"
              />
            )}

            {drawRect && (
              <Rect
                x={drawRect.x}
                y={drawRect.y}
                width={drawRect.width}
                height={drawRect.height}
                stroke="#888888"
                strokeWidth={1 / zoom}
                dash={[4 / zoom, 4 / zoom]}
                fill="transparent"
              />
            )}

            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
