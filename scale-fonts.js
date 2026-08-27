const fs = require('fs');
let css = fs.readFileSync('app/globals.css', 'utf-8');

// Replace font-size: Xpx with font-size: X+2px
css = css.replace(/font-size:\s*([\d.]+)px/g, (match, p1) => {
  let size = parseFloat(p1);
  // Add 2px to all font sizes
  size += 2;
  return `font-size:${size}px`;
});

// Also replace font: w w Xpx/y font with font: w w X+2px/y font
css = css.replace(/font:\s*([\d\w\s]+)\s+([\d.]+)px\//g, (match, p1, p2) => {
  let size = parseFloat(p2);
  size += 2;
  return `font:${p1} ${size}px/`;
});

fs.writeFileSync('app/globals.css', css);
console.log("Fonts scaled up.");
