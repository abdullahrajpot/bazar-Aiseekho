const fs = require('fs');
const path = require('path');

const dirs = [
  path.join(__dirname, 'node_modules', 'react-native-maps', 'android', 'src', 'main', 'java', 'com', 'facebook', 'react', 'viewmanagers'),
  path.join(__dirname, 'node_modules', 'react-native-gesture-handler', 'android', 'paper', 'src', 'main', 'java', 'com', 'facebook', 'react', 'viewmanagers'),
];

for (const dir of dirs) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.java'));
    for (const file of files) {
      const filePath = path.join(dir, file);
      let content = fs.readFileSync(filePath, 'utf8');

      // Remove the import
      content = content.replace(/import com\.facebook\.react\.uimanager\.ViewManagerWithGeneratedInterface;\n/g, '');

      // Remove the extends clause
      content = content.replace(/ extends ViewManagerWithGeneratedInterface/g, '');

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Patched ${file}`);
    }
  } else {
    console.warn('Directory not found:', dir);
  }
}
console.log('Patching complete.');
