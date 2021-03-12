"use strict";
const AWS = require("aws-sdk");
const cf = new AWS.CloudFront();
const {v4: uuidv4} = require("uuid");
const { promisify } = require("es6-promisify");
const promised = {
    cf: {
        createInvalidation: promisify(cf.createInvalidation.bind(cf)),
    },
};

function CloudFrontDistribution(distId) {
    this._distId = distId;
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

