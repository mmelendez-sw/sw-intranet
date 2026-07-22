// Frontend-safe Power BI IDs only. Auth credentials live in server/.env.
export const powerbiConfig = {
  tenantId: '63fbe43e-8963-4cb6-8f87-2ecc3cd029b4',
  workspaceId: '113D281A-8FE0-4D14-829E-30BDE3A28F49',
  reportId: 'e091da31-91dd-42c2-9b17-099d2e07c492',
};

export const validatePowerbiConfig = () => {
  const requiredFields = ['tenantId', 'workspaceId', 'reportId'] as const;
  const missingFields = requiredFields.filter(
    (field) => !powerbiConfig[field] || powerbiConfig[field].includes('YOUR_')
  );

  if (missingFields.length > 0) {
    console.error('Missing Power BI config fields:', missingFields);
    return false;
  }

  return true;
};
