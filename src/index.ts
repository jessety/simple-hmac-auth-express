//
//  Simple HMAC Auth - Express
//  /lib/index.js
//  Created by Jesse T Youngblood on 11/24/18 at 10:52
//

import { Server } from 'simple-hmac-auth';
import { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';

// The SecretForKey function may return secrets directly, resolve a promise with the secret, or execute a callback
type SecretKeyReturnFunction = (key: string) => string | undefined;
type SecretKeyPromiseFunction = (key: string) => Promise<string>;
type SecretKeyCallbackFunction = (key: string, callback: ((error: Error) => void) | ((error: undefined, secret: string) => void)) => void;
type SecretForKeyFunction = SecretKeyReturnFunction | SecretKeyPromiseFunction | SecretKeyCallbackFunction;

type onAcceptedFunction = (request: Request, response: Response) => void;
type onRejectedFunction = (error: Error, request: Request, response: Response, next: NextFunction) => void;

interface SimpleHMACAuthExpressOptions {
  secretForKey: SecretForKeyFunction
  onAccepted?: onAcceptedFunction
  onRejected: onRejectedFunction
  bodySizeLimit: number,
  bodySizeLimitString?: string
  body?: {
    json?: true | bodyParser.OptionsJson
    urlencoded?: true | bodyParser.OptionsUrlencoded
    text?: true | bodyParser.OptionsText
    raw?: true | {
      type: string
      limit: string
    }
  }
}

// Extend the SimpleHMACAuth class to add a function which returns Express middleware
class SimpleHMACAuthExpress extends Server {

  public onAccepted?: onAcceptedFunction
  public onRejected?: onRejectedFunction

  /**
   * Return middleware for use with Express
   * @param   {object} options - Options
   * @returns {array}  - Array of middleware for Express
   */
  middleware(options: Partial<SimpleHMACAuthExpressOptions>): ((request: Request, response: Response, next: NextFunction) => void)[] {

    if (typeof options !== 'object') {
      options = {};
    }

    if (typeof options.body !== 'object') {
      options.body = {};
    }

    if (typeof options.bodySizeLimit !== 'number') {
      options.bodySizeLimit = 10;
    }

    options.bodySizeLimitString = `${options.bodySizeLimit}mb`;

    // If 'true' is specified for a parsing strategy, use sensible defaults parameters
    if (options.body.json === true) {
      options.body.json = { limit: options.bodySizeLimitString };
    }

    if (options.body.urlencoded === true) {
      options.body.urlencoded = { extended: true, limit: options.bodySizeLimitString };
    }

    if (options.body.text === true) {
      options.body.text = { type: 'text/plain', limit: options.bodySizeLimitString };
    }

    if (options.body.raw === true) {
      options.body.raw = { type: 'application/octet-stream', limit: options.bodySizeLimitString };
    }

    const middlewareArray: ((request: Request, response: Response, next: NextFunction) => void)[] = [];

    // Populate the rawBody attribute by reading the input stream
    // Because this function calls next() immediately and not on 'end', it can consume the data stream in parallel with the body parsers we're going to add below
    // Of course, this also means that if it wasn't followed by middleware that waits until request emits 'end' to call next() that the rawBody would never be populated by the time the authentication middleware gets the request
    // We counter that by including yet another piece of middleware after the body-parsers that resolves immediately if it finds a parsed body, or sets an observer for the request 'end'
    // Whew.
    middlewareArray.push((request, response, next) => {

      const chunks: Buffer[] = [];

      request.on('data', chunk => chunks.push(chunk));
      request.on('end', () => (request as any).rawBody = Buffer.concat(chunks).toString());

      next();
    });

    if (typeof options.body.json === 'object') {
      middlewareArray.push(bodyParser.json(options.body.json));
    }

    if (typeof options.body.urlencoded === 'object') {
      middlewareArray.push(bodyParser.urlencoded(options.body.urlencoded));
    }

    if (typeof options.body.text === 'object') {
      middlewareArray.push(bodyParser.text(options.body.text));
    }

    if (typeof options.body.raw === 'object') {
      middlewareArray.push(bodyParser.raw(options.body.raw));
    }

    // And finally, one last one that calls next() when the stream has completed.
    // If there's no parsing middleware involved, that'll be whenever on('end') is called
    // If there is, Express won't even push the request to this part until the 'body' has already been populated by one of the parsing strategies above.
    middlewareArray.push((request, response, next) => {

      if ((request as any).rawBody !== undefined) {
        // 'end' has already triggered
        next();
      }

      // If 'end' has not yet been triggered, call next() when it has
      request.on('end', () => {
        next();
      });
    });

    // Finally, middleware that autheticates the request- now that we know we have the raw body to work with.
    const authMiddleware = async (request: Request, response: Response, next: NextFunction) => {

      this.authenticate(request, (request as any).rawBody).then(() => {

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
    middlewareArray.push((...parameters) => {
      authMiddleware(...parameters);
    });

    return middlewareArray;
  }
}

/**
 * Return Express middleware that authenticates incoming requests
 *
 * @param {object} options
 * @param {function} options.secretForKey - function that returns the secret for a specified API key. Can be a promise, direct return, or invoke the 2nd callback parameter
 * @param {function} options.onRejected - function invoked when a request fails authentication
 * @param {function} [options.onAccepted] - optional function invoked when a request passes authentication
 * @param {object} [options.body] - body parser parameters
 * @param {object} [options.body.json] - JSON body parser parameters. Use 'true' to use defaults.
 * @param {object} [options.body.urlencoded] - Form data body parser parameters. Use 'true' to use defaults.
 * @param {object} [options.body.text] - Text body parser parameters. Use 'true' to use defaults.
 * @param {object} [options.body.raw] - Raw body parser parameters. Use 'true' to use defaults.
 * @param {number} [options.bodySizeLimit=10] - maximum body size, in mb
 * @returns {function} middleware function
 */
function middleware(options: Partial<SimpleHMACAuthExpressOptions>) {

  if (typeof options !== 'object') {
    options = {};
  }

  if (options.secretForKey === undefined || typeof options.secretForKey !== 'function') {
    throw new Error(`simple-hmac-auth-express missing 'secretForKey' parameter when creating middleware.`);
  }

  if (typeof options.onAccepted !== 'function') {
    // This function is optional, so this is not an issue.
  }

  if (typeof options.onRejected !== 'function') {
    throw new Error(`simple-hmac-auth-express missing 'onRejected' parameter when creating middleware.`);
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

export default middleware;
module.exports = middleware;
