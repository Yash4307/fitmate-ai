# FitMate AI | Adaptive Gym Assistant

Personalized fitness assistant: 7-day workout plans, BMI/TDEE, Indian diet plans,
a 40-exercise adaptive library, voice commands/coaching, and progress tracking.
Built with Python, Flask, HTML, CSS and JavaScript (Replit Buildathon project).

## Run locally
```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py                    # http://127.0.0.1:5000
```

## Deploy on Render
1. Push this folder to a GitHub repository (files must be at the repo root).
2. Render Dashboard → **New +** → **Blueprint** (uses `render.yaml`), pick the repo, Apply.
   - Or **New + → Web Service** manually with:
     - Runtime: Python 3
     - Build command: `pip install -r requirements.txt`
     - Start command: `gunicorn app:app --bind 0.0.0.0:$PORT`
     - Health check path: `/healthz`
3. Open the `https://<name>.onrender.com` URL once it is live.

Notes: no database or secrets needed. Free instances sleep after inactivity, so the
first load can take ~30–60 s. Voice features need HTTPS (Render provides it) and a
supporting browser (Chrome/Edge).
