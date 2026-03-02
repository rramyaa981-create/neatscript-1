import { useState, useRef, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────
const FONTS = {
  ballpen: {
    name: 'Caveat',
    url: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&display=swap',
    size: 30,
    lineHeight: 56,
    weight: '400',
  },
  gelpen: {
    name: 'Kalam',
    url: 'https://fonts.googleapis.com/css2?family=Kalam:wght@300;400&display=swap',
    size: 28,
    lineHeight: 54,
    weight: '300',
  },
}

const COLORS = { blue: '#1a3a8a', black: '#1a1a1a' }

// ─────────────────────────────────────────────
//  Canvas helpers
// ─────────────────────────────────────────────
function drawRuledPage(ctx, W, H, marginTop, lineH) {
  // paper background
  ctx.fillStyle = '#fefdf8'
  ctx.fillRect(0, 0, W, H)

  // ruled lines
  ctx.strokeStyle = 'rgba(173,198,230,0.42)'
  ctx.lineWidth = 1
  for (let y = marginTop; y < H - 50; y += lineH) {
    ctx.beginPath()
    ctx.moveTo(55, y)
    ctx.lineTo(W - 55, y)
    ctx.stroke()
  }

  // red margin
  ctx.strokeStyle = 'rgba(220,80,80,0.22)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(90, 50)
  ctx.lineTo(90, H - 50)
  ctx.stroke()

  // top / bottom tint bands
  ctx.fillStyle = 'rgba(99,120,210,0.07)'
  ctx.fillRect(0, 0, W, 52)
  ctx.fillStyle = 'rgba(99,120,210,0.05)'
  ctx.fillRect(0, H - 40, W, 40)
}

function buildWrappedLines(ctx, text, maxWidth, font) {
  const result = []
  const paragraphs = text.split('\n')

  for (const para of paragraphs) {
    if (para.trim() === '') {
      result.push({ text: '', blank: true })
      continue
    }

    const isHeading =
      /^[A-Z0-9\u0900-\u097F].*:$/.test(para.trim()) ||
      (/^[A-Z\s\u0900-\u097F]{3,}$/.test(para.trim()) && para.trim().length < 55)

    ctx.font = isHeading
      ? `600 ${font.size + 2}px '${font.name}', cursive`
      : `${font.weight} ${font.size}px '${font.name}', cursive`

    const words = para.split(' ')
    let current = ''

    for (const word of words) {
      const test = current ? current + ' ' + word : word
      if (ctx.measureText(test).width > maxWidth && current) {
        result.push({ text: current, isHeading })
        current = word
      } else {
        current = test
      }
    }
    if (current) result.push({ text: current, isHeading })
  }

  return result
}

async function renderAllPages(text, style, inkColor) {
  const W = 1080
  const H = 1350
  const MARGIN_TOP = 108
  const MARGIN_LEFT = 100
  const MARGIN_RIGHT = 80
  const usableWidth = W - MARGIN_LEFT - MARGIN_RIGHT
  const font = FONTS[style]
  const color = COLORS[inkColor]

  // Wait for fonts to be ready
  try {
    await Promise.all([
      document.fonts.load(`${font.weight} ${font.size}px '${font.name}'`),
      document.fonts.load(`600 ${font.size + 2}px '${font.name}'`),
    ])
  } catch (_) {
    // continue even if Font Loading API fails in some browsers
  }

  // Extra settle time so font glyphs are rendered
  await new Promise((r) => setTimeout(r, 300))

  // Measure canvas (off-screen)
  const measureCanvas = document.createElement('canvas')
  measureCanvas.width = W
  measureCanvas.height = H
  const mctx = measureCanvas.getContext('2d')
  mctx.font = `${font.weight} ${font.size}px '${font.name}', cursive`

  const allLines = buildWrappedLines(mctx, text, usableWidth, font)

  // Paginate lines
  const LINES_PER_PAGE = Math.floor((H - MARGIN_TOP - 70) / font.lineHeight)
  const pages = []
  let currentPage = []
  let lineCount = 0

  for (const line of allLines) {
    if (line.blank) {
      currentPage.push(line)
      lineCount += 0.5 // blank lines count as half
    } else {
      if (lineCount >= LINES_PER_PAGE) {
        pages.push(currentPage)
        currentPage = []
        lineCount = 0
      }
      currentPage.push(line)
      lineCount += 1
    }
  }
  if (currentPage.length > 0) pages.push(currentPage)
  if (pages.length === 0) pages.push([])

  // Render each page to a dataURL
  const dataUrls = []
  const totalPages = pages.length

  for (let pi = 0; pi < totalPages; pi++) {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    drawRuledPage(ctx, W, H, MARGIN_TOP, font.lineHeight)

    // Page number footer
    ctx.fillStyle = 'rgba(120,130,160,0.45)'
    ctx.font = '400 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`— ${pi + 1} / ${totalPages} —`, W / 2, H - 14)
    ctx.textAlign = 'left'

    // Write lines
    ctx.fillStyle = color
    ctx.textBaseline = 'alphabetic'
    let y = MARGIN_TOP + font.size + 4

    for (const line of pages[pi]) {
      if (line.blank) {
        y += font.lineHeight * 0.55
        continue
      }
      if (line.isHeading) {
        ctx.font = `600 ${font.size + 2}px '${font.name}', cursive`
      } else {
        ctx.font = `${font.weight} ${font.size}px '${font.name}', cursive`
      }
      ctx.fillText(line.text, MARGIN_LEFT, y)
      y += font.lineHeight
    }

    dataUrls.push(canvas.toDataURL('image/png', 1.0))
  }

  return dataUrls
}

// ─────────────────────────────────────────────
//  Reliable cross-browser PNG download
// ─────────────────────────────────────────────
function downloadPng(dataUrl, filename) {
  try {
    const byteString = atob(dataUrl.split(',')[1])
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }
    const blob = new Blob([ab], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch (err) {
    console.error('Download failed:', err)
    // Fallback: open in new tab
    const win = window.open()
    if (win) {
      win.document.write(`<img src="${dataUrl}" style="max-width:100%"/>`)
      win.document.title = filename
    }
  }
}

// ─────────────────────────────────────────────
//  OCR via Anthropic API
// ─────────────────────────────────────────────
async function runOCR(file, apiKey) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.type,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `You are a precise OCR engine. Extract ALL visible text from this handwritten notes image.

STRICT RULES — follow exactly:
1. Output ONLY the raw extracted text. No explanations, no markdown code blocks, no preamble.
2. Preserve EXACT wording — do NOT paraphrase, summarize, translate, or fix grammar.
3. Preserve all line breaks and paragraph spacing using actual newlines.
4. Keep headings on their own line; if they end with a colon, keep it.
5. Convert all bullet points to the • symbol. Keep numbered lists exactly as-is.
6. Keep all math symbols exactly: +, −, ×, ÷, =, ≠, ², ³, √, fractions like 1/2, 3/4.
7. Support Hindi (Devanagari script) and English mixed content — preserve both languages.
8. If a word is unclear or illegible, keep your best guess or write [unclear].
9. Do NOT add any title, header, or introduction before the text.
10. Start your output immediately with the very first word of the notes.`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    let errMsg = `API error (${response.status})`
    try {
      const errData = await response.json()
      errMsg = errData?.error?.message || errMsg
    } catch (_) {}
    throw new Error(errMsg)
  }

  const data = await response.json()
  const text = data.content?.map((c) => c.text || '').join('\n').trim() || ''
  if (!text) throw new Error('No text could be detected. Try a clearer image.')
  return text
}

