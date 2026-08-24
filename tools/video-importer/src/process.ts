import { spawn } from 'node:child_process';

export interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ProcessRunner {
  run(executable: string, args: readonly string[], signal?: AbortSignal): Promise<ProcessResult>;
}

export class SpawnProcessRunner implements ProcessRunner {
  public run(
    executable: string,
    args: readonly string[],
    signal?: AbortSignal,
  ): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, [...args], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
      const abort = (): void => {
        child.kill('SIGTERM');
      };
      signal?.addEventListener('abort', abort, { once: true });
      child.once('error', reject);
      child.once('close', (code) => {
        signal?.removeEventListener('abort', abort);
        resolve({
          exitCode: code ?? 1,
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
        });
      });
    });
  }
}

export async function detectToolVersion(
  runner: ProcessRunner,
  executable: string,
  args: readonly string[],
): Promise<string | null> {
  try {
    const result = await runner.run(executable, args);
    if (result.exitCode !== 0) return null;
    return `${result.stdout}\n${result.stderr}`.trim().split(/\r?\n/u)[0] ?? null;
  } catch {
    return null;
  }
}
