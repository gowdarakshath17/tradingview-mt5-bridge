const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(/  app\.listen\(PORT, "0\.0\.0\.0", \(\) => \{\n    console\.log\(\`Server running on http:\/\/0\.0\.0\.0:\$\{PORT\}\`\);\n  \}\);[\s\S]*$/, `  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
  });
}

startServer();
`);
fs.writeFileSync('server.ts', content, 'utf-8');
