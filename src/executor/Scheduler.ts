/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import { ExecutorService } from './ExecutorService';
import CplacePlugin from '../model/CplacePlugin';
import { JobDetails, JobTracker } from './JobTracker';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { FSWatcher } from 'chokidar';
import { cerr, csucc, debug, isDebugEnabled } from '../utils';
import { CompilationResult, ICompileRequest } from '../compiler/interfaces';
import Timeout = NodeJS.Timeout;
import { PluginDescriptor } from '../model/PluginDescriptor';

interface ISchedulingResult {
    scheduledPlugin?: string | null | undefined;
    backoff?: boolean;
}

export class Scheduler {
    private static readonly WATCH_PATTERNS = {
        ts: 'ts|htm?(l)',
        less: 'less',
        css: 'css',
        openAPIYaml: 'yaml',
        vendor: 'package-lock.json|index.ts',
    };

    private readonly tsJobs: JobTracker;
    private readonly lessJobs: JobTracker;
    private readonly openAPIYamlJobs: JobTracker;
    private readonly compressCssJobs: JobTracker;
    private readonly vendorJobs: JobTracker;
    private readonly combineJsJobs: JobTracker;

    private watchers = {
        ts: new Map<string, FSWatcher>(),
        less: new Map<string, FSWatcher>(),
        css: new Map<string, FSWatcher>(),
        openAPIYaml: new Map<string, FSWatcher>(),
        vendor: new Map<string, FSWatcher>(),
    };

    private completed = false;
    private finishedResolver?: () => void;
    private finishedRejecter?: (reason: any) => void;

    /**
     * Creates a new scheduler to run compilation jobs.
     *
     * @param executor The executor to run jobs
     * @param plugins All plugins that are currently in compilation scope
     * @param rootRepository The name of the repository the compilation is started from
     * @param mainRepoDir Path to the `main` repository
     * @param isProduction Whether to compile for production
     * @param noParents Whether to exclude parent repositories from compilation
     * @param watchFiles Whether to watch files for changes
     * @param updateDetails Details of a potentially available version update
     */
    constructor(
        private readonly executor: ExecutorService,
        private readonly plugins: Map<string, CplacePlugin>,
        private readonly rootRepository: string,
        private readonly mainRepoDir: string,
        private readonly isProduction: boolean,
        private readonly noParents: boolean,
        private readonly watchFiles: boolean,
        private readonly withYaml: boolean
    ) {
        this.vendorJobs = this.createVendorJobTracker();
        this.tsJobs = this.createTsJobTracker();
        this.lessJobs = this.createLessJobTracker();
        this.openAPIYamlJobs = this.createOpenAPIYamlJobTracker();
        this.compressCssJobs = this.createCompressCssJobTracker();
        this.combineJsJobs = this.createCombineJsJobTracker();
    }

    start(): Promise<void> {
        const p = new Promise<void>((resolve, reject) => {
            this.finishedResolver = resolve;
            this.finishedRejecter = reject;
            this.scheduleNext();
        });
        p.then(
            () => {
                this.cleanup();
            },
            () => {
                this.cleanup();
            }
        );
        return p;
    }

    public stop(): void {
        this.completed = true;
        this.cleanup();
    }

