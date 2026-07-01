declare module "https://esm.sh/@supabase/supabase-js@2.49.0" {
  export function createClient(url: string, key: string, options?: unknown): any;
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
