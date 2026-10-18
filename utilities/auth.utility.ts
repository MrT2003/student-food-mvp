

export const AuthUtilities = {
	// Use to validate token / api keys / session id 
	validateToken(value: unknown): value is string {
		return typeof value === 'string' && /^[\x21-\x7e]+$/.test(value);
	},

	// Use to validate ZaloId
	validateZaloID(value: unknown): value is string {
		return typeof value === 'string' && /^\d{1,64}$/.test(value);
	}
}