    private scheduleNext(): void {
        if (this.completed) {
            return;
        }

        // vendor compilation should be requested first
        const vendorSchedulingResult = this.getAndScheduleNextJob(
            this.vendorJobs,
            'vendor',
            'vendor'
        );
        if (vendorSchedulingResult.backoff) {
            return;
        }
        const nextVendorPlugin = vendorSchedulingResult.scheduledPlugin;

        const lessSchedulingResult = this.getAndScheduleNextJob(
            this.lessJobs,
            'less',
            'less'
        );
        if (lessSchedulingResult.backoff) {
            return;
        }
        const nextLessPlugin = lessSchedulingResult.scheduledPlugin;

        const openAPIYamlSchedulingResult = this.getAndScheduleNextJob(
            this.openAPIYamlJobs,
            'openAPIYaml',
            'openAPIYaml'
        );
        if (openAPIYamlSchedulingResult.backoff) {
            return;
        }
        const nextOpenAPIYamlPlugin =
            openAPIYamlSchedulingResult.scheduledPlugin;

        const compressCssSchedulingResult = this.getAndScheduleNextJob(
            this.compressCssJobs,
            'compressCss',
            'css'
        );
        if (compressCssSchedulingResult.backoff) {
            return;
        }
        const nextCompressCssPlugin =
            compressCssSchedulingResult.scheduledPlugin;

        const tsSchedulingResult = this.getAndScheduleNextJob(
            this.tsJobs,
            'ts',
            'ts'
        );
        if (tsSchedulingResult.backoff) {
            return;
        }

        const nextTsPlugin = tsSchedulingResult.scheduledPlugin;

        let nextCombineJsPlugin: string | null | undefined = null;
        if (this.isProduction) {
            const combineJsSchedulingResult = this.getAndScheduleNextJob(
                this.combineJsJobs,
                'combineJs',
                'combineJs'
            );
            if (combineJsSchedulingResult.backoff) {
                return;
            }
            nextCombineJsPlugin = combineJsSchedulingResult.scheduledPlugin;
        }

        if (
            nextTsPlugin === null &&
            nextLessPlugin === null &&
            nextCompressCssPlugin === null &&
            nextOpenAPIYamlPlugin === null &&
            nextVendorPlugin === null &&
            nextCombineJsPlugin === null
        ) {
            if (!this.watchFiles && !this.completed) {
                this.completed = true;
                this.finishedResolver && this.finishedResolver();
            } else if (this.watchFiles) {
                console.log();
                console.log(csucc`Compilation completed - watching files...`);
                console.log();
            }
        } else if (
            nextTsPlugin ||
            nextLessPlugin ||
            nextCompressCssPlugin ||
            nextOpenAPIYamlPlugin ||
            nextVendorPlugin ||
            nextCombineJsPlugin
        ) {
            if (this.executor.hasCapacity()) {
                this.scheduleNext();
            }
        }
    }

    private getAndScheduleNextJob(
        jobTracker: JobTracker,
        compileType:
            | 'ts'
            | 'less'
            | 'compressCss'
            | 'openAPIYaml'
            | 'vendor'
            | 'combineJs',
        watchType:
            | 'ts'
            | 'less'
            | 'css'
            | 'openAPIYaml'
            | 'vendor'
            | 'combineJs'
    ): ISchedulingResult {
        const nextPlugin = jobTracker.getNextKey();
        if (nextPlugin) {
            const plugin = this.getPlugin(nextPlugin);
            const compileRequest: ICompileRequest = {
                pluginName: plugin.pluginName,
                dependencyPaths: plugin.pluginDescriptor.dependencies.map(
                    (pluginDescriptor) =>
                        this.plugins.get(pluginDescriptor.name)!.pluginDir
                ),
                assetsPath: plugin.assetsDir,
                mainRepoDir: this.mainRepoDir,
                isProduction: this.isProduction,
                verbose: isDebugEnabled(),
            };
            compileRequest[compileType] = true;

            debug(
                `(Scheduler) scheduling ${compileType} compile step for ${plugin.pluginName}`
            );

            jobTracker.markProcessing(nextPlugin);
            this.executor.run(compileRequest, this.watchFiles).then(
                (result?: CompilationResult) => {
                    const compilationResultChanged =
                        result !== CompilationResult.UNCHANGED;
                    const firstCompletion = jobTracker.markCompleted(
                        nextPlugin,
                        compilationResultChanged
                    );
                    if (firstCompletion && this.watchFiles) {
                        this.registerWatch(nextPlugin, watchType);
                    }
                    this.scheduleNext();
                },
                (e) => {
                    const firstCompletion = jobTracker.markCompleted(
                        nextPlugin,
                        true
                    );
                    if (firstCompletion && this.watchFiles) {
                        this.registerWatch(nextPlugin, watchType);
                    }

                    // when watching we don't kill the compiler here but just continue
                    if (this.watchFiles) {
                        this.scheduleNext();
                        return;
                    }

                    this.completed = true;
                    this.finishedRejecter && this.finishedRejecter(e);
                }
            );

            if (!this.executor.hasCapacity()) {
                return { backoff: true };
            }
        }
        return {
            scheduledPlugin: nextPlugin,
        };
    }

    private cleanup(): void {
        this.watchers.ts.forEach((watcher) => {
            watcher.close();
        });
        this.watchers.less.forEach((watcher) => {
            watcher.close();
        });
        this.watchers.css.forEach((watcher) => {
            watcher.close();
        });
        this.watchers.openAPIYaml.forEach((watcher) => {
            watcher.close();
        });
        this.watchers.vendor.forEach((watcher) => {
            watcher.close();
        });
    }

