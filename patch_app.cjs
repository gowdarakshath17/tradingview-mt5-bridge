const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  "className={`min-h-screen flex flex-col font-sans antialiased transition-colors duration-300 ${theme === 'midnight' ? 'midnight bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-700'}`}",
  "className={`min-h-screen flex flex-col font-sans antialiased transition-colors duration-300 bg-slate-50 text-slate-700 ${theme === 'midnight' ? 'midnight' : ''}`}"
);

fs.writeFileSync('src/App.tsx', app, 'utf8');
console.log('App patched!');
