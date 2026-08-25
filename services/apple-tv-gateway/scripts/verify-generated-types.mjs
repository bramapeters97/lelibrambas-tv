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

function environmentSignature(source) {
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

  const environmentInterface = sourceFile.statements.find(
    (statement) =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === '__BaseEnv_Env',
  );
  if (!environmentInterface) {
    throw new Error('Wrangler output does not declare __BaseEnv_Env.');
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
  visit(environmentInterface);
  return nodes;
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

  const committedSignature = environmentSignature(committed);
  const generatedSignature = environmentSignature(generated);
  const firstDifference = Math.max(committedSignature.length, generatedSignature.length)
    ? Array.from({ length: Math.max(committedSignature.length, generatedSignature.length) }).findIndex(
        (_, index) => committedSignature[index] !== generatedSignature[index],
      )
    : -1;

  if (firstDifference !== -1) {
    throw new Error(
      `worker-configuration.d.ts environment differs at node ${firstDifference}: ` +
        `committed=${committedSignature[firstDifference] ?? '<missing>'}, ` +
        `generated=${generatedSignature[firstDifference] ?? '<missing>'}.`,
    );
  }

  console.log('Wrangler environment declarations are current.');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
