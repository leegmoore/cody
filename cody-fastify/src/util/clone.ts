export function cloneDeep<T>(value: T): T {
  return structuredClone(value);
}
