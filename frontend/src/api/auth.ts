import type { User } from '../types/user'
import { jsonBody, request } from './http'

interface UserResponse {
  user: User | null
}

export async function fetchCurrentUser(): Promise<User | null> {
  return (await request<UserResponse>('/auth/me')).user
}

export async function login(email: string, password: string): Promise<User> {
  const { user } = await request<UserResponse>('/auth/login', {
    method: 'POST',
    ...jsonBody({ email, password }),
  })
  return user!
}

export async function register(input: { email: string; name: string; password: string }) {
  const { user } = await request<UserResponse>('/auth/register', {
    method: 'POST',
    ...jsonBody(input),
  })
  return user!
}

export async function logout(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' })
}
