'use strict';

// 256-entry LUT: 1 byte -> 2 hex chars
const HEX_LUT = new Array(256);
for (let i = 0; i < 256; i++) {
  HEX_LUT[i] = (i < 16 ? '0' : '') + i.toString(16);
}

function UUID(binaryData, offset) {
  const b = binaryData;
  const o = offset;

  // Byte-Zugriffe
  const b0 = b[o], b1 = b[o+1], b2 = b[o+2], b3 = b[o+3];
  const b4 = b[o+4], b5 = b[o+5], b6 = b[o+6], b7 = b[o+7];
  const b8 = b[o+8], b9 = b[o+9], b10 = b[o+10], b11 = b[o+11];
  const b12 = b[o+12], b13 = b[o+13], b14 = b[o+14], b15 = b[o+15];

  // LUT-Zugriffe
  const h0 = HEX_LUT[b0], h1 = HEX_LUT[b1], h2 = HEX_LUT[b2], h3 = HEX_LUT[b3];
  const h4 = HEX_LUT[b4], h5 = HEX_LUT[b5], h6 = HEX_LUT[b6], h7 = HEX_LUT[b7];
  const h8 = HEX_LUT[b8], h9 = HEX_LUT[b9], h10 = HEX_LUT[b10], h11 = HEX_LUT[b11];
  const h12 = HEX_LUT[b12], h13 = HEX_LUT[b13], h14 = HEX_LUT[b14], h15 = HEX_LUT[b15];

  // Nach swap32: [b3, b2, b1, b0] -> hex(b3) + hex(b2) + hex(b1) + hex(b0)
  // Nach swap16: [b5, b4] -> hex(b5) + hex(b4)
  // Nach swap16: [b7, b6] -> hex(b7) + hex(b6)
  // Kein swap: [b8..b15] -> hex(b8) + ... + hex(b15)
  this.string = h3 + h2 + h1 + h0 + '-' + h5 + h4 + '-' + h7 + h6 + '-' + h8 + h9 + h10 + h11 + h12 + h13 + h14 + h15;
  this.data_length = 16;
}

module.exports = UUID;
