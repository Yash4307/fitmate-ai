from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

WORKOUT_PLANS = {
    "fat_loss": {
        "Day 1 (Upper Body)": [
            {"exercise": "Push-ups", "sets": 3, "reps": "12-15", "instructions": "Keep body straight, lower chest to floor, push back up."},
            {"exercise": "Dumbbell Shoulder Press", "sets": 3, "reps": "10-12", "instructions": "Press dumbbells overhead, control the descent."},
            {"exercise": "Tricep Dips (Chair)", "sets": 3, "reps": "10-12", "instructions": "Use a stable chair, dip down until elbows are 90°."},
            {"exercise": "Plank", "sets": 3, "reps": "30 sec", "instructions": "Keep hips level, brace core, breathe steadily."},
        ],
        "Day 2 (Lower Body)": [
            {"exercise": "Bodyweight Squats", "sets": 3, "reps": "15-20", "instructions": "Feet shoulder-width, squat until thighs are parallel to floor."},
            {"exercise": "Reverse Lunges", "sets": 3, "reps": "10 each leg", "instructions": "Step back, lower knee close to floor, push through front heel."},
            {"exercise": "Glute Bridges", "sets": 3, "reps": "15", "instructions": "Lie on back, push hips up, squeeze glutes at top."},
            {"exercise": "Calf Raises", "sets": 3, "reps": "20", "instructions": "Stand tall, rise on toes slowly, control descent."},
        ],
        "Day 3 (Cardio & Core)": [
            {"exercise": "Jumping Jacks", "sets": 3, "reps": "30 sec", "instructions": "Jump feet wide while raising arms overhead, keep a steady pace."},
            {"exercise": "High Knees", "sets": 3, "reps": "30 sec", "instructions": "Run in place, bring knees to hip height alternately."},
            {"exercise": "Bicycle Crunches", "sets": 3, "reps": "15 each side", "instructions": "Touch opposite elbow to knee, rotate through core."},
            {"exercise": "Mountain Climbers", "sets": 3, "reps": "20 each leg", "instructions": "In plank position, drive knees to chest alternately."},
        ],
        "Day 4 (Rest / Light Walk)": [
            {"exercise": "Brisk Walk", "sets": 1, "reps": "20-30 min", "instructions": "Maintain a pace where you can talk but feel slightly breathless."},
            {"exercise": "Stretching", "sets": 1, "reps": "10-15 min", "instructions": "Hold each stretch for 20-30 seconds, focus on legs and back."},
        ],
        "Day 5 (Full Body Circuit)": [
            {"exercise": "Push-ups", "sets": 3, "reps": "12", "instructions": "Keep body straight, lower chest to floor, push back up."},
            {"exercise": "Squats", "sets": 3, "reps": "15", "instructions": "Feet shoulder-width, squat until thighs are parallel to floor."},
            {"exercise": "Plank", "sets": 3, "reps": "40 sec", "instructions": "Keep hips level, brace core, breathe steadily."},
            {"exercise": "Dumbbell Rows", "sets": 3, "reps": "10 each arm", "instructions": "Hinge at hips, pull dumbbell to hip, squeeze shoulder blade."},
        ],
        "Day 6 (Cardio Blast)": [
            {"exercise": "Burpees", "sets": 3, "reps": "8-10", "instructions": "Jump up, drop to plank, do a push-up, jump feet to hands, repeat."},
            {"exercise": "Jump Squats", "sets": 3, "reps": "12", "instructions": "Squat down then explode upward, land softly."},
            {"exercise": "Side Plank", "sets": 3, "reps": "20 sec each", "instructions": "Balance on one forearm and foot, keep hips raised."},
            {"exercise": "Leg Raises", "sets": 3, "reps": "12", "instructions": "Lie flat, raise legs to 90°, lower slowly without touching floor."},
        ],
        "Day 7 (Rest)": [
            {"exercise": "Complete Rest", "sets": 1, "reps": "Full day", "instructions": "Let your body recover. Light stretching or yoga is optional."},
        ],
    },
    "muscle_gain": {
        "Day 1 (Chest & Triceps)": [
            {"exercise": "Push-ups", "sets": 4, "reps": "10-12", "instructions": "Keep body straight, lower chest to floor, push back up."},
            {"exercise": "Wide Push-ups", "sets": 3, "reps": "10", "instructions": "Hands wider than shoulder-width to target outer chest."},
            {"exercise": "Dumbbell Chest Press", "sets": 3, "reps": "10-12", "instructions": "Press dumbbells up from chest level, fully extend arms."},
            {"exercise": "Tricep Dips (Chair)", "sets": 3, "reps": "10", "instructions": "Use a stable chair, dip down until elbows are 90°."},
        ],
        "Day 2 (Back & Biceps)": [
            {"exercise": "Dumbbell Rows", "sets": 4, "reps": "10 each arm", "instructions": "Hinge at hips, pull dumbbell to hip, squeeze shoulder blade."},
            {"exercise": "Superman Hold", "sets": 3, "reps": "12", "instructions": "Lie face down, lift arms and legs, hold 2 sec at top."},
            {"exercise": "Dumbbell Bicep Curls", "sets": 3, "reps": "12", "instructions": "Keep elbows fixed, curl weight to shoulder, squeeze bicep."},
            {"exercise": "Hammer Curls", "sets": 3, "reps": "10", "instructions": "Palms facing each other, curl dumbbell up with controlled motion."},
        ],
        "Day 3 (Legs)": [
            {"exercise": "Bodyweight Squats", "sets": 4, "reps": "15", "instructions": "Feet shoulder-width, squat until thighs are parallel to floor."},
            {"exercise": "Dumbbell Goblet Squat", "sets": 3, "reps": "12", "instructions": "Hold dumbbell at chest, squat deep, keep torso upright."},
            {"exercise": "Lunges", "sets": 3, "reps": "10 each leg", "instructions": "Step forward, lower back knee near floor, push back."},
            {"exercise": "Glute Bridges", "sets": 3, "reps": "15", "instructions": "Lie on back, push hips up, squeeze glutes at top."},
            {"exercise": "Calf Raises", "sets": 4, "reps": "20", "instructions": "Stand tall, rise on toes slowly, control descent."},
        ],
        "Day 4 (Shoulders & Core)": [
            {"exercise": "Dumbbell Shoulder Press", "sets": 4, "reps": "10-12", "instructions": "Press dumbbells overhead, control the descent."},
            {"exercise": "Lateral Raises", "sets": 3, "reps": "12", "instructions": "Raise dumbbells to shoulder height with slight elbow bend."},
            {"exercise": "Plank", "sets": 3, "reps": "45 sec", "instructions": "Keep hips level, brace core, breathe steadily."},
            {"exercise": "Russian Twists", "sets": 3, "reps": "15 each side", "instructions": "Lean back slightly, rotate torso side to side with dumbbell."},
        ],
        "Day 5 (Full Body Compound)": [
            {"exercise": "Push-ups", "sets": 4, "reps": "12", "instructions": "Keep body straight, lower chest to floor, push back up."},
            {"exercise": "Squats", "sets": 4, "reps": "15", "instructions": "Feet shoulder-width, squat until thighs are parallel to floor."},
            {"exercise": "Dumbbell Rows", "sets": 3, "reps": "10 each arm", "instructions": "Hinge at hips, pull dumbbell to hip, squeeze shoulder blade."},
            {"exercise": "Dumbbell Bicep Curls", "sets": 3, "reps": "12", "instructions": "Keep elbows fixed, curl weight to shoulder, squeeze bicep."},
        ],
        "Day 6 (Active Recovery)": [
            {"exercise": "Brisk Walk", "sets": 1, "reps": "20-30 min", "instructions": "Maintain a pace where you can talk but feel slightly breathless."},
            {"exercise": "Stretching", "sets": 1, "reps": "15 min", "instructions": "Hold each stretch for 20-30 seconds, focus on legs and back."},
        ],
        "Day 7 (Rest)": [
            {"exercise": "Complete Rest", "sets": 1, "reps": "Full day", "instructions": "Let your body recover. Sleep 7-8 hours for maximum muscle growth."},
        ],
    },
}

