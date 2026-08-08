const fs = require('fs');
let content = fs.readFileSync('src/lib/firebase.ts', 'utf8');

content = content.replace(
  "import { \n  getFirestore, \n  doc,",
  "import { \n  getFirestore, \n  initializeFirestore, \n  doc,"
);

const initStr = `    if (firebaseConfig && (firebaseConfig as any).firestoreDatabaseId) {
      db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
    } else {
      db = getFirestore(app);
    }`;

const newInitStr = `    if (firebaseConfig && (firebaseConfig as any).firestoreDatabaseId) {
      db = initializeFirestore(app, { experimentalForceLongPolling: true }, (firebaseConfig as any).firestoreDatabaseId);
    } else {
      db = initializeFirestore(app, { experimentalForceLongPolling: true });
    }`;
content = content.replace(initStr, newInitStr);

fs.writeFileSync('src/lib/firebase.ts', content, 'utf8');
