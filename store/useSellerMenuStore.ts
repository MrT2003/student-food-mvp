"use client";
import { create } from "zustand";
import { useAuthStore } from "@/store/useAuthStore";
import { validateMenu } from "@/lib/seller/menu-contract";
import type { MenuItem } from "@/types/restaurant.types";
import type { SellerMenuRow } from "@/lib/seller/menu";
const messages: Record<string,string> = {
  MENU_STALE: "Dữ liệu đã thay đổi. Hãy tải lại trang và đối chiếu trước khi lưu.",
  MENU_NAME_CONFLICT: "Tên nhóm/lựa chọn đã tồn tại, kể cả phần đang ẩn. Hãy sửa phần đã có hoặc dùng tên khác. Đổi chéo tên cần thực hiện từng lần với tên hợp lệ.",
  MENU_RPC_UNAVAILABLE: "Data API chưa tìm được RPC menu phù hợp. Cần kiểm tra triển khai, chữ ký/tham số và schema cache.",
  MENU_RPC_DEPENDENCY_FAILED: "DB báo thiếu hàm khi xử lý menu. Cần quản lý DB kiểm tra RPC và hàm phụ thuộc.",
  MENU_SLUG_CONFLICT: "Mã đường dẫn món bị trùng. Hãy đối chiếu danh sách trước khi tạo lại.",
  MENU_WRITE_CONFLICT: "Dữ liệu menu bị trùng hoặc xung đột. Hãy tải lại để đối chiếu.",
  MENU_FORBIDDEN: "Chỉ seller đang hoạt động sở hữu quán được quản lý thực đơn.",
  UNAUTHORIZED: "Vui lòng đăng nhập lại.", VALIDATION_ERROR: "Thông tin món hoặc topping không hợp lệ (tối đa 20 nhóm, 50 lựa chọn/nhóm; giá tối đa 10.000.000, hai chữ số thập phân).",
};
class MenuClientError extends Error { constructor(public code:string) { super(messages[code] ?? "Chưa xác định kết quả. Hãy tải lại danh sách để đối chiếu; không gửi lại thao tác tạo món khi chưa kiểm tra."); } }
function owner() { const u=useAuthStore.getState().user; if(u?.role!=="seller"||u.status!=="active")throw new MenuClientError("MENU_FORBIDDEN"); return u.id; }
function map(row: MenuItem & { option_groups?: SellerMenuRow["optionGroups"] }): SellerMenuRow {
  const {option_groups = [],...item}=row;
  return {item,optionGroups:option_groups,optionCount:option_groups.filter(g=>g.is_active).reduce((n,g)=>n+g.options.filter(o=>o.is_active).length,0)};
}
interface State {
  restaurantId:string|null; loading:boolean; error:string; busy:boolean; rows:SellerMenuRow[];
  setRows:(update:(rows:SellerMenuRow[])=>SellerMenuRow[])=>void;
  loadRestaurantMenu:(id:string)=>Promise<void>;
  saveMenuItem:(row:SellerMenuRow,update:boolean)=>Promise<void>;
  updateMenuItemFields:(id:string,fields:Partial<MenuItem>)=>Promise<void>;
  deleteMenuItem:(id:string)=>Promise<void>;
}
let revision=0; let readAbort:AbortController|null=null;
async function request(id:string,item:string|undefined,method:string,payload?:unknown,signal?:AbortSignal) {
  const actor=owner(), abort=new AbortController();
  const cancel=()=>abort.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  const timer=setTimeout(cancel,15000);
  try {
    const response=await fetch(`/api/seller/restaurants/${encodeURIComponent(id)}/menu${item?'/'+encodeURIComponent(item):''}`,{
      method,credentials:'same-origin',cache:'no-store',signal:abort.signal,
      ...(payload?{headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})});
    const data=await response.json().catch(()=>null);
    if(owner()!==actor)throw new MenuClientError('UNAUTHORIZED');
    if(!response.ok)throw new MenuClientError(data?.error?.code??'MENU_RESULT_UNKNOWN');
    if(method==='GET'?!Array.isArray(data?.items):!data?.item?.id)throw new MenuClientError('MENU_RESULT_UNKNOWN');
    return data;
  } catch(e) { if(e instanceof MenuClientError)throw e; throw new MenuClientError('MENU_RESULT_UNKNOWN'); }
  finally {clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
export const useSellerMenuStore=create<State>((set,get)=>({
  restaurantId:null,rows:[],loading:false,error:'',busy:false,
  setRows:update=>set(s=>({rows:update(s.rows)})),
  loadRestaurantMenu:async id=>{
    const run=++revision;readAbort?.abort();const abort=new AbortController();readAbort=abort;
    set(s=>({restaurantId:id,rows:s.restaurantId===id?s.rows:[],loading:true,error:''}));
    try {const data=await request(id,undefined,'GET',undefined,abort.signal);if(run===revision)set({rows:data.items.map(map)});}
    catch(e){if(run===revision)set({error:e instanceof Error?e.message:'Không tải được thực đơn.',
      ...(e instanceof MenuClientError && ['UNAUTHORIZED','MENU_FORBIDDEN'].includes(e.code) ? {rows:[]} : {})});}
    finally {if(run===revision)set({loading:false});}
  },
  saveMenuItem:async(row,update)=>{
    if(get().busy)throw new MenuClientError('MENU_BUSY');
    const id=get().restaurantId;if(!id||id!==row.item.restaurant_id)throw new MenuClientError('MENU_FORBIDDEN');
    const actor=owner(),run=revision;
    const {name,description,category,image_url,price,is_active,is_available}=row.item;
    const payload={name,description,category,image_url,price,is_active,is_available,
      groups:(row.optionGroups??[]).map(g=>({id:g.id,name:g.name,is_active:g.is_active,is_multiple:g.is_multiple,is_required:g.is_required,
        options:g.options.map(o=>({id:o.id,option_name:o.option_name,additional_price:o.additional_price,is_active:o.is_active}))})),
      ...(update?{expected_updated_at:row.item.updated_at}:{})};
    validateMenu(payload,update);set({busy:true,error:''});
    try {const data=await request(id,update?row.item.id:undefined,update?'PATCH':'POST',payload);
      if(run!==revision||owner()!==actor||get().restaurantId!==id)throw new MenuClientError('UNAUTHORIZED');
      // Authoritative RPC readback, not optimistic draft data. Keep timestamp precision.
      const saved=map(data.item);set(s=>({rows:[saved,...s.rows.filter(r=>r.item.id!==saved.item.id)]}));
    } finally {if(run===revision)set({busy:false});}
  },
  updateMenuItemFields:async(id,fields)=>{
    if(get().busy)throw new MenuClientError('MENU_BUSY');
    const row=get().rows.find(r=>r.item.id===id),rid=get().restaurantId;
    const keys=Object.keys(fields);if(!row||!rid||keys.length!==1||!['is_active','is_available'].includes(keys[0]))throw new MenuClientError('VALIDATION_ERROR');
    const payload={...fields,expected_updated_at:row.item.updated_at};validateMenu(payload,true);
    const run=revision;set({busy:true});
    try {const data=await request(rid,id,'PATCH',payload);if(run!==revision)throw new MenuClientError('UNAUTHORIZED');const saved=map(data.item);set(s=>({rows:s.rows.map(r=>r.item.id===id?saved:r)}));}
    finally {if(run===revision)set({busy:false});}
  },
  deleteMenuItem:async id=>{await get().updateMenuItemFields(id,{is_active:false});},
}));
// Auth changes invalidate cache synchronously; late reads/mutations cannot restore it.
useAuthStore.subscribe((next,previous)=>{
  const key=(u:typeof next.user)=>JSON.stringify([u?.id,u?.role,u?.status]);
  if(key(next.user)!==key(previous.user)) {revision++;readAbort?.abort();useSellerMenuStore.setState({restaurantId:null,rows:[],loading:false,busy:false,error:''});}
});
