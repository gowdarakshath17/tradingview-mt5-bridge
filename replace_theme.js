const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Backgrounds & Borders (Deep Midnight Blue)
    content = content.replace(/bg-\[#0[aA]0[cC]10\]/g, 'bg-[#060B19]');
    content = content.replace(/bg-\[#11141[aA]\]/g, 'bg-[#0B1225]');
    content = content.replace(/bg-\[#161[aA]23\]/g, 'bg-[#121B33]');
    content = content.replace(/bg-\[#1[aA]1[fF]2[cC]\]/g, 'bg-[#192543]');
    
    content = content.replace(/border-\[#1[eE]2330\]/g, 'border-[#1E2C4F]');
    content = content.replace(/border-\[#232936\]/g, 'border-[#263760]');

    // Replace indigo with amber (gold accent)
    content = content.replace(/indigo-400/g, 'amber-400');
    content = content.replace(/indigo-500/g, 'amber-500');
    content = content.replace(/indigo-600/g, 'amber-600');
    content = content.replace(/indigo-900\/30/g, 'amber-900/30');
    content = content.replace(/indigo-950\/25/g, 'amber-950/25');
    content = content.replace(/indigo-950\/45/g, 'amber-950/45');
    content = content.replace(/indigo-500\/10/g, 'amber-500/10');
    content = content.replace(/indigo-500\/20/g, 'amber-500/20');

    // Replace emerald with teal for a more institutional look, or leave it. Let's keep emerald but maybe adjust to emerald-400/emerald-500
    // Red stays rose or red.

    fs.writeFileSync(filePath, content, 'utf8');
}

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
            replaceInFile(fullPath);
        }
    }
}

processDir('./src');
console.log('Done!');
