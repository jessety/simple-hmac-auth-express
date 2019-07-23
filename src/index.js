//
//  Simple HMAC Auth - Express
//  /src/index.js
//  Created by Jesse T Youngblood on 11/24/18 at 10:52
//

'use strict';

const SimpleHMACAuth = require('simple-hmac-auth');
const bodyParser = require('body-parser');

// Extend the SimpleHMACAuth class to add an Express middleware function
class SimpleHMACAuthExpress extends SimpleHMACAuth.Server {

  /**
   * Return middleware for use with Express
   * @param   {object} options - Options
   * @returns {array}  - Array of middleware for Express
   */
  middleware(options) {

    if (typeof options !== 'object') {
      options = {};
    }

    if (typeof options.body !== 'object') {
      options.body = {};
    }

    // If 'true' is specified for either parsing strategies, use default parameters
    if (options.body.json === true) {
      options.body.json = { limit: this.settings.bodySizeLimit };
    }

    if (options.body.urlencoded === true) {
      options.body.urlencoded = { extended: true, limit: this.settings.bodySizeLimit };
    }

    if (options.body.text === true) {
      options.body.text = { type: 'text/plain', limit: this.settings.bodySizeLimit };
    }

    if (options.body.raw === true) {
      options.body.raw = { type: 'application/octet-stream', limit: this.settings.bodySizeLimit };
    }

    const middleware = [];

    // Populate the rawBody attribute by reading the input stream
    // Because this function calls next() immediately and not on 'end', it can consume the data stream in parallel with the body parsers we're going to add below
    // Of course, this also means that if it wasn't followed by middleware that waits until request emits 'end' to call next() that the rawBody would never be populated by the time the authentication middleware gets the request
    // We counter that by including yet another piece of middleware after the body-parsers that resolves immediately if it finds a parsed body, or sets an observer for the request 'end'
    // Whew.
    middleware.push((request, response, next) => {

      let data = '';

      request.on('data', chunk => {
        data += chunk.toString();
      });

      request.on('end', () => {
        request.rawBody = data;
      });

      next();
    });

    if (typeof options.body.json === 'object') {
      middleware.push(bodyParser.json(options.body.json));
    }

    if (typeof options.body.urlencoded === 'object') {
      middleware.push(bodyParser.urlencoded(options.body.urlencoded));
    }

    if (typeof options.body.text === 'object') {
      middleware.push(bodyParser.text(options.body.text));
    }

    if (typeof options.body.raw === 'object') {
      middleware.push(bodyParser.raw(options.body.raw));
    }

    // And finally, one last one that calls next() when the stream has completed.
    // If there's no parsing middleware involved, that'll be whenever on('end') is called
    // If there is, Express won't even push the request to this part until the 'body' has already been populated by one of the parsing strategies above.
    middleware.push((request, response, next) => {

      if (request.rawBody !== undefined) {
        // 'end' has already triggered
        next();
      }

      request.on('end', () => {
        next();
      });
    });

    // Finally, middleware that autheticates the request- now that we know we have the raw body to work with.
    const authMiddleware = async (request, response, next) => {

      this.authenticate(request, request.rawBody).then(() => {

        if (typeof this.onAccepted === 'function') {

          this.onAccepted(request, response);
        }

        next();

      }).catch(error => {

        if (typeof this.onRejected === 'function') {

          this.onRejected(error, request, response, next);
        }
      });
    };

    // Push the auth middleware as an arrow function so it retains a sense of self^H^H^H^H ..this
    middleware.push((...parameters) => {
      authMiddleware(...parameters);
    });

    return middleware;
  }
}

function middleware(options) {

  if (typeof options !== 'object') {
    options = {};
  }

  if (typeof options.secretForKey !== 'function') {
    console.error(`simple-hmac-auth-express middleware missing 'secretForKey' function parameter when creating middleware.`);
  }

  if (typeof options.onAccepted !== 'function') {
    // This function is optional, so this is not an issue.
  }

  if (typeof options.onRejected !== 'function') {
    console.error(`simple-hmac-auth-express middleware missing 'onRejected' function parameter when creating middleware.`);
  }

  const server = new SimpleHMACAuthExpress(options);

  if (typeof options.onAccepted === 'function') {

    server.onAccepted = options.onAccepted;
  }

  if (typeof options.onRejected === 'function') {

    server.onRejected = options.onRejected;
  }

  return server.middleware(options);
}

module.exports = middleware;
