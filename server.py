"""
Flask backend for ML Accuracy vs Luck experiments.
Each API endpoint runs the real scikit-learn code and returns JSON.
"""

import json
import numpy as np
from flask import Flask, render_template, jsonify, request

from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

app = Flask(__name__)

# Load dataset once at startup
X, y = load_breast_cancer(return_X_y=True)


def make_model(name, seed, n_trees=25):
    if name == "Logistic regression":
        return make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000))
    if name == "Decision tree":
        return DecisionTreeClassifier(random_state=seed)
    if name == "Random forest":
        return RandomForestClassifier(n_estimators=n_trees, random_state=seed)
    raise ValueError(name)


def accuracy_percent(model, Xtr, Xte, ytr, yte):
    model.fit(Xtr, ytr)
    return round(accuracy_score(yte, model.predict(Xte)) * 100, 4)


@app.route("/")
def index():
    return render_template("index.html")


# ── Experiment 1: Seed variation ──────────────────────────────
@app.route("/api/experiment1", methods=["POST"])
def experiment1():
    params = request.get_json()
    n_seeds = int(params.get("n_seeds", 50))
    test_size = int(params.get("test_size", 114))
    split_seed = int(params.get("split_seed", 42))
    n_trees = int(params.get("n_trees", 25))

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=test_size, stratify=y, random_state=split_seed
    )

    results = {"seeds": [], "rf": [], "dt": []}
    for seed in range(n_seeds):
        rf_score = accuracy_percent(make_model("Random forest", seed, n_trees), Xtr, Xte, ytr, yte)
        dt_score = accuracy_percent(make_model("Decision tree", seed, n_trees), Xtr, Xte, ytr, yte)
        results["seeds"].append(seed)
        results["rf"].append(rf_score)
        results["dt"].append(dt_score)

    rf = np.array(results["rf"])
    dt = np.array(results["dt"])
    results["summary"] = {
        "rf": {
            "mean": round(rf.mean(), 2), "sd": round(rf.std(ddof=1), 2),
            "min": round(rf.min(), 2), "max": round(rf.max(), 2),
            "distinct": len(set(results["rf"])),
        },
        "dt": {
            "mean": round(dt.mean(), 2), "sd": round(dt.std(ddof=1), 2),
            "min": round(dt.min(), 2), "max": round(dt.max(), 2),
            "distinct": len(set(results["dt"])),
        },
        "step_size": round(100 / test_size, 3),
    }
    return jsonify(results)


# ── Experiment 2: Shared splits ───────────────────────────────
@app.route("/api/experiment2", methods=["POST"])
def experiment2():
    params = request.get_json()
    n_splits = int(params.get("n_splits", 30))
    n_trees = int(params.get("n_trees", 25))

    model_names = ["Logistic regression", "Decision tree", "Random forest"]
    results = {"splits": [], "lr": [], "dt": [], "rf": []}
    top_counts = {n: 0 for n in model_names}

    for i in range(n_splits):
        split_seed = 100 + i
        Xtr, Xte, ytr, yte = train_test_split(
            X, y, test_size=0.20, stratify=y, random_state=split_seed
        )
        scores = {}
        for name in model_names:
            scores[name] = accuracy_percent(make_model(name, split_seed, n_trees), Xtr, Xte, ytr, yte)

        results["splits"].append(split_seed)
        results["lr"].append(scores["Logistic regression"])
        results["dt"].append(scores["Decision tree"])
        results["rf"].append(scores["Random forest"])

        best = max(scores.values())
        for name, s in scores.items():
            if np.isclose(s, best):
                top_counts[name] += 1

    results["summary"] = {}
    for key, name in [("lr", "Logistic regression"), ("dt", "Decision tree"), ("rf", "Random forest")]:
        arr = np.array(results[key])
        results["summary"][key] = {
            "mean": round(arr.mean(), 2),
            "sd": round(arr.std(ddof=1), 2),
            "wins": top_counts[name],
        }
    results["summary"]["n_splits"] = n_splits
    return jsonify(results)


# ── Experiment 3: A/A gaps ────────────────────────────────────
@app.route("/api/experiment3", methods=["POST"])
def experiment3():
    params = request.get_json()
    n_pairs = int(params.get("n_pairs", 200))
    rng_seed = int(params.get("rng_seed", 2026))
    n_trees = int(params.get("n_trees", 25))
    fixed_split = int(params.get("split_seed", 42))
    test_size = int(params.get("test_size", 114))

    rng = np.random.default_rng(rng_seed)

    def rf_score(split_seed, model_seed):
        Xtr, Xte, ytr, yte = train_test_split(
            X, y, test_size=test_size, stratify=y, random_state=int(split_seed)
        )
        model = RandomForestClassifier(n_estimators=n_trees, random_state=int(model_seed))
        return accuracy_percent(model, Xtr, Xte, ytr, yte)

    d1_gaps = []
    d2_gaps = []

    for _ in range(n_pairs):
        a, b = rng.integers(0, 100_000, size=2)
        d1_gaps.append(round(abs(rf_score(fixed_split, a) - rf_score(fixed_split, b)), 4))

        sa, sb, a, b = rng.integers(0, 100_000, size=4)
        d2_gaps.append(round(abs(rf_score(sa, a) - rf_score(sb, b)), 4))

    d1 = np.array(d1_gaps)
    d2 = np.array(d2_gaps)
    results = {
        "d1_gaps": d1_gaps,
        "d2_gaps": d2_gaps,
        "summary": {
            "d1": {
                "gte1": round(float(np.mean(d1 >= 1.0) * 100), 1),
                "gte2": round(float(np.mean(d1 >= 2.0) * 100), 1),
                "mean": round(float(d1.mean()), 2),
            },
            "d2": {
                "gte1": round(float(np.mean(d2 >= 1.0) * 100), 1),
                "gte2": round(float(np.mean(d2 >= 2.0) * 100), 1),
                "mean": round(float(d2.mean()), 2),
            },
        },
    }
    return jsonify(results)


if __name__ == "__main__":
    print("\n🎲 ML Accuracy vs Luck — Server running at http://localhost:5000\n")
    app.run(debug=False, port=5000)
