#! /usr/bin/env node
"use strict";
const Getopt = require("node-getopt");
const hasharg = require("hash-arg");
const AWS = require("aws-sdk");
const path = require("path");
const mime = require("mime-types");
const fs = require("promise-fs");
const { promisify } = require("es6-promisify");
const filesAsync = require("files-async");
const CloudFrontDistribution = require("../lib/cf-dist.js");
const Spinner = require("../lib/spinner.js");
const s3 = new AWS.S3();

const getopt = new Getopt([
  ["n", "dry-run",  "Do not upload any files, but print the files and target keys" ],
  ["v", "version",  "display version"   ],
  ["h", "help",     "display this help" ]
]);

getopt.setHelp(

`Usage: frontup [frontup_config_js] [OPTION]
AWS S3 contents uploader distributed by AWS cloudfront distribution.

PARAMETERS:
  frontup_config_js (Optional)
    A configuration filename.
    Default: "./frontup.config.js"

OPTIONS:
[[OPTIONS]]

A configuration file must be decalared as a CommonJs module.
It must export an object like below.

  module.exports = {
      "CloudFrontDistributionId": "<cloudfront-distribution-id>",
      "S3BucketName": "<s3-bucket-name>",
      "Files": {
          "<distination-s3-key>": "<relative-path-name>",
          ・
          ・
          ・
      },
  };

Installation: npm install frontup
Respository:  https://github.com/takamin/frontup`

);

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
    const command = getopt.parseSystem();
    if(command.options.version) {
        console.error(require("../package.json").version);
        process.exit(1);
    }
    if(command.options.help) {
        getopt.showHelp();
        process.exit(1);
    }
    const dryRunOption = command.options["dry-run"];
    const argv = hasharg.get([
        {
            "name":"frontupConfigJs",
            "default": "./frontup.config.js",
        }
    ], getopt.argv);
    const { frontupConfigJs } = argv;
    const config = await loadConfig( frontupConfigJs );
    if(!config) {
        process.exit(1);
    }
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
        if(dryRunOption) {
            return;
        }
        await promised.s3.putObject(item.params);
        count++;
    }));
    console.log(`${count} files uploaded`);

    if(dryRunOption) {
        return;
    }
    console.error("Create a invalidation");
    const invalidation = await cfDist.createInvalidation([ "/*" ]);
    const spinner = new Spinner("Waiting the invalidation is completed ...");
    await invalidation.waitTillCompleted();
    spinner.end("done.");
    console.error("The invalidation has completed.");
};

main();
