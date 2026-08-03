"""
Smart Home Temperature Control Agent
------------------------------------
A goal-based intelligent agent that monitors room temperature, updates internal state,
evaluates goal setpoints with hysteresis control, and commands HVAC actuators to maintain optimal comfort.
Includes a Simple Reflex Agent for performance and stability comparison.
"""

from dataclasses import dataclass
from enum import Enum
import random
import time
from typing import Dict, List, Tuple, Any


class HVACState(Enum):
    OFF = "OFF"
    COOLING = "COOLING"
    HEATING = "HEATING"
    FAN_ONLY = "FAN_ONLY"


class GoalMode(Enum):
    COMFORT = "COMFORT"   # Tight tolerance (e.g., +/- 0.5°C)
    ECO = "ECO"           # Wider tolerance (e.g., +/- 1.5°C) to save energy


@dataclass
class Percept:
    """Sensor readings provided to the agent at each time step."""
    current_temp: float
    target_temp: float
    ambient_temp: float
    occupants: int = 1


@dataclass
class Action:
    """Action commanded by the agent to the actuator."""
    state: HVACState
    power_level: float  # 0.0 to 1.0
    rationale: str


class Environment:
    """
    Simulates the physical room thermodynamics.
    dT/dt = -k_insulation * (T_room - T_ambient) + Q_hvac + Q_occupants + noise
    """

    def __init__(self, initial_temp: float = 28.0, ambient_temp: float = 32.0, insulation_factor: float = 0.05):
        self.room_temp: float = initial_temp
        self.ambient_temp: float = ambient_temp
        self.insulation_factor: float = insulation_factor  # Thermal transfer rate to outside
        self.occupants: int = 2
        self.hvac_state: HVACState = HVACState.OFF
        self.hvac_power: float = 0.0
        
        # Power constants (°C change per time step at 100% power)
        self.cooling_capacity: float = 0.35  # max °C drop per step
        self.heating_capacity: float = 0.30  # max °C rise per step
        self.occupant_heat: float = 0.02     # °C heat generated per occupant per step
        
        # Energy tracking
        self.total_energy_kwh: float = 0.0

    def step(self, action: Action, dt_minutes: float = 1.0) -> float:
        """Advance physical simulation by 1 time step."""
        self.hvac_state = action.state
        self.hvac_power = action.power_level
        
        # 1. Heat transfer with ambient outdoor air
        ambient_delta = -self.insulation_factor * (self.room_temp - self.ambient_temp)
        
        # 2. HVAC thermal effect
        hvac_delta = 0.0
        power_kw = 0.0
        if action.state == HVACState.COOLING:
            hvac_delta = -self.cooling_capacity * action.power_level
            power_kw = 2.5 * action.power_level  # 2.5 kW compressor
        elif action.state == HVACState.HEATING:
            hvac_delta = self.heating_capacity * action.power_level
            power_kw = 2.0 * action.power_level  # 2.0 kW heater
        elif action.state == HVACState.FAN_ONLY:
            power_kw = 0.05  # 50W fan
            
        # Accumulate energy (kW * hours)
        self.total_energy_kwh += power_kw * (dt_minutes / 60.0)
        
        # 3. Internal heat gains (occupants, electronics)
        internal_gains = self.occupants * self.occupant_heat
        
        # 4. Small environmental fluctuation noise (+/- 0.02°C)
        noise = random.uniform(-0.02, 0.02)
        
        # Update room temperature
        self.room_temp += (ambient_delta + hvac_delta + internal_gains + noise)
        return self.room_temp


class TemperatureSensor:
    """Simulates thermometer with optional Gaussian measurement noise."""
    
    def __init__(self, noise_std: float = 0.05):
        self.noise_std = noise_std

    def read(self, env: Environment, target_temp: float) -> Percept:
        noise = random.gauss(0, self.noise_std)
        perceived_temp = round(env.room_temp + noise, 2)
        return Percept(
            current_temp=perceived_temp,
            target_temp=target_temp,
            ambient_temp=env.ambient_temp,
            occupants=env.occupants
        )


