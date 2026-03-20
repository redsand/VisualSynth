/**
 * Verify arg counting and parent context detection.
 */
import { parse, generate } from '@shaderfrog/glsl-parser';
import { visit } from '@shaderfrog/glsl-parser/ast';
import type { AstNode, FunctionCallNode, DeclaratorListNode } from '@shaderfrog/glsl-parser/ast';

const src = `#version 300 es
precision highp float;
uniform sampler2D sampler_main;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec2 uv = vUv;
  vec3 ret = vec3(0.0);
  ret = texture(sampler_main, uv);
  ret = pow(ret, 2.0);
  ret = min(0.5, ret);
  int n = 3;
  for (int i = 0; i < n; i++) { ret += vec3(0.01); }
  fragColor = vec4(ret, 1.0);
}`;

const ast = parse(src, { stage: 'fragment', quiet: true });

// Check arg structure
visit(ast, {
  function_call: {
    enter: (p) => {
      const id = p.node.identifier;
      let name = '?';
      if (id.type === 'identifier') name = id.identifier;
      else if (id.type === 'type_specifier') {
        const spec = id.specifier;
        if (spec.type === 'keyword') name = spec.token;
      }
      const argTypes = p.node.args.map(a => a.type);
      console.log(`  ${name}(${argTypes.join(', ')})`);
    }
  }
});

// Check int_constant contexts
console.log('\nInt constants:');
visit(ast, {
  int_constant: {
    enter: (p) => {
      // Walk up to find declaration context
      let inIntDecl = false;
      let inForInit = false;
      let inArrayIdx = false;
      let ctx = p.parentPath;
      while (ctx) {
        if (ctx.node.type === 'declarator_list') {
          const decl = ctx.node as DeclaratorListNode;
          const typeSpec = decl.specified_type.specifier.specifier;
          if (typeSpec.type === 'keyword' && (typeSpec.token === 'int' || typeSpec.token.startsWith('ivec'))) {
            inIntDecl = true;
          }
        }
        if (ctx.node.type === 'for_statement') inForInit = true;
        if (ctx.node.type === 'array_specifier' || ctx.node.type === 'quantifier') inArrayIdx = true;
        ctx = ctx.parentPath;
      }
      console.log(`  "${p.node.token}" parent=${(p.parent as AstNode)?.type} inIntDecl=${inIntDecl} inForInit=${inForInit} inArrayIdx=${inArrayIdx}`);
    }
  }
});

// Check declarator_list types
console.log('\nDeclarations:');
visit(ast, {
  declarator_list: {
    enter: (p) => {
      const typeSpec = p.node.specified_type.specifier.specifier;
      const typeName = typeSpec.type === 'keyword' ? typeSpec.token : '?';
      const names = p.node.declarations.map(d => d.identifier.identifier);
      console.log(`  ${typeName} ${names.join(', ')}`);
    }
  }
});
