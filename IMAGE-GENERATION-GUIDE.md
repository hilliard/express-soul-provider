# Album Art Generation Guide

## 🎨 AI Image Prompts by Genre

Use these prompts in **Bing Image Creator** (https://www.bing.com/images/create) or any AI image generator:

### **RnB (Rhythm & Blues)**

```
Elegant vintage RnB vinyl record album cover, 1960s Motown style,
smooth gradient background in burgundy and gold, minimalist geometric
patterns, sophisticated typography, professional product photography,
studio lighting, square format, 4K quality
```

**Alternative prompt:**

```
Modern RnB album artwork, sleek vinyl record design, deep purple and
rose gold color palette, silky smooth textures, luxury aesthetic,
high-end music product, centered composition
```

---

### **Soul**

```
Classic soul music vinyl album cover, warm amber and honey tones,
vintage microphone silhouette, soft spotlight effect, 1970s soul era
aesthetic, heartfelt and emotional design, square format album art,
professional photography
```

**Alternative prompt:**

```
Retro soul vinyl record design, rich chocolate brown and cream colors,
smooth gradients, vintage soul music vibes, elegant minimalist style,
studio product shot, high resolution
```

---

### **Funk**

```
Psychedelic funk vinyl album cover, vibrant 1970s disco era design,
bold geometric shapes and patterns, electric purple orange and yellow,
groovy retro aesthetic, dynamic composition, square format,
ultra detailed 4K
```

**Alternative prompt:**

```
Funky vinyl record album art, explosive color splash design,
neon gradients, retro 70s funk music style, energetic and bold,
high contrast photography, professional studio lighting
```

---

### **Gospel**

```
Inspirational gospel music vinyl album cover, heavenly golden light rays,
soft ethereal glow, peaceful and uplifting atmosphere, warm cream and
gold tones, spiritual aesthetic, elegant design, square format,
professional product photography
```

**Alternative prompt:**

```
Gospel vinyl record artwork, church stained glass color palette,
rays of light, peaceful and hopeful design, soft blue and gold gradients,
sacred music aesthetic, high quality studio shot
```

---

### **Blues**

```
Vintage blues vinyl album cover, moody deep blue and charcoal tones,
smoky atmospheric effect, guitar silhouette, 1950s delta blues aesthetic,
gritty texture, emotional depth, square format album art,
professional photography
```

**Alternative prompt:**

```
Classic blues music vinyl record, midnight blue gradient,
subtle texture overlay, melancholic atmosphere, vintage americana style,
dusty worn aesthetic, high resolution product shot
```

---

### **General Music Product (Any Genre)**

```
Professional vinyl record product photography, clean modern design,
colored vinyl disc visible, studio lighting, minimalist aesthetic,
centered composition, sharp focus, commercial product shot,
square format 1:1 ratio, 4K ultra HD
```

---

## 📦 Bulk Image Organization & Renaming

### **Step 1: Download Images**

After generating images with AI:

1. Generate 3-5 variations per genre
2. Download all to your **Downloads** folder
3. They'll likely be named: `OIG1.jpg`, `OIG2.jpg`, etc.

### **Step 2: Move to Project**

Create organized folders (optional):

```powershell
# Navigate to your project
cd E:\code\dev\scrimba\express-soul-provider\public\images

# Create genre subfolders (optional organization)
New-Item -ItemType Directory -Force -Path rnb, soul, funk, gospel, blues, general
```

### **Step 3: Bulk Rename with PowerShell**

**Option A: Simple Sequential Renaming**

```powershell
# Navigate to Downloads (or wherever images are)
cd $HOME\Downloads

# Rename all OIG*.jpg files to vinyl-new-*.png
Get-ChildItem -Filter "OIG*.jpg" |
  ForEach-Object -Begin { $i = 11 } -Process {
    Rename-Item $_.FullName -NewName "vinyl$i.png";
    $i++
  }

# Move to project images folder
Move-Item vinyl*.png E:\code\dev\scrimba\express-soul-provider\public\images\
```

**Option B: Genre-Specific Naming**

```powershell
# Rename by genre (do this for each batch of genre images)
cd $HOME\Downloads

# For RnB images (files OIG1.jpg through OIG3.jpg)
Get-ChildItem OIG1.jpg, OIG2.jpg, OIG3.jpg |
  ForEach-Object -Begin { $i = 1 } -Process {
    Rename-Item $_.FullName -NewName "vinyl-rnb-$i.png";
    $i++
  }

# For Soul images (next batch)
Get-ChildItem OIG4.jpg, OIG5.jpg, OIG6.jpg |
  ForEach-Object -Begin { $i = 1 } -Process {
    Rename-Item $_.FullName -NewName "vinyl-soul-$i.png";
    $i++
  }

# Repeat pattern for: vinyl-funk-*.png, vinyl-gospel-*.png, vinyl-blues-*.png

# Move all to project
Move-Item vinyl-*.png E:\code\dev\scrimba\express-soul-provider\public\images\
```

**Option C: Interactive Naming (Safest)**

```powershell
cd $HOME\Downloads

# List all images first
Get-ChildItem -Filter "OIG*.jpg" | Select-Object Name

# Rename one at a time with custom names
Rename-Item "OIG1.jpg" "vinyl-rnb-smooth-vibes.png"
Rename-Item "OIG2.jpg" "vinyl-soul-golden-era.png"
# ... etc

# Move when done
Move-Item vinyl-*.png E:\code\dev\scrimba\express-soul-provider\public\images\
```

### **Step 4: Convert JPG to PNG (If Needed)**

If you want to keep PNG format consistent:

```powershell
# Install ImageMagick (one-time setup)
# winget install ImageMagick.ImageMagick

# Convert all JPG to PNG
cd E:\code\dev\scrimba\express-soul-provider\public\images
Get-ChildItem -Filter "*.jpg" | ForEach-Object {
  magick convert $_.Name ($_.BaseName + ".png")
  Remove-Item $_.Name  # Delete original JPG
}
```

---

## 🚀 Quick Workflow

### **Recommended Process:**

1. **Generate 3 images per genre** in Bing Image Creator (18 total images)
   - Use the prompts above
   - Download each batch immediately

2. **Organize downloads by genre:**
   - Download RnB images → rename manually to `vinyl-rnb-1.png`, `vinyl-rnb-2.png`, `vinyl-rnb-3.png`
   - Download Soul images → rename to `vinyl-soul-1.png`, `vinyl-soul-2.png`, `vinyl-soul-3.png`
   - Continue for all genres

3. **Move to project:**

   ```powershell
   Move-Item $HOME\Downloads\vinyl-*.png E:\code\dev\scrimba\express-soul-provider\public\images\
   ```

4. **Use in add-product form:**
   - When adding a new product, use filename: `vinyl-soul-2.png`
   - Image will be accessible at `/images/vinyl-soul-2.png`

---

## 📋 Naming Convention Reference

### Current Products (existing):

- `vinyl1.png` through `vinyl10.png` ✓ Already in use

### New Products (recommended naming):

- **By Genre:** `vinyl-[genre]-[number].png`
  - `vinyl-rnb-1.png`, `vinyl-rnb-2.png`, ...
  - `vinyl-soul-1.png`, `vinyl-soul-2.png`, ...
  - `vinyl-funk-1.png`, `vinyl-funk-2.png`, ...
  - `vinyl-gospel-1.png`, `vinyl-gospel-2.png`, ...
  - `vinyl-blues-1.png`, `vinyl-blues-2.png`, ...

- **Sequential:** `vinyl11.png`, `vinyl12.png`, ... (simpler)

- **Descriptive:** `vinyl-groovy-nights.png`, `vinyl-midnight-soul.png` (more memorable)

Choose whichever naming style you prefer! The genre-specific naming makes it easier to find appropriate images when adding products.

---

## ✨ Pro Tips

1. **Generate variations:** Create 3-5 images per prompt, pick the best
2. **Keep aspect ratio 1:1:** Square images (300x300, 500x500, or 1000x1000)
3. **Consistent style:** Use similar prompts to maintain visual cohesion
4. **Test before bulk use:** Generate 1-2 samples first to ensure style matches
5. **Backup originals:** Keep high-res versions in a separate folder

---

## 🎯 Next Steps

1. Visit https://www.bing.com/images/create
2. Copy/paste the genre prompts above
3. Download generated images
4. Use PowerShell commands to rename and move files
5. Add new products using the new image filenames!

Happy designing! 🎨✨