DIET_PLANS = {
    "fat_loss": {
        "Breakfast": {
            "items": ["2 boiled eggs", "1 bowl poha (light, no potato)", "1 cup green tea"],
            "calories": 320,
            "tips": "Eat within 1 hour of waking. High protein breakfast reduces cravings.",
        },
        "Mid-Morning Snack": {
            "items": ["1 banana", "5-6 almonds", "1 glass water with lemon"],
            "calories": 160,
            "tips": "This keeps metabolism active and prevents overeating at lunch.",
        },
        "Lunch": {
            "items": ["2 whole wheat rotis", "1 bowl dal (moong or masoor)", "Mixed vegetable sabzi", "1 bowl salad (cucumber, tomato, onion)"],
            "calories": 450,
            "tips": "Eat slowly, chew well. Avoid extra ghee. Load up on vegetables.",
        },
        "Evening Snack": {
            "items": ["1 cup buttermilk (chaas)", "1 fruit (apple or guava)", "Handful of roasted chana"],
            "calories": 180,
            "tips": "Avoid biscuits or fried snacks. Chaas aids digestion.",
        },
        "Dinner": {
            "items": ["1 bowl brown rice or 2 rotis", "100g grilled paneer or 2 eggs", "1 bowl sabzi with spinach or broccoli", "1 glass warm water"],
            "calories": 420,
            "tips": "Eat 2-3 hours before bed. Keep dinner lighter than lunch.",
        },
    },
    "muscle_gain": {
        "Breakfast": {
            "items": ["3 scrambled eggs with paneer", "2 whole wheat rotis", "1 glass full-fat milk", "1 banana"],
            "calories": 620,
            "tips": "High protein + carbs post overnight fast kickstarts muscle protein synthesis.",
        },
        "Mid-Morning Snack": {
            "items": ["1 cup Greek yogurt (curd)", "1 tablespoon peanut butter on roti", "1 glass milk or protein shake"],
            "calories": 350,
            "tips": "Calorie-dense snack to hit daily surplus. Critical for muscle gain.",
        },
        "Lunch": {
            "items": ["1.5 cups rice", "2 whole wheat rotis", "1 bowl rajma or chana", "150g chicken or paneer", "Dal tadka"],
            "calories": 750,
            "tips": "Biggest meal of the day. Prioritize protein and complex carbs.",
        },
        "Evening Snack (Pre-Workout)": {
            "items": ["2 bananas", "1 cup curd", "4-5 dates", "Handful of peanuts"],
            "calories": 400,
            "tips": "Eat 45-60 min before workout. Provides energy for intense training.",
        },
        "Dinner": {
            "items": ["2 cups rice or 3 rotis", "200g paneer or 3 eggs", "Dal makhani (no cream)", "1 bowl mixed vegetables"],
            "calories": 680,
            "tips": "Post-workout: high protein dinner for muscle repair overnight.",
        },
    },
}

