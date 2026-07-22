'use strict';
const express = require('express');
const router = express.Router();
const helpUsController = require('../controllers/helpUsController');

router.post('/', helpUsController.create);

module.exports = router;
