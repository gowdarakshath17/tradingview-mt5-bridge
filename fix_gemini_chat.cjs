const fs = require('fs');
let content = fs.readFileSync('src/components/GeminiChat.tsx', 'utf8');

content = content.replace(
  'content: data.reply || "I encountered an error generating a response.",',
  'content: data?.reply || "I encountered an error generating a response.",'
).replace(
  'modelUsed: data.modelUsed',
  'modelUsed: data?.modelUsed'
);

fs.writeFileSync('src/components/GeminiChat.tsx', content, 'utf8');
console.log('Fixed GeminiChat.tsx');
