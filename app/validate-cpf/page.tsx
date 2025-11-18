'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ValidateCpfPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('verificationSessionId') || searchParams.get('session_id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('Session ID não encontrado na URL');
      setLoading(false);
      return;
    }

    validateCpf();
  }, [sessionId]);

  const validateCpf = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/didit/validate-cpf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao validar CPF');
      }

      setValidationResult(data);

      if (data.isMatch) {
        // CPF válido - redirecionar para success após 1 segundo
        setTimeout(() => {
          router.push(`/verification-success?session_id=${sessionId}`);
        }, 1000);
      } else {
        // CPF não corresponde - mostrar erro
        setError('O CPF verificado não corresponde ao CPF cadastrado.');
      }
    } catch (err) {
      console.error('Error validating CPF:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao validar CPF');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Validando seus dados...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Aguarde enquanto verificamos seu CPF
          </p>
        </div>
      </div>
    );
  }

  // Sucesso - mostrar mensagem antes de redirecionar
  if (validationResult?.isMatch) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              CPF Validado!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Seu CPF foi verificado com sucesso. Redirecionando...
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
              <span>Aguarde um momento</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Erro - CPF não corresponde ou outro erro
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Validação Falhou
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {error || 'Não foi possível validar seu CPF'}
            </p>
          </div>

          {validationResult && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Detalhes:
              </p>
              <div className="text-sm text-red-700 dark:text-red-300 space-y-1">
                <p>CPF Cadastrado: {validationResult.userCpf}</p>
                <p>CPF Verificado: {validationResult.diditCpf}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              Voltar ao Início
            </button>
            
            <button
              onClick={() => validateCpf()}
              className="w-full py-3 px-6 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
            >
              Tentar Novamente
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Entre em contato com o suporte se o problema persistir
          </p>
        </div>
      </div>
    </div>
  );
}
