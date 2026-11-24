export interface SelectedOption {
	id: string;
	name?: string;
	additional_price?: number;
}

export interface SelectedGroup {
	group_id: string;
	group_name?: string;
	options: SelectedOption[]
}

export interface CompactSelectedGroup {
	group_id: string;
	options: { id: string }[];
}



export const CartUtilities = {
	// Helper function to format the selected option_groups and option_items 
	// belong to corresponding option_group that user has picked  
	formatSortSelectedOptions( rawGroups: SelectedGroup[]): CompactSelectedGroup[] {
		// If user does not choose any option then return immediately to save resource 
		if (!rawGroups || rawGroups.length === 0) return [];		
	// 1. Use [...rawGroups] to clone the array, avoid modifying the original array (mutation)
		return [...rawGroups]
			.sort((a, b) => a.group_id.localeCompare(b.group_id))
			.map((group) => ({
				group_id: group.group_id,
				// 2. Continue clone options array before applying sort
				options: [...group.options]
					.sort((a, b) => a.id.localeCompare(b.id))
					.map((opt) => ({
						id: opt.id,
					})),
			})); 
	},

	// Helper function to generate option to hash 
	generateHash(selectedGroups: SelectedGroup[]): string {
		if (!selectedGroups || selectedGroups.length === 0) {
			return '';
		}

		// 1. Gather all ID of all selected option items into a flat array
		const optionIds: string[] = selectedGroups.flatMap((group) =>
			group.options ? group.options.map((opt) => opt.id) : []
		);

		// 2. Remove empty or null ID value
		const validOptionIds = optionIds.filter(Boolean);

		// 3. Order ID in alphabetic to ensure the uniqueness (Deterministic)
		validOptionIds.sort();

		// 4. Nối các ID bằng ký tự phân cách '|'
		return validOptionIds.join('|');
	}

}

