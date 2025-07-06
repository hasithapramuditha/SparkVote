const express = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth.middleware');
const {
  getEvents,
  createEvent,
  getEvent,
  updateEvent,
  addGroup,
  addProject,
  addCriteria,
  removeCriteria,
  getEventByVoteCode,
  validateGroupPassword,
  deleteEvent,
  removeGroup,
  removeProject,
  openVoting,
  closeVoting,
  updateGroupWeight
} = require('../controllers/eventController');

const router = express.Router();

// Validation rules
const eventValidation = [
  body('name')
    .isLength({ min: 1, max: 200 })
    .withMessage('Event name must be between 1 and 200 characters'),
  body('date')
    .notEmpty()
    .withMessage('Date is required'),
  body('startTime')
    .notEmpty()
    .withMessage('Start time is required'),
  body('closeTime')
    .notEmpty()
    .withMessage('Close time is required')
];

const groupValidation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Group name must be between 1 and 100 characters'),
  body('weight')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Weight must be between 0 and 100')
];

const projectValidation = [
  body('name')
    .isLength({ min: 1, max: 200 })
    .withMessage('Project name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('teamMembers')
    .optional()
    .isArray()
    .withMessage('Team members must be an array')
];

const projectNameValidation = [
  body('projectName')
    .isLength({ min: 1, max: 200 })
    .withMessage('Project name must be between 1 and 200 characters')
];

const criteriaValidation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Criteria name must be between 1 and 100 characters'),
  body('maxScore')
    .isInt({ min: 1, max: 100 })
    .withMessage('Max score must be between 1 and 100')
];

const passwordValidation = [
  body('groupId')
    .notEmpty()
    .withMessage('Group ID is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Public routes (no auth required)
router.get('/vote/:voteCode', getEventByVoteCode);
router.post('/vote/:voteCode/validate-password', passwordValidation, validateGroupPassword);

// Protected routes (require authentication)
router.use(auth);

// Event management routes
router.get('/', getEvents);
router.post('/', eventValidation, createEvent);
router.get('/:id', getEvent);
router.put('/:id', eventValidation, updateEvent);
router.delete('/:id', deleteEvent);

// Group and project management
router.post('/:id/groups', groupValidation, addGroup);
router.post('/:id/projects', projectValidation, addProject);
router.delete('/:id/groups/:groupId', removeGroup);
router.delete('/:id/projects/:projectId', removeProject);
router.put('/:id/groups/:groupId/weight', [body('weight').isInt({ min: 0, max: 100 }).withMessage('Weight must be between 0 and 100')], updateGroupWeight);

// Criteria management
router.post('/:id/criteria', criteriaValidation, addCriteria);
router.delete('/:id/criteria/:index', removeCriteria);

// Manual voting open/close
router.post('/:id/open-voting', openVoting);
router.post('/:id/close-voting', closeVoting);

module.exports = router; 