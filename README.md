# ML Accuracy vs Luck — Interactive Experiments

An interactive web application that demonstrates how random seeds, test-set splits, and blocking affect ML model accuracy benchmarks. Built with Flask + Chart.js + scikit-learn.

## Features

- **Experiment 1: Seed Variation** — Change only the model's random seed while keeping the train/test partition fixed
- **Experiment 2: Shared Splits** — Compare three classifiers on identical train/test partitions (blocking)
- **Experiment 3: A/A Test** — Same random forest vs. itself to measure inherent noise

## Tech Stack

- **Backend:** Python, Flask, scikit-learn, NumPy
- **Frontend:** HTML5, CSS3 (glassmorphic dark theme), Chart.js
- **Dataset:** Breast Cancer Wisconsin Diagnostic (569 observations, 30 features)

## Setup

```bash
pip install flask numpy scikit-learn
python server.py
```

Then open http://localhost:5000

## Project Structure

```
├── server.py              # Flask backend with ML experiment APIs
├── templates/
│   └── index.html         # Main HTML template
├── static/
│   ├── app.js             # Frontend logic & Chart.js visualizations
│   ├── styles.css          # Dark glassmorphic design system
│   └── chart.umd.min.js   # Chart.js v4.4.4 (local fallback)
```
