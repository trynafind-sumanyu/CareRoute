# CareRoute 🏥

> **AI-powered health triage & hospital navigation — get the right care, fast.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-care--root--vatsal.vercel.app-blue?style=flat-square)](https://care-root-vatsal.vercel.app)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)
![HTML](https://img.shields.io/badge/HTML-29.4%25-orange?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-32.8%25-yellow?style=flat-square)
![CSS](https://img.shields.io/badge/CSS-37.8%25-blue?style=flat-square)

---

## What is CareRoute?

CareRoute is a lightweight, browser-based web app that helps users quickly assess how serious their symptoms are and find nearby hospitals — all without leaving a single page.

Describe your symptoms, share your location, and CareRoute instantly returns an AI-generated severity rating, personalized action steps, and a live map of hospitals near you with one-tap directions.

---

## Features

- 🤖 **AI Severity Assessment** — classifies symptoms as Low, Moderate, High, or Emergency using an AI-powered backend
- 📋 **Personalized Action Steps** — tailored guidance based on what the user describes
- 🗺️ **Live Hospital Finder** — fetches nearby hospitals in real time from OpenStreetMap
- 📍 **Interactive Map** — visualizes hospitals relative to the user's current location
- 🧭 **One-tap Directions** — links directly to Google Maps for turn-by-turn navigation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| AI Backend | Node.js serverless functions (`/api`) |
| Map Data | OpenStreetMap (Overpass API) |
| Directions | Google Maps |
| Deployment | Vercel |

---

## Project Structure

```
CareRoute/
├── index.html       # Main application UI
├── style.css        # Styling and layout
├── app.js           # Frontend logic (symptom input, map rendering, API calls)
├── logo.svg         # App logo
├── vercel.json      # Vercel deployment configuration
└── api/             # Serverless backend functions (AI triage logic)
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Vercel CLI](https://vercel.com/docs/cli) (for local development with serverless functions)

### Run Locally

```bash
# Clone the repository
git clone https://github.com/vatsalawasthi/CareRoute.git
cd CareRoute

# Install Vercel CLI if you haven't already
npm install -g vercel

# Start the local dev server (serves frontend + API routes)
vercel dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Deploy to Vercel

```bash
vercel
```

Or connect the repository directly in the [Vercel dashboard](https://vercel.com/new) for automatic deployments on every push.

---

## How It Works

1. **User describes symptoms** in the text input.
2. **Frontend sends the description** to the `/api` serverless function.
3. **AI backend processes the input** and returns a severity level + recommended action steps.
4. **Browser requests the user's geolocation**, then queries the Overpass API for nearby hospitals.
5. **Results render on an interactive map**, with each hospital listed and linkable to Google Maps directions.

---

## Live Demo

🔗 [care-root-vatsal.vercel.app](https://care-root-vatsal.vercel.app)

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## Disclaimer

CareRoute is an informational tool and **is not a substitute for professional medical advice, diagnosis, or treatment**. If you believe you are experiencing a medical emergency, call your local emergency services immediately.

---

## License

This project is open source. See [LICENSE](LICENSE) for details.