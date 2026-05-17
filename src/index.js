'use strict';

const path = require('path');
const { createGateway } = require('./server/create-gateway');

function start(options = {}) {
  const packageRoot = options.packageRoot || path.join(__dirname, '..');
  const gateway = createGateway({ packageRoot });
  return gateway.start(options.listen);
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { createGateway, start };
