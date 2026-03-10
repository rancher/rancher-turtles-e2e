// This makes VS Code happy when we use `qase` in our tests without importing it
declare global {
  function qase(id: number | string | number[], test: any): any;
}

export {};
