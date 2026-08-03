"""
Unit Tests for Smart Home Temperature Control Agent
"""

import unittest
from smart_home_agent import (
    Environment, TemperatureSensor, GoalBasedAgent, ReflexAgent,
    GoalMode, HVACState, Percept, run_simulation
)


class TestSmartHomeAgent(unittest.TestCase):

    def setUp(self):
        self.sensor = TemperatureSensor(noise_std=0.0)

    def test_goal_agent_cooling_trigger(self):
        """Verify GoalBasedAgent turns on cooling when temp exceeds upper bound (22 + 0.5 = 22.5)."""
        agent = GoalBasedAgent(target_temp=22.0, mode=GoalMode.COMFORT)
        percept = Percept(current_temp=23.0, target_temp=22.0, ambient_temp=30.0)
        action = agent.perceive_and_act(percept)

        self.assertEqual(action.state, HVACState.COOLING)
        self.assertGreater(action.power_level, 0.0)

    def test_goal_agent_hysteresis_holding(self):
        """Verify GoalBasedAgent stays OFF when temp is inside tolerance window (22.3°C for 22°C goal)."""
        agent = GoalBasedAgent(target_temp=22.0, mode=GoalMode.COMFORT)
        percept = Percept(current_temp=22.3, target_temp=22.0, ambient_temp=30.0)
        action = agent.perceive_and_act(percept)

        self.assertEqual(action.state, HVACState.OFF)

    def test_goal_agent_heating_trigger(self):
        """Verify GoalBasedAgent turns on heating when temp drops below lower bound (22 - 0.5 = 21.5)."""
        agent = GoalBasedAgent(target_temp=22.0, mode=GoalMode.COMFORT)
        percept = Percept(current_temp=21.0, target_temp=22.0, ambient_temp=10.0)
        action = agent.perceive_and_act(percept)

        self.assertEqual(action.state, HVACState.HEATING)

    def test_eco_mode_wider_tolerance(self):
        """Verify ECO mode uses wider tolerance (1.2°C) than COMFORT mode (0.5°C)."""
        agent_eco = GoalBasedAgent(target_temp=22.0, mode=GoalMode.ECO)
        self.assertEqual(agent_eco.tolerance, 1.2)

        # 22.8°C is inside ECO window (22 +/- 1.2 -> 20.8 to 23.2), so it should stay OFF
        percept = Percept(current_temp=22.8, target_temp=22.0, ambient_temp=30.0)
        action = agent_eco.perceive_and_act(percept)
        self.assertEqual(action.state, HVACState.OFF)

    def test_goal_vs_reflex_switching_count(self):
        """Verify GoalBasedAgent results in significantly fewer compressor state switches than ReflexAgent."""
        results = run_simulation(steps=50, target_temp=22.0)
        self.assertLess(results["goal_switches"], results["reflex_switches"])


if __name__ == "__main__":
    unittest.main()
