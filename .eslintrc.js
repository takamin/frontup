module.exports = {
    "env": {
        "browser": false,
        "es6": true,
        "mocha": true,
        "node": true,
    },
    "extends": "eslint:recommended",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "rules": {
        "require-await": "error",
    }
};