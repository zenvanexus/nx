import {
  ModuleFederationConfig,
  NxModuleFederationConfigOverride,
} from '@nx/webpack/src/utils/module-federation';
import { getModuleFederationConfig } from './utils';

export async function withModuleFederationForSSR(
  options: ModuleFederationConfig,
  configOverride?: NxModuleFederationConfigOverride
) {
  if (global.NX_GRAPH_CREATION) {
    return (config) => config;
  }

  const { sharedLibraries, sharedDependencies, mappedRemotes } =
    await getModuleFederationConfig(options, {
      isServer: true,
    });

  return (config) => {
    config.target = 'async-node';
    config.output.uniqueName = options.name;
    config.optimization = {
      ...(config.optimization ?? {}),
      runtimeChunk: false,
    };

    config.plugins.push(
      new (require('@module-federation/enhanced').ModuleFederationPlugin)(
        {
          name: options.name,
          filename: 'remoteEntry.js',
          exposes: options.exposes,
          remotes: mappedRemotes,
          shared: {
            ...sharedDependencies,
          },
          /**
           * Apply user-defined config overrides
           */
          ...(configOverride ? configOverride : {}),
          runtimePlugins:
            process.env.NX_MF_DEV_REMOTES &&
            !options.disableNxRuntimeLibraryControlPlugin
              ? [
                  ...(configOverride?.runtimePlugins ?? []),
                  require.resolve(
                    '@nx/webpack/src/utils/module-federation/plugins/runtime-library-control.plugin.js'
                  ),
                ]
              : [
                  ...(configOverride?.runtimePlugins ?? []),
                  require.resolve('@module-federation/node/runtimePlugin'),
                ],
          virtualRuntimeEntry: true,
        },
        {}
      ),
      sharedLibraries.getReplacementPlugin()
    );

    // The env var is only set from the module-federation-dev-server
    // Attach the runtime plugin
    config.plugins.push(
      new (require('webpack').DefinePlugin)({
        'process.env.NX_MF_DEV_REMOTES': process.env.NX_MF_DEV_REMOTES,
      })
    );

    return config;
  };
}
