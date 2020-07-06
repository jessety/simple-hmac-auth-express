//
//  Simple HMAC Auth - Express
//  /example/basic.js
//  Created by Jesse Youngblood on 11/21/18 at 15:14
//

'use strict';

const express = require('express');
// const auth = require('simple-hmac-auth-express');
const auth = require('../');

// Example settings
const settings = {
  port: 8000,
  secretsForAPIKeys: {
    API_KEY: 'SECRET',
    API_KEY_TWO: 'SECRET_TWO',
    API_KEY_THREE: 'SECRET_THREE'
  }
};

const app = express();

// Register authentication middleware
app.use(auth({

  // Required. Execute callback with either an error, or an API key.
  secretForKey: (apiKey, callback) => {

    if (settings.secretsForAPIKeys[apiKey]) {

      callback(null, settings.secretsForAPIKeys[apiKey]);
      return;
    }

    callback();
  },

  // Required. Handle requests that have failed authentication.
  onRejected: (error, request, response, next) => {

    console.log(`Authentication failed`, error);

    response.status(401).json({ error });

    // If you want to ignore the auth failure and permit a request anyway, you certainly can.
    // next();
  },

  // Optional. Log requests that have passed authentication.
  onAccepted: (request, response) => {
    console.log(`Authentication succeeded for request with api key "${request.apiKey}" and signature: "${request.signature}"`);
  },

  // Which body-parser modules to parse the request data. All optional.
  body: {
    json: { strict: false, limit: '1mb' },
    urlencoded: { extended: true, limit: '1mb' },
    text: { type: 'application/octet-stream' }
  }
}));

// Set up routes
app.all('*', (request, response) => {
  console.log(`Routing request: ${request.method} ${request.url}`);
  console.log(`Body:`, request.body);
  response.status(200).end('200');
});

// Start the server
app.listen(settings.port, () => {

  console.log(`Listening on port ${settings.port}`);
});
