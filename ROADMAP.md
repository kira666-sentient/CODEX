# F&B App Roadmap: Payments, Mobile, and Performance

This document outlines the planned upgrades for the **Friends & Benefits (F&B)** app.

## 1. Performance Optimization (High Priority)
The landing page currently uses intensive canvas animations that can lag on mobile and tablet devices.

### Plan:
- **Layer Caching**: Pre-render static elements (mountains, trees, cliffs) onto an offscreen canvas to reduce draw calls per frame.
- **Adaptive Quality**: Scale back animation details (waterfall passes, particle counts) based on the device's screen size or performance profile.
- **Gradient Reuse**: Cache expensive canvas gradients instead of recreating them every frame.

## 2. Payment Integration
Adding a way for friends to settle balances directly within the app.

### Plan:
- **Provider**: Stripe (Global) or Razorpay (India-focused).
- **Flow**: Add a "Pay Now" button to friend views, integrate a secure checkout API, and use webhooks to automatically update Supabase balances upon success.

## 3. Mobile App (Play Store)
Converting the Next.js web app into a native Android application.

### Plan:
- **Framework**: Use **Capacitor** to wrap the existing codebase.
- **Requirements**:
  - Google Developer Account ($25 one-time fee).
  - Android Studio for generating the `.aab` (Android App Bundle) file.
  - App assets: Icon (512x512) and Splash Screen.

---
*Created on 2026-03-29*
