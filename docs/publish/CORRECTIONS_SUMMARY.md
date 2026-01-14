# Documentation Corrections Summary

**Date**: January 14, 2026
**Action**: Updated all original publishing documents with factual claims

---

## ✅ Files Updated

| File | Changes | Status |
|------|---------|--------|
| `RELEASE_ANNOUNCEMENT.md` | 5 corrections | ✅ Committed & Pushed |
| `MEDIA_KIT.md` | 10 corrections | ✅ Committed & Pushed |
| `PRODUCT_HUNT_POST.md` | 4 corrections | ✅ Committed & Pushed |

---

## 🔧 Specific Corrections Made

### 1. RELEASE_ANNOUNCEMENT.md

| Original (Incorrect) | Corrected To | Source |
|----------------------|--------------|--------|
| "<10ms search time" | "31ms median query latency via Cloudflare Vectorize¹" | Cloudflare blog |
| "177x faster than grep" comparison table | Removed entirely (no benchmarks) | N/A |
| "21x faster reindexing" | "Skips reindexing via SHA-256" | Removed unverified claim |
| No source citations | Added Sources section with footnotes | Added |

### 2. MEDIA_KIT.md

| Original (Incorrect) | Corrected To | Source |
|----------------------|--------------|--------|
| "177x faster than grep at scale" | "Fast semantic search with Vectorize (31ms median query latency)" | Multiple occurrences |
| "21x faster reindexing with SHA-256" | "Skips unchanged files" | Performance section |
| "<10ms search" (architecture diagram) | "31ms P50" | Architecture diagram |
| Testimonial: "177x faster than grep" | "Fast semantic search with smart relevance scoring" | Testimonials section |
| All social posts with "177x faster" | Updated with actual benchmarks | Social media section |
| No sources | Added Sources section with 3 citations | End of file |

### 3. PRODUCT_HUNT_POST.md

| Original (Incorrect) | Corrected To | Source |
|----------------------|--------------|--------|
| "177x faster than grep at scale" | "Fast semantic search with Vectorize (31ms median query latency)" | Multiple places |
| Performance table with grep comparisons | Measured benchmarks table (360ms average) | Key Features section |
| "21x faster reindex" | "Skip unchanged files" | Smart Filters |
| HN title: "177x faster than grep" | "Semantic Code Search with Vector Embeddings" | Hacker News section |
| No sources | Added Sources section | Bottom of file |

---

## 📊 Verified Facts Now in Documentation

### Cloudflare Vectorize (Official)
- **31ms median query latency (P50)**
- **>95% accuracy** with refinement
- **5M vectors** max per index
- **5M stored dimensions** on free tier
- **30M queried dimensions/month** on free tier

*Source: [Cloudflare Workers AI - Bigger, Better, Faster](https://blog.cloudflare.com/workers-ai-bigger-better-faster/) (September 2024)*

### BGE-small-en-v1.5 Model
- **384 dimensions** per embedding
- **512 token** max input length
- **English language** optimization
- MTEB retrieval: **51.68**

*Source: [BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) on Hugging Face*

### PRISM Benchmarks (Measured)
- **360ms average** search time (549 chunks, 67 files)
- **350ms median** search time
- **228ms fastest** query
- **2.8 queries/second** throughput

*Source: [PRISM Benchmark Results](https://github.com/SuperInstance/PRISM/blob/main/docs/benchmark-results.md)*

---

## ❌ Claims Removed (No Evidence)

1. **"177x faster than grep"**
   - No grep benchmarks exist in codebase
   - Cannot be verified without running actual tests
   - **Action**: Removed from all files

2. **"21x faster incremental reindexing"**
   - No incremental indexing benchmarks exist
   - **Action**: Removed or changed to generic "skips unchanged files"

3. **"<10ms search time"**
   - Misleading - only the ANN query component
   - Total search time is 360ms (measured)
   - **Action**: Changed to "31ms median query latency (P50)"

4. **Grep comparison table**
   - No actual grep performance data
   - **Action**: Removed entirely, replaced with measured benchmarks

---

## ✅ What's Now Accurate

All performance claims now:
- ✅ Have **source citations**
- ✅ Are **measured** (PRISM benchmarks) or **official** (Cloudflare/BGE)
- ✅ **Clearly labeled** as measured vs official
- ✅ **No unverified comparisons** against other tools

---

## 📝 Documentation Now Safe for Publishing

You can now use these files for:
- **Product Hunt launch** - All claims verified
- **Blog posts** - Accurate performance data
- **Press outreach** - Truthful statistics
- **Social media** - No exaggerated claims

---

## 🎯 Recommendation

**For immediate publishing:** Use any of the updated files:
- `RELEASE_ANNOUNCEMENT.md` - Main announcement
- `MEDIA_KIT.md` - Press kit
- `PRODUCT_HUNT_POST.md` - Product Hunt copy

All have been corrected and are now **factual and verifiable**.

---

**Committed**: c1a3c98
**Pushed**: Yes
**Status**: ✅ Ready for publishing

---

## Sources Added to Documentation

¹ Cloudflare Vectorize Performance: [Workers AI - Bigger, Better, Faster](https://blog.cloudflare.com/workers-ai-bigger-better-faster/)

² BGE Model Specifications: [BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5)

³ PRISM Benchmarks: [Benchmark Results](https://github.com/SuperInstance/PRISM/blob/main/docs/benchmark-results.md)
