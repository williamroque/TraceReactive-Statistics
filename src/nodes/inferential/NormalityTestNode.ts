import { BaseNode } from '@tracereactive/types';
import { InferentialCategory } from '../../categories';
import * as aq from 'arquero';
import { jStat } from 'jstat';

// Kolmogorov distribution CDF for the two-sided KS statistic.
// Uses the alternating series approximation (converges quickly for t > 0.2).
function kolmogorovPValue(D: number, n: number): number {
    // Adjustment factor accounts for estimated parameters (conservative Lilliefors approximation)
    const t = (Math.sqrt(n) - 0.01 + 0.85 / Math.sqrt(n)) * D;
    let sum = 0;
    for (let k = 1; k <= 200; k++) {
        const term = Math.pow(-1, k - 1) * Math.exp(-2 * k * k * t * t);
        sum += term;
        if (Math.abs(term) < 1e-12) break;
    }
    return Math.min(1, Math.max(0, 2 * sum));
}

export class NormalityTestNode extends BaseNode {
    readonly category = InferentialCategory;
    readonly typeId = 'stats:normality';
    readonly displayName = 'Normality Test';
    readonly visible = true;

    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];

    readonly outputs = [
        { name: 'Summary', outputType: 'core:dataframe' },
        { name: 'Statistic', outputType: 'core:number' },
        { name: 'P-Value', outputType: 'core:number' }
    ];

    readonly properties = [
        { name: 'column', label: 'Column', type: 'string' as const, defaultValue: '' },
        { name: 'method', label: 'Method', type: 'select' as const, options: [
            { label: 'Jarque-Bera', value: 'jarque-bera' },
            { label: 'Kolmogorov-Smirnov', value: 'ks' }
        ], defaultValue: 'jarque-bera' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const col = properties['column'] as string;
        if (!col || !table.columnNames().includes(col)) return {};

        const data = Array.from(table.array(col) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
        const n = data.length;
        const method = properties['method'] as string;

        // ── Jarque-Bera ─────────────────────────────────────────────────
        if (method === 'jarque-bera') {
            if (n < 8) return {}; // JB is asymptotic; unreliable below n=8

            const skew = jStat.skewness(data);
            const kurt = jStat.kurtosis(data); // excess kurtosis from jStat

            // Standard JB statistic; chi-squared(2) approximation is asymptotic
            const jb = (n / 6) * (skew * skew + 0.25 * kurt * kurt);
            const pValue = 1 - jStat.chisquare.cdf(jb, 2);

            return {
                Summary: aq.from([{ Test: 'Jarque-Bera', Statistic: jb, 'P-Value': pValue, n }]),
                Statistic: jb,
                'P-Value': pValue
            };
        }

        // ── Kolmogorov-Smirnov vs Normal ─────────────────────────────────
        if (method === 'ks') {
            if (n < 5) return {};

            const mean = jStat.mean(data);
            const std = jStat.stdev(data, true); // sample std dev
            if (std === 0) return {};

            const sorted = [...data].sort((a, b) => a - b);
            let D = 0;
            for (let i = 0; i < n; i++) {
                const z = (sorted[i] - mean) / std;
                const Fn = jStat.normal.cdf(z, 0, 1);
                // Both one-sided statistics for the two-sided D
                D = Math.max(D, Math.abs(Fn - i / n), Math.abs(Fn - (i + 1) / n));
            }

            // Note: since mean and std are estimated from data this is Lilliefors' test;
            // the p-value is conservative relative to true Lilliefors critical values.
            const pValue = kolmogorovPValue(D, n);

            return {
                Summary: aq.from([{ Test: 'Kolmogorov-Smirnov (vs Normal)', Statistic: D, 'P-Value': pValue, n }]),
                Statistic: D,
                'P-Value': pValue
            };
        }

        return {};
    }
}
