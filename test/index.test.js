'use strict';

// const auth = require('simple-hmac-auth-express');
const auth = require('../src');

// Include the core library, for the client implementation
const SimpleHMACAuth = require('simple-hmac-auth');

const express = require('express');

describe('express middleware', () => {

  test('throws when missing required options', () => {

    // Missing all options
    expect(() => auth()).toThrow();

    // Missing `secretForKey` function
    expect(() => auth({
      onAccepted: () => {},
      onRejected: () => {}
    })).toThrow();

    // Missing `onRejected` function
    expect(() => auth({
      secretForKey: () => {},
      onAccepted: () => {}
    })).toThrow();

    // Not missing anything
    expect(() => auth({
      secretForKey: () => {},
      onAccepted: () => {},
      onRejected: () => {}
    })).not.toThrow();
  });

  test('accepts valid requests', async () => {

    expect.assertions(3);

    const apiKey = 'TEST_API_KEY';
    const secret = 'TEST_SECRET';
    const port = 8000;

    const app = express();

    app.use(auth({

      // Required. Execute callback with either an error, or an API key.
      secretForKey: (apiKey) => {
        return secret;
      },
      onAccepted: (request) => {
        expect(request.apiKey).toBe(apiKey);
      },
      onRejected: (error, request, response, next) => {
        response.status(401).json({ error });
        server.close();
      },
      body: {
        json: true,
        urlencoded: true,
        text: true,
        raw: true
      }
    }));

    // Set up routes
    app.all('*', (request, response) => {
      server.close();
      expect(request.body.boolean).toBe(true);
      response.status(200).end('200');
    });

    // Start the server
    const server = app.listen(port);

    // Create a client and make a request

    const client = new SimpleHMACAuth.Client(apiKey, secret, {
      verbose: false,
      host: 'localhost',
      port: port,
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

    const response = await client.request(options);

    expect(response).toBe(200);
  });

  test('rejects invalid requests', async () => {

    expect.assertions(2);

    const apiKey = 'TEST_API_KEY';
    const secret = 'TEST_SECRET';
    const port = 8001;

    const app = express();

    app.use(auth({

      secretForKey: (apiKey) => {
        return secret;
      },

      onRejected: (error, request, response, next) => {
        response.status(401).json({ error });
        server.close();
        expect(error.code).toBe('SIGNATURE_INVALID');
      }
    }));

    // Set up routes
    app.all('*', (request, response) => {
      response.status(200).end('200');
      server.close();
    });

    // Start the server
    const server = app.listen(port);

    // Create a client and make a request

    const client = new SimpleHMACAuth.Client(apiKey, 'INCORRECT_SECRET', {
      verbose: false,
      host: 'localhost',
      port: port,
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

    await expect(() => client.request(options)).rejects.toThrow();
  });
});
