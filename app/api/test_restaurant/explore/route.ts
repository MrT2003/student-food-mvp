import { RestaurantService } from "@/services/restaurant.service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	try{
		const data = await RestaurantService.listRestaurants(); 
		if(!data) throw Error("No restaurant data found !")
		return NextResponse.json({data}, {status: 200})
	}catch(error: any){
		return NextResponse.json({error: error.message || error}, {status: 500})
	}
}