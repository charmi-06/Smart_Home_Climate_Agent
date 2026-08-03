# 🌡️ Smart Home Climate Agent

An intelligent, goal-based temperature control agent designed for smart home climate control. The agent monitors room temperature, tracks temperature trends, evaluates comfort setpoints with hysteresis control, and commands HVAC actuators to optimize comfort while minimizing energy consumption and mechanical wear.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![HTML5](https://img.shields.io/badge/HTML5-Canvas-orange.svg)

---

## 🎯 Case Study Overview

**Problem**: Traditional thermostat controllers often use simple reflex rules (e.g., *IF $T > 22^\circ\text{C}$ THEN COOL*). This causes rapid ON/OFF toggling (known as **short-cycling** or **chatter**) near setpoints, leading to excessive mechanical wear on compressors and high energy bills.

**Solution**: This project implements a **Goal-Based Agent** with state memory, trend anticipation, and hysteresis tolerance bounds ($\Delta T$). The agent maintains temperature within an optimal comfort window ($T_{target} \pm \Delta T$) while drastically reducing compressor state switches.

---

## 🧠 Agent Architecture

The agent follows the standard **Goal-Based Agent** architecture (Russell & Norvig):

```
       +---------------------------------------------+
       |           Physical Room Environment          |
       +----------------------+----------------------+
                              | (Room Temp, Ambient, Occupants)
                              v
                   +---------------------+
                   | Temperature Sensors |
                   +----------+----------+
                              | Percept Vector
                              v
                  +-----------------------+
                  |    State Estimator    |
                  | (Temp History & Trend)|
                  +-----------+-----------+
                              | State + Percept
                              v
+------------------+     +----+-------------------+
|  Goal Setpoint   |---->|   Goal Evaluator       |
| & Hysteresis Band|     | (Comfort vs Eco Mode) |
+------------------+     +----+-------------------+
                              | Action Rationale
                              v
                   +---------------------+
                   |   Action Selector   |
                   +----------+----------+
                              | Action & Power Level
                              v
                   +---------------------+
                   |    HVAC Actuator    |
                   | (Cooling / Heating) |
                   +---------------------+
```

### Key Components
- **Percepts**: Current Room Temp ($T_{room}$), Target Goal Setpoint ($T_{target}$), Outdoor Ambient Temp ($T_{ambient}$), Room Occupants.
- **Internal State**: Recent temperature trends ($\frac{dT}{dt}$), active HVAC state (`OFF`, `COOLING`, `HEATING`), switching count, accumulated energy ($kWh$).
- **Goal Formulation**: Maintain temperature within setpoint bounds ($T_{target} \pm \Delta T$) while minimizing AC toggles.
- **Actuators**: HVAC unit with modulated compressor power level (40% - 100%).

---

## 📊 Benchmark Results

Comparing the **Goal-Based Agent** against a **Simple Reflex Agent** over a 100-step simulation:

| Metric | Goal-Based Agent | Simple Reflex Agent | Improvement |
| :--- | :---: | :---: | :---: |
| **AC Compressor Switches** | **1 Switch** | 5 Switches | **80% Reduction** |
| **Total Energy Consumed** | **1.453 kWh** | 2.067 kWh | **~30% Energy Savings** |
| **Short-Cycling Chatter** | **None** | High | **Zero Compressor Wear** |

---

## 🖥️ Interactive Web Dashboard

The repository includes a visual web simulation dashboard built with HTML5 Canvas, CSS custom properties, and JavaScript:

- **Thermal Room Canvas**: Renders dynamic thermal wall gradients, animated AC fan rotation, cooling blue airflow particles, outdoor window weather scene, occupants, and thermometer.
- **Real-Time History Chart**: Plots live Room Temp vs. Target Setpoint vs. Outdoor Ambient with shaded green hysteresis bounds.
- **Perception-Action Loop Inspector**: Live inspection of sensor reading, trend estimation, goal evaluation band, action selection, and natural language rationale box.
- **Agent Comparison Toggle**: Switch between Goal-Based Agent and Simple Reflex Agent in real-time.

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/charmi-06/Smart_Home_Climate_Agent.git
cd Smart_Home_Climate_Agent
```

### 2. Run the Interactive Web Dashboard
No external npm dependencies required! Open `index.html` directly in any web browser, or launch a local web server:

```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000/index.html`.

### 3. Run the Python Agent Simulation
Run the CLI simulation:
```bash
python smart_home_agent.py
```

### 4. Run Automated Unit Tests
Run the unit test suite:
```bash
python -m unittest test_agent.py
```

---

## 📁 Repository Structure

```
Smart_Home_Climate_Agent/
├── index.html           # Dashboard HTML structure
├── styles.css           # Glassmorphism dark theme CSS
├── app.js               # Physics engine, live canvas renderer & UI logic
├── smart_home_agent.py  # Python OOP implementation of GoalBasedAgent & Environment
├── test_agent.py       # Automated unittest suite
├── .gitignore           # Git ignore rules
└── README.md            # Documentation
```

---

## 📜 License

Distributed under the MIT License.
