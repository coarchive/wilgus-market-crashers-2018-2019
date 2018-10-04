const fs = require('fs');
const path = require('path');

const backend = path.join(__dirname, '..');
const dist = path.join(backend, '..', 'dist');
const CHBD = 'COPYHASBEENDONE';

try {
  if (fs.readFileSync(path.join(dist, `.${CHBD}`), 'utf8') === CHBD) {
    process.exit(1);
  }
} catch (e) {
  console.warn('Running Copy Process');
}

const deps = JSON.parse(fs.readFileSync(path.join(backend, 'package.json'), 'utf8')).dependencies;

fs.writeFileSync(
  path.join(dist, 'package.json'),
  JSON.stringify({
    dependencies: deps,
    name: 'LOL, you have to compile the server',
    version: '0.0.1'
  })
);

fs.writeFileSync(path.join(dist, 'config.json'), fs.readFileSync(path.join(backend, 'config.json'), 'utf8'));

fs.writeFileSync(path.join(dist, `.${CHBD}`), CHBD);
