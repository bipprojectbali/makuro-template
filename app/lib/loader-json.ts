/**
 * Round-trip a server value through JSON so loader data has the same shape the
 * client gets from the REST API (Date → ISO string). Lets pages hand loader
 * output to react-query as `initialData` without a second type.
 */
export function toJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
