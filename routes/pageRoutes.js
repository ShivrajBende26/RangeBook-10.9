'use strict';

const express = require('express');
const pageController = require('../controllers/pageController');

const router = express.Router();

router.get('/', pageController.renderHome);
router.get('/:page', pageController.renderPage);

module.exports = router;
