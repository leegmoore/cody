// Extend ImportMeta to include Bun-specific properties
declare global {
  interface ImportMeta {
    main?: boolean;
  }
}

export {};
