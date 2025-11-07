/**
 * Token data structures for authentication.
 *
 * Represents JWT token information and parsed claims.
 */

/**
 * Flat subset of useful claims in id_token from auth.json.
 */
export interface IdTokenInfo {
  /** User email address */
  email?: string
  /** ChatGPT subscription plan type (e.g., "free", "plus", "pro", "business") */
  chatgpt_plan_type?: string
  /** Organization/workspace identifier */
  chatgpt_account_id?: string
  /** Raw JWT string */
  raw_jwt: string
}

/**
 * Complete token data structure stored in auth.json.
 */
export interface TokenData {
  /** Parsed information from the ID token JWT */
  id_token: IdTokenInfo
  /** Access token (JWT) */
  access_token: string
  /** Refresh token for obtaining new access tokens */
  refresh_token: string
  /** Optional account identifier */
  account_id?: string
}

/**
 * Parse an ID token JWT to extract claims.
 *
 * @param idToken - The JWT string to parse
 * @returns Parsed token information
 * @throws {Error} If the token format is invalid
 */
export function parseIdToken(idToken: string): IdTokenInfo {
  // JWT format: header.payload.signature
  const parts = idToken.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid ID token format')
  }

  const [_header, payloadB64, _signature] = parts

  if (!payloadB64) {
    throw new Error('Invalid ID token format: missing payload')
  }

  try {
    // Decode base64url payload
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8')
    const claims = JSON.parse(payloadJson)

    // Extract auth claims from nested structure
    const authClaims = claims['https://api.openai.com/auth'] || {}

    return {
      email: claims.email,
      chatgpt_plan_type: authClaims.chatgpt_plan_type,
      chatgpt_account_id: authClaims.chatgpt_account_id,
      raw_jwt: idToken,
    }
  } catch (error) {
    throw new Error(`Failed to parse ID token: ${error}`)
  }
}
