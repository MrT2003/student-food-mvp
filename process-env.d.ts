declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NEXT_PUBLIC_SUPBASE_URL: string;
			NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
			ZALO_SECRET_KEY: string;
			ZALO_APP_ID: string;
			NEXT_PUBLIC_ZALO_CALLBACK_URL_DEV: string;
			NEXT_PUBLIC_ZALO_CALLBACK_URL_PRODUCT: string;
			ZALO_CALLBACK_URL_DEV: string;
			ZALO_CALLBACK_URL_PRODUCT: string;
			SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET: string;
			SUPABASE_SERVICE_ROLE_KEY: string;
		}
	}
}

export {};
