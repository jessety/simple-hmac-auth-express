//
//  Simple HMAC Auth - Express
//  /examples/roundtrip/index.js
//  Created by Jesse Youngblood on 11/23/18 at 19:31
//

'use strict';

const express = require('express');
// const auth = require('simple-hmac-auth-express');
const auth = require('../../');

// Include the core library, for the client implementation
const SimpleHMACAuth = require('simple-hmac-auth');

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

    if (settings.secretsForAPIKeys[apiKey] !== undefined) {

      callback(null, settings.secretsForAPIKeys[apiKey]);
      return;
    }

    callback();
  },

  // Required. Handle requests that have failed authentication.
  onRejected: (error, request, response, next) => {

    console.log(`Authentication failed`, error);

    response.status(401).json({
      error: {
        message: error.message
      }
    });

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
const server = app.listen(settings.port, () => {

  console.log(`Listening on port ${settings.port}`);

  // Create a client and make a request

  const client = new SimpleHMACAuth.Client('API_KEY', 'SECRET', {
    verbose: true,
    host: 'localhost',
    port: settings.port,
    ssl: false
  });

  const options = {
    method: 'POST',
    path: '/items/',
    query: {
      string: 'string',
      boolean: true,
      number: 42,
      object: { populated: true },
      array: [1, 2, 3]
    },
    data: {
      string: 'string',
      boolean: true,
      number: 42,
      object: { populated: true },
      array: [1, 2, 3]
    }
  };

  console.log(`Client sending request..`);

  client.request(options).then(response => {

    console.error(`Client received response from server:`, response);
    server.close();

  }).catch(error => {

    console.error(`Client received error from server:`, error);
    server.close();
  });
});
