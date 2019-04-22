#! /usr/bin/env node
"use strict";
const AWS = require("aws-sdk");
const path = require("path");
const mime = require("mime-types");
const fs = require("promise-fs");
const { promisify } = require("es6-promisify");
const filesAsync = require("files-async");
const CloudFrontDistribution = require("../lib/cf-dist.js");
const Spinner = require("../lib/spinner.js");
const s3 = new AWS.S3();
const promised = {
    s3: {
        putObject: promisify(s3.putObject.bind(s3)),
    },
};

const loadConfig = async pathname => {
    try {
        return require(path.join(process.cwd(), pathname));
    } catch(err) {
        console.error(`Error: ${err.name} ${err.message}`);
        console.error(`frontup could not load a config file ${pathname}`);
    }
};

const createS3PutObjectParam = async (bucket, key, pathname) => {
    try {
        const body = await fs.readFile(pathname);
        const contentType = mime.lookup(pathname);
        return {
            Body: contentType.match(/^text\//) ? body.toString() : body,
            Bucket: bucket,
            Key: key,
            CacheControl: "no-cache",
            ContentType: contentType,
        };
    } catch(err) {
        console.warn(err.message);
    }
};

const createUploadParams = async (bucket, dstRoot, srcPath) => {
    const keyPath = dstRoot.replace(/\/$/, "");
    const stats = await fs.stat(srcPath);
    if(stats.isFile()) {
        const pathname = srcPath;
        const keyPathIsFolder = dstRoot.match(/\/$/);
        const keyBasename = path.basename(pathname.replace(/\\/g, "/"));
        const key = (!keyPathIsFolder ? keyPath : `${keyPath}/${keyBasename}`);
        const params = await createS3PutObjectParam(bucket, key, pathname);
        return [ { pathname, params } ];
    }

    const re = new RegExp(`^${srcPath}`);
    return await filesAsync(srcPath, async pathname => {
        const key = pathname.replace(/\\/g, "/").replace(re, keyPath);
        const params = await createS3PutObjectParam(bucket, key, pathname);
        return { pathname, params };
    });
};

const main = async () => {
    const config = await loadConfig( "./frontup.config.js");
    const cfDist = new CloudFrontDistribution(config.CloudFrontDistributionId);
    const paths = config.Files;

    const putObjectParamList = [];
    const errors = (await Promise.all(
        Object.keys(paths).map( async (dstRoot) => {
            try {
                const srcPath = paths[dstRoot];
                const bucket = await cfDist.getOriginBucket(dstRoot);
                const params = await createUploadParams(
                    bucket, dstRoot, srcPath);
                params.forEach( async item => {
                    putObjectParamList.push(item);
                });
                return null;
            } catch(err) {
                return err;
            }
        })
    )).filter( err => !!err );

    if(errors.length > 0) {
        console.error(errors.map(
            err => `Error: ${err.message}`
        ).join("\n"));
        process.exit(-1);
    }

    let count = 0;
    await Promise.all(putObjectParamList.map( async item => {
        console.log(`putObject: ${item.pathname}`);
        console.log(`  [ContentType: ${item.params.ContentType}]`);
        console.log(`  ==> s3:${'//'}${item.params.Bucket}/${item.params.Key}`);
        await promised.s3.putObject(item.params);
        count++;
    }));
    console.log(`${count} files uploaded`);

    console.error("Create a invalidation");
    const invalidation = await cfDist.createInvalidation([ "/*" ]);
    const spinner = new Spinner("Waiting the invalidation is completed ...");
    await invalidation.waitTillCompleted();
    spinner.end("done.");
    console.error("The invalidation has completed.");
};

main();
