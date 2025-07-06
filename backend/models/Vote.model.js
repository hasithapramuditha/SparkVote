const mongoose = require('mongoose');

const VoteSchema = new mongoose.Schema({
  event: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event', 
    required: true 
  },
  project: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  group: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  scores: {
    type: Map,
    of: Number,
    required: true,
    validate: {
      validator: function(scores) {
        // Validate that scores are within valid range (1-100, actual max will be validated per criterion)
        for (let [key, value] of scores) {
          if (value < 1 || value > 100) {
            return false;
          }
        }
        return true;
      },
      message: 'Scores must be between 1 and 100'
    }
  },
  // To identify a unique voter session without requiring user login
  voterSessionId: { 
    type: String, 
    required: true 
  },
  // Optional voter information
  voterName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  // Timestamp when vote was submitted
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true 
});

// Compound index to prevent duplicate votes from same session
VoteSchema.index({ 
  event: 1, 
  voterSessionId: 1, 
  project: 1 
}, { 
  unique: true 
});

// Method to get total score
VoteSchema.methods.getTotalScore = function() {
  let total = 0;
  for (let [key, value] of this.scores) {
    total += value;
  }
  return total;
};

// Method to get average score
VoteSchema.methods.getAverageScore = function() {
  const total = this.getTotalScore();
  return total / this.scores.size;
};

module.exports = mongoose.model('Vote', VoteSchema); 