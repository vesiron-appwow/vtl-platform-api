INSERT INTO apps_catalog (
  id,
  app_name,
  short_name,
  developer_id,
  category,
  description,
  short_description,
  app_url,
  icon_r2_key,
  screenshots_r2_keys,
  manifest_url,
  is_evosystem,
  is_featured,
  listing_status
) VALUES

(
  'appwow-demo-001',
  'LinxLocal Demo',
  'LinxLocal',
  NULL,
  'Discovery',
  'LinxLocal connects users with trusted local businesses instantly. Built as part of the VTL Evosystem.',
  'Local discovery made instant.',
  'https://example.com/linxlocal',
  'linxlocal-icon.png',
  '["linxlocal-1.png","linxlocal-2.png"]',
  'https://example.com/manifest.json',
  1,
  1,
  'verified'
),

(
  'appwow-demo-002',
  'TaskFlow Pro',
  'TaskFlow',
  NULL,
  'Productivity',
  'TaskFlow Pro is a third-party Instant Application designed to manage tasks across teams.',
  'Team task management.',
  'https://example.com/taskflow',
  NULL,
  NULL,
  NULL,
  0,
  1,
  'verified'
),

(
  'appwow-demo-003',
  'BudgetLite',
  NULL,
  NULL,
  'Finance',
  'BudgetLite helps individuals manage personal budgets without installing software.',
  'Simple personal budgeting.',
  'https://example.com/budgetlite',
  NULL,
  NULL,
  NULL,
  0,
  0,
  'verified'
);