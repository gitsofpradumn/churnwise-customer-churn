
from pathlib import Path
import pickle
import traceback

import pandas as pd
from flask import Flask, request, jsonify, render_template

# --------------------------------------------------
# 1. Flask application and file paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "churn_pipeline.pkl"

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static")
)

FEATURES = [
    "tenure",
    "Contract",
    "MonthlyCharges",
    "InternetService",
    "OnlineSecurity",
    "TechSupport"
]

ALLOWED_VALUES = {
    "Contract": ["Month-to-month", "One year", "Two year"],
    "InternetService": ["DSL", "Fiber optic", "No"],
    "OnlineSecurity": ["Yes", "No", "No internet service"],
    "TechSupport": ["Yes", "No", "No internet service"]
}

# --------------------------------------------------
# 2. Load the trained ML pipeline
# --------------------------------------------------

if not MODEL_PATH.is_file():
    raise FileNotFoundError(
        f"Model file not found: {MODEL_PATH}"
    )

with open(MODEL_PATH, "rb") as file:
    pipeline = pickle.load(file)

if not hasattr(pipeline, "feature_names_in_"):
    raise ValueError(
        "The saved model does not expose its expected input features."
    )

MODEL_FEATURES = list(pipeline.feature_names_in_)

if MODEL_FEATURES != FEATURES:
    raise ValueError(
        "Model feature mismatch.\n"
        f"Expected by app: {FEATURES}\n"
        f"Expected by model: {MODEL_FEATURES}"
    )

print("=" * 55, flush=True)
print("ChurnWise Flask application started", flush=True)
print(f"Project folder: {BASE_DIR}", flush=True)
print(f"Model loaded: {MODEL_PATH}", flush=True)
print(f"Model features: {MODEL_FEATURES}", flush=True)
print("=" * 55, flush=True)


# --------------------------------------------------
# 3. Home page
# --------------------------------------------------

@app.route("/")
def home():
    return render_template("index.html")


# --------------------------------------------------
# 4. Prediction endpoint
# --------------------------------------------------

@app.route("/predict", methods=["POST"])
def predict():
    print("\nReceived prediction request.", flush=True)

    try:
        # Read JSON sent by the frontend
        data = request.get_json(silent=True)

        print(f"Received data: {data}", flush=True)

        if not isinstance(data, dict):
            return jsonify({
                "error": "Invalid request. Please submit customer data as JSON."
            }), 400

        # Check required fields
        missing_fields = [
            feature for feature in FEATURES
            if feature not in data
        ]

        if missing_fields:
            return jsonify({
                "error": (
                    "Missing required fields: "
                    + ", ".join(missing_fields)
                )
            }), 400

        # Build a DataFrame using the exact training columns
        input_df = pd.DataFrame(
            [{feature: data[feature] for feature in FEATURES}],
            columns=FEATURES
        )

        # Validate numeric values
        try:
            tenure = float(input_df.loc[0, "tenure"])
            monthly_charges = float(
                input_df.loc[0, "MonthlyCharges"]
            )
        except (ValueError, TypeError):
            return jsonify({
                "error": "Tenure and Monthly Charges must be valid numbers."
            }), 400

        if not pd.notna(tenure) or not 0 <= tenure <= 72:
            return jsonify({
                "error": "Tenure must be between 0 and 72 months."
            }), 400

        if not tenure.is_integer():
            return jsonify({
                "error": "Tenure must be a whole number."
            }), 400

        if (
            not pd.notna(monthly_charges)
            or monthly_charges < 0
            or monthly_charges > 10000
        ):
            return jsonify({
                "error": "Enter valid Monthly Charges."
            }), 400

        input_df["tenure"] = int(tenure)
        input_df["MonthlyCharges"] = monthly_charges

        # Validate categorical values
        for column, allowed in ALLOWED_VALUES.items():
            value = input_df.loc[0, column]

            if not isinstance(value, str) or value not in allowed:
                return jsonify({
                    "error": (
                        f"Invalid value for {column}. "
                        f"Allowed values: {', '.join(allowed)}"
                    )
                }), 400

        # Ensure the exact feature order
        input_df = input_df[FEATURES]

        print(
            f"Input columns: {list(input_df.columns)}",
            flush=True
        )
        print(
            f"Input values: {input_df.to_dict(orient='records')}",
            flush=True
        )

        # Run the trained pipeline
        prediction = int(pipeline.predict(input_df)[0])

        probabilities = pipeline.predict_proba(input_df)[0]
        classes = list(pipeline.classes_)

        if 1 not in classes:
            raise ValueError(
                f"Churn class 1 not found. Model classes: {classes}"
            )

        churn_probability = float(
            probabilities[classes.index(1)] * 100
        )

        result = {
            "prediction": (
                "Will Churn (Leave)"
                if prediction == 1
                else "Will Stay"
            ),
            "probability": round(churn_probability, 2)
        }

        print(f"Prediction result: {result}", flush=True)

        return jsonify(result), 200

    except Exception as error:
        print("\nPREDICTION ERROR:", repr(error), flush=True)
        traceback.print_exc()

        return jsonify({
            "error": (
                "Prediction failed on the server. "
                f"Details: {str(error)}"
            )
        }), 500


# --------------------------------------------------
# 5. Run Flask
# --------------------------------------------------

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False,
        use_reloader=False
    )
