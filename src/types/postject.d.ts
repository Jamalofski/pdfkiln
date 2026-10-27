declare module 'postject' {
  export function inject(file: string, name: string, data: Buffer, opts: { sentinelFuse: string; machoSegmentName?: string; overwrite?: boolean }): Promise<void>;
}
