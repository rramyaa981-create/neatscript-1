# ✍️ NeatScript — AI Handwriting Converter

> Turn messy handwritten notes into beautiful handwritten pages using AI OCR

---

## ✨ Features
- 📸 Upload JPG/PNG of handwritten notes
- 🤖 AI OCR — supports Hindi + English mixed content  
- ✏️ Editable text panel before generating
- 🖋️ Ball Pen & Gel Pen styles
- 🎨 Blue & Black ink options
- 📄 Auto multi-page support for long notes
- ⬇️ Download as high-res PNG (1080 × 1350 px)
- 🔑 API key stored in browser (no backend needed)

---

## 🚀 Deploy to Vercel (Zero Config)

### Option A — GitHub Import (Recommended)

1. **Upload to GitHub**
   - Go to [github.com](https://github.com) → New Repository → name it `neatscript`
   - Click "uploading an existing file"
   - Drag and drop ALL files from this ZIP (unzipped) → Commit

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com) → Add New Project
   - Select your `neatscript` repository
   - Vercel auto-detects Vite — just click **Deploy**
   - ✅ Live in ~90 seconds!

### Option B — Vercel CLI

```bash
npm install -g vercel
cd neatscript
vercel deploy
```

---

## 🔑 API Key Setup

After deployment, open your live site and:
1. Get a free key at [console.anthropic.com](https://console.anthropic.com)
2. Paste it into the **🔑 API Key** field at the top of the page
3. Key is saved in your browser — you only need to do this once

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
neatscript/
├── index.html          ← HTML entry point
├── package.json        ← Dependencies & scripts
├── vite.config.js      ← Vite build config
├── vercel.json         ← Vercel deployment config
├── .nvmrc              ← Node version pin
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx        ← React entry point
    └── App.jsx         ← Full application
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 |
| Build Tool | Vite 5 |
| Handwriting | HTML Canvas API |
| OCR | Anthropic Claude API |
| Fonts | Google Fonts (Caveat, Kalam) |
| Hosting | Vercel |
