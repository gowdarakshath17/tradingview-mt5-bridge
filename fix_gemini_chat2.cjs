const fs = require('fs');
let content = fs.readFileSync('src/components/GeminiChat.tsx', 'utf8');

content = content.replace(
`      try {
        const text = await response.text();
        try {
          data = JSON.parse(text);
          if (!isOk && data.error) {
             errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
          }
        } catch (e) {
          if (!isOk) {
            errorMsg = text || errorMsg;
          } else {
            throw new Error(\`Invalid JSON response: \${text.substring(0, 50)}...\`);
          }
        }
      } catch (e) {
        // failed to read text
      }`,
`      const text = await response.text().catch(() => "");
      try {
        if (text) {
          data = JSON.parse(text);
          if (!isOk && data.error) {
             errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
          }
        }
      } catch (e) {
        if (!isOk) {
          errorMsg = text || errorMsg;
        } else {
          throw new Error(\`Invalid JSON response: \${text.substring(0, 50)}...\`);
        }
      }`
);

fs.writeFileSync('src/components/GeminiChat.tsx', content, 'utf8');
console.log('Fixed GeminiChat.tsx swallowed error');
