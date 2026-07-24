import pytest
from app.services.limits_calculator import calculate_remaining_fuel, calculate_usage_percentage


def test_calculate_remaining_fuel_normal():
    """Test correct calculation of remaining fuel from limit and usage."""
    monthly_limit = 1000.0
    total_used = 450.5
    remaining = calculate_remaining_fuel(monthly_limit, total_used)
    assert remaining == 549.5


def test_calculate_remaining_fuel_zero_limit():
    """Test the case where the monthly limit is zero."""
    remaining = calculate_remaining_fuel(0.0, 50.0)
    assert remaining == 0.0


def test_calculate_usage_percentage_normal():
    """Test accurate calculation of usage percentage."""
    percentage = calculate_usage_percentage(monthly_limit=1000.0, total_used=250.0)
    assert percentage == 25.0


def test_calculate_usage_percentage_over_limit():
    """Test the case where usage exceeds 100% of the limit."""
    percentage = calculate_usage_percentage(monthly_limit=500.0, total_used=600.0)
    assert percentage == 120.0


def test_calculate_usage_percentage_zero_division():
    """Test prevention of ZeroDivisionError when the limit is 0."""
    percentage = calculate_usage_percentage(monthly_limit=0.0, total_used=100.0)
    assert percentage == 100.0