// ─────────────────────────────────────────────
//  Styles (injected once)
// ─────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { -webkit-font-smoothing: antialiased; font-family: 'DM Sans', sans-serif; }

.card {
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.95);
  box-shadow: 0 6px 30px rgba(79,70,229,0.07), 0 1px 3px rgba(0,0,0,0.04);
  animation: fadeUp 0.35s ease both;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: none; }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 13px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s, background 0.15s;
  text-decoration: none;
  white-space: nowrap;
}
.btn-primary {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  padding: 14px 28px;
  box-shadow: 0 4px 18px rgba(79,70,229,0.32);
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(79,70,229,0.42);
}
.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}
.btn-ghost {
  background: white;
  color: #4f46e5;
  border: 2px solid #c7d2fe;
  padding: 11px 22px;
  font-size: 14px;
}
.btn-ghost:hover { background: #eef2ff; border-color: #818cf8; }

.opt-btn {
  padding: 9px 20px;
  border-radius: 10px;
  border: 2px solid #e2e8f0;
  background: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  color: #475569;
  font-family: inherit;
}
.opt-btn.on {
  border-color: #4f46e5;
  background: #eef2ff;
  color: #4f46e5;
  font-weight: 600;
}

textarea {
  width: 100%;
  border: 1.5px solid #dde1f0;
  border-radius: 14px;
  padding: 16px 18px;
  font-size: 15px;
  line-height: 1.85;
  resize: vertical;
  outline: none;
  font-family: inherit;
  color: #1e293b;
  background: #f9faff;
  transition: border-color 0.2s, background 0.2s;
  min-height: 260px;
}
textarea:focus { border-color: #6366f1; background: #fff; }

.api-input {
  flex: 1;
  border: 1.5px solid #dde1f0;
  border-radius: 11px;
  padding: 11px 14px;
  font-size: 14px;
  color: #1e293b;
  background: #f9faff;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  min-width: 0;
}
.api-input:focus { border-color: #6366f1; background: #fff; }

.step-dot {
  width: 9px; height: 9px;
  border-radius: 50%;
  background: #c7d2fe;
  transition: all 0.3s;
}
.step-dot.on   { background: #4f46e5; transform: scale(1.35); }
.step-dot.done { background: #a5b4fc; }

.spinner {
  width: 18px; height: 18px;
  border: 2.5px solid rgba(255,255,255,0.35);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.drop-zone {
  border: 2px dashed #c7d2fe;
  border-radius: 18px;
  padding: 44px 20px;
  text-align: center;
  cursor: pointer;
  background: #f8f9ff;
  transition: all 0.2s;
  user-select: none;
}
.drop-zone.over { border-color: #4f46e5; background: #eef2ff; }
.drop-zone:hover { border-color: #818cf8; }

.error-box {
  background: #fff1f2;
  border: 1.5px solid #fecdd3;
  border-radius: 12px;
  padding: 12px 16px;
  color: #be123c;
  font-size: 14px;
  margin-bottom: 16px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.success-badge {
  font-size: 12px;
  color: #16a34a;
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.color-swatch {
  width: 30px; height: 30px;
  border-radius: 50%;
  cursor: pointer;
  border: 3px solid transparent;
  transition: all 0.15s;
  outline: 2px solid transparent;
  outline-offset: 2px;
}
.color-swatch.on {
  border-color: white;
  outline-color: #4f46e5;
  transform: scale(1.18);
}

.page-thumb {
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 3px solid transparent;
  transition: border-color 0.15s, transform 0.15s;
  flex-shrink: 0;
  background: #f1f5f9;
}
.page-thumb:hover  { transform: translateY(-2px); }
.page-thumb.active { border-color: #4f46e5; }

.preview-wrap {
  border-radius: 16px;
  overflow: hidden;
  background: #f1f5f9;
  padding: 16px;
  display: flex;
  justify-content: center;
  box-shadow: inset 0 2px 8px rgba(0,0,0,0.06);
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 10px;
}

.info-link {
  color: #6366f1;
  text-decoration: none;
}
.info-link:hover { text-decoration: underline; }

@media (max-width: 600px) {
  .btn-primary { padding: 13px 20px; font-size: 14px; }
  .btn-ghost   { padding: 10px 16px; font-size: 13px; }
}
`

// ─────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────
export default function App() {
  // Persistent API key in localStorage
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('neatscript_apikey') || '' } catch (_) { return '' }
  })
  const [showKey, setShowKey] = useState(false)

  const [image, setImage]         = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [editableText, setEditableText] = useState('')
  const [penStyle, setPenStyle]   = useState('ballpen')
  const [inkColor, setInkColor]   = useState('blue')

  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const [pages, setPages]           = useState([])
  const [activePage, setActivePage] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [step, setStep]             = useState(1)  // 1=upload  2=edit  3=preview
  const [error, setError]           = useState('')

  const fileInputRef = useRef(null)

  // Inject global CSS once
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = GLOBAL_CSS
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  // Load handwriting fonts
  useEffect(() => {
    const links = Object.values(FONTS).map((f) => {
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = f.url
      document.head.appendChild(l)
      return l
    })
    return () => links.forEach((l) => document.head.removeChild(l))
  }, [])

  const saveApiKey = (value) => {
    setApiKey(value)
    try { localStorage.setItem('neatscript_apikey', value) } catch (_) {}
  }

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.match(/image\/(jpeg|png)/)) {
      setError('Please upload a JPG or PNG image.')
      return
    }
    setError('')
    setImageFile(file)
    setImage(URL.createObjectURL(file))
    setStep(1)
    setPages([])
    setEditableText('')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const extractText = async () => {
    if (!imageFile) return
    if (!apiKey.trim()) {
      setError('Please enter your Anthropic API key first (see the key section above).')
      return
    }
    setIsExtracting(true)
    setError('')
    try {
      const text = await runOCR(imageFile, apiKey.trim())
      setEditableText(text)
      setStep(2)
    } catch (e) {
      setError('OCR failed: ' + e.message)
    } finally {
      setIsExtracting(false)
    }
  }

  const generateHandwriting = useCallback(async () => {
    if (!editableText.trim()) return
    setIsGenerating(true)
    setError('')
    try {
      const result = await renderAllPages(editableText, penStyle, inkColor)
      setPages(result)
      setActivePage(0)
      setStep(3)
    } catch (e) {
      setError('Generation failed: ' + e.message)
    } finally {
      setIsGenerating(false)
    }
  }, [editableText, penStyle, inkColor])

  const downloadCurrent = () =>
    downloadPng(pages[activePage], `neatscript-page-${activePage + 1}.png`)

  const downloadAll = () =>
    pages.forEach((url, i) =>
      downloadPng(url, `neatscript-page-${i + 1}.png`)
    )

  const resetAll = () => {
    setImage(null); setImageFile(null)
    setEditableText(''); setPages([])
    setStep(1); setError('')
  }

  // ── RENDER ───────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg,#eef2ff 0%,#f5f0ff 50%,#fce8f0 100%)',
      fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* ── Header ── */}
      <header style={{ textAlign: 'center', padding: '44px 20px 24px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 34 }}>✍️</span>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(28px, 5vw, 42px)',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #4f46e5, #9333ea)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            NeatScript
          </h1>
        </div>
        <p style={{ color: '#64748b', fontSize: 15, fontWeight: 300, letterSpacing: '0.2px' }}>
          Turn messy handwritten notes into beautiful pages — AI-powered OCR
        </p>
        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 18 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} className={`step-dot${step === s ? ' on' : step > s ? ' done' : ''}`} />
          ))}
        </div>
      </header>

      {/* ── Body ── */}
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px 80px' }}>

        {/* Error banner */}
        {error && (
          <div className="error-box">
            <span>❌</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── API Key Card ── */}
        <div className="card" style={{ padding: '22px 28px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ flexShrink: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>🔑 Anthropic API Key</p>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                Free key at{' '}
                <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="info-link">
                  console.anthropic.com
                </a>
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 220, maxWidth: 440 }}>
              <input
                className="api-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => saveApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn btn-ghost" style={{ padding: '10px 14px', fontSize: 13, flexShrink: 0 }}
                onClick={() => setShowKey((v) => !v)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {apiKey.trim().length > 10 && (
            <p className="success-badge">✓ API key saved in browser</p>
          )}
        </div>

        {/* ── Step 1 — Upload ── */}
        <div className="card" style={{ padding: 30, marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
            📎 Upload Your Notes
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
            JPG or PNG · Long notes are automatically split into multiple pages
          </p>

          <div
            className={`drop-zone${isDragging ? ' over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {image ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <img
                  src={image}
                  alt="uploaded notes"
                  style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                />
                <p style={{ color: '#6366f1', fontSize: 13, fontWeight: 500 }}>
                  ✅ Image loaded — click to change
                </p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 54, marginBottom: 14 }}>🗒️</div>
                <p style={{ color: '#475569', fontSize: 15, fontWeight: 500 }}>
                  Drop your notes image here
                </p>
                <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>
                  or click to browse · JPG or PNG
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {image && (
            <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={extractText}
                disabled={isExtracting}
              >
                {isExtracting
                  ? <><div className="spinner" />Extracting text…</>
                  : '✨ Extract Text with AI'}
              </button>
            </div>
          )}
        </div>

        {/* ── Step 2 — Edit ── */}
        {step >= 2 && (
          <div className="card" style={{ padding: 30, marginBottom: 18 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
              ✏️ Review & Edit
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 18 }}>
              Correct any OCR errors below. Long text is automatically split across multiple pages.
            </p>

            <textarea
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              placeholder="Extracted text will appear here…"
              spellCheck={false}
            />

            {/* Style controls */}
            <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
              <div>
                <p className="label">✒️ Pen Style</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={`opt-btn${penStyle === 'ballpen' ? ' on' : ''}`}
                    onClick={() => setPenStyle('ballpen')}>
                    Ball Pen
                  </button>
                  <button className={`opt-btn${penStyle === 'gelpen' ? ' on' : ''}`}
                    onClick={() => setPenStyle('gelpen')}>
                    Gel Pen
                  </button>
                </div>
              </div>
              <div>
                <p className="label">🎨 Ink Color</p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className={`color-swatch${inkColor === 'blue' ? ' on' : ''}`}
                    style={{ background: '#1a3a8a' }}
                    onClick={() => setInkColor('blue')}
                    title="Blue ink"
                  />
                  <div className={`color-swatch${inkColor === 'black' ? ' on' : ''}`}
                    style={{ background: '#1a1a1a' }}
                    onClick={() => setInkColor('black')}
                    title="Black ink"
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={generateHandwriting}
                disabled={isGenerating || !editableText.trim()}
              >
                {isGenerating
                  ? <><div className="spinner" />Generating pages…</>
                  : '🖋️ Generate Handwritten Pages'}
              </button>
              {editableText.trim() && (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  ~{Math.ceil(editableText.split('\n').length / 18)} page{Math.ceil(editableText.split('\n').length / 18) !== 1 ? 's' : ''} estimated
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3 — Preview & Download ── */}
        {step >= 3 && pages.length > 0 && (
          <div className="card" style={{ padding: 30 }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 22 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                  🎉 {pages.length > 1 ? `${pages.length} Pages Generated` : 'Your Handwritten Page'}
                </h2>
                <p style={{ color: '#94a3b8', fontSize: 13 }}>1080 × 1350 px · High-resolution PNG</p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {pages.length > 1 && (
                  <button className="btn btn-primary" onClick={downloadAll}>
                    ⬇️ All {pages.length} Pages
                  </button>
                )}
                <button className="btn btn-primary" onClick={downloadCurrent}>
                  ⬇️ {pages.length > 1 ? `Page ${activePage + 1}` : 'Download PNG'}
                </button>
              </div>
            </div>

            {/* Thumbnail strip (multi-page only) */}
            {pages.length > 1 && (
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', marginBottom: 18, paddingBottom: 6 }}>
                {pages.map((url, i) => (
                  <div
                    key={i}
                    className={`page-thumb${activePage === i ? ' active' : ''}`}
                    onClick={() => setActivePage(i)}
                  >
                    <img src={url} alt={`Page ${i + 1}`}
                      style={{ height: 90, width: 'auto', display: 'block' }} />
                    <div style={{
                      textAlign: 'center', fontSize: 11, fontWeight: 600,
                      padding: '4px 0',
                      color: activePage === i ? '#4f46e5' : '#94a3b8',
                    }}>
                      P{i + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Main preview */}
            <div className="preview-wrap">
              <img
                src={pages[activePage]}
                alt={`Handwritten page ${activePage + 1}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: 640,
                  borderRadius: 10,
                  boxShadow: '0 6px 28px rgba(0,0,0,0.12)',
                }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
              <button className="btn btn-ghost"
                onClick={() => { setStep(2); setPages([]) }}>
                ↩ Edit &amp; Regenerate
              </button>
              <button className="btn btn-ghost" onClick={resetAll}>
                ＋ New Notes
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '0 20px 40px', color: '#cbd5e1', fontSize: 12 }}>
        NeatScript · Built with React + Vite · Powered by Claude AI
      </footer>
    </div>
  )
}
