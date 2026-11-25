# Menu validation upgrade

Apply only `supabase/migrations/202611070001_seller_menu_validation.sql` after the original `202611060001_seller_menu.sql` has been deployed. The upgrade replaces the existing function body; it does not replay table grants, change the signature, or rewrite existing items/slugs. Do not rerun the original CREATE FUNCTION script on an installed function.

The API keeps `error.code = VALIDATION_ERROR` and adds `error.issue = {field, reason}`. PostgreSQL sends this object in exception DETAIL, not in a concatenated MESSAGE. Old deployments without DETAIL still use the generic fallback. Frontend and API both use the shared validator; no Zod/Yup dependency is needed for this contract.

New item URLs use a Vietnamese name prefix plus the full UUID (e.g. `com-suon-bi-cha-<32 hex characters>`). Renaming a dish preserves its URL. Unicode normalization uses PostgreSQL built-ins and requires a UTF-8 database. The database remains the source of truth for slug and updated_at.

Toggle requests remain one boolean plus expected_updated_at through the existing API. Keep a single atomic RPC for the menu tree; separating database writes would weaken atomicity/OCC without reducing the current toggle payload.

Not deployed or runtime-tested as part of this change. Manual checks before deployment to production:

- Invalid name/category/description lengths, image URL, negative/excessive price and >2 decimals return a field-specific error; frontend validation sends no mutation request.
- Invalid group/option ID, duplicate ID/name, >20 groups, >50 options, active group without active options are rejected.
- Direct RPC call with scalar/null group or option returns VALIDATION_ERROR with DETAIL; no rows are changed.
- Create a Vietnamese-named dish: returned slug is readable and unique. Edit it: slug stays unchanged.
- Two editors using the same timestamp: the later save fails MENU_STALE; its payload does not overwrite the winner.
- Toggle and hide retain group/option IDs. Existing order snapshots remain unchanged.
- Unauthenticated callers and another restaurant's seller cannot mutate the item.
- Verify both the form's local validation and the API/RPC error path display the detailed message; price/text fields and option groups are highlighted.

Consistent locking reduces deadlock risk but is not a guarantee across all database writers, triggers, foreign keys and unique indexes. SECURITY DEFINER and revoked direct writes do not constitute a blanket security guarantee. Order history should render stored snapshots rather than rely on live option names/prices.
