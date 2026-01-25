import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('package configuration', () => {
  it('exposes required build scripts', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
    ) as { scripts?: Record<string, string> };

    expect(pkg.scripts?.dev).toBeTruthy();
    expect(pkg.scripts?.build).toBeTruthy();
    expect(pkg.scripts?.dist).toBeTruthy();
  });

  it('sets mandatory NSIS options', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
    ) as {
      build?: {
        nsis?: {
          oneClick?: boolean;
          allowElevation?: boolean;
          allowToChangeInstallationDirectory?: boolean;
          createDesktopShortcut?: boolean;
          createStartMenuShortcut?: boolean;
        };
      };
    };

    const nsis = pkg.build?.nsis;
    expect(nsis?.oneClick).toBe(false);
    expect(nsis?.allowElevation).toBe(true);
    expect(nsis?.allowToChangeInstallationDirectory).toBe(true);
    expect(nsis?.createDesktopShortcut).toBe(true);
    expect(nsis?.createStartMenuShortcut).toBe(true);
  });
});
