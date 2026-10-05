import { validateToken } from '@/utilities/auth.utility';
import { isRecord } from '@/utilities/system.utility';
import * as crypto from 'crypto';
import 'server-only';


interface ZaloTokenReponse {
  access_token: string;
}

interface ZaloProfileResponse {
  id: string;
  name: string ;
  img_url: string;
}

interface FailureMsg {
  httpStatus?: number;
  zaloErrorCode?: number;
  field?: Record<string, string>;
  networkCode?: string;
}

type ZaloStage = 'token_exchange' | 'token_validation' | 'profile_request' | 'profile_validation'; 


class ZaloProviderError extends Error {}

function generateFailureReponse(stage: ZaloStage, kind: string, details?: FailureMsg): never {
  const failureMsg = JSON.stringify({ stage, kind, ...details })
  console.error('[services][zalo.service.ts] ', failureMsg)
  throw new ZaloProviderError('ZALO_PROVIDER_REQUEST_FAILED')
}

function getNetworkErrorCode(error: unknown): string {
  // Check whether error contain error.cause{} object
  // If not then return the error object instead
  const cause = isRecord(error) && isRecord(error.cause) ? error.cause : error;
  // Check if in the cause object contains the cause.code{} object
  // If not exist then return undefined
  const code = isRecord(cause) ? cause.code : undefined;
  // Validate code message, if it match any code in the array then return code 
  // else return UNKNOWN 
  return typeof code === 'string' && [
    'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'EACCES', 'EPERM',
    'UND_ERR_CONNECT_TIMEOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID',
  ].includes(code) ? code : 'UNKNOWN';
}

async function sendRequestToZalo(stage: ZaloStage, url: string, options: RequestInit): Promise<Record<string, unknown>> {
  // Send request 
  let response: Response | undefined
  try {
    response = await fetch(url, {
      ...options,
      cache: 'no-store',
      redirect: 'error',
      // Set request timeout = 10 second
      signal: AbortSignal.timeout(10000)
    })


    // fetch data
    const data = await response.json() 

    // If data is not object then immediately return error 
    if (!isRecord(data)) return generateFailureReponse(stage, 'invalid_json', {
      httpStatus: response.status
    })

    // Validate whether response contains error
    const rawCode = data.error; 

    // If there is error then try to extract error and assign to zaloErrorCode 
    const numericCode = typeof rawCode === 'number' ? rawCode : typeof rawCode === 'string' && /^-?\d{1,6}$/.test(rawCode) ? Number(rawCode) : undefined;
    const zaloErrorCode = Number.isSafeInteger(numericCode) && Math.abs(numericCode!) <= 99999 ? numericCode : undefined
    
    // If resposne is not ok then return include the zaloErrorCode to check which 
    // part cause error when send request to Zalo Server
    if (!response.ok) {
      return generateFailureReponse(stage, 'http_request', {
        httpStatus: response.status,
        zaloErrorCode: zaloErrorCode,
      })
    }

    if (rawCode !== undefined && rawCode !== null && rawCode !== 0 && rawCode !== '0') {
      return generateFailureReponse(stage, 'provider_error', {
        httpStatus: response.status,
        zaloErrorCode,
      });
    }

    return data



  } catch (error) {
    // Preserve already-classified failures instead of logging them again as network errors.
    if (error instanceof ZaloProviderError) throw error;
    if (error instanceof SyntaxError) {
      return generateFailureReponse(stage, 'invalid_json', {
        httpStatus: response?.status,
      });
    }
    // Defined timeout error name
    const timeoutErrors = ['TimeoutError', 'AbortError'];
    // Validate whether error is an object and error.name exists in timeoutErrors array 
    const timeout = isRecord(error) && timeoutErrors.includes(String(error.name));
    return generateFailureReponse(stage, timeout ? 'timeout' : 'network', {
      networkCode: getNetworkErrorCode(error)
    })
  }
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
    const appID = process.env.ZALO_APP_ID?.trim();
    const callbackVariable = process.env.NODE_ENV === 'production'
      ? 'ZALO_CALLBACK_URL_PRODUCT'
      : 'ZALO_CALLBACK_URL_DEV';
    const redirectUri = process.env.ZALO_CALLBACK_URL_DEV;

    if (!appID || !redirectUri) {
      throw new Error(`Missing Zalo configuration: ZALO_APP_ID or ${callbackVariable}`);
    }

    const callbackUrl = new URL(redirectUri);
    if (!['http:', 'https:'].includes(callbackUrl.protocol) ||
        callbackUrl.pathname !== '/api/auth/zalo/callback' ||
        callbackUrl.hash || callbackUrl.username || callbackUrl.password) {
      throw new Error(`Invalid ${callbackVariable}: expected an HTTP(S) URL ending in /api/auth/zalo/callback`);
    }
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
    // Validate whether app_id and secret_key already exist 
    const appID = process.env.ZALO_APP_ID;
    const secretKey = process.env.ZALO_SECRET_KEY;
    if (!appID || !secretKey) {
      const missingFields: Record<string, string> = {}

      if (!appID) {
        missingFields["ZALO_APP_ID"] = "Variable is missing or undefined in .env";
      }

      if (!secretKey) {
        missingFields["ZALO_SECRET_KEY"] = "Variable is missing or undefined in .env";
      }

      return generateFailureReponse('token_exchange', 'missing_configuration', {
        field: missingFields
      })
    }
    // Define url to send to Zalo Server for token extraction 
    const requestTokenURL = 'https://oauth.zaloapp.com/v4/access_token'
    // Define RequestInit 
    const requestInit: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key': secretKey
      },
      body: new URLSearchParams({
        code: code, 
        app_id: appID,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      })
    }
    // Start to send request to Zalo
    const response = await sendRequestToZalo('token_exchange', requestTokenURL, requestInit)
    // Validate return access_token 
    if (!validateToken(response.access_token)) {
      return generateFailureReponse('token_validation', 'invalid_field', {
        // No Http error at this time so the code is 200
        httpStatus: 200, 
        // Attach the format error message of access_token
        field: { "access_token": "Token shape is invalid or empty string" }
      });
    }

    return { access_token: response.access_token }
  },

  // Extract user profile from Zalo
  async getZaloProfile(access_token: string | undefined): Promise<ZaloProfileResponse> {
    const stage = 'profile_request'
    // Validate whether access_token is in correct format
    if (!validateToken(access_token)) {
      return generateFailureReponse('token_validation', 'invalid_field', {
        // Attach the format error message of access_token
        field: { "access_token": "Token shape is invalid or empty string" }
      });
    }
    const requestProfileUrl = 'https://graph.zalo.me/v2.0/me?fields=id,name,picture'
    const requestInit: RequestInit = {
      method: 'GET',
      headers: {
        "access_token": access_token
      }
    }
    const response = await sendRequestToZalo(stage, requestProfileUrl, requestInit)

    // Validate fields of resposne 
    if (typeof response.id !== 'string' || !response.id || /\s|[\x00-\x1f\x7f]/.test(response.id)) {
      return generateFailureReponse(stage, 'invalid_id_format', {
        httpStatus: 200, 
      })
    }

    if (typeof response.name !== 'string') {
      return generateFailureReponse(stage, 'invalid_name_format', {
        httpStatus: 200, 
      })
    }

    const imgData = isRecord(response.picture) && isRecord(response.picture.data) ? response.picture.data : null; 
    const imgUrl = typeof imgData?.url === "string" ? imgData.url.trim() : ''

    return { id: response.id, name: response.name, img_url: imgUrl }
  }
}