class GoalBasedAgent:
    """
    Intelligent Goal-Based Agent for Smart Home Climate Control.
    
    Architecture components:
    - Percept Processing & State Estimation: Tracks temperature history and trend.
    - Goal Formulation: Maintains target setpoint and tolerance bounds (hysteresis).
    - Utility & Action Selection: Selects action to move state toward goal while minimizing switching cycles.
    """

    def __init__(self, target_temp: float = 22.0, mode: GoalMode = GoalMode.COMFORT):
        self.target_temp = target_temp
        self.mode = mode
        self.current_hvac_state: HVACState = HVACState.OFF
        self.temp_history: List[float] = []
        self.switch_count: int = 0

    @property
    def tolerance(self) -> float:
        """Hysteresis band to prevent rapid on/off cycling."""
        return 0.5 if self.mode == GoalMode.COMFORT else 1.2

    def perceive_and_act(self, percept: Percept) -> Action:
        self.temp_history.append(percept.current_temp)
        if len(self.temp_history) > 10:
            self.temp_history.pop(0)

        # Calculate rate of temperature change (trend)
        temp_trend = 0.0
        if len(self.temp_history) >= 2:
            temp_trend = self.temp_history[-1] - self.temp_history[-2]

        current = percept.current_temp
        target = percept.target_temp
        tol = self.tolerance

        upper_bound = target + tol
        lower_bound = target - tol

        new_state = self.current_hvac_state
        power = 1.0
        rationale = ""

        # Goal-Based Decision Logic with Hysteresis & Trend Anticipation
        if self.current_hvac_state == HVACState.OFF:
            if current > upper_bound:
                new_state = HVACState.COOLING
                rationale = f"Temp {current:.1f}°C exceeded upper goal limit ({upper_bound:.1f}°C). Activating cooling."
            elif current < lower_bound:
                new_state = HVACState.HEATING
                rationale = f"Temp {current:.1f}°C fell below lower goal limit ({lower_bound:.1f}°C). Activating heating."
            else:
                rationale = f"Temp {current:.1f}°C is comfortably within goal bounds [{lower_bound:.1f}°C, {upper_bound:.1f}°C]."

        elif self.current_hvac_state == HVACState.COOLING:
            # Continue cooling until reaching goal setpoint (or lower bound)
            if current <= target:
                new_state = HVACState.OFF
                rationale = f"Target temp {target:.1f}°C reached. Turning off cooling to conserve energy."
            else:
                # Modulate power as temperature approaches goal
                diff = current - target
                power = min(1.0, max(0.4, diff / 2.0))
                rationale = f"Cooling in progress. Diff to goal: {diff:+.1f}°C. Power modulated to {power*100:.0f}%."

        elif self.current_hvac_state == HVACState.HEATING:
            # Continue heating until reaching goal setpoint (or upper bound)
            if current >= target:
                new_state = HVACState.OFF
                rationale = f"Target temp {target:.1f}°C reached. Turning off heating."
            else:
                diff = target - current
                power = min(1.0, max(0.4, diff / 2.0))
                rationale = f"Heating in progress. Diff to goal: {-diff:+.1f}°C. Power modulated to {power*100:.0f}%."

        if new_state != self.current_hvac_state:
            self.switch_count += 1
            self.current_hvac_state = new_state

        return Action(state=new_state, power_level=power, rationale=rationale)


class ReflexAgent:
    """
    Simple Reflex Agent without internal state memory or hysteresis tolerance.
    Switches state purely based on current percept vs target (IF T > Target THEN Cool).
    Demonstrates 'short-cycling' oscillation bug.
    """

    def __init__(self, target_temp: float = 22.0):
        self.target_temp = target_temp
        self.current_hvac_state: HVACState = HVACState.OFF
        self.switch_count: int = 0

    def perceive_and_act(self, percept: Percept) -> Action:
        current = percept.current_temp
        target = percept.target_temp

        new_state = HVACState.OFF
        if current > target:
            new_state = HVACState.COOLING
        elif current < target:
            new_state = HVACState.HEATING

        if new_state != self.current_hvac_state:
            self.switch_count += 1
            self.current_hvac_state = new_state

        rationale = f"Reflex rule: T={current:.1f}°C vs Target={target:.1f}°C => {new_state.value}"
        return Action(state=new_state, power_level=1.0, rationale=rationale)


def run_simulation(steps: int = 100, target_temp: float = 22.0) -> Dict[str, Any]:
    """Runs simulation comparing GoalBasedAgent vs ReflexAgent."""
    # Start closer to target to observe setpoint hovering and chatter behavior
    env_goal = Environment(initial_temp=22.2, ambient_temp=28.0)
    env_reflex = Environment(initial_temp=22.2, ambient_temp=28.0)

    sensor = TemperatureSensor(noise_std=0.03)
    goal_agent = GoalBasedAgent(target_temp=target_temp, mode=GoalMode.COMFORT)
    reflex_agent = ReflexAgent(target_temp=target_temp)

    history = []

    for t in range(steps):
        # Dynamically change ambient temperature halfway through
        if t == 50:
            env_goal.ambient_temp = 32.0
            env_reflex.ambient_temp = 32.0

        p_goal = sensor.read(env_goal, target_temp)
        p_reflex = sensor.read(env_reflex, target_temp)

        a_goal = goal_agent.perceive_and_act(p_goal)
        a_reflex = reflex_agent.perceive_and_act(p_reflex)

        temp_g = env_goal.step(a_goal)
        temp_r = env_reflex.step(a_reflex)

        history.append({
            "step": t,
            "goal_temp": temp_g,
            "goal_action": a_goal.state.value,
            "reflex_temp": temp_r,
            "reflex_action": a_reflex.state.value
        })

    return {
        "history": history,
        "goal_switches": goal_agent.switch_count,
        "goal_energy_kwh": env_goal.total_energy_kwh,
        "reflex_switches": reflex_agent.switch_count,
        "reflex_energy_kwh": env_reflex.total_energy_kwh,
    }


if __name__ == "__main__":
    print("=== Smart Home Temperature Control Agent Simulation ===")
    results = run_simulation(steps=50, target_temp=22.0)
    print(f"Goal-Based Agent   -> Switches: {results['goal_switches']} | Energy: {results['goal_energy_kwh']:.3f} kWh")
    print(f"Simple Reflex Agent -> Switches: {results['reflex_switches']} | Energy: {results['reflex_energy_kwh']:.3f} kWh")
