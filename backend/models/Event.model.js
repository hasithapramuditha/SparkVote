const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  weight: { 
    type: Number, 
    default: 50,
    min: 0,
    max: 100
  },
  password: { 
    type: String,
    required: false,
    trim: true
  }
}, { _id: true });

const ProjectSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  description: { 
    type: String, 
    default: '',
    maxlength: 1000
  },
  teamMembers: [{
    type: String,
    trim: true,
    maxlength: 100
  }]
}, { _id: true });

const EventSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  description: { 
    type: String, 
    default: '',
    maxlength: 1000
  },
  date: { 
    type: String, 
    required: true 
  },
  startTime: { 
    type: String, 
    required: true 
  },
  closeTime: { 
    type: String, 
    required: true 
  },
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  voteCode: { 
    type: String, 
    required: false, 
    unique: true,
    uppercase: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Manual override for voting open/close (null = auto, true = open, false = closed)
  isVotingOpen: {
    type: Boolean,
    default: null
  },
  groups: [GroupSchema],
  projects: [ProjectSchema],
  criteria: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    maxScore: {
      type: Number,
      required: true,
      min: 1,
      max: 100
    }
  }]
}, { 
  timestamps: true 
});

// Virtual: votingStatus (open, closed, upcoming)
EventSchema.virtual('votingStatus').get(function() {
  const now = new Date();
  const start = new Date(`${this.date}T${this.startTime}`);
  const end = new Date(`${this.date}T${this.closeTime}`);
  if (this.isVotingOpen === true) return 'open';
  if (this.isVotingOpen === false) return 'closed';
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'open';
  return 'closed';
});

// Generate unique vote code
EventSchema.pre('save', function(next) {
  if (!this.voteCode) {
    this.voteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

// Set default criteria if not provided
EventSchema.pre('save', function(next) {
  if (!this.criteria || this.criteria.length === 0) {
    this.criteria = [
      { name: 'Creativity', maxScore: 10 },
      { name: 'Execution', maxScore: 10 },
      { name: 'Impact', maxScore: 10 }
    ];
  }
  next();
});

module.exports = mongoose.model('Event', EventSchema); 