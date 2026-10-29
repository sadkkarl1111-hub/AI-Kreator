const OBVIOUS_PASSWORD_PATTERNS = [
  /test/i,
  /haslo/i,
  /password/i,
  /admin/i,
  /qwerty/i,
  /1234/,
  /2024/,
  /2025/,
  /2026/,
];

export const PASSWORD_RULES = [
  { label: "minimum 6 znaków", test: (value: string) => value.length >= 6 },
  { label: "co najmniej 1 mała litera", test: (value: string) => /[a-z]/.test(value) },
  { label: "co najmniej 1 duża litera", test: (value: string) => /[A-Z]/.test(value) },
  { label: "co najmniej 1 cyfra", test: (value: string) => /\d/.test(value) },
  { label: "co najmniej 1 znak specjalny, np. # ! % @", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
  {
    label: "nie może być zbyt oczywiste, np. Test123#",
    test: (value: string) => !OBVIOUS_PASSWORD_PATTERNS.some((pattern) => pattern.test(value)),
  },
] as const;

export const getPasswordValidationError = (value: string): string => {
  if (value.length < 6) {
    return "Hasło musi mieć co najmniej 6 znaków.";
  }
  if (!/[a-z]/.test(value)) {
    return "Hasło musi zawierać co najmniej jedną małą literę.";
  }
  if (!/[A-Z]/.test(value)) {
    return "Hasło musi zawierać co najmniej jedną dużą literę.";
  }
  if (!/\d/.test(value)) {
    return "Hasło musi zawierać co najmniej jedną cyfrę.";
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return "Hasło musi zawierać co najmniej jeden znak specjalny.";
  }
  if (OBVIOUS_PASSWORD_PATTERNS.some((pattern) => pattern.test(value))) {
    return "Hasło jest zbyt oczywiste. Nie używaj słów typu test, hasło, admin ani prostych końcówek liczbowych.";
  }

  return "";
};

