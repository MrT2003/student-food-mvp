export interface SelectedOption {
	id: string;
	name: string;
	additional_price: number;
}

export interface SelectedGroup {
	group_id: string;
	group_name: string;
	options: SelectedOption[]
}

export const CartUtilities = {
	// Helper function to format the selected option_groups and option_items 
	// belong to corresponding option_group that user has picked  
	formatSortSelectedOptions(rawGroups: SelectedGroup[]): SelectedGroup[] {
		// 1. Use [...rawGroups] to clone the array, avoid modifying the original array (mutation)
		return [...rawGroups]
			.sort((a, b) => a.group_id.localeCompare(b.group_id))
			.map((group) => ({
				group_id: group.group_id,
				group_name: group.group_name,
				// 2. Continue clone options array before applying sort
				options: [...group.options]
					.sort((a, b) => a.id.localeCompare(b.id))
					.map((opt) => ({
						id: opt.id,
						name: opt.name,
						additional_price: opt.additional_price,
					})),
			})); 
	},

	// Helper function to generate option to hash 
	generateHash(){
		
	}

}

