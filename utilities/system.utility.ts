// Record<Key, Value> is used to check whether a key is a string 
// and value can be anything based on the input object 
export function isRecord(value: unknown):  value is Record< string, unknown> {
	return typeof value === 'object' && value != null && !Array.isArray(value)
}

