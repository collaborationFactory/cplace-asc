import { AbstractTSConfigGenerator } from './AbstractTSConfigGenerator';
import { CplaceArtifactBasedTSConfigGenerator } from './CplaceArtifactBasedTSConfigGenerator';
import CplacePlugin from './CplacePlugin';
import { CplaceTSConfigGenerator } from './CplaceTSConfigGenerator';
import { isArtifactsOnlyBuild } from './utils';

export class TsConfigGeneratorFactory {
    public static getTSConfigGeneratorInstance(
        plugin: CplacePlugin,
        dependencies: CplacePlugin[],
        localOnly: boolean,
        isProduction: boolean
    ): AbstractTSConfigGenerator {
        // check if parent repos, or artifact are used for assets compilation
        if (isArtifactsOnlyBuild()) {
            return new CplaceArtifactBasedTSConfigGenerator(
                plugin,
                dependencies,
                localOnly,
                isProduction
            );
        } else {
            return new CplaceTSConfigGenerator(
                plugin,
                dependencies,
                localOnly,
                isProduction
            );
        }
    }
}
