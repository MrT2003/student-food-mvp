import { RestaurantService } from "@/services/restaurant.service";
import { useParams } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const {slugParam} = useParams()
	const slug = slugParam?.toString() as string
	try {
		const data = RestaurantService.getRestaurantMenu(slug)
		if (!data) throw new Error("Cannot get menu of restaurant !")
		return NextResponse.json({data} , {status: 200});
	}catch(error: any){
		return NextResponse.json({error: error.message || error}, {status: 500})
	}
}