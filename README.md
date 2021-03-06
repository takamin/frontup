frontup
=======

A command to upload files to a S3 bucket and create invalidation of AWS
CloudFront distribution.

This command needs official AWS-CLI.
And you must setup the profile (~/.aws) to connect for AWS.

Currently, this command invalidates all content paths after uploading.

## INSTALL

`npm install --global frontup`

or 

`npm install --save-dev frontup`

If the global install fails, once uninstalling might be a solution.

## USAGE

```console
$ frontup -h
Usage: frontup [frontup_config_js] [OPTION]
AWS S3 contents uploader distributed by AWS cloudfront distribution.

PARAMETERS:
  frontup_config_js (Optional)
    A configuration filename.
    Default: "./frontup.config.js"

OPTIONS:
  -n, --dry-run Do not upload any files, but print the files and target keys
  -v, --version display version
  -h, --help    display this help

A configuration file must be decalared as a CommonJs module.
It must export an object like below.

  module.exports = {
      "CloudFrontDistributionId": "<cloudfront-distribution-id>",
      "S3BucketName": "<s3-bucket-name>",
      "Files": {
          "<destination-s3-key>": "<relative-path-name>",
          "<destination-s3-key>": [
              "<relative-path-name>",
                  .
                  .
                  .
          ],
          "<destination-s3-key>": {
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
Respository:  https://github.com/takamin/frontup
```

Here is an example of configuration file.

__frontup.config.js__:

```javascript
module.exports = {
    "CloudFrontDistributionId": "<cloudfront-distribution-id>",
    "S3BucketName": "<s3-bucket-name>",
    "Files": {
        "<destination-s3-key>": "<relative-path-name>",
        "<destination-s3-key>": [
            "<relative-path-name>",
                .
                .
                .
        ],
        "<destination-s3-key>": {
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
```

__`cloudfront-distribution-id`:__

The id of CloudFront distribution.

__`s3-bucket-name`:__

The S3 bucket name which the contents published by the ClodFront distribution
are stored.

__`destination-s3-key`:__

The destination S3 Key.
If this must be a folder key, it should be ended with a slash(`/`).

__`relative-path-name`:__

The name to upload file or directory.
This must be a relative pathname from the current working directory.
__Do not start with `./`, `../` or `/`__ for the pathname.

If the pathname is directory, all the files will be uploaded.

__`regular-expression-to-exclude`__

To exclude specific files, Write regular expressions matching to the excluding
file name.

## LICENSE

Copyright (c) 2019 Koji Takami

This software is released under the [MIT License](./LICENSE)
