import { RestaurantService } from "@/services/restaurant.service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	// Static API route has no dynamic params; read the requested restaurant slug.
	const slug = request.nextUrl.searchParams.get("slugParam")?.trim();
	if (!slug) return NextResponse.json({error: "slugParam is required"}, {status: 400});
	try {
		const data = await RestaurantService.getRestaurantMenu(slug)
		if (!data) throw new Error("Cannot get menu of restaurant !")
		return NextResponse.json({data} , {status: 200});
	}catch{
		return NextResponse.json({error: "Cannot get menu of restaurant !"}, {status: 500})
	}
}
