'use client'

import {createClient} from '@/lib/supabase/client'

// CLIENT SIDE RENDERING 
export default function GoogleLoginButton(){
	const handleLogin = async () =>{
		const supabase = createClient()
		await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/api/auth/google/callback&next=/`
			},
		})
	}
	return (
    <button
      onClick={handleLogin}
      className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 font-medium"
    >
      Đăng nhập bằng Google
    </button>
  )
}


