const { validationResult } = require('express-validator');
const Event = require('../models/Event.model');
const Vote = require('../models/Vote.model');
const { v4: uuidv4 } = require('uuid');

// @desc    Submit votes for an event
// @route   POST /api/vote/:eventId
// @access  Public
const submitVote = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { eventId } = req.params;
    const { votes, voterName, groupPassword } = req.body;

    // Get event
    const event = await Event.findById(eventId);
    if (!event || !event.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or inactive'
      });
    }

    // Enforce voting window and manual override
    const now = new Date();
    const start = new Date(`${event.date}T${event.startTime}`);
    const end = new Date(`${event.date}T${event.closeTime}`);
    let votingOpen = false;
    if (event.isVotingOpen === true) votingOpen = true;
    else if (event.isVotingOpen === false) votingOpen = false;
    else votingOpen = now >= start && now <= end;
    if (!votingOpen) {
      return res.status(403).json({
        success: false,
        message: 'Voting is not open for this event.'
      });
    }

    // Generate unique session ID
    const voterSessionId = uuidv4();

    // Validate votes structure
    if (!Array.isArray(votes) || votes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Votes array is required and cannot be empty'
      });
    }

    const savedVotes = [];

    // Process each vote
    for (const voteData of votes) {
      const { projectId, groupId, scores } = voteData;

      // Validate project exists
      const project = event.projects.id(projectId);
      if (!project) {
        return res.status(400).json({
          success: false,
          message: `Project with ID ${projectId} not found`
        });
      }

      // Validate group exists
      const group = event.groups.id(groupId);
      if (!group) {
        return res.status(400).json({
          success: false,
          message: `Group with ID ${groupId} not found`
        });
      }

      // Check group password if required
      if (group.password && group.password !== groupPassword) {
        return res.status(403).json({
          success: false,
          message: 'Invalid group password'
        });
      }

      // Validate scores
      if (!scores || typeof scores !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Scores object is required'
        });
      }

      // Validate each score against its criterion's maxScore
      for (const [criterionName, score] of Object.entries(scores)) {
        const criterion = event.criteria.find(c => c.name === criterionName);
        if (!criterion) {
          return res.status(400).json({
            success: false,
            message: `Criterion '${criterionName}' not found`
          });
        }
        
        if (score < 1 || score > criterion.maxScore) {
          return res.status(400).json({
            success: false,
            message: `Score for '${criterionName}' must be between 1 and ${criterion.maxScore}`
          });
        }
      }

      // Check if vote already exists for this session and project
      const existingVote = await Vote.findOne({
        event: eventId,
        voterSessionId,
        project: projectId
      });

      if (existingVote) {
        return res.status(400).json({
          success: false,
          message: `Vote already submitted for project ${project.name}`
        });
      }

      // Create vote
      const vote = new Vote({
        event: eventId,
        project: projectId,
        group: groupId,
        scores: new Map(Object.entries(scores)),
        voterSessionId,
        voterName
      });

      await vote.save();
      savedVotes.push(vote);
    }

    res.status(201).json({
      success: true,
      message: 'Votes submitted successfully',
      data: {
        sessionId: voterSessionId,
        votesCount: savedVotes.length
      }
    });
  } catch (error) {
    console.error('Submit vote error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get voting results for an event
// @route   GET /api/results/:eventId
// @access  Private (event owner only)
const getResults = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Get event
    const event = await Event.findById(eventId);
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
        message: 'Not authorized to view results'
      });
    }

    // Get all votes for this event
    const votes = await Vote.find({ event: eventId });

    // Calculate results
    const results = calculateResults(event, votes);

    res.json({
      success: true,
      data: {
        event: {
          id: event._id,
          name: event.name,
          description: event.description,
          date: event.date,
          startTime: event.startTime,
          closeTime: event.closeTime
        },
        results,
        totalVotes: votes.length,
        totalVoters: new Set(votes.map(v => v.voterSessionId)).size
      }
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get public results (without detailed analysis)
// @route   GET /api/results/public/:eventId
// @access  Public
const getPublicResults = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Get event
    const event = await Event.findById(eventId);
    if (!event || !event.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or inactive'
      });
    }

    // Get all votes for this event
    const votes = await Vote.find({ event: eventId });

    // Accept group weights as a query parameter: ?weights={"groupId1":weight1,"groupId2":weight2,...}
    let groupWeights = null;
    if (req.query.weights) {
      try {
        groupWeights = JSON.parse(req.query.weights);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid weights parameter. Must be a valid JSON object.'
        });
      }
    }

    // Calculate results
    const results = calculateResults(event, votes, groupWeights);

    res.json({
      success: true,
      data: {
        event: {
          id: event._id,
          name: event.name,
          description: event.description,
          date: event.date
        },
        results,
        totalVotes: votes.length,
        totalVoters: new Set(votes.map(v => v.voterSessionId)).size
      }
    });
  } catch (error) {
    console.error('Get public results error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Helper function to calculate results
// Accepts optional groupWeights: { [groupId]: weight }
const calculateResults = (event, votes, groupWeights = null) => {
  const projectResults = {};
  const groupResults = {};
  const groupIdToName = {};
  // Track unique voters per group
  const groupVoters = {};

  // Initialize project results
  event.projects.forEach(project => {
    projectResults[project._id.toString()] = {
      id: project._id,
      name: project.name,
      description: project.description,
      teamMembers: project.teamMembers,
      totalScore: 0,
      averageScore: 0,
      voteCount: 0,
      criteriaScores: {},
      groupAverages: {}, // { [groupName]: avgScore }
      finalScore: 0, // weighted sum
      rank: 0 // will be set later
    };
  });

  // Initialize group results
  event.groups.forEach(group => {
    groupResults[group._id.toString()] = {
      id: group._id,
      name: group.name,
      weight: groupWeights && groupWeights[group._id.toString()] !== undefined
        ? groupWeights[group._id.toString()]
        : group.weight,
      totalScore: 0,
      voteCount: 0,
      voterCount: 0 // will be set later
    };
    groupIdToName[group._id.toString()] = group.name;
    groupVoters[group._id.toString()] = new Set();
  });

  // For each project, for each group, collect scores
  // Structure: { [projectId]: { [groupId]: { total: number, count: number } } }
  const projectGroupScores = {};
  Object.keys(projectResults).forEach(pid => {
    projectGroupScores[pid] = {};
    Object.keys(groupResults).forEach(gid => {
      projectGroupScores[pid][gid] = { total: 0, count: 0 };
    });
  });

  // Calculate scores
  votes.forEach(vote => {
    const projectId = vote.project.toString();
    const groupId = vote.group.toString();
    const voterSessionId = vote.voterSessionId;

    if (projectResults[projectId] && groupResults[groupId]) {
      // Add to project results
      projectResults[projectId].voteCount++;
      let projectTotal = 0;
      vote.scores.forEach((score, criterion) => {
        if (!projectResults[projectId].criteriaScores[criterion]) {
          projectResults[projectId].criteriaScores[criterion] = { total: 0, count: 0 };
        }
        projectResults[projectId].criteriaScores[criterion].total += score;
        projectResults[projectId].criteriaScores[criterion].count++;
        projectTotal += score;
      });
      projectResults[projectId].totalScore += projectTotal;

      // Add to group results
      groupResults[groupId].voteCount++;
      groupResults[groupId].totalScore += projectTotal;
      // Track unique voters
      groupVoters[groupId].add(voterSessionId);

      // Add to project-group scores
      projectGroupScores[projectId][groupId].total += projectTotal;
      projectGroupScores[projectId][groupId].count++;
    }
  });

  // Set voterCount for each group
  Object.keys(groupResults).forEach(groupId => {
    groupResults[groupId].voterCount = groupVoters[groupId].size;
  });

  // Calculate averages and group averages
  Object.keys(projectResults).forEach(projectId => {
    const project = projectResults[projectId];
    if (project.voteCount > 0) {
      project.averageScore = project.totalScore / project.voteCount;
      // Calculate average for each criterion
      Object.keys(project.criteriaScores).forEach(criterion => {
        const criterionData = project.criteriaScores[criterion];
        criterionData.average = criterionData.total / criterionData.count;
      });
    }
    // Calculate group averages for this project
    Object.keys(groupResults).forEach(groupId => {
      const groupScore = projectGroupScores[projectId][groupId];
      const avg = groupScore.count > 0 ? groupScore.total / groupScore.count : 0;
      const groupName = groupIdToName[groupId];
      project.groupAverages[groupName] = avg;
    });
  });

  // Calculate final score for each project (weighted sum of group averages)
  Object.keys(projectResults).forEach(projectId => {
    const project = projectResults[projectId];
    let weightedSum = 0;
    let totalWeight = 0;
    Object.keys(groupResults).forEach(groupId => {
      const group = groupResults[groupId];
      const groupName = group.name;
      const avg = project.groupAverages[groupName];
      const weight = group.weight;
      weightedSum += avg * weight;
      totalWeight += weight;
    });
    project.finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  });

  // Sort projects by final score (descending)
  const sortedProjects = Object.values(projectResults)
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((project, index) => ({
      ...project,
      rank: index + 1
    }));

  // Sort groups by total score (descending)
  const sortedGroups = Object.values(groupResults)
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((group, index) => ({
      ...group,
      rank: index + 1
    }));

  return {
    projects: sortedProjects,
    groups: sortedGroups
  };
};

module.exports = {
  submitVote,
  getResults,
  getPublicResults
}; 