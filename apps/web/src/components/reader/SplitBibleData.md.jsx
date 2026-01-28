# Split Bible Data - GitHub 25MB Solution

## 🚨 Problem
GitHub has a 25MB file size limit, and a full Bible JSON exceeds this.

## ✅ Solution
Split the Bible into **one file per book** (66 files per translation).

---

## 📁 New File Structure

```
Bible-app/
  ├── translations.json
  ├── kjv/
  │   ├── genesis.json
  │   ├── exodus.json
  │   ├── leviticus.json
  │   ├── numbers.json
  │   ├── deuteronomy.json
  │   ├── joshua.json
  │   ├── judges.json
  │   ├── ruth.json
  │   ├── 1-samuel.json
  │   ├── 2-samuel.json
  │   ├── 1-kings.json
  │   ├── 2-kings.json
  │   ├── 1-chronicles.json
  │   ├── 2-chronicles.json
  │   ├── ezra.json
  │   ├── nehemiah.json
  │   ├── esther.json
  │   ├── job.json
  │   ├── psalms.json
  │   ├── proverbs.json
  │   ├── ecclesiastes.json
  │   ├── song-of-solomon.json
  │   ├── isaiah.json
  │   ├── jeremiah.json
  │   ├── lamentations.json
  │   ├── ezekiel.json
  │   ├── daniel.json
  │   ├── hosea.json
  │   ├── joel.json
  │   ├── amos.json
  │   ├── obadiah.json
  │   ├── jonah.json
  │   ├── micah.json
  │   ├── nahum.json
  │   ├── habakkuk.json
  │   ├── zephaniah.json
  │   ├── haggai.json
  │   ├── zechariah.json
  │   ├── malachi.json
  │   ├── matthew.json
  │   ├── mark.json
  │   ├── luke.json
  │   ├── john.json
  │   ├── acts.json
  │   ├── romans.json
  │   ├── 1-corinthians.json
  │   ├── 2-corinthians.json
  │   ├── galatians.json
  │   ├── ephesians.json
  │   ├── philippians.json
  │   ├── colossians.json
  │   ├── 1-thessalonians.json
  │   ├── 2-thessalonians.json
  │   ├── 1-timothy.json
  │   ├── 2-timothy.json
  │   ├── titus.json
  │   ├── philemon.json
  │   ├── hebrews.json
  │   ├── james.json
  │   ├── 1-peter.json
  │   ├── 2-peter.json
  │   ├── 1-john.json
  │   ├── 2-john.json
  │   ├── 3-john.json
  │   ├── jude.json
  │   └── revelation.json
  ├── esv/
  │   ├── genesis.json
  │   └── ... (same 66 books)
  ├── niv/
  │   └── ... (same 66 books)
```

---

## 📝 File Format

### `translations.json` (Same as before)
```json
{
  "translations": [
    {
      "id": "KJV",
      "name": "King James Version",
      "language": "en",
      "premium": false,
      "folder": "kjv"
    },
    {
      "id": "ESV",
      "name": "English Standard Version",
      "language": "en",
      "premium": true,
      "folder": "esv"
    }
  ]
}
```

### Each Book File (e.g., `kjv/genesis.json`)
```json
{
  "book": "Genesis",
  "translation": "KJV",
  "chapters": {
    "1": {
      "1": "In the beginning God created the heaven and the earth.",
      "2": "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.",
      "3": "And God said, Let there be light: and there was light.",
      "4": "And God saw the light, that it was good: and God divided the light from the darkness.",
      "5": "And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.",
      "31": "And God saw every thing that he had made, and, behold, it was very good. And the evening and the morning were the sixth day."
    },
    "2": {
      "1": "Thus the heavens and the earth were finished, and all the host of them.",
      "2": "And on the seventh day God ended his work which he had made; and he rested on the seventh day from all his work which he had made.",
      "3": "And God blessed the seventh day, and sanctified it: because that in it he had rested from all his work which God created and made."
    },
    "3": {
      "1": "Now the serpent was more subtil than any beast of the field which the LORD God had made..."
    }
  }
}
```

---

## 🔧 Python Script to Split Bible

```python
import json
import os

def split_bible_by_book(input_file, output_dir, translation_id):
    """
    Split a full Bible JSON into separate book files
    
    Args:
        input_file: Path to the full Bible JSON
        output_dir: Directory to save split files (e.g., 'kjv/')
        translation_id: Translation ID (e.g., 'KJV')
    """
    # Load the full Bible
    with open(input_file, 'r', encoding='utf-8') as f:
        bible = json.load(f)
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Assuming the Bible JSON has a structure like:
    # { "books": { "Genesis": { "chapters": { "1": { "1": "text", ... } } } } }
    
    if 'books' in bible:
        for book_name, book_data in bible['books'].items():
            # Create filename (lowercase, hyphens)
            filename = book_name.lower().replace(' ', '-') + '.json'
            filepath = os.path.join(output_dir, filename)
            
            # Create book JSON
            book_json = {
                'book': book_name,
                'translation': translation_id,
                'chapters': book_data.get('chapters', book_data.get('data', {}))
            }
            
            # Save to file
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(book_json, f, ensure_ascii=False, indent=2)
            
            print(f"Created {filename}")
    
    print(f"✅ Split complete! {len(bible.get('books', {}))} books created in {output_dir}")

# Example usage:
if __name__ == '__main__':
    # If you downloaded a Bible JSON like this structure:
    # { "books": { "Genesis": { "data": { "1": { "1": "text" } } } } }
    
    split_bible_by_book(
        input_file='kjv-full.json',    # Your downloaded KJV
        output_dir='kjv',               # Output folder
        translation_id='KJV'
    )
```

