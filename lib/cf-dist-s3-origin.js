"use strict";

/**
 * S3 Origin information of CloudFront distribution.
 * @constructor
 * @param {object} item An oject to initialize this instance.
 * ```
 * type: object:
 * properties:
 *     BucketName:
 *         type: string
 *     OriginPath:
 *         type: string
 * ```
 */
function CfDistS3Origin(item) {
    this.BucketName = item.BucketName;
    this.OriginPath = item.OriginPath;
};

/**
 * A factory to create an array of instace of this class.
 * @param {Array<object>} originsItems An array of origins
 *      provided by the CloudFront distribution information
 *      which getDistribution API returns.
 * @returns {Array<CfDistS3Origin>} An array of instance of this class
 */
CfDistS3Origin.fromConfigItems = function(originsItems) {
    const regexpS3DomainName = /\.s3\.amazonaws\.com$/;
    return originsItems
        .filter( item => item.DomainName.match(regexpS3DomainName) )
        .map(item => new CfDistS3Origin({
            BucketName: item.DomainName.replace(regexpS3DomainName,""),
            OriginPath: item.OriginPath
        }));
};

/**
 * Get this bucket name.
 * @returns {string} A bucket name.
 */
CfDistS3Origin.prototype.getBucketName = function() {
    return this.BucketName;
};

/**
 * Get this origin path.
 * @returns {string} An origin path.
 */
CfDistS3Origin.prototype.getOriginPath = function() {
    return this.OriginPath;
};

/**
 * Test whether the key match this origin path.
 * @param {string} key S3 key to test.
 * @returns {boolean} The key matches to this or not.
 */
CfDistS3Origin.prototype.isKeyMatch = function(key) {
    const pattern = `^${this.OriginPath}`;
    return `/${key}`.match(new RegExp(pattern));
};

module.exports = CfDistS3Origin;


