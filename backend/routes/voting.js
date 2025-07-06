const express = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth.middleware');
const { submitVote, getResults, getPublicResults } = require('../controllers/votingController');

const router = express.Router();

// Validation rules
const voteValidation = [
  body('votes')
    .isArray({ min: 1 })
    .withMessage('Votes must be a non-empty array'),
  body('votes.*.projectId')
    .notEmpty()
    .withMessage('Project ID is required for each vote'),
  body('votes.*.groupId')
    .notEmpty()
    .withMessage('Group ID is required for each vote'),
  body('votes.*.scores')
    .isObject()
    .withMessage('Scores must be an object for each vote'),
  body('voterName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Voter name must be less than 100 characters'),
  body('groupPassword')
    .optional()
    .isString()
    .withMessage('Group password must be a string')
];

// Public routes (no auth required)
router.post('/:eventId', voteValidation, submitVote);
router.get('/public/:eventId', getPublicResults);

// Protected routes (require authentication)
router.get('/:eventId', auth, getResults);

module.exports = router; 