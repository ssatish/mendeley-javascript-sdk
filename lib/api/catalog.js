'use strict';

var utils = require('../utilities');

/**
 * Catalog API
 *
 * @namespace
 * @name api.catalog
 */
module.exports = function catalog() {
    return {

        /**
         * Search the catalog
         *
         * @method
         * @memberof api.catalog
         * @param {object} params - A catalog search filter
         * @returns {promise}
         */
        search: utils.requestFun('GET', '/catalog'),

        /**
         * Retrieve a document data from catalog
         *
         * @method
         * @memberof api.catalog
         * @param {string} id - A catalog UUID
         * @param {object} params - A catalog search filter
         * @returns {promise}
         */
        retrieve: utils.requestFun('GET', '/catalog/{id}', ['id'])

    };
};
