# Video Conversion Setup Guide

## ✅ **Added: Automatic Video Conversion to MP4**

Your WhatsApp API now automatically converts various video formats to MP4 for better WhatsApp compatibility!

---

## 📦 **Required Installation**

### 1. Install Node.js Packages

```bash
npm install fluent-ffmpeg@^2.1.2
npm install --save-dev @types/fluent-ffmpeg@^2.1.21
```

### 2. Install FFmpeg Binary

FFmpeg is required for video conversion. Install it on your system:

#### Windows:
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from: https://ffmpeg.org/download.html
# Add FFmpeg to your PATH
```

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install ffmpeg
```

#### Mac:
```bash
brew install ffmpeg
```

### 3. Verify Installation

```bash
ffmpeg -version
```

You should see FFmpeg version information.

---

## 🎬 **Video Formats Supported**

### Auto-Converted to MP4:
- **AVI** (`video/avi`, `video/x-msvideo`)
- **MOV** (`video/quicktime`)
- **MKV** (`video/x-matroska`)
- **WEBM** (`video/webm`)

### Already Compatible (No Conversion):
- **MP4** (`video/mp4`)
- **3GP** (`video/3gpp`)

---

## 🔧 **How It Works**

### 1. Upload Video
User uploads AVI/MOV/MKV/WEBM video

### 2. Auto-Detection
System detects it's not MP4

### 3. Conversion
```typescript
// Automatic conversion settings:
- Video Codec: H.264 (libx264)
- Audio Codec: AAC
- Preset: fast (good speed/quality balance)
- CRF: 23 (good quality)
- Format: MP4 with fast-start enabled
```

### 4. Send to WhatsApp
Converted MP4 is sent via WhatsApp

### 5. Cleanup
All temporary files are deleted

---

## 📊 **Conversion Settings**

```typescript
.videoCodec('libx264')      // H.264 video (universal compatibility)
.audioCodec('aac')          // AAC audio (widely supported)
.format('mp4')              // MP4 container
.outputOptions([
  '-preset fast',           // Fast encoding
  '-crf 23',               // Constant quality (23 = good quality)
  '-movflags +faststart'   // Enable streaming/progressive download
])
```

### Quality Levels (CRF):
- **18** - Very high quality, larger file
- **23** - Good quality (default) ✅
- **28** - Lower quality, smaller file

To change quality, modify `'-crf 23'` in the code.

---

## 🚀 **Usage**

### Upload Video (Auto-Converts):
```bash
curl -X POST "http://localhost:3000/api/whatsapp/sessions/SESSION_ID/media" \
  -H "Authorization: Bearer TOKEN" \
  -F "media=@video.avi" \
  -F "to=919876543210" \
  -F "caption=Check out this video"
```

### What Happens:
```
1. video.avi uploaded (50 MB, AVI format)
2. Detected: needs conversion
3. Converting AVI → MP4...
4. Conversion complete (45 MB, MP4 format)
5. Sending to WhatsApp...
6. Success! Message ID: xxx
7. Cleanup: temp files deleted
```

---

## 📝 **Log Examples**

### Successful Conversion:
```
Converting video/avi to MP4 for better WhatsApp compatibility...
Video conversion completed
Video converted successfully: video.avi -> video.mp4
Size change: 52428800 bytes -> 47185920 bytes
File saved temporarily: C:\...\temp\abc123_video.mp4
Sending media from file: C:\...\temp\abc123_video.mp4 to 919876543210@c.us
Media sent successfully, messageId: true_919876543210@c.us_...
Temporary file cleaned up: C:\...\temp\abc123_video.mp4
```

### Conversion Failed (Falls Back to Original):
```
Converting video/avi to MP4 for better WhatsApp compatibility...
Video conversion error: FFmpeg not found
Video conversion failed, using original
Sending original video file...
```

---

## ⚙️ **Configuration**

### Change Video Quality

In `src/controllers/whatsappController.ts`, find:

```typescript
.outputOptions([
  '-preset fast',
  '-crf 23',  // ← Change this number
  '-movflags +faststart'
])
```

**Quality Options:**
- `18` - Near lossless (large files)
- `20` - Very high quality
- `23` - High quality (default)
- `26` - Good quality
- `28` - Medium quality
- `30` - Lower quality (smaller files)

### Change Encoding Speed

```typescript
'-preset fast'  // Current setting
```

**Preset Options (speed vs quality):**
- `ultrafast` - Fastest, larger files
- `superfast` - Very fast
- `veryfast` - Fast
- `faster` - Faster
- `fast` - Good balance ✅ (default)
- `medium` - Balanced
- `slow` - Better compression
- `slower` - Much better compression
- `veryslow` - Best compression, slowest

---

## 🎯 **Supported Formats Summary**

| Format | Extension | Auto-Convert | Final Format |
|--------|-----------|--------------|--------------|
| JPEG | .jpg, .jpeg | ❌ No | JPEG |
| PNG | .png | ✅ Yes | JPEG |
| WEBP | .webp | ✅ Yes | JPEG |
| GIF | .gif | ✅ Yes | JPEG |
| MP4 | .mp4 | ❌ No | MP4 |
| AVI | .avi | ✅ Yes | MP4 |
| MOV | .mov | ✅ Yes | MP4 |
| MKV | .mkv | ✅ Yes | MP4 |
| WEBM | .webm | ✅ Yes | MP4 |

