'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const loginSchema = z.object({
  username: z.email('Enter an email address'),
  password: z.string().min(1, 'Password is required'),
  twoFactorCode: z.string().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [needsCode, setNeedsCode] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    const result = await signIn('credentials', {
      ...data,
      redirect: false,
    })

    setIsLoading(false)

    if (result?.error === 'TwoFactorRequired') {
      setNeedsCode(true)
      toast.success('Check your email or server console for the login code')
      return
    }

    if (result?.error === 'EmailUsernameRequired') {
      toast.error('Use an email address as your username for 2FA')
      return
    }

    if (result?.error) {
      toast.error(needsCode ? 'Invalid two-factor code' : 'Invalid username or password')
      return
    }

    toast.success('Logged in successfully')
    router.refresh()
    router.push('/admin/movies')
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">TMDB Service</CardTitle>
            <CardDescription>Sign in to access the admin dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="email"
                    placeholder="Enter email"
                    autoComplete="username"
                    readOnly={needsCode}
                    {...register('username')}
                  />
                  {errors.username && (
                    <p className="text-sm text-destructive">{errors.username.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    autoComplete="current-password"
                    readOnly={needsCode}
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>
                {needsCode && (
                  <div className="grid gap-2">
                    <Label htmlFor="twoFactorCode">Two-factor code</Label>
                    <Input
                      id="twoFactorCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter 6-digit code"
                      {...register('twoFactorCode')}
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : needsCode ? 'Verify Code' : 'Sign In'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