YOUTUBE_LINKS = {
    "Push-ups": "https://www.youtube.com/watch?v=IODxDxX7oi4",
    "Bodyweight Squats": "https://www.youtube.com/watch?v=aclHkVaku9U",
    "Squats": "https://www.youtube.com/watch?v=aclHkVaku9U",
    "Plank": "https://www.youtube.com/watch?v=ASdvN_XEl_c",
    "Dumbbell Shoulder Press": "https://www.youtube.com/watch?v=qEwKCR5JCog",
    "Tricep Dips (Chair)": "https://www.youtube.com/watch?v=6kALZikXxLc",
    "Dumbbell Rows": "https://www.youtube.com/watch?v=roCP6wCXPqo",
    "Dumbbell Bicep Curls": "https://www.youtube.com/watch?v=ykJmrZ5v0Oo",
    "Lunges": "https://www.youtube.com/watch?v=QOVaHwm-Q6U",
    "Burpees": "https://www.youtube.com/watch?v=818Dq4k5hgo",
    "Mountain Climbers": "https://www.youtube.com/watch?v=nmwgirgXLYM",
    "Jumping Jacks": "https://www.youtube.com/watch?v=iSSAk4XCsRA",
    "Glute Bridges": "https://www.youtube.com/watch?v=wPM8icPu6H8",
    "Lateral Raises": "https://www.youtube.com/watch?v=3VcKaXpzqRo",
}


def calculate_bmi(weight, height):
    height_m = height / 100
    bmi = weight / (height_m ** 2)
    if bmi < 18.5:
        category = "Underweight"
    elif bmi < 25:
        category = "Normal weight"
    elif bmi < 30:
        category = "Overweight"
    else:
        category = "Obese"
    return round(bmi, 1), category


def calculate_tdee(age, weight, height, goal):
    bmr = 10 * weight + 6.25 * height - 5 * age + 5
    tdee = bmr * 1.375
    if goal == "fat_loss":
        target = int(tdee - 400)
        label = "Caloric Deficit"
    else:
        target = int(tdee + 300)
        label = "Caloric Surplus"
    return int(tdee), target, label


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/healthz")
def healthz():
    return "ok", 200


@app.route("/result")
def result():
    return render_template("result.html")


@app.route("/generate-plan", methods=["POST"])
def generate_plan():
    data = request.get_json()

    age = int(data.get("age", 25))
    weight = float(data.get("weight", 70))
    height = float(data.get("height", 170))
    goal = data.get("goal", "fat_loss")
    experience = data.get("experience", "beginner")

    bmi, bmi_category = calculate_bmi(weight, height)
    tdee, target_calories, calorie_label = calculate_tdee(age, weight, height, goal)

    workout_plan = WORKOUT_PLANS.get(goal, WORKOUT_PLANS["fat_loss"])
    diet_plan = DIET_PLANS.get(goal, DIET_PLANS["fat_loss"])

    enriched_workout = {}
    for day, exercises in workout_plan.items():
        enriched_exercises = []
        for ex in exercises:
            enriched_ex = dict(ex)
            enriched_ex["youtube"] = YOUTUBE_LINKS.get(ex["exercise"], "")
            enriched_exercises.append(enriched_ex)
        enriched_workout[day] = enriched_exercises

    total_diet_calories = sum(meal["calories"] for meal in diet_plan.values())

    goal_label = "Fat Loss" if goal == "fat_loss" else "Muscle Gain"

    return jsonify({
        "success": True,
        "user": {
            "age": age,
            "weight": weight,
            "height": height,
            "goal": goal_label,
            "experience": experience.capitalize(),
            "bmi": bmi,
            "bmi_category": bmi_category,
            "tdee": tdee,
            "target_calories": target_calories,
            "calorie_label": calorie_label,
        },
        "workout_plan": enriched_workout,
        "diet_plan": diet_plan,
        "total_diet_calories": total_diet_calories,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