---

## 🐛 **Troubleshooting**

### Error: "FFmpeg not found"
**Solution**: Install FFmpeg and add to PATH

Windows:
```bash
choco install ffmpeg
# Or download and add to PATH manually
```

### Error: "Video conversion failed"
**Possible causes**:
1. FFmpeg not installed
2. Video file corrupted
3. Unsupported codec in source video

**Solution**: Check logs for specific error, ensure FFmpeg is installed

### Video Takes Long to Convert
**Normal**: Large videos take time to convert

**Solutions**:
1. Use faster preset: `-preset ultrafast`
2. Lower quality: `-crf 28`
3. Reduce resolution (add to outputOptions):
   ```typescript
   .size('1280x720')  // 720p
   ```

### Conversion Uses Too Much CPU/Memory
**Solutions**:
1. Use faster preset
2. Process one video at a time
3. Limit concurrent uploads
4. Add server resource limits

---

## 📈 **Performance Impact**

### Small Video (10 MB, 30 seconds):
- Conversion time: ~5-10 seconds
- CPU usage: High during conversion
- Memory: +100-200 MB

### Medium Video (50 MB, 2 minutes):
- Conversion time: ~20-40 seconds
- CPU usage: Very high
- Memory: +300-500 MB

### Large Video (100 MB, 5 minutes):
- Conversion time: ~60-120 seconds
- CPU usage: Maximum
- Memory: +500 MB - 1 GB

**Recommendation**: For large videos, consider:
1. Upload limit < 50 MB
2. Queue system for conversions
3. Separate conversion server

---

## 🔒 **Security**

### Temporary Files:
- Created in `/temp` directory
- Unique random filenames
- Automatically deleted after sending
- Gitignored (not committed to repo)

### File Validation:
- Size limit: 16 MB (WhatsApp limit)
- Type validation: Only video/* mimetypes
- Path sanitization: Prevents directory traversal

---

## 💡 **Best Practices**

### 1. Set Upload Size Limits
```typescript
// In multer config
limits: {
  fileSize: 50 * 1024 * 1024 // 50 MB max
}
```

### 2. Add Progress Tracking
```typescript
ffmpeg.default(tempInputPath)
  .on('progress', (progress) => {
    logger.info(`Converting: ${progress.percent}% done`);
  })
```

### 3. Queue Large Conversions
For production with many users, use a queue system:
- Bull Queue
- RabbitMQ
- AWS SQS

### 4. Monitor Disk Space
Conversions use temporary disk space:
- Monitor `/temp` directory
- Set up cleanup cron job
- Alert if disk space low

### 5. Handle Timeouts
Add timeout for long conversions:
```typescript
const timeout = setTimeout(() => {
  ffmpeg.kill();
  reject(new Error('Conversion timeout'));
}, 300000); // 5 minutes
```

---

## 📚 **Additional Resources**

### FFmpeg Documentation:
- Official: https://ffmpeg.org/documentation.html
- Guide: https://trac.ffmpeg.org/wiki

### fluent-ffmpeg:
- NPM: https://www.npmjs.com/package/fluent-ffmpeg
- GitHub: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg

### Video Codecs:
- H.264: https://trac.ffmpeg.org/wiki/Encode/H.264
- AAC: https://trac.ffmpeg.org/wiki/Encode/AAC

---

## ✅ **Installation Checklist**

- [ ] Run `npm install fluent-ffmpeg@^2.1.2`
- [ ] Run `npm install --save-dev @types/fluent-ffmpeg@^2.1.21`
- [ ] Install FFmpeg binary on system
- [ ] Verify: `ffmpeg -version`
- [ ] Rebuild TypeScript: `npm run build`
- [ ] Restart server: `npm start`
- [ ] Test with AVI/MOV file upload
- [ ] Check logs for conversion messages
- [ ] Verify WhatsApp receives MP4

---

## 🎉 **Summary**

**Before**: Only MP4 videos worked reliably  
**After**: AVI, MOV, MKV, WEBM all auto-convert to MP4

**Benefits**:
✅ Universal video format support  
✅ Better WhatsApp compatibility  
✅ Automatic optimization  
✅ Smaller file sizes (in some cases)  
✅ Faster WhatsApp sending  

**Requirements**:
📦 fluent-ffmpeg npm package  
🛠️ FFmpeg binary installed  
💾 Temporary disk space  
⚡ CPU for encoding  

---

## 🚨 **Important Notes**

1. **FFmpeg Must Be Installed** - The npm package is just a wrapper
2. **CPU Intensive** - Video conversion uses significant CPU
3. **Takes Time** - Large videos can take 1-2 minutes to convert
4. **Disk Space** - Needs 2x video size temporarily (input + output)
5. **Fallback** - If conversion fails, original video is sent

---

**Need help?** Run `ffmpeg -version` to verify installation!

