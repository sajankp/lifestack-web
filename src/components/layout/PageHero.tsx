import React from 'react';

type PageHeroProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
};

export const PageHero: React.FC<PageHeroProps> = ({ title, subtitle, actions, className }) => {
  const customClassName = className ? ` ${className}` : '';
  return (
    <header className={`mb-8${customClassName}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle ? <p className="mt-2 text-slate-400">{subtitle}</p> : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">{actions}</div>
        ) : null}
      </div>
    </header>
  );
};
