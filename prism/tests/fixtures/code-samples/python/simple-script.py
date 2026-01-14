"""
Simple Python script for testing
"""

from typing import List, Optional
from dataclasses import dataclass
from datetime import datetime


def add(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b


def subtract(a: int, b: int) -> int:
    """Subtract b from a."""
    return a - b


def multiply(a: int, b: int) -> int:
    """Multiply two numbers."""
    return a * b


def divide(a: float, b: float) -> float:
    """Divide a by b."""
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b


@dataclass
class Person:
    """A simple person class."""
    name: str
    age: int
    email: Optional[str] = None

    def greet(self) -> str:
        """Return a greeting message."""
        return f"Hello, my name is {self.name} and I'm {self.age} years old."


def process_people(people: List[Person]) -> List[str]:
    """Process a list of people and return greetings."""
    return [person.greet() for person in people]


def main():
    """Main function."""
    # Simple calculations
    result = add(10, 20)
    print(f"10 + 20 = {result}")

    # Person example
    person = Person(name="Alice", age=30, email="alice@example.com")
    print(person.greet())

    # List processing
    people = [
        Person(name="Bob", age=25),
        Person(name="Charlie", age=35),
    ]
    greetings = process_people(people)
    for greeting in greetings:
        print(greeting)


if __name__ == "__main__":
    main()
