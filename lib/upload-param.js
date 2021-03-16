"use strict";
const debug = require("debug")("UploadParam");
const path = require("path");
const mime = require("mime-types");
const fs = require("promise-fs");
const filesAsync = require("files-async");

const UploadParam = {};

UploadParam.createS3PutObjectParam = async (bucket, key, pathname) => {
    const body = await fs.readFile(pathname);
    const contentType = mime.lookup(pathname);
    if(contentType === false) {
        return {
            Body: body,
            Bucket: bucket,
            Key: key,
            CacheControl: "no-cache",
        };
    }
    return {
        Body: contentType.match(/^text\//) ? body.toString() : body,
        Bucket: bucket,
        Key: key,
        CacheControl: "no-cache",
        ContentType: contentType,
    };
};

UploadParam.createS3BucketKey = async (dstRoot, srcPath) => {
    debug(`dstRoot: ${dstRoot}`);
    const keyPath = dstRoot.replace(/\/$/, "");
    debug(`keyPath: ${keyPath}`);
    const keyPathIsFolder = dstRoot.match(/\/$/);
    debug(`keyPathIsFolder: ${keyPathIsFolder}`);
    const stats = await fs.stat(srcPath);

    if(stats.isFile()) {
        const pathname = srcPath;
        const keyBasename = path.basename(pathname.replace(/\\/g, "/"));
        const key = (!keyPathIsFolder ? keyPath : `${keyPath}/${keyBasename}`);
        debug(`key: ${key}`);
        return [{key, pathname}];
    }

    if(!stats.isDirectory()) {
        return [];
    }

    if(!keyPathIsFolder) {
        throw new Error("Destination key must be specified as a folder with trailing slash.");
    }

    // srcPath is not file.
    const re = new RegExp(`^${srcPath.replace(/\/$/, "")}`);
    return await filesAsync(srcPath, pathname => {
        const pathname_s = pathname.replace(/\\/g, "/");
        const key = pathname_s.replace(re, keyPath).replace(/^\//, "");
        debug(`key: ${key}`);
        return {key, pathname: pathname_s};
    });
};

/**
 * Create parameters of S3.PutObject API to upload files.
 * @param {string} bucket A destination bucket name of AWS S3.
 * @param {string} dstRoot A destination key as filename or folder.
 * @param {string|Array<any>|object} srcPath A specification to list local
 *      files to be upload.
 */
UploadParam.createUploadParams = async (bucket, dstRoot, srcPath) => {
    if(typeof srcPath === "string") {
        const keyAndPathname = await UploadParam.createS3BucketKey(
            dstRoot, srcPath);
        return await Promise.all(keyAndPathname.map(async pair => {
            const { key, pathname } = pair;
            const params = await UploadParam.createS3PutObjectParam(
                bucket, key, pathname);
            return { pathname, params };
        }));
    }
    if(Array.isArray(srcPath)) {
        const allParams = [];
        (await Promise.all(srcPath.map(path =>
            UploadParam.createUploadParams(bucket, dstRoot, path)
        ))).forEach(arr => arr.forEach( param => allParams.push(param)));
        return allParams;
    }
    if(typeof srcPath === "object") {
        if(!('path' in srcPath)) {
            throw new Error([
                `specifying files to be uploaded by an object must have`,
                `a 'path' property. ${JSON.stringify(srcPath, null, 2)}`
            ].join(" "));
        }
        const params = await UploadParam.createUploadParams(
            bucket, dstRoot, srcPath.path);

        if('exclude' in srcPath) {
            if(typeof srcPath.exclude === "string") {
                const regexp = new RegExp(srcPath.exclude);
                return params.filter(param => {
                    if(param.pathname.match(regexp)) {
                        return false;
                    }
                    return true;
                });
            }
            if(Array.isArray(srcPath.exclude)) {
                const excludeREs = srcPath.exclude.map(
                    pattern => new RegExp(pattern));
                return params.filter(param => {
                    for(const regexp of excludeREs) {
                        if(param.pathname.match(regexp)) {
                            return false;
                        }
                    }
                    return true;
                });
            }
        }
    }
};

module.exports = UploadParam;
