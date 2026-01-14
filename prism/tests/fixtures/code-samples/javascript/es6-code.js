/**
 * ES6 JavaScript code for testing
 */

// Arrow functions
const add = (a, b) => a + b;
const subtract = (a, b) => a - b;

// Template literals
const greet = (name) => {
  return `Hello, ${name}!`;
};

// Destructuring
const createUser = ({ name, age, email }) => {
  return { id: Date.now(), name, age, email };
};

// Spread operator
const mergeObjects = (...objs) => {
  return Object.assign({}, ...objs);
};

// Array methods
const sumArray = (arr) => arr.reduce((sum, val) => sum + val, 0);

// Async/await
const fetchData = async (url) => {
  const response = await fetch(url);
  return response.json();
};

// Class with private fields
class Counter {
  #count = 0;

  increment() {
    this.#count++;
  }

  decrement() {
    this.#count--;
  }

  getValue() {
    return this.#count;
  }
}

// Export
export {
  add,
  subtract,
  greet,
  createUser,
  mergeObjects,
  sumArray,
  fetchData,
  Counter
};
