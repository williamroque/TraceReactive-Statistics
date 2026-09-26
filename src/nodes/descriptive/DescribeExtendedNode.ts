import { BaseNode } from '@tracereactive/types';
import { DescriptiveCategory } from '../../categories';
import * as aq from 'arquero';
import * as ss from 'simple-statistics';

export class DescribeExtendedNode extends BaseNode {
    readonly category = DescriptiveCategory;
    readonly typeId = 'stats:describe';
    readonly displayName = 'Describe (Extended)';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Summary', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'columns', label: 'Columns (csv)', type: 'text' as const, defaultValue: '' },
        { name: 'percentiles', label: 'Percentiles (csv)', type: 'text' as const, defaultValue: '25,50,75' },
        { name: 'confidenceLevel', label: 'Confidence Level (%)', type: 'number' as const, defaultValue: 95, min: 1, max: 99.9 }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        let cols = (properties['columns'] as string || '').split(',').map(c => c.trim()).filter(Boolean);
        if (cols.length === 0) {
            // Default to numeric columns
            cols = table.columnNames().filter(c => typeof table.get(c, 0) === 'number');
        }
        
        if (cols.length === 0) return { Summary: aq.table({}) };

        const pStrs = (properties['percentiles'] as string || '25,50,75').split(',').map(p => p.trim()).filter(Boolean);
        const pVals = pStrs.map(p => Number(p) / 100).filter(p => !isNaN(p) && p >= 0 && p <= 1);

        let cl = Number(properties['confidenceLevel']);
        if (isNaN(cl)) cl = 95;
        const alpha = 1 - (cl / 100);
        const p = 1 - alpha / 2;

        // Helper to approximate inverse t-distribution (Abramowitz & Stegun 26.7.5)
        const getTScore = (p: number, df: number): number => {
            const z = ss.probit(p);
            if (df <= 0) return z;
            if (df === 1) return Math.tan(Math.PI * (p - 0.5));
            if (df === 2) return (2 * p - 1) / Math.sqrt(2 * p * (1 - p));
            
            const z2 = z * z;
            const term1 = (z2 + 1) / 4;
            const term2 = (5 * z2 * z2 + 16 * z2 + 3) / 96;
            const term3 = (3 * z2 * z2 * z2 + 19 * z2 * z2 + 17 * z2 - 15) / 384;
            
            return z * (1 + term1 / df + term2 / (df * df) + term3 / (df * df * df));
        };

        const summaryRows: any[] = [];
        
        for (const col of cols) {
            const arr = Array.from(table.array(col) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
            if (arr.length === 0) continue;
            
            const n = arr.length;
            const mean = ss.mean(arr);
            const std = n > 1 ? ss.standardDeviation(arr) : 0;
            const sampleSd = n > 1 ? ss.sampleStandardDeviation(arr) : 0;
            const se = n > 1 ? sampleSd / Math.sqrt(n) : 0;
            
            let marginOfError = 0;
            if (n > 1) {
                try {
                    const tScore = getTScore(p, n - 1);
                    marginOfError = tScore * se;
                } catch (e) {
                    const zScore = ss.probit(p);
                    marginOfError = zScore * se;
                }
            }

            const row: any = {
                'Column': col,
                'Count': n,
                'Mean': mean,
                'Standard Deviation': std,
                'Variance': n > 1 ? ss.variance(arr) : 0,
                'Min': ss.min(arr),
                'Max': ss.max(arr),
                'Standard Error': se,
                'Margin of Error': marginOfError,
                'CI Lower': mean - marginOfError,
                'CI Upper': mean + marginOfError
            };
            
            for (let i = 0; i < pVals.length; i++) {
                row[`P${pStrs[i]}`] = ss.quantile(arr, pVals[i]);
            }
            
            summaryRows.push(row);
        }
        
        if (summaryRows.length === 0) return { Summary: aq.table({}) };

        return { Summary: aq.from(summaryRows) };
    }
}
