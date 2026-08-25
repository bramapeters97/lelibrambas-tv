import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const gatewayRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const committedTypesPath = path.join(gatewayRoot, 'worker-configuration.d.ts');
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'lelibrambas-worker-types-'));
const generatedTypesPath = path.join(temporaryDirectory, 'worker-configuration.d.ts');
const wranglerPath = path.join(gatewayRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function syntaxSignature(source) {
  const sourceFile = ts.createSourceFile(
    'worker-configuration.d.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  if (sourceFile.parseDiagnostics.length > 0) {
    throw new Error('Wrangler environment declarations contain invalid TypeScript syntax.');
  }

  const nodes = [];
  const visit = (node) => {
    let value = '';
    if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
      value = `:${node.text}`;
    }
    nodes.push(`${node.kind}${value}`);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return nodes.join('\n');
}

try {
  const result = spawnSync(
    process.execPath,
    [
      wranglerPath,
      'types',
      generatedTypesPath,
      '--env-interface',
      'Env',
      '--include-runtime',
      'false',
    ],
    { cwd: gatewayRoot, encoding: 'utf8' },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`Wrangler type generation exited with status ${result.status ?? 'unknown'}.`);
  }

  const committed = readFileSync(committedTypesPath, 'utf8');
  const generated = readFileSync(generatedTypesPath, 'utf8');

  if (syntaxSignature(committed) !== syntaxSignature(generated)) {
    throw new Error('worker-configuration.d.ts declarations differ from current Wrangler output.');
  }

  console.log('Wrangler environment declarations are current.');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
