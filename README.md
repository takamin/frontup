apfront
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

## USAGE

Run the command `frontup` after creating a config file where current directory.

__frontup.config.js__:

```javascript
module.exports = {
    CloudFrontDistributionId: "<cloudfront-distribution-id>",
    "S3BucketName": "<s3-bucket-name>",
    "Files":{
        "<distination-s3-key>": "<relative-path-name>",
        ・
        ・
        ・
    },
};
```

__`cloudfront-distribution-id`:__

The id of CloudFront distribution.

__`s3-bucket-name`:__

The S3 bucket name which the contents published by the ClodFront distribution
are stored.

__`distination-s3-key`:__

The distination S3 Key.
If this must be a folder key, you would better to add slash(`/`) to the end.

__`relative-path-name`:__

The name to upload file or directory.
This must be a relative pathname from the current working directory.
__Do not start with `./`, `../` or `/`__ for the pathname.

If the pathname is directory, all the files will be uploaded.

## LICENSE

Copyright (c) 2019 Koji Takami

This software is released under the [MIT License](./LICENSE)
