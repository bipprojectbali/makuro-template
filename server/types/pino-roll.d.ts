// pino-roll v4 ships no types. Signature: one options object → SonicBoom-compatible stream.
declare module 'pino-roll' {
  export type PinoRollOptions = {
    /** Base path; a date/number suffix and the extension are appended per roll. */
    file: string;
    /** e.g. '10m', '1g' or bytes */
    size?: string | number;
    /** 'daily' | 'hourly' | interval in ms */
    frequency?: 'daily' | 'hourly' | number;
    extension?: string;
    limit?: { count?: number; removeOtherLogFiles?: boolean };
    symlink?: boolean;
    dateFormat?: string;
    /** Create the target directory when missing. */
    mkdir?: boolean;
  };
  export default function build(options: PinoRollOptions): Promise<NodeJS.WritableStream>;
}
