import z from '@deepseek-ai/schemastery';
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic';
import { proSummarize, resolveProConfig } from './summarize.js';
const num = z.number();
const str = z.string();
const modelPolicy = z.object({
    provider: z.string().required(),
    model: z.string().required(),
    thresholdRatio: num,
    retainRatio: num,
    retainTokens: z.number().step(1).min(0),
    summarizationProvider: str,
    summarizationModel: str,
    maxTokens: z.number().step(1).min(1),
    compactionRetries: z.number().step(1).min(0),
    maxOverflowRetries: z.number().step(1).min(0),
});
const BASE_KEYS = [
    'thresholdRatio', 'retainRatio', 'retainTokens', 'summarizationProvider',
    'summarizationModel', 'maxTokens', 'compactionRetries', 'maxOverflowRetries',
    'modelPolicies', 'auto',
];
export class ProCompactionEngine extends BasicCompactionEngine {
    // 修复 1：去掉 as const 以兼容可变数组类型
    static inject = ['llm', 'tokenMeter', 'sessions'];
    // 修复 2：加上 any 断言，绕过底层包 cosmokit 的路径推断问题
    static Config = z.object({
        thresholdRatio: num,
        retainRatio: num,
        retainTokens: z.number().step(1).min(0),
        summarizationProvider: str,
        summarizationModel: str,
        maxTokens: z.number().step(1).min(1),
        compactionRetries: z.number().step(1).min(0),
        maxOverflowRetries: z.number().step(1).min(0),
        modelPolicies: z.array(modelPolicy),
        auto: z.boolean(),
        // --- dsh-compaction-pro additions ---
        summaryLanguage: z.string(),
        faithful: z.boolean(),
        recursive: z.boolean(),
        chunkMessages: z.number().step(1).min(1),
        customInstruction: z.string(),
    });
    proConfig;
    constructor(ctx, config = {}) {
        const cfg = config;
        const base = {};
        for (const k of BASE_KEYS)
            if (k in cfg)
                base[k] = cfg[k];
        super(ctx, base);
        this.proConfig = resolveProConfig(config);
    }
    async summarize(input, agent, signal) {
        const full = { ...this.config, ...this.proConfig };
        return proSummarize(this.ctx, full, input, agent, signal);
    }
}
export default ProCompactionEngine;
export const name = 'dsh-compaction-pro';
export function apply(ctx) {
    ctx.plugin(ProCompactionEngine);
    // 修复 3：入参应为 payload 对象，并去掉 async
    ctx.on('agent/created', (payload) => {
        void payload.agent;
    });
    const msg = '[dsh-compaction-pro] registered as the `ctx.compaction` provider. ' +
        'If dsh fails to start with a "service already provided" error, disable `compaction-basic` in cordis.patch.yml.';
    if (ctx.logger?.info)
        ctx.logger.info(msg);
    else
        console.log(msg);
}
