'use strict';

var Request = require('./request');
var assign = require('object-assign');
var Bluebird = require('bluebird');

var baseUrl = 'https://api.mendeley.com';
var authFlow = false;

/**
 * Utilities
 *
 * @namespace
 * @name utilities
 */
module.exports = {
    setAuthFlow: setAuthFlow,
    setBaseUrl: setBaseUrl,

    requestFun: requestFun,
    requestPageFun: requestPageFun,
    requestWithDataFun: requestWithDataFun,
    requestWithFileFun: requestWithFileFun,

    resetPaginationLinks: resetPaginationLinks
};

function setAuthFlow(auth) {
    authFlow = auth;
}

function setBaseUrl(url) {
    baseUrl = url;
}

function dataFilter(response) {
    return response.data;
}

/**
 * A general purpose request functions
 *
 * @private
 * @param {function} [responseFilter] - Optional filter to control which part of the response the promise resolves with
 * @param {string} method
 * @param {string} uriTemplate
 * @param {array} uriVars
 * @param {array} headers
 * @returns {function}
 */
function requestFun(responseFilter, method, uriTemplate, uriVars, headers) {
    if (typeof responseFilter !== 'function') {
        return requestFun(dataFilter, responseFilter, method, uriTemplate, uriVars);
    }

    uriVars = uriVars || [];

    return function() {
        var args = Array.prototype.slice.call(arguments, 0);
        var url = getUrl(uriTemplate, uriVars, args);
        var params = args[uriVars.length];

        var request = {
            method: method,
            responseType: 'json',
            url: url,
            headers: getRequestHeaders(headers),
            params: params
        };

        var settings = {
            authFlow: authFlow
        };

        var promise = Request.create(request, settings).send();
        
        return promise.then(function(response) {
            setPaginationLinks.call(this, response.headers);

            return response;
        }.bind(this)).then(responseFilter);
    };
}

/**
 * Get a function for getting a pagination rel
 *
 * @private
 * @param {function} [responseFilter] - Optional filter to control which part of the response the promise resolves with
 * @param {string} rel - One of "next", "prev" or "last"
 * @param {object} headers
 * @returns {function}
 */
function requestPageFun(responseFilter, rel, headers) {
    if (typeof responseFilter !== 'function') {
        return requestPageFun(dataFilter, responseFilter, rel);
    }

    return function() {
        if (!this.paginationLinks[rel]) {
            return Bluebird.reject(new Error('No pagination links'));
        }

        var request = {
            method: 'GET',
            responseType: 'json',
            url: this.paginationLinks[rel],
            headers: getRequestHeaders(headers || {})
        };

        var settings = {
            authFlow: authFlow,
            maxRetries: 1
        };

        var promise = Request.create(request, settings).send();
        
        return promise.then(function(response) {
            setPaginationLinks.call(this, response.headers);
            return response;
        }.bind(this)).then(responseFilter);
    };
}

/**
 * Get a request function that sends data i.e. for POST, PUT, PATCH
 * The data will be taken from the calling argument after any uriVar arguments.
 *
 * @private
 * @param {function} [responseFilter] - Optional filter to control which part of the response the promise resolves with
 * @param {string} method - The HTTP method
 * @param {string} uriTemplate - A URI template e.g. /documents/{id}
 * @param {array} uriVars - The variables for the URI template in the order
 * they will be passed to the function e.g. ['id']
 * @param {object} headers - Any additional headers to send
 *  e.g. { 'Content-Type': 'application/vnd.mendeley-documents+1.json'}
 * @param {bool} followLocation - follow the returned location header? Default is false
 * @returns {function}
 */
function requestWithDataFun(responseFilter, method, uriTemplate, uriVars, headers, followLocation) {
    if (typeof responseFilter !== 'function') {
        return requestWithDataFun(dataFilter, responseFilter, method, uriTemplate, uriVars, headers);
    }

    uriVars = uriVars || [];

    return function() {
        var args = Array.prototype.slice.call(arguments, 0);
        var url = getUrl(uriTemplate, uriVars, args);
        var data = args[uriVars.length];
        var request = {
            method: method,
            url: url,
            headers: getRequestHeaders(headers, data),
            data: JSON.stringify(data)
        };

        var settings = {
            authFlow: authFlow,
            followLocation: followLocation
        };

        var promise = Request.create(request, settings).send();

        return promise.then(responseFilter);
    };
}

/**
 * Get a request function that sends a file
 *
 * @private
 * @param {function} [responseFilter] - Optional filter to control which part of the response the promise resolves with
 * @param {string} method
 * @param {string} uriTemplate
 * @param {string} linkType - Type of the element to link this file to
 * @param {object} headers - Any additional headers to send
 * @returns {function}
 */
