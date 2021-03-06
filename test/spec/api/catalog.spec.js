'use strict';

var axios = require('axios');
var Bluebird = require('bluebird');

describe('catalog api', function() {

    var api = require('../../../lib/api');
    var catalogApi = api.catalog;
    var baseUrl = 'https://api.mendeley.com';

    var mockAuth = require('../../mocks/auth');
    api.setAuthFlow(mockAuth.mockImplicitGrantFlow());

    describe('search method', function() {
        var ajaxSpy;
        var ajaxRequest;
        var params = {
            filehash: 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d' // SHA1('hello')
        };

        it('should be defined', function(done) {
            expect(typeof catalogApi.search).toBe('function');
            ajaxSpy = spyOn(axios, 'request').and.returnValue(Bluebird.resolve({headers: {}}));
            catalogApi.search(params).finally(function() {
                expect(ajaxSpy).toHaveBeenCalled();
                ajaxRequest = ajaxSpy.calls.mostRecent().args[0];
                done();
            });
        });

        it('should use GET', function() {
            expect(ajaxRequest.method).toBe('get');
        });

        it('should use endpoint /catalog', function() {
            expect(ajaxRequest.url).toBe(baseUrl + '/catalog');
        });

        it('should NOT have a Content-Type header', function() {
            expect(ajaxRequest.headers['Content-Type']).not.toBeDefined();
        });

        it('should have an Authorization header', function() {
            expect(ajaxRequest.headers.Authorization).toBeDefined();
            expect(ajaxRequest.headers.Authorization).toBe('Bearer auth');
        });

        it('should allow paramaters', function() {
            expect(ajaxRequest.params).toEqual(params);
        });

    });

    describe('retrieve method', function() {
        var ajaxSpy;
        var ajaxRequest;
        var params = {
            view: 'all'
        };

        it('should be defined', function(done) {
            expect(typeof catalogApi.retrieve).toBe('function');
            ajaxSpy = spyOn(axios, 'request').and.returnValue(Bluebird.resolve({headers: {}}));
            catalogApi.retrieve('catalogId', params).finally(function() {
                expect(ajaxSpy).toHaveBeenCalled();
                ajaxRequest = ajaxSpy.calls.mostRecent().args[0];
                done();
            });
        });

        it('should use GET', function() {
            expect(ajaxRequest.method).toBe('get');
        });

        it('should use endpoint /catalog/catalogId', function() {
            expect(ajaxRequest.url).toBe(baseUrl + '/catalog/catalogId');
        });

        it('should NOT have a Content-Type header', function() {
            expect(ajaxRequest.headers['Content-Type']).not.toBeDefined();
        });

        it('should have an Authorization header', function() {
            expect(ajaxRequest.headers.Authorization).toBeDefined();
            expect(ajaxRequest.headers.Authorization).toBe('Bearer auth');
        });

        it('should allow paramaters', function() {
            expect(ajaxRequest.params).toEqual(params);
        });

    });
});
