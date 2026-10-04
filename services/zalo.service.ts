import { supabase } from '@/lib/supabase';
import * as crypto from 'crypto';
import 'server-only';


interface ZaloTokenReponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string;
  error?: string
  message?: string
}

interface ZaloProfileResponse {
  id?: string;
  name?: string
  picture?: {
    data?: {
      url?: string
    }
  };
  error?: number;
  message?: string;
}

export const ZaloAuthService = {

  // generateCodeVerifier generate a code verifier with length of 43
  generateCodeVerifier(): string {
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const code_verifier_length: number = 43
    let result = '';
    // Apply crypto to create random code_verifier
    const randomBytes = crypto.randomBytes(code_verifier_length);
    for (let i = 0; i < code_verifier_length; i++) {
      result += validChars[randomBytes[i] % validChars.length]
    }
    console.log("code_verifier: ", result)
    return result
  },

  // generateCodeChallenge receive code_verifier and convert it 
  generateCodeChallenge(codeVerifier: string): string {
    return crypto 
      .createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  },

  // Generate Authorization URL 
  getAuthorizationUrl(codeChallenge: string, state: string): string {
    const appID = process.env.ZALO_APP_ID;
    const redirectUri = process.env.NEXT_PUBLIC_ZALO_CALLBACK_URL_DEV
    // Define available params in the url sent to user for account authorization 
    const params = new URLSearchParams({
      app_id: appID,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      state: state
    });
    return `https://oauth.zaloapp.com/v4/permission?${params.toString()}`
  },

  // Exchange Authorization Code for Access Token from API Zalo OAuth
  async getZaloAccessToken(code: string, codeVerifier: string): Promise<ZaloTokenReponse> {
    const response = await fetch('https://oauth.zaloapp.com/v4/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key': process.env.ZALO_SECRET_KEY || ''
      },
      body: new URLSearchParams({
        code: code, 
        app_id: process.env.ZALO_APP_ID || '',
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      })
    });
    const data: ZaloTokenReponse = await response.json()
    if (!data.access_token && !data.refresh_token) {
      throw new Error(`Zalo Token Error: ${data.message || `Failed to get Access Token `}`);
    }
    return data
  }
}