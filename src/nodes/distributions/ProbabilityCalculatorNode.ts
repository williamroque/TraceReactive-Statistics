import { BaseNode } from '@tracereactive/types';
import { DistributionsCategory } from '../../categories';
import * as aq from 'arquero';
import { jStat } from 'jstat';

type CalcFn = (v: number) => number | null;

function makeCalcFn(dist: string, calc: string, p1: number, p2: number): CalcFn {
    switch (dist) {
        case 'Normal':
            if (calc === 'PDF') return v => jStat.normal.pdf(v, p1, p2);
            if (calc === 'CDF') return v => jStat.normal.cdf(v, p1, p2);
            if (calc === 'Quantile') return v => jStat.normal.inv(v, p1, p2);
            break;
        case 'Uniform':
            if (calc === 'PDF') return v => jStat.uniform.pdf(v, p1, p2);
            if (calc === 'CDF') return v => jStat.uniform.cdf(v, p1, p2);
            if (calc === 'Quantile') return v => jStat.uniform.inv(v, p1, p2);
            break;
        case 'Poisson':
            if (calc === 'PDF') return v => jStat.poisson.pdf(Math.round(v), p1);
            if (calc === 'CDF') return v => jStat.poisson.cdf(Math.floor(v), p1);
            if (calc === 'Quantile') return v => jStat.poisson.inv(v, p1);
            break;
        case 'Exponential':
            if (calc === 'PDF') return v => v < 0 ? 0 : jStat.exponential.pdf(v, p1);
            if (calc === 'CDF') return v => v < 0 ? 0 : jStat.exponential.cdf(v, p1);
            if (calc === 'Quantile') return v => jStat.exponential.inv(v, p1);
            break;
        case 'Gamma':
            if (calc === 'PDF') return v => v < 0 ? 0 : jStat.gamma.pdf(v, p1, p2);
            if (calc === 'CDF') return v => v < 0 ? 0 : jStat.gamma.cdf(v, p1, p2);
            if (calc === 'Quantile') return v => jStat.gamma.inv(v, p1, p2);
            break;
        case 'Student-T':
            if (calc === 'PDF') return v => jStat.studentt.pdf(v, p1);
            if (calc === 'CDF') return v => jStat.studentt.cdf(v, p1);
            if (calc === 'Quantile') return v => jStat.studentt.inv(v, p1);
            break;
        case 'Chi-Squared':
            if (calc === 'PDF') return v => v < 0 ? 0 : jStat.chisquare.pdf(v, p1);
            if (calc === 'CDF') return v => v < 0 ? 0 : jStat.chisquare.cdf(v, p1);
            if (calc === 'Quantile') return v => jStat.chisquare.inv(v, p1);
            break;
        case 'F':
            if (calc === 'PDF') return v => v < 0 ? 0 : jStat.centralF.pdf(v, p1, p2);
            if (calc === 'CDF') return v => v < 0 ? 0 : jStat.centralF.cdf(v, p1, p2);
            if (calc === 'Quantile') return v => jStat.centralF.inv(v, p1, p2);
            break;
    }
    return () => null;
}

// Parameter semantics per distribution:
//   Normal:      p1 = mean (μ),   p2 = std (σ)
//   Uniform:     p1 = min,        p2 = max
//   Poisson:     p1 = lambda (λ)
//   Exponential: p1 = rate (1/mean)
//   Gamma:       p1 = shape (α),  p2 = scale (β)
//   Student-T:   p1 = df
//   Chi-Squared: p1 = df
//   F:           p1 = df1,        p2 = df2

export class ProbabilityCalculatorNode extends BaseNode {
    readonly category = DistributionsCategory;
    readonly typeId = 'stats:prob_calc';
    readonly displayName = 'Probability Calculator';
    readonly visible = true;

    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];

    readonly outputs = [
        { name: 'Result', outputType: 'core:dataframe' }
    ];

    readonly properties = [
        { name: 'distribution', label: 'Distribution', type: 'select' as const, options: [
            { label: 'Normal (μ, σ)', value: 'Normal' },
            { label: 'Uniform (min, max)', value: 'Uniform' },
            { label: 'Poisson (λ)', value: 'Poisson' },
            { label: 'Exponential (rate)', value: 'Exponential' },
            { label: 'Gamma (shape α, scale β)', value: 'Gamma' },
            { label: 'Student-T (df)', value: 'Student-T' },
            { label: 'Chi-Squared (df)', value: 'Chi-Squared' },
            { label: 'F (df1, df2)', value: 'F' }
        ], defaultValue: 'Normal' },
        { name: 'calculation', label: 'Calculation', type: 'select' as const, options: [
            { label: 'PDF / PMF', value: 'PDF' },
            { label: 'CDF', value: 'CDF' },
            { label: 'Quantile (Inverse CDF)', value: 'Quantile' }
        ], defaultValue: 'PDF' },
        { name: 'param1', label: 'Param 1 (μ / min / λ / rate / shape / df / df1)', type: 'number' as const, defaultValue: 0 },
        { name: 'param2', label: 'Param 2 (σ / max / scale / df2)', type: 'number' as const, defaultValue: 1 },
        { name: 'valueOrCol', label: 'Value or Column Name', type: 'string' as const, defaultValue: '0' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }

        const table = inputs['Data'] as aq.internal.Table | undefined;
        const dist = properties['distribution'] as string;
        const calc = properties['calculation'] as string;
        const p1 = Number(properties['param1']) || 0;
        const p2 = Number(properties['param2']) || 1;
        const valueOrCol = String(properties['valueOrCol'] || '0');

        const fn = makeCalcFn(dist, calc, p1, p2);

        // Column mode — apply fn to every row
        if (table && typeof table.columnNames === 'function' && table.columnNames().includes(valueOrCol)) {
            const outCol = `${valueOrCol}_${calc.toLowerCase()}`;
            const values = Array.from(table.array(valueOrCol) as Iterable<number>).map(v => {
                if (typeof v !== 'number' || isNaN(v)) return null;
                try { return fn(v); } catch { return null; }
            });
            return { Result: table.assign({ [outCol]: values }) };
        }

        // Scalar mode
        const v = Number(valueOrCol);
        if (isNaN(v)) return { Result: aq.table({}) };
        let ans: number | null = null;
        try { ans = fn(v); } catch {}
        return { Result: aq.from([{ distribution: dist, calculation: calc, input: v, result: ans }]) };
    }
}
