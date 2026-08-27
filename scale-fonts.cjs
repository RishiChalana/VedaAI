const fs = require('fs');
let css = fs.readFileSync('app/globals.css', 'utf-8');

css = css.replace(/font-size:\s*([\d.]+)px/g, (match, p1) => {
  let size = parseFloat(p1);
  // Add 2.5px to all font sizes
  size += 2.5;
  return `font-size:${size}px`;
});

css = css.replace(/font:\s*([\d\w\s]+)\s+([\d.]+)px\//g, (match, p1, p2) => {
  let size = parseFloat(p2);
  size += 2.5;
  return `font:${p1} ${size}px/`;
});

fs.writeFileSync('app/globals.css', css);
console.log("Fonts scaled up by 2.5px.");
