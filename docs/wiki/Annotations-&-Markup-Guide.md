# 🎨 Annotations & Markup Guide

Learn how to use, customize, and programmatically manage annotations in **TeamSync PDF Viewer**.

---

## ✏️ Annotation Tools

1. **Freehand Ink (`brush`)**: Smooth stroke drawing with stroke width and color customization.
2. **Text Highlighting (`highlight`)**: Translucent markup over text selections.
3. **Geometric Shapes**: Rectangles, ellipses, straight lines, and arrows.
4. **Callouts & Sticky Notes**: Directional pointer text callouts and movable note boxes.
5. **Interactive Hyperlinks**: Internal page jumps (`#page=3`) and external web URLs (`https://...`).

---

## 💻 Listening to Annotation Changes

```tsx
<DocumentViewer
  initialDoc="/document.pdf"
  onAnnotationsChange={(annotations) => {
    console.log('Updated annotations count:', annotations.length);
  }}
/>
```
