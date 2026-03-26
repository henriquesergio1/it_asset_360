const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'components');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    const colors = ['emerald', 'red', 'orange', 'indigo', 'purple', 'gray', 'slate'];

    for (const color of colors) {
        const regex = new RegExp(`bg-${color}-600 hover:bg-${color}-700`, 'g');
        content = content.replace(regex, `bg-${color}-600 dark:bg-${color}-500 hover:bg-${color}-700 dark:hover:bg-${color}-600`);
    }

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
