'use client';
export const dynamic = 'force-dynamic';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [accessCode, setAccessCode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const returnTo = params.get('returnTo') || '/tenant/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(accessCode, verifyCode);
      if (result.ok) {
        router.push(returnTo);
      } else {
        setError(result.error || 'Login failed. Check your access and verify codes.');
      }
    } catch {
      setError('Connection error. Is the VistA server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-2xl border-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Sign In</CardTitle>
        <CardDescription>
          Use your VistA access code and verify code to sign in.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="accessCode">Access Code</Label>
            <Input
              id="accessCode"
              type="text"
              autoComplete="username"
              placeholder="Enter your access code"
              value={accessCode}
              onChange={e => setAccessCode(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="verifyCode">Verify Code</Label>
            <Input
              id="verifyCode"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your verify code"
              value={verifyCode}
              onChange={e => setVerifyCode(e.target.value)}
              disabled={loading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3 pt-0">
          <Button type="submit" className="w-full" disabled={loading || !accessCode || !verifyCode}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </Button>
          {process.env.NODE_ENV !== 'production' && (
            <p className="text-xs text-muted-foreground text-center">
              Sandbox: Access <code className="bg-muted px-1 rounded">PRO1234</code> / Verify <code className="bg-muted px-1 rounded">PRO1234!!</code>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-vista-navy to-brand-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">VistA Evolved</h1>
          <p className="text-blue-200 text-sm mt-1">Site Administration Console</p>
        </div>
        <Suspense fallback={<div className="h-64 rounded-xl bg-white/10 animate-pulse" />}>
          <LoginForm />
        </Suspense>
        <p className="text-center text-xs text-blue-200/60">
          VistA Evolved Platform · Site Administration
        </p>
      </div>
    </div>
  );
}