    private createTsJobTracker(): JobTracker {
        const tsPlugins: CplacePlugin[] = [];
        this.plugins.forEach((plugin) => {
            if (
                plugin.hasTypeScriptAssets &&
                this.isInCompilationScope(plugin)
            ) {
                tsPlugins.push(plugin);
            }
        });

        const jobs: JobDetails[] = tsPlugins.map(
            (plugin) =>
                new JobDetails(
                    plugin.pluginName,
                    this.filterTypeScriptPlugins(
                        plugin.pluginDescriptor.dependencies
                    ),
                    this.filterTypeScriptPlugins(plugin.dependents),
                    [this.vendorJobs.isJobDone.bind(this.vendorJobs)]
                )
        );
        return new JobTracker(jobs);
    }

    private createLessJobTracker(): JobTracker {
        const lessPlugins: CplacePlugin[] = [];
        this.plugins.forEach((plugin) => {
            if (plugin.hasLessAssets && this.isInCompilationScope(plugin)) {
                lessPlugins.push(plugin);
            }
        });

        const jobs: JobDetails[] = lessPlugins.map(
            (plugin) =>
                new JobDetails(
                    plugin.pluginName,
                    this.filterLessPlugins(
                        plugin.pluginDescriptor.dependencies
                    ),
                    this.filterLessPlugins(plugin.dependents),
                    []
                )
        );
        return new JobTracker(jobs);
    }

    private createVendorJobTracker(): JobTracker {
        const vendorPlugins: CplacePlugin[] = [];
        this.plugins.forEach((plugin) => {
            if (plugin.hasVendors && this.isInCompilationScope(plugin)) {
                vendorPlugins.push(plugin);
            }
        });
        const jobs: JobDetails[] = vendorPlugins.map(
            (plugin) =>
                new JobDetails(
                    plugin.pluginName,
                    this.filterVendorPlugins(
                        plugin.pluginDescriptor.dependencies
                    ),
                    this.filterVendorPlugins(plugin.dependents),
                    []
                )
        );
        return new JobTracker(jobs);
    }

    private filterVendorPlugins(plugins: PluginDescriptor[]): string[] {
        return plugins
            .map((p) => this.getPlugin(p.name))
            .filter((p) => p.hasVendors && this.isInCompilationScope(p))
            .map((p) => p.pluginName);
    }

    private createCombineJsJobTracker(): JobTracker {
        const combineJsPlugins: CplacePlugin[] = [];
        this.plugins.forEach((plugin) => {
            if (plugin.hasCombineJs && this.isInCompilationScope(plugin)) {
                combineJsPlugins.push(plugin);
            }
        });
        const jobs: JobDetails[] = combineJsPlugins.map(
            (plugin) =>
                new JobDetails(
                    plugin.pluginName,
                    this.filterCombineJsPlugins(
                        plugin.pluginDescriptor.dependencies
                    ),
                    this.filterCombineJsPlugins(plugin.dependents),
                    [
                        this.vendorJobs.isJobDone.bind(this.vendorJobs),
                        this.tsJobs.isJobDone.bind(this.tsJobs),
                    ]
                )
        );
        return new JobTracker(jobs);
    }

    private createOpenAPIYamlJobTracker(): JobTracker {
        const openAPIYamlPlugins: CplacePlugin[] = [];
        this.plugins.forEach((plugin) => {
            if (
                plugin.hasOpenAPIYamlAssets &&
                this.isInCompilationScope(plugin) &&
                this.withYaml
            ) {
                openAPIYamlPlugins.push(plugin);
            }
        });
        const jobs: JobDetails[] = openAPIYamlPlugins.map(
            (plugin) =>
                new JobDetails(
                    plugin.pluginName,
                    this.filterOpenAPIYamlPlugins(
                        plugin.pluginDescriptor.dependencies
                    ),
                    this.filterOpenAPIYamlPlugins(plugin.dependents),
                    []
                )
        );
        return new JobTracker(jobs);
    }

