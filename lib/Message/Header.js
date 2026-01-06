'use strict';

// Lookup-Array für next_state (vermeidet switch-case Overhead)
const NEXT_STATES = ['text', 'binary_file', 'etable_values', 'etable_text', 'etable_daytimer', 'header', 'header', 'etable_weather'];

var Header = function (binaryData) {
    const b = binaryData;
    const b0 = b[0], b1 = b[1], b2 = b[2];
    const b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7];
    
    this.bin_type = b0;
    this.identifier = b1;
    this.info = b2;
    this.len = b4 | (b5 << 8) | (b6 << 16) | (b7 << 24);
};

Header.prototype.next_state = function() {
    return (this.info & 0x80) ? 'header' : NEXT_STATES[this.identifier] || 'header';
};

module.exports = Header;
