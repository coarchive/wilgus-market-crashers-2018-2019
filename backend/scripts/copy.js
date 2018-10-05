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

const pkg = JSON.parse(fs.readFileSync(path.join(backend, 'package.json'), 'utf8'));

fs.writeFileSync(
  path.join(dist, 'package.json'),
  JSON.stringify({
    dependencies: pkg.dependencies,
    name: 'crasher-server',
    version: pkg.version
  })
);

fs.writeFileSync(path.join(dist, 'config.json'), fs.readFileSync(path.join(backend, 'config.json'), 'utf8'));

try {
  fs.unlinkSync(path.join(dist, 'package-lock.json'));
} catch (e) {
  (_ => _)();
}

fs.writeFileSync(path.join(dist, `.${CHBD}`), CHBD);

process.exit(0);
