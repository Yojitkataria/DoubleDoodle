import React, { useMemo, useState } from 'react';
import { HexColorPicker } from 'react-colorful';

const PRESET_COLORS = [
  '#000000',
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
];

function ToolButton({ label, isActive, onClick, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors text-sm border ${
        isActive
          ? 'bg-blue-600 text-white border-blue-700'
          : 'bg-gray-200 text-gray-700 border-gray-200 hover:bg-gray-300'
      }`}
    >
      <span className="inline-flex items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const WhiteboardToolbar = ({
  brushColor,
  setBrushColor,
  brushSize,
  setBrushSize,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isConnected,
  activeTool,
  setActiveTool,
  onDownload,
  onStampShape,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewSize = useMemo(() => {
    if (activeTool === 'pen') return 2;
    return Math.min(40, Math.max(4, Number(brushSize) || 1));
  }, [activeTool, brushSize]);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // If clipboard is blocked, do nothing (avoid noisy alerts in UI).
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 h-full">
      {/* Tools Grid */}
      <div>
        <h4 className="text-sm font-semibold text-gray-500 mb-2">Tools</h4>
        <div className="grid grid-cols-2 gap-2">
          <ToolButton
            label="Pen"
            isActive={activeTool === 'pen'}
            onClick={() => setActiveTool('pen')}
            icon={<span className="text-base leading-none">✏️</span>}
          />
          <ToolButton
            label="Draw"
            isActive={activeTool === 'draw'}
            onClick={() => setActiveTool('draw')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
              </svg>
            }
          />
          <ToolButton
            label="Eraser"
            isActive={activeTool === 'eraser'}
            onClick={() => setActiveTool('eraser')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 20H11" />
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 15.5 14.5 4a2.1 2.1 0 0 1 3 0l3.5 3.5a2.1 2.1 0 0 1 0 3L14 20H7a2 2 0 0 1-1.4-.6L3 17a2 2 0 0 1 0-1.5Z"
                />
              </svg>
            }
          />
          <ToolButton
            label="Select"
            isActive={activeTool === 'select'}
            onClick={() => setActiveTool('select')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 3l11 11-5 1 1 5-2 1-3-4-4 1Z" />
              </svg>
            }
          />
          <ToolButton
            label="Line"
            isActive={activeTool === 'line'}
            onClick={() => setActiveTool('line')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 19 19 5" />
              </svg>
            }
          />
          <ToolButton
            label="Rect"
            isActive={activeTool === 'rect'}
            onClick={() => setActiveTool('rect')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" strokeWidth="2" />
              </svg>
            }
          />
          <ToolButton
            label="Circle"
            isActive={activeTool === 'circle'}
            onClick={() => setActiveTool('circle')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <ellipse cx="12" cy="12" rx="7" ry="7" strokeWidth="2" />
              </svg>
            }
          />
        </div>
      </div>

      {/* DSA Shapes */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-semibold text-gray-500 mb-2">DSA Shapes</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onStampShape?.('array');
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors text-sm bg-purple-50 text-purple-700 hover:bg-purple-100"
          >
            <span className="font-mono">[ ]</span>
            <span>Array</span>
          </button>

          <button
            type="button"
            onClick={() => onStampShape?.('node')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors text-sm bg-purple-50 text-purple-700 hover:bg-purple-100"
          >
            <span>⭕</span>
            <span>Node</span>
          </button>

          <button
            type="button"
            onClick={() => onStampShape?.('arrow')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors text-sm bg-purple-50 text-purple-700 hover:bg-purple-100"
          >
            <span>→</span>
            <span>Arrow</span>
          </button>

          <button
            type="button"
            onClick={() => onStampShape?.('stack')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors text-sm bg-purple-50 text-purple-700 hover:bg-purple-100"
          >
            <span>📚</span>
            <span>Stack</span>
          </button>

          <button
            type="button"
            onClick={() => onStampShape?.('queue')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors text-sm bg-purple-50 text-purple-700 hover:bg-purple-100"
          >
            <span>⇒</span>
            <span>Queue</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onStampShape?.('table');
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors text-sm bg-purple-50 text-purple-700 hover:bg-purple-100"
          >
            <span>⊞</span>
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* Color Palette */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-semibold text-gray-500 mb-3">Color</h4>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setBrushColor(color)}
              className={`w-full h-8 rounded-lg border-2 transition-transform hover:scale-105 ${
                brushColor === color ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Set color ${color}`}
            />
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorPicker((v) => !v)}
              className="w-full h-8 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center"
              aria-label="Custom color"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {showColorPicker && (
              <div className="absolute top-10 left-0 z-20 p-2 bg-white rounded-lg shadow-xl">
                <HexColorPicker color={brushColor} onChange={setBrushColor} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Brush Size */}
      <div className="border-t border-gray-200 pt-4">
        <label className="block text-sm font-semibold text-gray-500 mb-3">Brush Size</label>
        <input
          type="range"
          min="1"
          max="50"
          value={brushSize}
          onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="text-center text-xs text-gray-500 mt-1">{brushSize}px</div>
        <div className="mt-3 flex items-center justify-center">
          <div
            className="rounded-full border border-gray-300 shadow-sm"
            style={{
              width: previewSize,
              height: previewSize,
              backgroundColor: brushColor,
            }}
            aria-label="Brush size preview"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-t border-gray-200 pt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={copyInvite}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10.5 4.5" />
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14 11a5 5 0 0 0-7.07 0L5.52 12.4a5 5 0 0 0 7.07 7.07L13.5 19.5" />
          </svg>
          {copied ? 'Copied!' : 'Copy Invite Link'}
        </button>

        <button
          type="button"
          onClick={onDownload}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3v10" />
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m7 12 5 5 5-5" />
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 21h14" />
          </svg>
          Download Board
        </button>
      </div>

      {/* Undo/Redo */}
      <div className="border-t border-gray-200 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || !isConnected}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo || !isConnected}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Redo
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Clear */}
      <div className="border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={onClear}
          disabled={!isConnected}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Clear All
        </button>
      </div>

      {/* Connection status dot */}
      <div className="mt-auto pt-2 flex items-center gap-2 text-xs text-gray-500">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
    </div>
  );
};

export default WhiteboardToolbar;