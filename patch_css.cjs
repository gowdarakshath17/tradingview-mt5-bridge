const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// Replace typography block 1
css = css.replace(
`.midnight h1,
.midnight h2,
.midnight h3,
.midnight h4,
.midnight h5,
.midnight h6,
.midnight .text-slate-900,
.midnight .text-slate-800,
.midnight .text-slate-700,
.midnight .text-gray-900,
.midnight .text-gray-800 {
  color: #f8fafc !important;
}`,
`.midnight .text-slate-900,
.midnight .text-slate-800,
.midnight .text-slate-700,
.midnight .text-gray-900,
.midnight .text-gray-800 {
  color: #f8fafc !important;
}`);

// Replace typography block 2
css = css.replace(
`.midnight p,
.midnight span,
.midnight label,
.midnight .text-slate-600,
.midnight .text-slate-500 {
  color: #cbd5e1 !important;
}`,
`.midnight .text-slate-600,
.midnight .text-slate-500 {
  color: #cbd5e1 !important;
}`);

fs.writeFileSync('src/index.css', css, 'utf8');
console.log('CSS patched!');
