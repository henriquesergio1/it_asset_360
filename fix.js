const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Example: bg-blue-50 dark:bg--
  // Replace with bg-blue-50 dark:bg-blue-900
  content = content.replace(/bg-([a-z]+)-([0-9]+)\s+dark:bg--/g, (match, color, shade) => {
    // If it's slate, usually it was slate-800 or slate-900
    if (color === 'slate') return `bg-${color}-${shade} dark:bg-slate-800`;
    // Otherwise, usually it was color-900
    return `bg-${color}-${shade} dark:bg-${color}-900`;
  });
  
  // What if it was dark:bg-- without a preceding bg-color?
  // Let's check if there are any left.
  
  fs.writeFileSync(filePath, content);
});
console.log('Fixed colors');
