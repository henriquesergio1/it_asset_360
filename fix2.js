const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/bg-([a-z]+)-([0-9]+)\/[0-9]+\s+dark:bg--/g, (match, color, shade) => {
    if (color === 'slate' || color === 'gray') return `bg-${color}-${shade}/50 dark:bg-slate-800`;
    return `bg-${color}-${shade}/50 dark:bg-${color}-900`;
  });

  content = content.replace(/bg-([a-z]+)-([0-9]+)\s+dark:bg--/g, (match, color, shade) => {
    if (color === 'slate' || color === 'gray') return `bg-${color}-${shade} dark:bg-slate-800`;
    return `bg-${color}-${shade} dark:bg-${color}-900`;
  });
  
  // Also fix any remaining dark:bg-- that didn't match
  content = content.replace(/dark:bg--/g, 'dark:bg-slate-800');

  fs.writeFileSync(filePath, content);
});
console.log('Fixed dark:bg--');
