# Mendeley JavaScript SDK [![Build Status][travis-image]][travis-url]

## About the SDK

The SDK provides a convenient library for accessing the Mendeley API with client-side and server-side JavaScript.


## Installation

Installation can be done with [bower][]:

    $ bower install mendeley-javascript-sdk

Or clone the git repository:

    $ git clone https://github.com/Mendeley/mendeley-javascript-sdk

The SDK is available as a CommonJS module or a standalone bundle. To use the standalone library add a link from your HTML page.

```html
<script src="/your/path/to/mendeley-javascript-sdk/dist/standalone.js"></script>
```

To use as a CommonJS module in the browser, you'll need a module loader like [browserify][] or [webpack][].

Depending on your target browsers, you may need to polyfill Promise because the SDK relies on a global Promise variable being defined. For example, in webpack configuration include the following:

```
{
    plugins: [new webpack.ProvidePlugin({
        Promise: 'bluebird'
    })];
}
```

Some ECMAScript5 features are used so for older browsers you may need to shim these methods, for example with [es5-shim][].


## Registering a Client

To use the API you first need to register your application to get a client ID which you can use with OAuth2.

Go to [the Mendeley developers site][], sign-in with your Mendeley account details and click on "My Apps" and follow the instructions to register a new application.

## OAuth2 Flows

To begin a session you must set an authentication flow. This SDK includes code for the implict grant and auth code flows.

### Implicit Grant Flow

For purely client-side applications you can use the implicit grant flow which only requires a client id. To initiate the flow call:

```javascript
var options = { clientId: /* YOUR CLIENT ID */ };
var auth = MendeleySDK.Auth.implicitGrantFlow(options);
MendeleySDK.API.setAuthFlow(auth);
```

The options are:

- `clientId` - Your registered client ID. **Required**.
- `redirectUrl` - must match the redirect URL you used when registering the client. Defaults to the current URL.
- `accessTokenCookieName` - the name of the cookie to store the access token in. You should only change this if it clashes with another cookie you use. Defaults to `accessToken`.

The API internally will handle stale cookies by redirecting to the log-in page if any request fails with a status of 401 Unauthorized.

### Authorization Code Flow

For server applications you can use the authorization code flow. This requires server-to-server communication in order to acquire an access token. Implementing this depends on your language, framework etc. so isn't included in this SDK, but there is a nodejs example included (more info below).

The main difference is the server will do the token exchange and set the access token cookie. From the client-side point of view you start the flow like:

```javascript
var options = {
    apiAuthenticateUrl: '/login',
    refreshAccessTokenUrl: '/refresh-token'
};
var auth = MendeleySDK.Auth.authCodeFlow(options);
MendeleySDK.API.setAuthFlow(auth);
```

The options are:

- `apiAuthenticateUrl` - A URL on *your server* to redirect to when authentication fails. That URL should in turn redirect to the Mendeley OAuth endpoint passing the relevant credentials, as in this flow the client doesn't have any credentials. Required, defaults to `'/login'`.
- `refreshAccessTokenUrl` - A URL on *your server* that will attempt to refresh the current access token. Optional, defaults to false.
- `accessTokenCookieName` - the name of the cookie to store the access token in. You should only change this if it clashes with another cookie you use. Defaults to `accessToken`.

## Basic Usage

Once the OAuth flow is complete you can start grabbing data for the user. CORS is enabled by default for all clients so there's no need to do anything special to implement the cross-domain requests (unless you need to support browsers that don't have CORS).

Each API is exposed as a property of the SDK, for example `MendeleySDK.API.documents`, `MendeleySDK.API.folders`.

Methods that make API calls return [Bluebird promises][]. Each call will either resolve with some data or reject with a response object according to the response from [axios][]. Here's an example using the standalone version:

```javascript
MendeleySDK.API.documents.list().then(function(docs) {

    console.log('Success!');
    console.log(docs);

}).catch(function(response) {

    console.log('Failed!');
    console.log('Status:', response.status);

});
```

Here's an example using [requirejs][]:

```javascript
define(function(require) {
    var api = require('mendeley-javascript-sdk/lib/api');
    var auth = require('mendeley-javascript-sdk/lib/auth');
    api.setAuthFlow(auth.authCodeFlow());

    api.documents.list().then(function() {

        console.log('Success!');
        console.log(docs);

    }).catch(function(response) {

        console.log('Failed!');
        console.log('Status:', response.status);

    });
});
```

## Pagination

The API endpoint objects (e.g. ```MendeleySDK.API.documents```) store their pagination state and pagination methods on themselves. This means each call of ```list()``` method will override the state set by previous call. This wont cause any problems as long as you only use one set of params for ```list()``` method, but will result in wrong pagination results if you request a list of entities with many different param sets.

