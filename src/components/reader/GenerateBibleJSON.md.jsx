# How to Populate Your GitHub with Bible Data

## 📋 Overview
You need to create JSON files for each Bible translation and upload them to: `https://github.com/buckeye7066/Bible-app`

## 📁 Required File Structure

```
Bible-app/
  ├── translations.json     # Metadata about all translations
  ├── kjv.json             # King James Version (Free)
  ├── esv.json             # English Standard Version (Premium)
  ├── niv.json             # New International Version (Premium)
  ├── nkjv.json            # New King James Version (Premium)
  ├── nlt.json             # New Living Translation (Premium)
  ├── nasb.json            # New American Standard Bible (Premium)
  ├── msg.json             # The Message (Premium)
  └── amp.json             # Amplified Bible (Premium)
```

## 📝 File Format

### `translations.json`
```json
{
  "translations": [
    {
      "id": "KJV",
      "name": "King James Version",
      "language": "en",
      "premium": false,
      "filename": "kjv.json"
    },
    {
      "id": "ESV",
      "name": "English Standard Version",
      "language": "en",
      "premium": true,
      "filename": "esv.json"
    },
    {
      "id": "NIV",
      "name": "New International Version",
      "language": "en",
      "premium": true,
      "filename": "niv.json"
    },
    {
      "id": "NKJV",
      "name": "New King James Version",
      "language": "en",
      "premium": true,
      "filename": "nkjv.json"
    },
    {
      "id": "NLT",
      "name": "New Living Translation",
      "language": "en",
      "premium": true,
      "filename": "nlt.json"
    },
    {
      "id": "NASB",
      "name": "New American Standard Bible",
      "language": "en",
      "premium": true,
      "filename": "nasb.json"
    },
    {
      "id": "MSG",
      "name": "The Message",
      "language": "en",
      "premium": true,
      "filename": "msg.json"
    },
    {
      "id": "AMP",
      "name": "Amplified Bible",
      "language": "en",
      "premium": true,
      "filename": "amp.json"
    }
  ]
}
```

### Each Bible Translation File (e.g., `kjv.json`)
```json
{
  "translation": "KJV",
  "language": "en",
  "books": {
    "Genesis": {
      "chapters": 50,
      "data": {
        "1": {
          "1": "In the beginning God created the heaven and the earth.",
          "2": "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.",
          "3": "And God said, Let there be light: and there was light.",
          "31": "And God saw every thing that he had made, and, behold, it was very good. And the evening and the morning were the sixth day."
        },
        "2": {
          "1": "Thus the heavens and the earth were finished, and all the host of them.",
          "2": "And on the seventh day God ended his work which he had made; and he rested on the seventh day from all his work which he had made."
        }
      }
    },
    "Exodus": {
      "chapters": 40,
      "data": {
        "1": {
          "1": "Now these are the names of the children of Israel, which came into Egypt...",
          "2": "..."
        }
      }
    },
    "Matthew": {
      "chapters": 28,
      "data": {
        "1": {
          "1": "The book of the generation of Jesus Christ, the son of David, the son of Abraham.",
          "2": "..."
        }
      }
    }
  }
}
```

## 🔧 Step-by-Step Instructions

### Step 1: Get Bible Data

**Option A: Use Existing Open Source Bible JSON**
1. Visit: https://github.com/thiagobodruk/bible
2. Download the KJV JSON
3. Convert it to the format above

**Option B: Use Bible API**
1. Sign up at https://scripture.api.bible/
2. Get API keys for different translations
3. Write a script to fetch all verses

**Option C: Use Bolls.Life API**
1. Free API: https://bolls.life/
2. Supports multiple translations
3. No API key needed

### Step 2: Convert to Required Format

Use this Node.js script to convert:

```javascript
// convertBible.js
const fs = require('fs');

// If you have Bible data in a different format, convert it like this:
function convertToAppFormat(rawBibleData, translationId) {
  const result = {
    translation: translationId,
    language: "en",
    books: {}
  };

  // Loop through your raw data and populate result.books
  // Example structure depends on your source data
  
  return result;
}

// Save to file
const kjv = convertToAppFormat(yourKJVData, 'KJV');
fs.writeFileSync('kjv.json', JSON.stringify(kjv, null, 2));
```

### Step 3: Upload to GitHub

```bash
cd Bible-app
git add .
git commit -m "Add Bible translations"
git push origin main
```

### Step 4: Enable GitHub Pages

1. Go to your repo: https://github.com/buckeye7066/Bible-app
2. Click **Settings**
3. Click **Pages** in sidebar
4. Under "Source", select **Deploy from a branch**
5. Select branch: **main**
6. Click **Save**

Your files will be available at:
`https://buckeye7066.github.io/Bible-app/kjv.json`

## 🎯 Quick Start: Create KJV First

Start with just KJV to test:

```bash
# 1. Clone your repo
git clone https://github.com/buckeye7066/Bible-app.git
cd Bible-app

# 2. Download KJV from an open source
# Visit: https://github.com/thiagobodruk/bible
# Or use this quick Python script:

# 3. Create translations.json
cat > translations.json << 'EOF'
{
  "translations": [
    {
      "id": "KJV",
      "name": "King James Version",
      "language": "en",
      "premium": false,
      "filename": "kjv.json"
    }
  ]
}
EOF

# 4. Add your kjv.json file (you'll need to create/download this)

# 5. Push to GitHub
git add .
git commit -m "Add KJV Bible"
git push
```

## 📚 Bible Data Sources

1. **Free KJV**: https://github.com/thiagobodruk/bible
2. **Multiple Translations**: https://scripture.api.bible/
3. **Open Bible Data**: https://github.com/scrollmapper/bible_databases
4. **Bolls.Life API**: https://bolls.life/

## ⚠️ Copyright Notice

**IMPORTANT**: Most modern Bible translations (ESV, NIV, NLT, etc.) are copyrighted. 

- **KJV** is public domain ✅
- **Premium translations** require licensing

For premium translations, you'll need to:
1. Contact copyright holders (Crossway, Zondervan, Tyndale, etc.)
2. Obtain API access or licensing
3. Use their official APIs

## ✅ Test Your Setup

Once files are uploaded and GitHub Pages is enabled:

1. Visit: `https://buckeye7066.github.io/Bible-app/translations.json`
2. Visit: `https://buckeye7066.github.io/Bible-app/kjv.json`
3. Both should return JSON data

Your app will automatically fetch from these URLs! 🎉