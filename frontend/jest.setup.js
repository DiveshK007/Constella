require("@testing-library/jest-dom");

// recharts (used by the metrics page) needs ResizeObserver, which jsdom lacks.
global.ResizeObserver =
  global.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

// jsdom lacks AbortSignal.timeout, which the fetch call sites use.
if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout !== "function") {
  AbortSignal.timeout = (ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}
