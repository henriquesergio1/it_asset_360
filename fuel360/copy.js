const fs = require('fs');
const content = fs.readFileSync('components/RoteirizadorVendedores.tsx', 'utf8');
const newContent = content.replace(/RoteirizadorVendedores/g, 'RoteirizadorPromotores');
fs.writeFileSync('components/RoteirizadorPromotores.tsx', newContent);
console.log('Done');
