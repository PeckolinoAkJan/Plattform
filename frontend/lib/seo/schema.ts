export type RouteJsonLdInput = {
  title: string;
  description: string;
  path: string;
  section?: string;
  sectionPath?: string;
  type?: 'WebPage' | 'CollectionPage';
  breadcrumbs?: Array<{
    name: string;
    path: string;
  }>;
};

export type RouteJsonLdPayload = ReturnType<typeof buildRouteJsonLd>;

function normalizePath(path: string): string {
  if (!path) return '/';
  if (!path.startsWith('/')) return '/';
  return path;
}

function escapeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function getSiteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export function buildRouteJsonLd(input: RouteJsonLdInput): string {
  const baseUrl = getSiteBaseUrl();
  const canonical = normalizePath(input.path);
  const pathWithBase = `${baseUrl.replace(/\/$/, '')}${canonical}`;

  const section = input.section?.trim();
  const sectionPath = normalizePath(input.sectionPath || '/dashboard');
  const sectionCrumbName = section || 'Dashboard';

  const breadcrumbItems = input.breadcrumbs
    ? input.breadcrumbs
    : input.section
      ? [
          { name: 'Startseite', path: '/' },
          { name: sectionCrumbName, path: sectionPath },
          { name: input.title, path: canonical },
        ]
      : [
          { name: 'Startseite', path: '/' },
          { name: input.title, path: canonical },
        ];

  const canonicalBreadcrumb =
    canonical === '/dashboard'
      ? [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Startseite',
            item: baseUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Dashboard',
            item: `${baseUrl}/dashboard`,
          },
        ]
      : breadcrumbItems.map((entry, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: entry.name,
          item: `${baseUrl}${normalizePath(entry.path)}`,
        }));

  const payload = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'VTC Hub',
      url: baseUrl,
      logo: `${baseUrl}/vtc-hub-logo.png`,
      description: 'Premium Plattform für VTC-Live-Telemetrie, Fahrtenbuch und Team-Operations.',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@vtc-hub.local',
      },
      sameAs: [
        'https://twitter.com/vtchub',
        'https://discord.gg/vtchub',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': input.type ?? (input.section ? 'CollectionPage' : 'WebPage'),
      name: input.title,
      description: input.description,
      url: pathWithBase,
      inLanguage: 'de-DE',
      isPartOf: {
        '@type': 'WebSite',
        name: 'VTC Hub',
        url: `${baseUrl}/`,
      },
      image: `${baseUrl}/vtc-hub-hero.png`,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: canonicalBreadcrumb,
      },
    },
  ];

  return escapeForScript(payload);
}
