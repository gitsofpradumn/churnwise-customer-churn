
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll(".content-section");
const pageTitle = document.getElementById("page-title");

const titles = {
    home: "Welcome to ChurnWise",
    prediction: "Churn Prediction",
    risk: "Customer Risk Assessment",
    retention: "Retention Tips",
    learn: "Know About Customer Churn",
    model: "About the Model"
};

let latestPrediction = null;

// ------------------------------
// NAVIGATION
// ------------------------------
function showSection(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;

    sections.forEach(section => {
        section.classList.toggle("active", section.id === sectionId);
    });

    navLinks.forEach(link => {
        link.classList.toggle(
            "active",
            link.dataset.section === sectionId
        );
    });

    pageTitle.textContent = titles[sectionId] || "ChurnWise";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

navLinks.forEach(link => {
    link.addEventListener("click", () => {
        showSection(link.dataset.section);
    });
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        showSection(button.dataset.go);
    });
});

// ------------------------------
// FORM ELEMENTS
// ------------------------------
const form = document.getElementById("churn-form");
const predictButton = document.getElementById("predict-button");
const resultBox = document.getElementById("result-box");

function getValue(id) {
    return document.getElementById(id).value;
}

// ------------------------------
// COLLECT ONLY SIX FEATURES
// ------------------------------
function collectCustomerData() {
    return {
        tenure: Number(getValue("tenure")),
        Contract: getValue("Contract"),
        MonthlyCharges: Number(getValue("MonthlyCharges")),
        InternetService: getValue("InternetService"),
        OnlineSecurity: getValue("OnlineSecurity"),
        TechSupport: getValue("TechSupport")
    };
}

// ------------------------------
// ERROR DISPLAY
// ------------------------------
function showError(message) {
    resultBox.hidden = false;
    resultBox.className = "result-box error";

    document.getElementById("result-status").textContent =
        "Prediction unavailable";

    document.getElementById("result-description").textContent =
        message;

    document.getElementById("probability-value").textContent = "—";
    document.getElementById("progress-bar").style.width = "0%";

    resultBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

// ------------------------------
// RISK LEVEL
// ------------------------------
function getRiskLevel(probability) {
    if (probability < 30) return "Low";
    if (probability < 60) return "Medium";
    return "High";
}

// ------------------------------
// DISPLAY PREDICTION
// ------------------------------
function displayPrediction(data, prediction, probability) {
    const predictionText = String(prediction);
    const normalized = predictionText.toLowerCase().trim();

    const isChurn =
        normalized.includes("leave") ||
        normalized.includes("churn") ||
        normalized === "1";

    const risk = getRiskLevel(probability);

    latestPrediction = {
        data,
        prediction: predictionText,
        probability,
        risk,
        isChurn
    };

    resultBox.hidden = false;
    resultBox.className =
        "result-box " + (isChurn ? "churn" : "stay");

    document.getElementById("result-status").textContent =
        predictionText;

    document.getElementById("result-description").textContent =
        isChurn
            ? "The model predicts potential churn. Review the customer's contract, service experience, and support needs."
            : "The model predicts that the customer will stay. Continue monitoring their needs and delivering good service.";

    document.getElementById("probability-value").textContent =
        probability.toFixed(2) + "%";

    document.getElementById("progress-bar").style.width =
        probability + "%";

    document.getElementById("risk-level").textContent =
        risk + " Risk";

    document.getElementById("risk-summary").textContent =
        "The model estimates a " +
        probability.toFixed(2) +
        "% chance of churn for this customer.";

    document.getElementById("risk-probability").textContent =
        probability.toFixed(2) + "%";

    document.getElementById("risk-progress").style.width =
        probability + "%";

    document.getElementById("retention-summary").textContent =
        isChurn
            ? "Potential churn detected. Consider reviewing the customer's contract, pricing, online security needs, and technical support experience."
            : "The model predicts that the customer will stay. Continue providing reliable service and monitor customer feedback.";

    resultBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

// ------------------------------
// FORM SUBMISSION
// ------------------------------
form.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const data = collectCustomerData();

    if (
        !Number.isFinite(data.tenure) ||
        data.tenure < 0 ||
        data.tenure > 72 ||
        !Number.isInteger(data.tenure) ||
        !Number.isFinite(data.MonthlyCharges) ||
        data.MonthlyCharges < 0
    ) {
        showError("Please enter valid customer values.");
        return;
    }

    predictButton.disabled = true;
    predictButton.textContent = "Analyzing customer...";
    resultBox.hidden = true;

    try {
        const response = await fetch("/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error(
                "The server returned an unexpected response. Check Flask's terminal."
            );
        }

        if (!response.ok || result.error) {
            throw new Error(
                result.error || "The prediction request failed."
            );
        }

        if (
            result.prediction === undefined ||
            result.probability === undefined
        ) {
            throw new Error(
                "The server response is missing the prediction or probability."
            );
        }

        const probability = Number(
            String(result.probability).replace("%", "").trim()
        );

        if (
            !Number.isFinite(probability) ||
            probability < 0 ||
            probability > 100
        ) {
            throw new Error(
                "The server returned an invalid churn probability."
            );
        }

        displayPrediction(
            data,
            result.prediction,
            probability
        );

    } catch (error) {
        showError(
            error.message ||
            "Unable to connect to the Flask prediction service."
        );
    } finally {
        predictButton.disabled = false;
        predictButton.textContent = "Predict Churn";
    }
});

// ------------------------------
// RESET FORM
// ------------------------------
form.addEventListener("reset", function() {
    setTimeout(() => {
        resultBox.hidden = true;
    }, 0);
});

