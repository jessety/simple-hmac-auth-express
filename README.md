# simple-hmac-auth-express
Express middleware for creating APIs that implement [simple-hmac-auth](https://github.com/jessety/simple-hmac-auth).

## Usage

Two parameters are required. `secretForKey` must be a function that returns a promise with the secret for a specified API key, and `onRejected` must be a function that handles requests that have failed authentication.

```javascript
const auth = require('simple-hmac-auth-express')

app.use(auth({

  // Return a promise that resolves with the secret for the specified API key
  secretForKey: async (apiKey) => { 
    return 'SECRET';
  },

  // Handle requests that have failed authentication
  onRejected: (error, request, response, next) => {
    console.log(`"${request.apiKey}" failed authentication: ${request.method} ${request.url}`);
    response.status(401).json({
      error: {
        message: error.message
      }
    });
  },
  
  // Optional
  onAccepted: (request, response) => {
    console.log(`"${request.apiKey}" authenticated request to ${request.method} ${request.url} with signature "${request.signature}"`);
  }
}));
```

Because the unparsed body of the request must be loaded and hashed to authenticate, the included middleware also handles parsing the request body. If you would like to parse the contents of the request body, use the same parameters as [body-parser](https://github.com/expressjs/body-parser) in the `body` node:

```javascript
const auth = require('simple-hmac-auth-express')

app.use(auth({

  // Required
  secretForKey: (apiKey, callback) => callback(null, 'secret'),
  onRejected: (error, request, response, next) => response.status(401).end('401'),
  onAccepted: (request, response) => console.log(`authenticated ${request.method} ${request.url}`)

  // Body-parser options. All optional.
  body: {
    json: { strict: false, limit: '1mb' }
    urlencoded: { extended: true, limit: '5mb' },
    text: { type: 'application/octet-stream' }
  }
}));
```

## License

MIT © Jesse T Youngblood
