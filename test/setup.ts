// Mock localStorage globally for all tests before any modules are loaded
const noop = () => {};
const noopStorage = {
	getItem: noop,
	setItem: noop,
	removeItem: noop,
	clear: noop,
	key: noop,
	length: 0
};

Object.defineProperty(global, 'localStorage', {
	value: noopStorage,
	writable: true,
	configurable: true
});

Object.defineProperty(global, 'sessionStorage', {
	value: noopStorage,
	writable: true,
	configurable: true
});

export {};
