const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert(html.includes("window.location.hostname === 'localhost'"), 'Localhost fallback should be present');
assert(html.includes("https://notepad-v1j7.onrender.com/api/run"), 'Remote backend URL should be present');
assert(html.includes("GitHub Pages"), 'GitHub Pages guidance should be present');
console.log('GitHub Pages compatibility checks passed.');
