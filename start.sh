#!/bin/sh

# Start mountebank and load imposters
# This script starts MB, waits for it to be ready, then loads the imposters via Node.js

# Start mountebank in background
mb start --allowInjection --loglevel info &

# Wait for mountebank to be ready
sleep 3

# Load imposters using Node.js (handles function serialization)
node -e "
const http = require('http');
const config = require('/mb/imposters.js');

config.imposters.forEach((imposter) => {
  const data = JSON.stringify(imposter, (key, value) => 
    typeof value === 'function' ? value.toString() : value
  );
  
  const req = http.request({
    hostname: 'localhost',
    port: 2525,
    path: '/imposters',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    res.on('data', () => {});
    res.on('end', () => console.log('Loaded: ' + imposter.name));
  });
  
  req.write(data);
  req.end();
});
"

echo "All imposters loaded!"

# Keep container running
tail -f /dev/null
