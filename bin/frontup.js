#! /usr/bin/env node
"use strict";
const Getopt = require("node-getopt");
const hasharg = require("hash-arg");
const AWS = require("aws-sdk");
const path = require("path");
const { promisify } = require("es6-promisify");
const CloudFrontDistribution = require("../lib/cf-dist.js");
const { createUploadParams } = require("../lib/upload-param.js");
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
          "<distination-s3-key>": [
              "<relative-path-name>",
                  .
                  .
                  .
          ],
          "<distination-s3-key>": {
              "path": "<relative-path-name>",
              "exclude": [
                  "<regular-expression-to-exclude>",
                      .
                      .
                      .
              ],
          },
          .
          .
          .
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

const loadConfig = pathname => {
    try {
        return require(path.join(process.cwd(), pathname));
    } catch(err) {
        console.error(`Error: ${err.name} ${err.message}`);
        console.error(`frontup could not load a config file ${pathname}`);
    }
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
    const config = loadConfig( frontupConfigJs );
    if(!config) {
        process.exit(1);
    }
    const cfDist = new CloudFrontDistribution(config.CloudFrontDistributionId);
    const S3_BUCKET = config.S3BucketName;
    const paths = config.Files;

    const putObjectParamList = [];
    await Promise.all(Object.keys(paths).map( async (dstRoot) => {
        const srcPath = paths[dstRoot];
        const params = await createUploadParams(S3_BUCKET, dstRoot, srcPath);
        params.forEach( item => {
            putObjectParamList.push(item);
        });
    }));
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

main().catch(err => console.error(`Error: ${err.message}`));
