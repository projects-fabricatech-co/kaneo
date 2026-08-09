import "@testing-library/jest-dom/vitest";

/**
 * jsdom implements neither of these, and both are used by components we render
 * in tests — `input-otp` observes its own size, and Base UI's overlays match
 * media queries on mount. Stubbing them here rather than mocking the components
 * keeps the tests exercising the real thing.
 */
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
