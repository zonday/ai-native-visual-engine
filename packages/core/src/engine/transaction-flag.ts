export interface TransactionFlag {
  isActive(): boolean;
  setActive(v: boolean): void;
}

export function createTransactionFlag(): TransactionFlag {
  let active = false;
  return {
    isActive: () => active,
    setActive: (v: boolean) => {
      active = v;
    },
  };
}