function requestWithFileFun(responseFilter, method, uriTemplate, linkType, headers) {
    if (typeof responseFilter !== 'function') {
        return requestWithFileFun(dataFilter, responseFilter, method, uriTemplate, linkType);
    }

    return function() {
        var args = Array.prototype.slice.call(arguments, 0);
        var url = getUrl(uriTemplate, [], args);
        var file = args[0];
        var linkId = args[1];
        var requestHeaders = assign({}, getRequestHeaders(uploadHeaders(file, linkId, linkType), method), headers);
        var progressHandler;

        if (typeof args[args.length - 1] === 'function') {
            progressHandler = args[args.length - 1];
        }

        var request = {
            method: method,
            url: url,
            headers: requestHeaders,
            data: file,
            progress: progressHandler
        };

        var settings = {
            authFlow: authFlow
        };

        var promise = Request.create(request, settings).send();

        return promise.then(responseFilter);
    };
}

/**
 * Provide the correct encoding for UTF-8 Content-Disposition header value.
 * See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
 *
 * @private
 * @param {string} str
 * @returns {string}
 */
function encodeRFC5987ValueChars(str) {
    return encodeURIComponent(str).
        replace(/'/g, '%27').
        replace(/\(/g, '%28').
        replace(/\)/g, '%29').
        replace(/\*/g, '%2A');
}

/**
 * Get headers for an upload
 *
 * @private
 * @param {object} file
 * @param {string} [file.type='application/octet-stream'] Value for the Content-Type header
 * @param {string} file.name File name e.g. 'foo.pdf'
 * @param {string} linkId
 * @param {string} linkType either 'group' or 'document'
 * @returns {object}
 */
function uploadHeaders(file, linkId, linkType) {
    var headers = {
        'Content-Type': !!file.type ? file.type : 'application/octet-stream',
        'Content-Disposition': 'attachment; filename*=UTF-8\'\'' + encodeRFC5987ValueChars(file.name)
    };
    if (linkType && linkId) {
        switch(linkType) {
            case 'group':
                headers.Link = '<' + baseUrl + '/groups/' + linkId +'>; rel="group"';
                break;
            case 'document':
                headers.Link = '<' + baseUrl + '/documents/' + linkId +'>; rel="document"';
                break;
        }
    }

    return headers;
}

/**
 * Generate a URL from a template with properties and values
 *
 * @private
 * @param {string} uriTemplate
 * @param {array} uriProps
 * @param {array} uriValues
 * @returns {string}
 */
function getUrl(uriTemplate, uriProps, uriValues) {
    if (!uriProps.length) {
        return baseUrl + uriTemplate;
    }
    var uriParams = {};
    uriProps.forEach(function(prop, i) {
        uriParams[prop] = uriValues[i];
    });

    return baseUrl + expandUriTemplate(uriTemplate, uriParams);
}

/**
 * Get the headers for a request
 *
 * @private
 * @param {array} headers
 * @param {array} data
 * @returns {array}
 */
function getRequestHeaders(headers, data) {
    for (var headerName in headers) {
        var val = headers[headerName];
        if (typeof val === 'function') {
            headers[headerName] = val(data);
        }
    }

    return headers;
}

/**
 * Populate a URI template with data
 *
 * @private
 * @param {string} template
 * @param {object} data
 * @returns {string}
 */
function expandUriTemplate(template, data) {
    var matches = template.match(/\{[a-z]+\}/gi);
    matches.forEach(function(match) {
        var prop = match.replace(/[\{\}]/g, '');
        if (!data.hasOwnProperty(prop)) {
            throw new Error('Endpoint requires ' + prop);
        }
        template = template.replace(match, data[prop]);
    });

    return template;
}

/**
 * Set the current pagination links for a given API by extracting
 * looking at the headers retruend with the response.
 *
 * @private
 * @param {object} headers
 */
function setPaginationLinks(headers) {
    if (headers.hasOwnProperty('mendeley-count')) {
        this.count = parseInt(headers['mendeley-count'], 10);
    }

    if (!headers.hasOwnProperty('link') || typeof headers.link !== 'object') {
        return;
    }

    for (var p in this.paginationLinks) {
        this.paginationLinks[p] = headers.link.hasOwnProperty(p) ? headers.link[p] : false;
    }
}

/**
 * Reset the pagination links
 *
 * @private
 */
function resetPaginationLinks() {
    this.paginationLinks = {
        last: false,
        next: false,
        previous: false
    };
    this.count = 0;
}
