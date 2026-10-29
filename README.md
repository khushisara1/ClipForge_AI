# ClipForge AI — AI-Powered Podcast-to-Clips Application

ClipForge AI is a full-stack, production-quality web application that transforms long-form podcast recordings and video interviews into short, engaging vertical videos (9:16) tailored for YouTube Shorts, Instagram Reels, and TikTok.

---

## Architecture & Core Workflow

```
[ Raw Video Upload ]
        │  (Streaming multipart parser, file-type & size validation)
        ▼
[ Media Inspection ] ────► FFprobe (Streams, Duration, Resolution, FPS, Codecs)
        │
        ▼
[ Audio Extraction ] ────► FFmpeg (16kHz mono MP3 optimized for speech recognition)
        │
        ▼
[ Speech Transcription ] ──► Groq Whisper AI (Timestamped word/segment transcript)
        │
        ▼
[ Highlight Detection ] ──► Groq Llama 3.3 (Viral moments, hooks, heuristics)
        │
        ▼
[ 9:16 Clip Rendering ] ──► FFmpeg (Framing, ambient blurred background, burned ASS subtitles)
        │
        ▼
[ Preview & Customization ] ► Interactive Studio (Edit subtitles, aspect ratio, styles)
        │
        ▼
[ Instant MP4 Download ] ──► Browser-compatible H.264/AAC with Range streaming
```

---

## Features

- **Chunked Video Upload**: Stream MP4, MOV, WebM, and MKV files up to 500MB directly to disk using `busboy` to avoid buffering heavy files in memory.
- **Deep Media Inspection**: Inspect containers, video/audio streams, sample rates, and durations using bundled static `FFprobe`.
- **Whisper Speech-to-Text**: Automatically transcribes speech with segment timestamps via Groq's high-speed Whisper API (`whisper-large-v3` / `whisper-large-v3-turbo`). Audio exceeding Groq's 25MB threshold is automatically split and reassembled with accurate timestamp offsets.
- **Context-Aware AI Moment Extraction**: Groq LLM analyzes the timestamped transcript for complete stories, advice, explanations, question-and-answer moments, and problem-solution arcs. It returns structured editorial assessments for context, opening strength, standalone clarity, value, completeness, and endings. Candidates are checked against transcript boundaries, and incomplete moments can be re-reviewed with surrounding context.
- **Quality-Based Clip Selection**: Ranks publishable candidates by configurable editorial weights, transcript clarity where Whisper confidence metadata is available, and redundancy. It returns fewer clips when fewer moments pass quality checks instead of filling a fixed quota.
- **Transcript-Aligned Timing**: Snaps proposed boundaries to actual transcript or word timestamps, enforces configurable duration limits, and uses word-level timing for synchronized captions when available.
- **9:16 Vertical Video Engine**: Converts landscape podcast footage into vertical videos using a layered blurred-background composition that keeps speakers centered without cutting off content or stretching pixels.
- **Burned-In Subtitles (ASS/SRT)**: Custom styled captions with customizable font size, screen position (bottom, center, top), and vibrant color schemes (white bold, yellow highlight, cyan).
- **Persistent Data Store**: Atomic JSON database persists projects, transcripts, clips, and real-time job progression across server reboots.
- **Interactive Clips Studio**: Live video player with HTTP Range request support (`206 Partial Content`), transcript editor, subtitle style editor, re-render engine, and direct file downloads.
- **System Diagnostics Modal**: In-app diagnostics checking FFmpeg binary availability, storage write permissions, and quick API key setup.

---

## Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, Node.js runtime)
- **UI & Styling**: [React 19](https://react.dev), [TypeScript 5](https://www.typescriptlang.org), [Tailwind CSS v4](https://tailwindcss.com), [Lucide React](https://lucide.dev)
- **Media Engine**: `ffmpeg-static` (v6.1.1) and `ffprobe-static` (pre-compiled standalone Windows/Linux binaries)
- **Validation**: [Zod](https://zod.dev)
- **Upload Parser**: `busboy` streaming multipart parser
- **Speech-to-Text**: Groq Cloud Audio API (`whisper-large-v3`)
- **LLM Reasoning**: Groq Cloud Chat Completions API (`llama-3.3-70b-versatile`)

### Highlight Quality Configuration

The pipeline reads these optional server environment variables; defaults are shown in parentheses:

- `MIN_CLIP_DURATION_SECONDS` (15), `MAX_CLIP_DURATION_SECONDS` (90), and `TARGET_CLIP_COUNT` (5).
- `HIGHLIGHT_MIN_QUALITY` (55), `HIGHLIGHT_MIN_OPENING_STRENGTH` (60), `HIGHLIGHT_MIN_STANDALONE_CLARITY` (65), `HIGHLIGHT_MIN_CONTENT_VALUE` (50), `HIGHLIGHT_MIN_NARRATIVE_COMPLETENESS` (65), and `HIGHLIGHT_MIN_NATURAL_ENDING` (60).
- Ranking weights: `HIGHLIGHT_WEIGHT_HOOK_STRENGTH` (0.20), `HIGHLIGHT_WEIGHT_STANDALONE_CLARITY` (0.20), `HIGHLIGHT_WEIGHT_CONTENT_VALUE` (0.18), `HIGHLIGHT_WEIGHT_NARRATIVE_COMPLETENESS` (0.18), `HIGHLIGHT_WEIGHT_NATURAL_ENDING` (0.14), `HIGHLIGHT_WEIGHT_QUALITY_SCORE` (0.10), `HIGHLIGHT_WEIGHT_AUDIO_CLARITY` (0.10), and `HIGHLIGHT_WEIGHT_REDUNDANCY` (0.22).

### Groq Rate-Limit Configuration

Long transcripts are sent in timestamped, overlapping windows rather than as one full prompt. Each request has a bounded completion, requests are queued, and 429 responses retry a limited number of times using Groq's retry headers where provided. The in-process rolling token estimate avoids sending a burst past the configured budget; it is a conservative estimate, not provider-side accounting. Configure these server-side values to match the selected model and Groq account:

- `GROQ_TOKENS_PER_MINUTE` (7000), `GROQ_MAX_CONCURRENT_REQUESTS` (1), and `GROQ_429_MAX_RETRIES` (2).
- `HIGHLIGHT_MAX_COMPLETION_TOKENS` (900).
- `HIGHLIGHT_CHUNK_MAX_CHARACTERS` (9000), `HIGHLIGHT_CHUNK_MAX_SEGMENTS` (140), `HIGHLIGHT_CHUNK_MAX_SECONDS` (300), and `HIGHLIGHT_CHUNK_OVERLAP_SECONDS` (60).

For an 8,000 TPM model, the 7,000 default leaves headroom. If the chosen model or account has a lower quota, lower the token budget and chunk character limit. The retry cooldown is retained on the project; users can retry without re-uploading, and existing transcripts/clips are reused.

Model scores are editorial estimates, not probabilities. Whisper confidence is used only as a clarity proxy when the transcription response provides the needed metadata.

---

## Prerequisites

- **Node.js**: v18.18.0 or newer (v20+ or v24+ recommended).
- **FFmpeg**: **No manual installation required!** The application bundles pre-compiled static FFmpeg and FFprobe binaries via `ffmpeg-static` and `ffprobe-static` with fallback to system PATH if present.
- **Groq API Key**: A free API key from [console.groq.com/keys](https://console.groq.com/keys) (required for AI speech transcription and highlight detection).

---

## Quick Start (Local Setup)

### 1. Clone & Install Dependencies

```bash
cd podcast
npm install
```

### 2. Configure Environment Variables

Create `.env.local` based on `.env.example`:

```bash
# Copy template
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Get a free key at https://console.groq.com/keys
GROQ_API_KEY=gsk_your_groq_api_key_here

TRANSCRIPTION_MODEL=whisper-large-v3
HIGHLIGHT_MODEL=llama-3.3-70b-versatile
MAX_UPLOAD_MB=500
DATA_DIR=./data
```

*(Note: You can also launch the app without an API key immediately to test video upload, inspection, and clip rendering; you can enter the Groq API key directly in the UI Settings modal at any time).*

### 3. Run Automated Tests

Execute the automated pipeline and security suite (including mocked Groq rate-limit and response-validation checks):

```bash
npm test
```

This validates:
- Path security and directory traversal protection
- Database CRUD and project metadata handling
- FFprobe media inspection on synthetic video
- Audio extraction and Whisper optimization
- ASS subtitle file generation
- FFmpeg 9:16 vertical video rendering with burned captions
- Project deletion and disk file cleanup

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Build

To build and run the optimized production bundle:

```bash
npm run build
npm run start
```

---

## Step-by-Step User Guide

1. **Upload Episode**:
   - Navigate to **Upload Podcast**.
   - Drag and drop any MP4, MOV, or WebM recording (up to 500MB).
   - Watch the live byte-level progress bar.
2. **Automated AI Pipeline**:
   - Follow the actual pipeline stages: preparing media, checking codecs, extracting audio, transcribing speech, finding and validating highlights, rendering clips and captions, and preparing downloads.
3. **Clips Studio**:
   - Preview each generated vertical clip in the responsive 9:16 player.
   - Adjust the clip title.
   - Edit the burned subtitle text.
   - Switch aspect ratios (`9:16 Shorts`, `1:1 Square`, `16:9 Wide`).
   - Change caption position (`Bottom`, `Center`, `Top`) and color styling.
   - Click **Re-render Clip** to regenerate the video with updated parameters.
   - Click **Download Finished Clip** to save the finished MP4 video to your computer.

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Stream multipart video upload with size and format validation |
| `GET` | `/api/projects` | List all saved projects and clip counts |
| `GET` | `/api/projects/:id` | Get project details, transcript, and clips |
| `DELETE` | `/api/projects/:id` | Delete project and remove all associated files |
| `POST` | `/api/projects/:id/process` | Trigger or restart processing pipeline |
| `GET` | `/api/projects/:id/status` | Poll real-time job progress and step logs |
| `PATCH` | `/api/projects/:id/clips/:clipId` | Update clip metadata (title, caption text, style) |
| `POST` | `/api/projects/:id/clips/:clipId/rerender` | Re-render clip with updated captions or aspect ratio |
| `DELETE` | `/api/projects/:id/clips/:clipId` | Delete an individual clip |
| `GET` | `/api/media/*` | Stream media files with HTTP Range (`206 Partial Content`) support |
| `GET` | `/api/download/*` | Download finished MP4 clip with sanitized attachment headers |
| `GET` | `/api/health` | System health check (FFmpeg status, Groq key, storage) |
| `POST` | `/api/health` | Save Groq API key directly to `.env.local` |

---

## Deployment Considerations

### Recommended Deployment: Node.js VPS / Docker
Video processing with FFmpeg is CPU- and disk-intensive:
- Deploy to a VPS or containerized host with persistent disk storage (e.g. Ubuntu VPS on Hetzner, DigitalOcean, AWS EC2, or Railway with persistent volume).
- Ensure at least 2 CPU cores and 2GB RAM for smooth 1080p rendering.

### Serverless Limitations
Platforms like Vercel Serverless have maximum execution limits (10s–60s) and read-only filesystems (with small `/tmp` caches). Long-running podcast rendering (e.g., 30+ minute episodes) will exceed serverless timeouts. For production cloud deployments at scale, offload the processing pipeline to a Redis/BullMQ background worker with S3-compatible object storage (e.g. AWS S3 or Cloudflare R2).

---

## Security Best Practices Implemented

- **Path Traversal Defense**: All file resolution passes through `resolveSafeDataPath()`, verifying that requested files remain strictly within `./data` subdirectories.
- **Client Sanitization**: Video filenames and attachment names are sanitized against invalid characters, control sequences, and null bytes.
- **Secret Protection**: `GROQ_API_KEY` is loaded strictly on the server and is never exposed in client bundles or API responses.
- **No Unsanitized Shell Execution**: All external commands invoke `execFile` with argument arrays rather than shell interpolation.
