const fs = require('fs');

const input = fs.readFileSync('raw_input.csv', 'utf8').trim().split(/\r?\n/);

input.shift();

const result = [];


for (const rawLine of input) {
  const line = rawLine.trim();
  if (!line) continue;

  const match = rawLine.split(",");
  if (!match) {
    console.error('Cant parse line:', rawLine);
    continue;
  }

  const address = match[0];
  const amount = match[1];

  result.push({ address, amount });
}


fs.writeFileSync('raw_output.json', JSON.stringify(result, null, 2), 'utf8');
console.log('Result: raw_output.json');
