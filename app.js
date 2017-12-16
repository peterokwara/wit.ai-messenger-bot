const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
const config = require('config');

let Wit = require('node-wit').Wit;
let log = require('node-wit').log;

var app = express();