declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NEXT_PUBLIC_SUPABASE_URL: string;
			NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
			ZALO_SECRET_KEY: string;
			ZALO_APP_ID: string;
			ZALO_CALLBACK_URL_DEV: string;
			ZALO_CALLBACK_URL_PRODUCT: string;
			SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET: string;
		}
	}
}

export {};
