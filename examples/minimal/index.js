//
//  Simple HMAC Auth - Express
//  /examples/minimal/index.js
//  Created by Jesse Youngblood on 7/22/19 at 23:31
//

'use strict';

const express = require('express');
// const auth = require('simple-hmac-auth-express');
const auth = require('../../index.js');

const app = express();

app.use(auth({

  // Return a promise that resolves with the secret for the specified API key
  secretForKey: async (apiKey) => 'SECRET',

  // Handle requests that have failed authentication
  onRejected: (error, request, response, next) => {
    response.status(401).json({
      error: {
        message: error.message
      }
    });
  },

  // body-parser options, if you need to parse the body of incoming requests
  body: {
    json: { strict: false, limit: '5mb' }
  }
}));

// Set up routes
app.all('*', (request, response) => {
  console.log(`Routing request: ${request.method} ${request.url}`);
  console.log(`Body:`, request.body);
  response.status(200).end('200');
});

// Start the server
app.listen(8000, () => {

  console.log(`Listening on port ${8000}`);
});
