"use strict";
const AWS = require("aws-sdk");
const cf = new AWS.CloudFront();
const uuidv4 = require("uuid/v4");
const { promisify } = require("es6-promisify");
const CfDistS3Origin = require("./cf-dist-s3-origin.js");

const promised = {
    cf: {
        createInvalidation: promisify(cf.createInvalidation.bind(cf)),
        getDistribution: promisify(cf.getDistribution.bind(cf)),
    },
};

function CloudFrontDistribution(distId) {
    this._distId = distId;
    this._distribution = null;
}

module.exports = CloudFrontDistribution;

CloudFrontDistribution.prototype.createInvalidation = async function(paths) {
    const invalidation = new CloudFrontDistribution.Invalidation(this._distId, paths);
    await invalidation.create();
    return invalidation;
};

CloudFrontDistribution.Invalidation = function(distId, paths) {
    const callerRef = uuidv4();
    this._params = {
        DistributionId: distId,
        InvalidationBatch: {
            CallerReference: callerRef,
            Paths: {
                Quantity: paths.length,
                Items: paths,
            },
        },
    };
};

CloudFrontDistribution.Invalidation.prototype.create = async function() {
    this._response = await promised.cf.createInvalidation(this._params);
};

CloudFrontDistribution.Invalidation.prototype.isCompleted = function() {
    return this._response.Invalidation.Status === "Completed";
};

CloudFrontDistribution.Invalidation.prototype.checkCompleted = async function() {
    this._response = await promised.cf.createInvalidation(this._params);
    return this.isCompleted();
};

CloudFrontDistribution.Invalidation.prototype.waitTillCompleted = function(interval) {
    interval = interval || 5000;
    return new Promise( (resolve, reject) => {
        const tid = setInterval(async () => {
            try {
                if(await this.checkCompleted()) {
                    clearInterval(tid);
                    resolve();
                }
            } catch (err) {
                reject(err);
            }
        }, interval);
    });
};

/**
 * A wrapper of CloudFront.getDistribution API.
 *
 * @async
 * @returns {Promise<{DistInfo}>} A promise that will be resolved by DistInfo:
 * ```
 * type: object
 * properties:
 *      DomainName:
 *          type: string
 *      DefaultRootObject:
 *          type: string:
 *      Origins:
 *          type: array
 *          items:
 *              type: CfDistS3Origin
 * ```
 */
CloudFrontDistribution.prototype.getDistribution = async function() {
    const distInfo =  await promised.cf.getDistribution({Id: this._distId });
    this._distribution = {
        DomainName:
            distInfo.Distribution.DomainName,
        DefaultRootObject:
            distInfo.DistributionConfig.DefaultRootObject,
        Origins:
            CfDistS3Origin.fromConfigItems(
                distInfo.DistributionConfig.Origins.Items),
    };
    this.getDistribution = async () => this._distribution;
    return this._distribution;
};

/**
 * Select a bucket name for the key.
 * @async
 * @param { string } key The uploading distination key for S3 bucket.
 * @returns {Promise<string>} A promise that will be resolved by a bucket name.
 */
CloudFrontDistribution.prototype.getOriginBucket = async function(key) {
    const distribution = await this.getDistribution();
    return CloudFrontDistribution.getOriginBucket(
        distribution.Origins, key);
};

/**
 * Select a bucket name for the key.
 * @param {Array<CfDistS3Origin>} origins S3 origin config.
 * @param {string} key The uploading distination key for S3 bucket.
 * @returns {string} A bucket name that was selected with the matching
 *      status for the key.
 */
CloudFrontDistribution.getOriginBucket = function(origins, key) {
    const candi =  origins.filter( item => item.isKeyMatch(key) )
    .sort( (a, b) => b.getOriginPath().length - a.getOriginPath().length );

    if(candi.length == 0) {
        throw new Error(`Bucket not found for ${key}`);
    }
    return candi[0].getBucketName();
};
