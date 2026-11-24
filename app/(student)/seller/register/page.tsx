import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {SellerAccessServices,SellerAccessError} from "@/services/seller-access.service";
import SellerAccessProblem from "@/components/features/seller/SellerAccessProblem";
import SellerRegistrationGate from "@/components/features/seller/SellerRegistrationGate";
import SellerRegistrationView from "@/components/features/seller/SellerRegistrationView";
export default async function SellerRegistrationPage(){
  let access,code="";try{access=await SellerAccessServices.read(await createClient());}catch(e){code=e instanceof SellerAccessError?e.code:"ACCESS_READ_FAILED";}
  if(code==="UNAUTHORIZED")redirect("/auth/login?next=%2Fseller%2Fregister");
  if(access?.user.role==="seller"&&access.restaurant)redirect("/seller");
  if(access?.user.role==="student"&&!access.restaurant)return <SellerRegistrationGate><SellerRegistrationView/></SellerRegistrationGate>;
  return <SellerAccessProblem/>;
}