Example
```javascript
var api = require('mendeley-javascript-sdk/lib/api');

api.documents.list().then(function (result) {
    // handle the first page of "My documents"
    // api.documents.nextPage() gets set up to retrieve the next page of "My documents"
});

api.documents.list({folder_id: 'abc-123-xyz'}).then(function (result) {
    // handle the first page of "123" folder documents
    // api.documents.nextPage() gets set up to retrieve the next page of "123" folder documents
});

api.documents.nextPage().then(function (result) {
    // next page of "123" folder documents will be retrieved,
    // there's no way to retirieve the next page of "My documents" at this point
});
```

To avoid this behavior, every endpoint object allows using separate instances of itself. It also saves you the hassle of storing the instances by exposing a simple getter on the top of string-indexed map.

Example
```javascript
var api = require('mendeley-javascript-sdk/lib/api');

// a new instance of api.documents is created under the hood and returned
var myDocumentsApi = api.documents.for('my_documents');

myDocumentsApi.list().then(function (result) {
    // handle the first page of "My documents"
    // myDocumentsApi.nextPage() gets set up to retrieve the next page of "My documents"
});


// another instance of api.documents is created for folder "123"
var folder123Api = api.documents.for('folder_id_abc-123-xyz');

folder123Api.list({folder_id: 'abc-123-xyz'}).then(function (result) {
    // handle the first page of "123" folder documents
    // folder123Api.nextPage() gets set up to retrieve the next page of "123" folder documents
});

folder123Api.nextPage().then(function (result) {
    // next page of "123" folder documents will be retrieved
});

myDocumentsApi.nextPage().then(function (result) {
    // next page of "My documents" will be retrieved independently of any other folder
});
```

Each call to ```api.endpoint.for()``` with the same string parameter will return
exactly tha same instance of endpoint object.

Calling the ```api.endpoint.for()``` method with a falsy or no params will return
the original ```api.endpoint``` instance.

If you work with many folders at the same time, the convenient way of preparing
the string parameter for the ```for()``` method is serialising the params object
passed to the ```list()``` method.

Example
```javascript
var api = require('mendeley-javascript-sdk/lib/api');

var params = {
    group_id: 'zxc-876-cbm',
    folder_id: '345-jkl-ghj'
};

api.documents.for(JSON.stringify(params)).list(params).then(function (result) {
    // handle the result
});
```

## Examples

There are more examples in the `examples/` directory. To try the examples you will need [nodejs][] installed. *Note:* nodejs is not required to use this library, it is only used to serve the examples from a local URL you can use with OAuth2.

To run the examples you will need to [register your application][] to get a client ID (as described above). Use `http://localhost:8111/examples/` as the redirect URL.

The default example setup uses the implicit grant flow. To use this copy `examples/oauth-config.implicit-grant.js.dist` to `examples/oauth-config.js`, fill in your client ID, then run:

    $ npm install
    $ npm start

Go to http://localhost:8111/examples/ in your browser and you should be redirected to log-in to Mendeley. Once logged in you'll be redirected back to the examples.


### Example Using Authorization Code Flow

There is also some example nodejs code for using the authorization code flow.

To try out the authorization code flow copy `examples/oauth-config.auth-code.js.dist` to `examples/oauth-config.js`, filling in your client ID and secret.

To use this flow you will need to change your clients redirect URI to `http://localhost:8111/oauth/token-exchange` (or register a new one).


## Documentation

SDK documentation can be generated with:

    $ npm run build-jsdoc

This will be output to the `docs/` directory.

Further documentation on the API is available at http://dev.mendeley.com.

For an interactive console to the API visit https://api.mendeley.com/apidocs.


## Contributing

We would love to have your contributions, bug fixes and feature requests! You can raise an issue here, or ideally send us a pull request.

All contributions should be made by pull request (even if you have commit rights!).

In lieu of a formal styleguide, take care to maintain the existing coding style.

Please add unit tests for any new or changed functionality. Tests run twice: in PhantomJS using Karma and Jasmine, and in Node using only Jasmine, run them with:

    $ npm test

If you make changes please check coverage reports under `/coverage` to make sure you haven't left any new code untested.

Please note the aim of this SDK is to connect to the existing Mendeley API, not to add to that API. For more information about the API and to give any feedback please visit [the Mendeley developers site].


[Bluebird promises]:http://bluebirdjs.com/docs/api-reference.html
[axios]:https://github.com/mzabriskie/axios#response-schema
[es5-shim]:https://github.com/es-shims/es5-shim
[browserify]:http://browserify.org/
[webpack]:http://webpack.github.io
[the Mendeley developers site]:http://dev.mendeley.com
[register your application]:http://dev.mendeley.com
[nodejs]:http://nodejs.org
[bower]:http://bower.io

[travis-image]: http://img.shields.io/travis/Mendeley/mendeley-javascript-sdk/master.svg?style=flat
[travis-url]: https://travis-ci.org/Mendeley/mendeley-javascript-sdk