    private createCompressCssJobTracker(): JobTracker {
        const compressPlugins: CplacePlugin[] = [];
        this.plugins.forEach((plugin) => {
            // if the plugin has vendors, the compress css task will also be called from the VendorCompiler
            // To prevent the task from running twice, skip compress css task if plugin has vendors.
            if (
                plugin.hasCompressCssAssets &&
                !plugin.hasVendors &&
                this.isInCompilationScope(plugin)
            ) {
                compressPlugins.push(plugin);
            }
        });

        const jobs: JobDetails[] = compressPlugins.map(
            (plugin) => new JobDetails(plugin.pluginName, [], [], [])
        );
        return new JobTracker(jobs);
    }

    private isInCompilationScope(plugin: CplacePlugin): boolean {
        // do not compile plugins which are used from the npm artifacts
        if (plugin.isArtifactPlugin) {
            return false;
        }

        return !this.noParents || plugin.repo === this.rootRepository;
    }

    private filterTypeScriptPlugins(plugins: PluginDescriptor[]): string[] {
        return plugins
            .map((p) => this.getPlugin(p.name))
            .filter(
                (p) => p.hasTypeScriptAssets && this.isInCompilationScope(p)
            )
            .map((p) => p.pluginName);
    }

    private filterLessPlugins(plugins: PluginDescriptor[]): string[] {
        return plugins
            .map((p) => this.getPlugin(p.name))
            .filter((p) => p.hasLessAssets && this.isInCompilationScope(p))
            .map((p) => p.pluginName);
    }

    private filterOpenAPIYamlPlugins(plugins: PluginDescriptor[]): string[] {
        return plugins
            .map((p) => this.getPlugin(p.name))
            .filter(
                (p) => p.hasOpenAPIYamlAssets && this.isInCompilationScope(p)
            )
            .map((p) => p.pluginName);
    }

    private filterCombineJsPlugins(plugins: PluginDescriptor[]): string[] {
        return plugins
            .map((p) => this.getPlugin(p.name))
            .filter((p) => p.hasCombineJs && this.isInCompilationScope(p))
            .map((p) => p.pluginName);
    }

    private registerWatch(
        pluginName: string,
        type: 'ts' | 'less' | 'css' | 'openAPIYaml' | 'vendor' | 'combineJs'
    ): void {
        if (!this.watchFiles) {
            return;
        }

        const plugin = this.getPlugin(pluginName);
        const pattern = Scheduler.WATCH_PATTERNS[type];
        let glob: any;

        let watchDir = path.join(plugin.assetsDir, type);
        let jobTracker;
        switch (type) {
            case 'ts':
                jobTracker = this.tsJobs;
                break;
            case 'less':
                jobTracker = this.lessJobs;
                break;
            case 'css':
                jobTracker = this.compressCssJobs;
                break;
            case 'openAPIYaml':
                watchDir = path.join(plugin.pluginDir, 'api');
                jobTracker = this.openAPIYamlJobs;
                break;
            case 'vendor':
                watchDir = path.join(plugin.pluginDir, 'assets');
                glob = Scheduler.convertToUnixPath(`${watchDir}/*(${pattern})`);
                jobTracker = this.vendorJobs;
                break;
            case 'combineJs':
                jobTracker = this.combineJsJobs;
                break;
        }

        if (!glob) {
            glob = Scheduler.convertToUnixPath(`${watchDir}/**/*.(${pattern})`);
        }

        const watcher = chokidar.watch(glob);
        this.watchers[type].set(pluginName, watcher);

        let ready = false;
        let debounce: Timeout;
        const handleEvent = () => {
            if (!ready) {
                return;
            }
            console.log('===> Recompiling', pluginName);
            debounce && clearTimeout(debounce);
            debounce = setTimeout(() => {
                jobTracker.markDirty(pluginName);
                this.scheduleNext();
            }, 500);
        };

        watcher
            .on('ready', () => (ready = true))
            .on('add', handleEvent)
            .on('change', handleEvent)
            .on('unlink', handleEvent)
            .on('unlinkDir', handleEvent)
            .on('error', (e) => {
                console.error(cerr`[${pluginName}] watcher failed: ${e}`);
                watcher.close();
            });
    }

    private getPlugin(pluginName: string): CplacePlugin {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw Error(`unknown plugin: ${plugin}`);
        }
        return plugin;
    }

    // code from some github project
    static convertToUnixPath(input) {
        const isExtendedLengthPath = /^\\\\\?\\/.test(input);
        const hasNonAscii = /[^\u0000-\u0080]+/.test(input);

        if (isExtendedLengthPath || hasNonAscii) {
            return input;
        }

        return input.replace(/\\/g, '/');
    }
}
