const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

css = css.replace(
`.midnight .border,
.midnight .border-slate-100,
.midnight .border-slate-200,
.midnight .border-slate-300 {
  border-color: #1e293b !important;
}`,
`.midnight .border-slate-100,
.midnight .border-slate-200,
.midnight .border-slate-300 {
  border-color: #1e293b !important;
}`);

fs.writeFileSync('src/index.css', css, 'utf8');
console.log('CSS patched border!');