---

## 🔧 Node.js Script to Split Bible

```javascript
const fs = require('fs');
const path = require('path');

function splitBibleByBook(inputFile, outputDir, translationId) {
  // Read the full Bible JSON
  const bible = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Split by book
  const books = bible.books || bible;
  
  for (const [bookName, bookData] of Object.entries(books)) {
    // Create filename
    const filename = bookName.toLowerCase().replace(/\s+/g, '-') + '.json';
    const filepath = path.join(outputDir, filename);
    
    // Create book JSON
    const bookJson = {
      book: bookName,
      translation: translationId,
      chapters: bookData.chapters || bookData.data || bookData
    };
    
    // Save to file
    fs.writeFileSync(filepath, JSON.stringify(bookJson, null, 2));
    console.log(`Created ${filename}`);
  }
  
  console.log(`✅ Split complete! Books created in ${outputDir}`);
}

// Usage:
splitBibleByBook('kjv-full.json', 'kjv', 'KJV');
```

---

## 📥 Quick Start with Pre-Split Data

### Option 1: Use Existing Split Bible
Some repos already have split Bible data:
- https://github.com/seven1m/open-bibles (has split KJV)
- https://github.com/scrollmapper/bible_databases (SQL, can export to JSON)

### Option 2: Use Bolls.Life API
Fetch each book individually from API:

```python
import requests
import json
import os

def download_bible_book(translation, book_id, book_name):
    """Download a single book from Bolls.Life API"""
    url = f"https://bolls.life/get-paralel-books/{translation}/{book_id}/"
    response = requests.get(url)
    
    if response.status_code == 200:
        data = response.json()
        # Transform to our format
        chapters = {}
        
        for verse in data:
            chapter = str(verse['chapter'])
            verse_num = str(verse['verse'])
            text = verse['text']
            
            if chapter not in chapters:
                chapters[chapter] = {}
            
            chapters[chapter][verse_num] = text
        
        return {
            'book': book_name,
            'translation': translation.upper(),
            'chapters': chapters
        }
    
    return None

# Example: Download Genesis from KJV
book_data = download_bible_book('KJV', 1, 'Genesis')
if book_data:
    os.makedirs('kjv', exist_ok=True)
    with open('kjv/genesis.json', 'w') as f:
        json.dump(book_data, f, indent=2)
```

---

## 📋 Book ID Mapping (for APIs)

```python
BIBLE_BOOKS = [
    (1, "Genesis"), (2, "Exodus"), (3, "Leviticus"), (4, "Numbers"),
    (5, "Deuteronomy"), (6, "Joshua"), (7, "Judges"), (8, "Ruth"),
    (9, "1 Samuel"), (10, "2 Samuel"), (11, "1 Kings"), (12, "2 Kings"),
    (13, "1 Chronicles"), (14, "2 Chronicles"), (15, "Ezra"), (16, "Nehemiah"),
    (17, "Esther"), (18, "Job"), (19, "Psalms"), (20, "Proverbs"),
    (21, "Ecclesiastes"), (22, "Song of Solomon"), (23, "Isaiah"), (24, "Jeremiah"),
    (25, "Lamentations"), (26, "Ezekiel"), (27, "Daniel"), (28, "Hosea"),
    (29, "Joel"), (30, "Amos"), (31, "Obadiah"), (32, "Jonah"),
    (33, "Micah"), (34, "Nahum"), (35, "Habakkuk"), (36, "Zephaniah"),
    (37, "Haggai"), (38, "Zechariah"), (39, "Malachi"), (40, "Matthew"),
    (41, "Mark"), (42, "Luke"), (43, "John"), (44, "Acts"),
    (45, "Romans"), (46, "1 Corinthians"), (47, "2 Corinthians"), (48, "Galatians"),
    (49, "Ephesians"), (50, "Philippians"), (51, "Colossians"), (52, "1 Thessalonians"),
    (53, "2 Thessalonians"), (54, "1 Timothy"), (55, "2 Timothy"), (56, "Titus"),
    (57, "Philemon"), (58, "Hebrews"), (59, "James"), (60, "1 Peter"),
    (61, "2 Peter"), (62, "1 John"), (63, "2 John"), (64, "3 John"),
    (65, "Jude"), (66, "Revelation")
]
```

---

## 🚀 Upload to GitHub

```bash
cd Bible-app

# Add all files
git add translations.json kjv/ esv/ niv/

# Commit
git commit -m "Add split Bible data"

# Push
git push origin main
```

---

## ✅ Benefits of This Approach

1. **No GitHub limits** - Each file < 1MB
2. **Faster loading** - Only load the book you need
3. **Better caching** - Browser caches each book separately
4. **More efficient** - Don't load 31,000 verses to read Genesis 1

---

## 🎯 Test Your Setup

Visit these URLs:
- `https://buckeye7066.github.io/Bible-app/translations.json`
- `https://buckeye7066.github.io/Bible-app/kjv/genesis.json`
- `https://buckeye7066.github.io/Bible-app/kjv/john.json`

Your app will now fetch individual books as needed! 🎉