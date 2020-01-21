"use strict"
const assert = require("chai").assert;
const {
    createS3PutObjectParam,
    createS3BucketKey,
    createUploadParams,
} = require("../lib/upload-param.js");
const fs = require("promise-fs");
const path = require("path");
const rmdirRecursive = require('rmdir-recursive');

const testDir = __dirname;
const testFiles = {
    data: {
        dA0: {
            "fA0.js": "fA0", "fA1.html": "fA1", "fB0.css": "fB0", "fB1.no-mime-type": "fB1",
            dA0: { "fA0.js": "fA0", "fA1.html": "fA1", "fB0.css": "fB0", },
            dA1: { "fA0.js": "fA0", "fA1.html": "fA1", "fB0.css": "fB0", },
            dB0: { "fA0.js": "fA0", "fA1.html": "fA1", "fB0.css": "fB0", },
            dB1: { "fA0.js": "fA0", "fA1.html": "fA1", "fB0.css": "fB0", },
        },
        dA1: { "fA0.js": "fA0", "fA1.html": "fA1", "fB0.css": "fB0", },
        dB0: { "fA0.js": "fA0", "fA1.html": "fA1", "fB0.css": "fB0", },
        dB1: { "fA0.js": "fA0", "fA1.html": "fA1", "fB0.css": "fB0", },
    },
};

const prepareFileTree = async (rootDir, tree) => {
    await Promise.all(Object.keys(tree).map( async file => {
        const defContent = tree[file];
        const pathname = path.join(rootDir, file);
        if(typeof defContent === "string") {
            try{
                await fs.writeFile(pathname, defContent);
            } catch(err) {
                console.error(err.message);
            }
        } else if(typeof defContent === "object") {
            try{
                await fs.mkdir(pathname);
            } catch(err) {
                console.error(err.message);
            }
            await prepareFileTree(pathname, defContent);
        }
    }));
};

const createTestDir = async () => {
    await prepareFileTree(testDir, testFiles);
};

