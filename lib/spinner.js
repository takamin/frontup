"use strict";
function Spinner(message) {
    this._states = ["|","/","-"];
    this._index = 0;
    process.stderr.write(`${message} ${this.next()}`);
    this._tid = setInterval(()=> {
        process.stderr.write(`\b${this.next()}`);
    }, 100);
}
module.exports = Spinner;
Spinner.prototype.end = function(message) {
    clearInterval(this._tid);
    this._tid = null;
    process.stderr.write(`\b${message}\n`);
};
Spinner.prototype.next = function() {
    const ch = this._states[this._index];
    this._index = (this._index + 1) % this._states.length;
    return ch;
};

