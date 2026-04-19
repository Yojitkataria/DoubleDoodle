import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';
import * as fabric from 'fabric';
import WhiteboardCanvas from '../components/WhiteboardCanvas';
import WhiteboardToolbar from '../components/WhiteboardToolbar';
import WhiteboardChat from '../components/WhiteboardChat';
import Button from '../components/Button';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_BASE_URL.replace('/api', '');

const WhiteboardPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);

  // Critical: keep BOTH state + refs so Fabric event handlers always see latest values.
  const [activeTool, setActiveToolState] = useState('pen');
  const activeToolRef = useRef('pen');
  const setActiveTool = useCallback((t) => {
    activeToolRef.current = t;
    setActiveToolState(t);
    if (t === 'pen') {
      // Keep UI consistent with the dedicated pen mode (2px).
      brushSizeRef.current = 2;
      setBrushSizeState(2);
    }
  }, []);

  const [brushColor, setBrushColorState] = useState('#000000');
  const brushColorRef = useRef('#000000');
  const setBrushColor = (c) => {
    brushColorRef.current = c;
    setBrushColorState(c);
  };

  const [brushSize, setBrushSizeState] = useState(5);
  const brushSizeRef = useRef(5);
  const setBrushSize = (s) => {
    brushSizeRef.current = s;
    setBrushSizeState(s);
  };

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    if (!token || !roomId) return;

    const newSocket = io(SOCKET_URL, {
      auth: {
        token: token
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      
      // Join the whiteboard room
      newSocket.emit('join-whiteboard', { roomId });

      // Request persisted board state for mid-session joiners.
      newSocket.emit('request-board-state', { roomId });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket Connection Error:', err.message);
      setError(`Failed to connect to the whiteboard server: ${err.message}. Please try refreshing the page.`);
      setIsConnected(false);
    });

    newSocket.on('room-participants', (participants) => {
      setParticipants(participants);
    });

    newSocket.on('user-joined', (userData) => {
      console.log(`${userData.userName} joined the room`);
    });

    newSocket.on('user-left', (userData) => {
      console.log(`${userData.userName} left the room`);
    });

    newSocket.on('error', (error) => {
      setError(error.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token, roomId]);

  // Fetch room data
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch room data');
        }

        const data = await response.json();
        setRoom(data.data);
      } catch (error) {
        setError(error.message);
      }
    };

    if (token && roomId) {
      fetchRoom();
    }
  }, [token, roomId]);

  const handleClear = () => {
    if (!socket || !socket.connected) {
      console.error('Socket not connected');
      return;
    }
    
    const confirmed = window.confirm('Are you sure you want to clear the entire whiteboard? This action cannot be undone.');
    if (confirmed && canvasRef.current && canvasRef.current.clear) {
      canvasRef.current.clear();
    }
  };

  const handleUndo = useCallback(() => {
    if (!socket || !socket.connected) {
      console.error('Socket not connected');
      return;
    }
    if (canvasRef.current && canvasRef.current.undo) {
      canvasRef.current.undo();
    }
  }, [socket]);

  const handleRedo = useCallback(() => {
    if (!socket || !socket.connected) {
      console.error('Socket not connected');
      return;
    }
    if (canvasRef.current && canvasRef.current.redo) {
      canvasRef.current.redo();
    }
  }, [socket]);

  const handleDownload = () => canvasRef.current?.download?.();
  const handleStampShape = useCallback((shapeType) => {
    let obj;
    const stroke = '#000000';
    const sw = 2;

    if (shapeType === 'array') {
      const n = parseInt(window.prompt('How many cells?', '5') || '5', 10);
      const size = 50;
      const rects = [];
      for (let i = 0; i < n; i++) {
        rects.push(
          new fabric.Rect({
            left: i * size,
            top: 0,
            width: size,
            height: size,
            fill: '#fff',
            stroke,
            strokeWidth: sw,
          }),
        );
      }
      obj = new fabric.Group(rects, { selectable: true, id: `stamp-${Date.now()}` });
    } else if (shapeType === 'node') {
      obj = new fabric.Circle({
        radius: 35,
        fill: '#fff',
        stroke,
        strokeWidth: sw,
        selectable: true,
        id: `stamp-${Date.now()}`,
      });
    } else if (shapeType === 'arrow') {
      const line = new fabric.Line([0, 0, 100, 0], { stroke, strokeWidth: sw });
      const head = new fabric.Triangle({
        width: 14,
        height: 14,
        fill: stroke,
        left: 93,
        top: -7,
        angle: 90,
      });
      obj = new fabric.Group([line, head], { selectable: true, id: `stamp-${Date.now()}` });
    } else if (shapeType === 'stack') {
      const items = [];
      const w = 60,
        h = 40,
        n = 4;
      for (let i = 0; i < n; i++) {
        items.push(
          new fabric.Rect({
            left: 0,
            top: i * h,
            width: w,
            height: h,
            fill: '#fff',
            stroke,
            strokeWidth: sw,
          }),
        );
      }
      const label = new fabric.Text('TOP', { left: 10, top: -22, fontSize: 12, fill: '#555' });
      obj = new fabric.Group([label, ...items], { selectable: true, id: `stamp-${Date.now()}` });
    } else if (shapeType === 'queue') {
      const items = [];
      const size = 50,
        n = 4;
      for (let i = 0; i < n; i++) {
        items.push(
          new fabric.Rect({
            left: i * size,
            top: 0,
            width: size,
            height: size,
            fill: '#fff',
            stroke,
            strokeWidth: sw,
          }),
        );
      }
      const front = new fabric.Text('FRONT', { left: 0, top: size + 4, fontSize: 11, fill: '#555' });
      const rear = new fabric.Text('REAR', {
        left: (n - 1) * size + 6,
        top: size + 4,
        fontSize: 11,
        fill: '#555',
      });
      obj = new fabric.Group([...items, front, rear], { selectable: true, id: `stamp-${Date.now()}` });
    } else if (shapeType === 'table') {
      const rows = parseInt(window.prompt('Rows?', '3') || '3', 10);
      const cols = parseInt(window.prompt('Cols?', '4') || '4', 10);
      const cw = 60,
        ch = 40;
      const cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          cells.push(
            new fabric.Rect({
              left: c * cw,
              top: r * ch,
              width: cw,
              height: ch,
              fill: '#fff',
              stroke,
              strokeWidth: sw,
            }),
          );
        }
      }
      obj = new fabric.Group(cells, { selectable: true, id: `stamp-${Date.now()}` });
    }

    if (obj) canvasRef.current?.addFabricObject?.(obj);
  }, []);

  // Keyboard shortcuts (skip when typing in inputs)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e) return;

      const tag = e.target?.tagName;
      if (tag === 'INPUT') return;
      if (e.target?.isContentEditable) return;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = String(e.key || '').toLowerCase();
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (ctrlOrCmd && key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (ctrlOrCmd && key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (key === 'p') {
        setActiveTool('pen');
        return;
      }
      if (key === 'd') {
        setActiveTool('draw');
        return;
      }
      if (key === 'e') {
        setActiveTool('eraser');
        return;
      }
      if (key === 's') {
        setActiveTool('select');
        return;
      }

      if (key === '1') {
        handleStampShape('array');
        return;
      }
      if (key === '2') {
        handleStampShape('node');
        return;
      }
      if (key === '3') {
        handleStampShape('arrow');
        return;
      }
      if (key === '4') {
        handleStampShape('stack');
        return;
      }
      if (key === '5') {
        handleStampShape('queue');
        return;
      }
      if (key === '6') {
        handleStampShape('table');
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleRedo, handleStampShape, handleUndo, setActiveTool]);

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('leave-room', { roomId });
    }
    navigate('/dashboard');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 z-10 flex-shrink-0">
        <div className="max-w-full mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-gray-900">
                {room?.name || 'Whiteboard Session'}
              </h1>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
              <Button variant="outline" onClick={handleLeaveRoom}>
                Leave Room
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex h-screen overflow-hidden">
        {/* Left panel */}
        <div className="w-52 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <WhiteboardToolbar
            brushColor={brushColor}
            setBrushColor={setBrushColor}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            onClear={handleClear}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            isConnected={isConnected}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            onDownload={handleDownload}
            onStampShape={handleStampShape}
          />
        </div>

        {/* Center */}
        <div className="flex-1 overflow-hidden p-6 bg-gray-50">
          <div className="w-full h-full bg-white rounded-lg shadow-md overflow-hidden">
            <WhiteboardCanvas
              ref={canvasRef}
              roomId={roomId}
              socket={socket}
              activeToolRef={activeToolRef}
              brushColorRef={brushColorRef}
              brushSizeRef={brushSizeRef}
              setCanUndo={setCanUndo}
              setCanRedo={setCanRedo}
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-56 bg-white border-l border-gray-200 flex flex-col h-full flex-shrink-0">
          <WhiteboardChat socket={socket} roomId={roomId} participants={participants} />
        </div>
      </main>

      {/* Shortcut hint bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="px-4 py-2 rounded-full bg-gray-100/90 text-gray-600 text-xs shadow-sm border border-gray-200 backdrop-blur">
          P=pen&nbsp;&nbsp; D=draw&nbsp;&nbsp; E=erase&nbsp;&nbsp; S=select&nbsp;&nbsp; 1-6=shapes
        </div>
      </div>
    </div>
  );
};

export default WhiteboardPage; 