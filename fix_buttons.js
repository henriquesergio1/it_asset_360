const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'components');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/bg-blue-600 hover:bg-blue-700/g, 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600');
    content = content.replace(/bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 dark:bg-blue-500/g, 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'); // Clean up duplicates if any

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed ${filePath}`);
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walk(filePath);
        } else if (filePath.endsWith('.tsx')) {
            fixFile(filePath);
        }
    }
}

walk(componentsDir);
