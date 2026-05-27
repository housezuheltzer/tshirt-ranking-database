const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. Get API Key from arguments
const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Error: Please provide your Logo.dev API key as an argument.');
  console.error('Usage: node fetch_logos.js YOUR_API_KEY');
  process.exit(1);
}

// 2. Ensure directories exist
const imagesDir = path.join(__dirname, 'images');
const logosDir = path.join(imagesDir, 'logos');

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir);
}

// 3. Read data.js content and parse GARMENTS
const dataPath = path.join(__dirname, 'data.js');
if (!fs.existsSync(dataPath)) {
  console.error(`Error: data.js not found at ${dataPath}`);
  process.exit(1);
}

const dataContent = fs.readFileSync(dataPath, 'utf8');
const sandbox = { GARMENTS: [] };
const evalFn = new Function('sandbox', dataContent + '\nsandbox.GARMENTS = GARMENTS;');
evalFn(sandbox);

const brands = [...new Set(sandbox.GARMENTS.map(g => g.brand))].sort();
console.log(`Found ${brands.length} unique brands. Starting logo download...\n`);

// Hardcoded overrides mapping brand name to their verified domain for Logo.dev lookup
const BRAND_OVERRIDES = {
  "ATON": "aton-tokyo.com",
  "MAN-TLE": "man-tle.com",
  "Veilance": "veilance.com",
  "Kirkland Signature": "costco.com",
  "COMOLI": "comoli.jp",
  "Handvaerk": "handvaerk.com",
  "LSKD": "lskd.co"
};

// Brands that should not have a logo (fallback to text initial)
const BRANDS_TO_SKIP = [
  "The Real McCoy's",
  "Whitesville",
  "nonnotte"
];

// Helper to download image
function downloadLogo(brandName) {
  if (BRANDS_TO_SKIP.includes(brandName)) {
    console.log(`- Skipped logo download for: ${brandName} (fallback active)`);
    return Promise.resolve(false);
  }

  const slug = brandName.toLowerCase().replace(/\s+/g, '-');
  const filename = `${slug}.png`;
  const destPath = path.join(logosDir, filename);

  let url;
  if (BRAND_OVERRIDES[brandName]) {
    const domain = BRAND_OVERRIDES[brandName];
    url = `https://img.logo.dev/${domain}?token=${apiKey}&size=128&format=png`;
  } else {
    // URL encode the brand name
    const encodedName = encodeURIComponent(brandName);
    url = `https://img.logo.dev/name/${encodedName}?token=${apiKey}&size=128&format=png`;
  }

  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✓ Downloaded logo for: ${brandName}`);
          resolve(true);
        });
      } else {
        file.close();
        fs.unlinkSync(destPath); // Remove empty/failed file
        console.log(`✗ Failed to find logo for: ${brandName} (HTTP ${response.statusCode})`);
        resolve(false);
      }
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      console.log(`✗ Error downloading logo for: ${brandName} - ${err.message}`);
      resolve(false);
    });
  });
}

// Download sequentially to avoid hitting rate limits or overwhelming connection
async function main() {
  let successCount = 0;
  for (const brand of brands) {
    const success = await downloadLogo(brand);
    if (success) successCount++;
    // Small delay between requests to be polite
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`\nFinished! Successfully downloaded ${successCount}/${brands.length} logos to: ${logosDir}`);
}

main();
