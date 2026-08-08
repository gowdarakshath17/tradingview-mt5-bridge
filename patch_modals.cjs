const fs = require('fs');

let admin = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
admin = admin.replace('bg-slate-900/60 backdrop-blur-sm', 'bg-black/60 backdrop-blur-sm');
fs.writeFileSync('src/components/AdminPanel.tsx', admin, 'utf8');

let auth = fs.readFileSync('src/components/AuthModal.tsx', 'utf8');
auth = auth.replace('bg-slate-900/40 backdrop-blur-sm', 'bg-black/40 backdrop-blur-sm');
fs.writeFileSync('src/components/AuthModal.tsx', auth, 'utf8');

console.log('Modals patched!');
