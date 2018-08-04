const Bitfield = require('bitfield');
const fetch = require('node-fetch');
const fs = require('fs');
const {PNG} = require('pngjs');
const QRCode = require('./vendor/qrcode');
const QRErrorCorrectLevel = require('./vendor/qrcode/QRErrorCorrectLevel');

const MESSENGER_CODES_ENDPOINT =
  'https://graph.facebook.com/v3.0/me/messenger_codes'
;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

module.exports = (ref, callback) => {
  fetch(`${MESSENGER_CODES_ENDPOINT}?access_token=${ACCESS_TOKEN}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'standard',
      data: {ref},
      image_size: 1000
    })
  }).then(
    response => response.json()
  ).then(
    ({uri}) => fetch(uri)
  ).then(
    response => response.arrayBuffer()
  ).then(
    buffer => new Promise((resolve, reject) => {
      const png = new PNG();
      png.parse(buffer, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      })
    })
  ).then(imgData => {
    const pixels = imgData.data;
    const data = fs.readFileSync(require.resolve('./mask.png'));
    const png = PNG.sync.read(data);
    const mask = png.data;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) {
        pixels[i] = mask[i];
      }
    }
    const field = new Bitfield(684 + 833);
    let p = 0;
    [[459, 1.875], [426, 2.02225], [393, 2.195], [360, 2.4]].forEach(
      ([r, d]) => {
        const n = (360 / d) | 0;
        let angle = 0;
        for (let i = 0; i < n; i++) {
            const x = (500 + r * Math.cos(-angle * Math.PI / 180)) | 0;
            const y = (500 + r * Math.sin(-angle * Math.PI / 180)) | 0;
            field.set(p++, pixels[(y * 1000 + x) * 4] < 255);
            angle += d;
        }
      }
    );
    const qrcode = new QRCode(4, QRErrorCorrectLevel.Q);
    qrcode.addData(ref);
    qrcode.make();
    const n = qrcode.getModuleCount();
    const modules = qrcode.modules;
    for (let row = 0; row < n; row++) {
      for (var col = 0; col < n; col++) {
        if ((col < 8 || col > 24) && (row < 8 || row > 24)) {
          continue;
        }
        field.set(p++, modules[row][col]);
      }
    }
    callback(null, field.buffer);
  }).catch(callback(err));
};
