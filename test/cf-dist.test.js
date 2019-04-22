"use strict";
const assert = require("chai").assert;
const CloudFrontDistribution = require("../lib/cf-dist.js");
const CfDistS3Origin = require("../lib/cf-dist-s3-origin.js");
describe("CloudFrontDistribution", () => {
    describe(".getOriginBucket", () => {
        it("should returns proper bucket name", () => {
            assert.equal(
                CloudFrontDistribution.getOriginBucket([
                    new CfDistS3Origin({ BucketName: "b0", OriginPath: "/path0" }),
                    new CfDistS3Origin({ BucketName: "b1", OriginPath: "/path0/path1" }),
                    new CfDistS3Origin({ BucketName: "b2", OriginPath: "/path0/path11" }),
                    new CfDistS3Origin({ BucketName: "b3", OriginPath: "/path" }),
                ], "path0/path11"), "b2");
        });
    });
});
