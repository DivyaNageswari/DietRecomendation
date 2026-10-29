# Diet Recommendation System

An intelligent diet recommendation and multi-criteria meal planning web application rewritten in React, TypeScript, and Tailwind CSS from the original USDA/OpenFoodFacts machine learning pipeline.

## Features

- **Multi-Criteria Goal Optimization**:
  - Weight Loss, Muscle Gain, Heart Health, Diabetic-Friendly, and Balanced Diet goal weight sliders.
  - Normalization and weighted sum scoring algorithm ported directly from the mathematical specification.
  - Quick goal presets (Fat Loss & Cardio, Lean Muscle Hypertrophy, Diabetic Care, Cardio Longevity, Whole-Body Balance).

- **Three-State Allergen Safety Protocol**:
  - Selective filtering for 6 common allergens: Gluten, Dairy, Nuts, Soy, Eggs, Fish.
  - **Strict Allergen Mode**: Excludes both confirmed present (`1`) and unverified/shared facility (`-1`) foods, ensuring allergen safety.
  - Permissive mode toggle to only exclude confirmed allergens (`1`).

- **4-Meal Daily Schedule Allocation**:
  - Heuristic meal slot classification: Morning (Breakfast), Afternoon (Lunch), Afternoon (Dinner), and Snack.
  - Slot swapping, alternative recommendations, and subtotal calorie/macro counts.

- **Nutrition Synthesis & RDA Benchmarks**:
  - Real-time aggregate tally of Calories, Protein, Carbs, Fat, Dietary Fiber, Sugars, Sodium, and Average Health Index.
  - Recommended Daily Allowance (RDA) reference visualizers.

- **Machine Learning & Neural Classifier Lab**:
  - Simulates the Multi-Layer Perceptron (MLP) (64, 32) classifier with Softmax probability distributions.
  - Real-time prediction sandbox with continuous nutrient sliders and PCA 2D coordinates.
  - Model evaluation report and confusion matrix viewer.

- **Food Database Explorer**:
  - Search, filter by category/slot/allergen clearance, sort by health score/protein/fiber/calories.
  - Add custom food items and recipes with automatic real-time classification.

## Tech Stack

- **Framework**: React 19, TypeScript
- **Backend & Dev Server**: Express 5 + Vite 6 (`tsx server.ts`)
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL (via `pg`) with automatic persistent file fallback (`.user_data_cache.json`)
- **Icons**: Lucide React

## Local Setup & Running Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **npm** (comes bundled with Node.js)
- *(Optional)* **PostgreSQL & pgAdmin 4** (if you want to use an external PostgreSQL database)

---

### Step 1: Install Dependencies
Open your terminal inside the project root folder and run:
```bash
npm install
```

---

### Step 2: Environment Configuration (Optional)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(On Windows Command Prompt: `copy .env.example .env`)*

- **Option A (Zero-configuration mode)**: 
  You can run without configuring anything. If PostgreSQL is not running or not configured, the app will automatically use the built-in persistent local JSON database (`.user_data_cache.json`).
- **Option B (With PostgreSQL in pgAdmin 4)**:
  1. Open pgAdmin 4 and create a database named `diet_recommendation`.
  2. In your `.env` file, set your PostgreSQL password and port:
     ```env
     PGHOST=localhost
     PGPORT=5432
     PGDATABASE=diet_recommendation
     PGUSER=postgres
     PGPASSWORD=your_postgres_password
     ```
  3. The tables (`users`, `user_preferences`, `weekly_schedules`, `diet_schedule_history`) will be created automatically when the server boots.

---

### Step 3: Run the Development Server
```bash
npm run dev
```

The server will start on:
**[http://localhost:3000](http://localhost:3000)**

---

### Production Build & Run
To create an optimized production build:
```bash
npm run build
npm start
```
