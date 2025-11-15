module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	setupFiles: ["<rootDir>/test/setup.ts"],
	moduleDirectories: ['node_modules', 'src', 'test'],
	moduleNameMapper: {
		"obsidian": "<rootDir>/test/mocks/obsidian.ts"
	}
}