const removeTestDir = async () => {
    await Promise.all(Object.keys(testFiles).map(key => {
        return new Promise((resolve, reject) => {
            rmdirRecursive(
                path.join(testDir, key),
                err => {
                    if(err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            )
        });
    }));
};

describe("lib/upload-param.js", ()=>{
    describe(".createS3PutObjectParam", ()=>{
        it("should be exported", () => {
            assert.instanceOf(createS3PutObjectParam, Function);
        });
        it("should throw if the input file does not exist", async () => {
            await createTestDir();
            try {
                await createS3PutObjectParam(
                    "BucketName", "test/data", "there-is-no-file");
                assert(false);
            } catch( err ) {
                assert(true);
            } finally {
                await removeTestDir();
            }
        });
        it("should not yield a ContentType property when the MIME-type is not be determined", async () => {
            await createTestDir();
            try {
                const param = await createS3PutObjectParam(
                    "BucketName",
                    "test/data/",
                    "test/data/dA0/fB1.no-mime-type");
                assert.notProperty(param, "ContentType");
            } finally {
                await removeTestDir();
            }
        });
    });
    describe(".createS3BucketKey", ()=>{
        it("should be exported", () => {
            assert.instanceOf(createS3BucketKey, Function);
        });
        it("should return a single key and pathname", async () => {
            await createTestDir();
            try {
                const uploadList = await createS3BucketKey(
                    "test/data/", "test/data/dA0/fA0.js");
                assert.equal(uploadList.length, 1);
                assert.equal(uploadList[0].key, "test/data/fA0.js");
                assert.equal(uploadList[0].pathname, "test/data/dA0/fA0.js");
            } finally {
                await removeTestDir();
            }
        });
        describe("Listing all files below specific directory", () => {
            describe("When the source directory specifier has no trailing slash", () => {
                it("should be error if the destination specifier has no trailing slash", async () => {
                    await createTestDir();
                    try {
                        await createS3BucketKey("test/data", "test/data/dA0/dA0");
                        assert(false);
                    } catch( err ) {
                        assert(true);
                    } finally {
                        await removeTestDir();
                    }
                });
                it("should returns an array which length is equal to the number of files listed", async () => {
                    await createTestDir();
                    try {
                        const uploadList = await createS3BucketKey(
                            "test/data/", "test/data/dA0/dA0");
                        assert.equal(uploadList.length, 3);
                    } finally {
                        await removeTestDir();
                    }
                });
                it("should list files", async () => {
                    await createTestDir();
                    try {
                        const uploadList = await createS3BucketKey(
                            "test/data/", "test/data/dA0/dA0");
                        assert.deepInclude(uploadList, {
                            key: "test/data/fA0.js",
                            pathname: "test/data/dA0/dA0/fA0.js",
                        });
                    } finally {
                        await removeTestDir();
                    }
                });
                it("should list all files in sub directories", async () => {
                    await createTestDir();
                    try {
                        const uploadList = await createS3BucketKey(
                            "test/data/", "test/data");
                        assert.deepInclude(uploadList, {
                            key: "test/data/dA0/dB1/fB0.css",
                            pathname: "test/data/dA0/dB1/fB0.css",
                        });
                    } finally {
                        await removeTestDir();
                    }
                });
                it("should generate the key including source path", async () => {
                    await createTestDir();
                    try {
                        const uploadList = await createS3BucketKey(
                            "test1/data2/", "test/data");
                        assert.deepInclude(uploadList, {
                            key: "test1/data2/dA0/dA0/fA1.html",
                            pathname: "test/data/dA0/dA0/fA1.html",
                        });
                    } finally {
                        await removeTestDir();
                    }
                });
            });
            describe("When the source directory specifier has a trailing slash", () => {
                it("should be error if the destination specifier has no trailing slash", async () => {
                    await createTestDir();
                    try {
                        await createS3BucketKey("test/data", "test/data/dA0/dA0/");
                        assert(false);
                    } catch( err ) {
                        assert(true);
                    } finally {
                        await removeTestDir();
                    }
                });
                it("should list files even if the source directory specifier has trailing slash", async () => {
                    await createTestDir();
                    try {
                        const uploadList = await createS3BucketKey(
                            "test/data/dA0/dA0/", "test/data/dA0/dA0/");
                        assert.deepInclude(uploadList, {
                            key: "test/data/dA0/dA0/fB0.css",
                            pathname: "test/data/dA0/dA0/fB0.css",
                        });
                    } finally {
                        await removeTestDir();
                    }
                });
                it("should generate the key including source path", async () => {
                    await createTestDir();
                    try {
                        const uploadList = await createS3BucketKey(
                            "test1/data2/", "test/data/");
                        assert.deepInclude(uploadList, {
                            key: "test1/data2/dA0/dA0/fA1.html",
                            pathname: "test/data/dA0/dA0/fA1.html",
                        });
                    } finally {
                        await removeTestDir();
                    }
                });
            });
        });
    });
    describe(".createUploadParams", ()=>{
        it("should be exported", () => {
            assert.instanceOf(createUploadParams, Function);
        });
        it("should be error if the destination specifier has no trailing slash", async () => {
            await createTestDir();
            try {
                await createUploadParams(
                    "BucketName", "test/data", "test/data/dA0/dA0");
                assert(false);
            } catch( err ) {
                assert(true);
            } finally {
                await removeTestDir();
            }
        });
        it("should create parameter for single file", async () => {
            await createTestDir();
            try {
                const params = await createUploadParams(
                    "BucketName", "test/data/", "test/data/dA0/fA0.js");
                assert.equal(params.length, 1);
                assert.equal(params[0].params.Bucket, "BucketName");
                assert.equal(params[0].params.Key, "test/data/fA0.js");
                assert.equal(params[0].params.CacheControl, "no-cache");
                assert.equal(params[0].params.ContentType, "application/javascript");
                assert.equal(params[0].pathname, "test/data/dA0/fA0.js");
            } finally {
                await removeTestDir();
            }
        });
        describe("Specifying files by array", ()=>{
            it("should create multiple parameters", async () => {
                await createTestDir();
                try {
                    const params = await createUploadParams(
                        "BucketName", "test/data/", [
                            "test/data/dA0/fA0.js",
                            "test/data/dA0/fA1.html",
                        ]);
                    assert.equal(params.length, 2);
                    assert.equal(params[0].params.Key, "test/data/fA0.js");
                    assert.equal(params[0].params.ContentType, "application/javascript");
                    assert.equal(params[0].pathname, "test/data/dA0/fA0.js");
                    assert.equal(params[1].params.Key, "test/data/fA1.html");
                    assert.equal(params[1].params.ContentType, "text/html");
                    assert.equal(params[1].pathname, "test/data/dA0/fA1.html");
                } finally {
                    await removeTestDir();
                }
            });
        });
        describe("Exculuding feature", ()=>{
            it("should exclude the files by a single regular expression", async () => {
                await createTestDir();
                try {
                    const params = await createUploadParams(
                        "BucketName", "test/data/", {
                            path: "test/data/dA0/dA0",
                            exclude: "(js|html)$",
                        });
                    assert.equal(params.length, 1);
                    assert.equal(params[0].params.Key, "test/data/fB0.css");
                } finally {
                    await removeTestDir();
                }
            });
            it("should exclude the files by multiple regular expression", async () => {
                await createTestDir();
                try {
                    const params = await createUploadParams(
                        "BucketName", "test/data/", {
                            path: "test/data/dA0/dA0",
                            exclude: [
                                "js$",
                                "html$",
                            ],
                        });
                    assert.equal(params.length, 1);
                    assert.equal(params[0].params.Key, "test/data/fB0.css");
                } finally {
                    await removeTestDir();
                }
            });
            it("should exclude the directories", async () => {
                await createTestDir();
                try {
                    const params = await createUploadParams(
                        "BucketName", "test/data/", {
                            path: "test/data/",
                            exclude: [
                                "^test/data/dA0/",
                            ],
                        });
                    assert.equal(params.length, 9);
                    const keys = params.map(item => item.params.Key)
                    assert.include(keys , "test/data/dA1/fA0.js");
                    assert.include(keys , "test/data/dB0/fA1.html");
                    assert.include(keys , "test/data/dB1/fB0.css");
                } finally {
                    await removeTestDir();
                }
            });
            it("should exclude with multiple extension", async () => {
                await createTestDir();
                try {
                    const params = await createUploadParams(
                        "BucketName", "test/data/", {
                            path: "test/data/",
                            exclude: [
                                "(js|html|no-mime-type)$",
                            ],
                        });
                    assert.equal(params.length, 8);
                    const keys = params.map(item => item.params.Key)
                    assert.include(keys , "test/data/dA0/fB0.css");
                    assert.include(keys , "test/data/dA0/dA0/fB0.css");
                    assert.include(keys , "test/data/dA0/dA1/fB0.css");
                    assert.include(keys , "test/data/dA0/dB0/fB0.css");
                    assert.include(keys , "test/data/dA0/dB1/fB0.css");
                    assert.include(keys , "test/data/dA1/fB0.css");
                    assert.include(keys , "test/data/dB0/fB0.css");
                    assert.include(keys , "test/data/dB1/fB0.css");
                } finally {
                    await removeTestDir();
                }
            });
        });
    });
});