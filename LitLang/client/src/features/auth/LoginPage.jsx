import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './AuthContext';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setError('');
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch {
      setError(t('auth.loginError'));
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 ui-card p-6">
      <h1 className="text-2xl font-bold text-center text-slate-900 mb-6">{t('auth.login')}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.email')}</label>
          <input
            type="email"
            {...register('email')}
            className="ui-input"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.password')}</label>
          <input
            type="password"
            {...register('password')}
            className="ui-input"
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full ui-btn-primary"
        >
          {isSubmitting ? t('common.loading') : t('auth.login')}
        </button>
      </form>
      <p className="text-center mt-4 text-sm text-gray-600">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="text-primary-600 hover:text-primary-700">{t('auth.register')}</Link>
      </p>
    </div>
  );
}
