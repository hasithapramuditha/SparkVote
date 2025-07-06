const { validationResult } = require('express-validator');
const Event = require('../models/Event.model');
const Vote = require('../models/Vote.model');

// @desc    Get all events for current user
// @route   GET /api/events
// @access  Private
const getEvents = async (req, res) => {
  try {
    const events = await Event.find({ owner: req.user.id })
      .populate('owner', 'username')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create new event
// @route   POST /api/events
// @access  Private
const createEvent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { name, description, date, startTime, closeTime, groups, projects, criteria } = req.body;

    // Generate event description if not provided
    let eventDescription = description;
    if (!description) {
      eventDescription = `Join us for ${name} - an exciting event where innovation meets collaboration!`;
    }

    const event = new Event({
      name,
      description: eventDescription,
      date,
      startTime,
      closeTime,
      owner: req.user.id,
      groups: groups || [],
      projects: projects || [],
      criteria: criteria || []
    });

    await event.save();

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Private
const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('owner', 'username');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is owner
    if (event.owner._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this event'
      });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private
const updateEvent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    let event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is owner
    if (event.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this event'
      });
    }

    const { name, description, date, startTime, closeTime, isActive, isVotingOpen } = req.body;

    event = await Event.findByIdAndUpdate(
      req.params.id,
      { name, description, date, startTime, closeTime, isActive, isVotingOpen },
      { new: true, runValidators: true }
    ).populate('owner', 'username');

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Manually open voting
// @route   POST /api/events/:id/open-voting
// @access  Private
const openVoting = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.owner.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    event.isVotingOpen = true;
    await event.save();
    res.json({ success: true, message: 'Voting manually opened', data: event });
  } catch (error) {
    console.error('Open voting error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Manually close voting
// @route   POST /api/events/:id/close-voting
// @access  Private
const closeVoting = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.owner.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    event.isVotingOpen = false;
    await event.save();
    res.json({ success: true, message: 'Voting manually closed', data: event });
  } catch (error) {
    console.error('Close voting error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add group to event
// @route   POST /api/events/:id/groups
// @access  Private
const addGroup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is owner
    if (event.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this event'
      });
    }

    const { name, weight, password } = req.body;

    event.groups.push({ name, weight, password });
    await event.save();

    res.json({
      success: true,
      message: 'Group added successfully',
      data: event.groups[event.groups.length - 1]
    });
  } catch (error) {
    console.error('Add group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Add project to event
// @route   POST /api/events/:id/projects
// @access  Private
const addProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is owner
    if (event.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this event'
      });
    }

    const { name, description, teamMembers } = req.body;

    event.projects.push({ name, description, teamMembers });
    await event.save();

    res.json({
      success: true,
      message: 'Project added successfully',
      data: event.projects[event.projects.length - 1]
    });
  } catch (error) {
    console.error('Add project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Add criteria to event
// @route   POST /api/events/:id/criteria
// @access  Private
const addCriteria = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is owner
    if (event.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this event'
      });
    }

    const { name, maxScore } = req.body;

    // Validate maxScore
    if (maxScore < 1 || maxScore > 100) {
      return res.status(400).json({
        success: false,
        message: 'Max score must be between 1 and 100'
      });
    }

    event.criteria.push({ name, maxScore });
    await event.save();

    res.json({
      success: true,
      message: 'Criteria added successfully',
      data: event.criteria[event.criteria.length - 1]
    });
  } catch (error) {
    console.error('Add criteria error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Remove criteria from event
// @route   DELETE /api/events/:id/criteria/:index
// @access  Private
const removeCriteria = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is owner
    if (event.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this event'
      });
    }

    const index = parseInt(req.params.index);
    
    if (isNaN(index) || index < 0 || index >= event.criteria.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid criteria index'
      });
    }

    const removedCriteria = event.criteria.splice(index, 1)[0];
    await event.save();

    res.json({
      success: true,
      message: 'Criteria removed successfully',
      data: removedCriteria
    });
  } catch (error) {
    console.error('Remove criteria error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get event by vote code (public)
// @route   GET /api/events/vote/:voteCode
// @access  Public
const getEventByVoteCode = async (req, res) => {
  try {
    const event = await Event.findOne({ 
      voteCode: req.params.voteCode.toUpperCase(),
      isActive: true
    }).populate('owner', 'username');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or inactive'
      });
    }

    // Don't send sensitive information
    const publicEvent = {
      id: event._id,
      name: event.name,
      description: event.description,
      date: event.date,
      startTime: event.startTime,
      closeTime: event.closeTime,
      voteCode: event.voteCode,
      groups: event.groups.map(g => ({ id: g._id, name: g.name, weight: g.weight, hasPassword: !!g.password })),
      projects: event.projects.map(p => ({ id: p._id, name: p.name, description: p.description, teamMembers: p.teamMembers })),
      criteria: event.criteria
    };

    res.json({
      success: true,
      data: publicEvent
    });
  } catch (error) {
    console.error('Get event by vote code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Validate group password
// @route   POST /api/events/vote/:voteCode/validate-password
// @access  Public
const validateGroupPassword = async (req, res) => {
  try {
    const { groupId, password } = req.body;

    if (!groupId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Group ID and password are required'
      });
    }

    const event = await Event.findOne({ 
      voteCode: req.params.voteCode.toUpperCase(),
      isActive: true
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or inactive'
      });
    }

    const group = event.groups.id(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.password) {
      return res.status(400).json({
        success: false,
        message: 'This group does not require a password'
      });
    }

    const isValid = group.password === password;

    res.json({
      success: true,
      isValid
    });
  } catch (error) {
    console.error('Validate password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    // Check if user is owner
    if (event.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event'
      });
    }
    await event.deleteOne();
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Remove group from event
// @route   DELETE /api/events/:id/groups/:groupId
// @access  Private
const removeGroup = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (event.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this event' });
    }
    console.log('Before group removal:', event.groups.map(g => g._id.toString()));
    event.groups.pull(req.params.groupId);
    console.log('After group removal:', event.groups.map(g => g._id.toString()));
    await event.save();

    // Delete all votes for this group in this event
    await Vote.deleteMany({ event: event._id, group: req.params.groupId });

    res.json({ success: true, message: 'Group removed successfully' });
  } catch (error) {
    console.error('Remove group error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Remove project from event
// @route   DELETE /api/events/:id/projects/:projectId
// @access  Private
const removeProject = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (event.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this event' });
    }
    console.log('Before project removal:', event.projects.map(p => p._id.toString()));
    event.projects.pull(req.params.projectId);
    console.log('After project removal:', event.projects.map(p => p._id.toString()));
    await event.save();
    res.json({ success: true, message: 'Project removed successfully' });
  } catch (error) {
    console.error('Remove project error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update group weight
// @route   PUT /api/events/:id/groups/:groupId/weight
// @access  Private
const updateGroupWeight = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is owner
    if (event.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this event'
      });
    }

    const { weight } = req.body;
    const group = event.groups.id(req.params.groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    group.weight = weight;
    await event.save();

    res.json({
      success: true,
      message: 'Group weight updated successfully',
      data: {
        id: group._id,
        name: group.name,
        weight: group.weight
      }
    });
  } catch (error) {
    console.error('Update group weight error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getEvents,
  createEvent,
  getEvent,
  updateEvent,
  openVoting,
  closeVoting,
  addGroup,
  addProject,
  addCriteria,
  removeCriteria,
  getEventByVoteCode,
  validateGroupPassword,
  deleteEvent,
  removeGroup,
  removeProject,
  updateGroupWeight
}; 