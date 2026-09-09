// Sharing publishes chosen content, never an account/profile or its authority.
const privateKeys = new Set(['user_id','userId','owner_id','ownerId','author_id','authorId','created_by','updated_by','reviewed_by','author_email','user_name','email','phone','password','token','access_token','refresh_token','profile','role','premium','tokenVersion','token_version']);
export function publicShareResource(value, depth = 0) {
  if (Array.isArray(value)) return value.map(item => publicShareResource(item, depth + 1));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>!privateKeys.has(key) && !(depth === 0 && key === 'author_name')).map(([key,item])=>[key,publicShareResource(item, depth + 1)]));
}
