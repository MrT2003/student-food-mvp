export function validateToken(value: unknown): value is string {
	return typeof value === 'string' && /^[\x21-\x7e]+$/.test(value);
}
