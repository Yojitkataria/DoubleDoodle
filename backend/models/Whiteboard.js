const mongoose = require('mongoose');

const drawingActionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['draw', 'erase', 'clear', 'undo', 'redo']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  data: {
    x: Number,
    y: Number,
    endX: Number,
    endY: Number,
    color: String,
    brushSize: Number,
    points: [{
      x: Number,
      y: Number
    }]
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const whiteboardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'editor'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  drawingActions: [drawingActionSchema],
  // Persist Fabric.js object JSON for board replay (server stores ADD actions).
  objects: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  settings: {
    canvasWidth: {
      type: Number,
      default: 1920
    },
    canvasHeight: {
      type: Number,
      default: 1080
    },
    backgroundColor: {
      type: String,
      default: '#ffffff'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
whiteboardSchema.index({ createdBy: 1, isActive: 1 });
whiteboardSchema.index({ 'collaborators.user': 1, isActive: 1 });

// Update lastModified on save
whiteboardSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

module.exports = mongoose.model('Whiteboard', whiteboardSchema); 