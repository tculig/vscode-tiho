const isCI =
  ['true', '1'].includes(String(process.env.CI).toLowerCase()) ||
  ['true', '1'].includes(String(process.env.GITHUB_ACTIONS).toLowerCase());

const isCISimplified = process.env.CI || process.env.GITHUB_ACTIONS;

export const testIfCI = (
  name: string,
  fn: Mocha.Func | Mocha.AsyncFunc,
): void => {
  (isCI ? test : test.skip)(name, fn);
};

export const suiteIfCI = (
  name: string,
  fn: (this: Mocha.Suite) => void,
): void => {
  (isCI ? suite : suite.skip)(name, fn);
};

export function testIfCIv2(
  testName: string,
  testFn: () => void | Promise<void>,
): void {
  isCISimplified ? test(testName, testFn) : test.skip(testName, testFn);
}
